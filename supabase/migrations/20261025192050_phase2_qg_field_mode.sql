-- Additive Phase 2. Requires the 17 installed security migrations. LOCAL CANDIDATE ONLY.
begin;

create or replace function public.sentinelle_agent_sites(p_site text default null) returns setof jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('firebase_id',s.firebase_id,'name',s.name,'address',s.address,'client_name',s.client_name,
 'active',s.active,'created_at',s.created_at,'updated_at',s.updated_at,'payload',
 (select coalesce(jsonb_object_agg(k,v),'{}') from jsonb_each(coalesce(s.payload,'{}')) j(k,v)
 where k=any(array['name','address','clientName','postalCode','city','instructions','contactName','contactPhone',
 'emergencyContact','whatsappQG','planningColor','gps','latitude','longitude','isActive'])))
 from public.sites s join public.profiles p on p.id=public.current_profile_id()
 where p.role in ('agent','admin','superviseur') and p.organization_id=s.organization_id and (p_site is null or s.firebase_id=p_site)
$$;

create or replace function public.sentinelle_agent_missions(p_mission text default null) returns setof jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select (to_jsonb(m)-'payload')||jsonb_build_object('payload',
 (select coalesce(jsonb_object_agg(k,v),'{}') from jsonb_each(coalesce(m.payload,'{}')) j(k,v) where k=any(array[
 'agentId','agentNom','siteId','siteNom','siteColor','status','scheduledStart','scheduledEnd','actualStart','actualEnd',
 'type','instructions','shiftId','planningMonth','publicationStatus','monthlyPlanning','planningRevision',
 'acknowledgedAt','acknowledgedBy','acknowledgedRevision','updatedAt','updatedBy','createdAt','createdBy',
 'reportsCount','roundsCount','incidentsCount','conformityScore','checkInPhotoAvailable','checkInPhotoUrl'])))
 from public.missions m join public.profiles p on p.id=public.current_profile_id()
 where p.role in ('agent','admin','superviseur') and p.organization_id=m.organization_id and m.firebase_agent_uid=p.external_uid
 and (p_mission is null or m.firebase_id=p_mission)
$$;

create or replace function public.sentinelle_get_handover(p_shift_id text, p_acknowledge boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $body$
declare actor public.profiles%rowtype; current_shift public.shifts%rowtype;
  previous_shift public.shifts%rowtype; entries jsonb; acknowledged boolean; instructions text;
begin
  select * into actor from public.profiles where id=public.current_profile_id();
  if actor.id is null or actor.role not in ('agent','admin','superviseur') then
    raise exception using errcode='42501', message='Agent actif requis';
  end if;
  -- FOR UPDATE serialise consultation/accuse avec cloture, et deux accuses.
  select * into current_shift from public.shifts
    where organization_id=actor.organization_id and firebase_id=p_shift_id
      and firebase_agent_uid=actor.external_uid and status='active'
      and server_completed_at is null for update;
  if current_shift.id is null then
    raise exception using errcode='42501', message='Poste personnel actif requis';
  end if;
  if current_shift.server_started_at is null then
    raise exception using errcode='55000', message='Ancien poste sans contexte de releve serveur';
  end if;
  if current_shift.handover_predecessor_id is null then
    return jsonb_build_object('previous',null,'acknowledged',false,'events','[]'::jsonb);
  end if;
  select * into previous_shift from public.shifts
    where id=current_shift.handover_predecessor_id and organization_id=actor.organization_id
      and firebase_site_id=current_shift.firebase_site_id and status='completed' for share;
  if previous_shift.id is null then
    raise exception using errcode='55000', message='Poste precedent indisponible';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.firebase_id,'category',r.category,'severity',r.severity,
    'message',r.message,'occurredAt',r.occurred_at) order by r.occurred_at,r.id),'[]'::jsonb)
    into entries from public.reports r
    where r.organization_id=actor.organization_id
      and r.firebase_shift_id=previous_shift.firebase_id
      and r.firebase_site_id=previous_shift.firebase_site_id
      and r.firebase_agent_uid=previous_shift.firebase_agent_uid;
  -- Consignes issues des objets QG du perimetre, pas de la copie fournie
  -- par le navigateur lors de la prise de poste.
  select coalesce(
    (select m.payload->>'instructions' from public.missions m
      where m.organization_id=actor.organization_id and m.firebase_id=previous_shift.firebase_mission_id
        and m.firebase_site_id=previous_shift.firebase_site_id),
    (select s.payload->>'instructions' from public.sites s
      where s.organization_id=actor.organization_id and s.firebase_id=previous_shift.firebase_site_id),
    '') into instructions;
  if p_acknowledge then
    insert into sentinelle_private.handover_acknowledgements(shift_id,predecessor_id,actor_auth_id)
      values(current_shift.id,previous_shift.id,auth.uid()) on conflict(shift_id) do nothing;
    update public.shifts set payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
      'handoverAcknowledged',true,'handoverFromShiftId',previous_shift.firebase_id,
      'handoverAcknowledgedAt',(select received_at from sentinelle_private.handover_acknowledgements
        where shift_id=current_shift.id)) where id=current_shift.id;
  end if;
  select exists(select 1 from sentinelle_private.handover_acknowledgements
    where shift_id=current_shift.id) into acknowledged;
  insert into sentinelle_private.operation_events
    (organization_id,actor_auth_id,entity,entity_id,operation,next_state)
    values(actor.organization_id,auth.uid(),'handover',current_shift.id,'READ',
      jsonb_build_object('predecessorId',previous_shift.id,'eventCount',jsonb_array_length(entries)));
  return jsonb_build_object('previous',jsonb_build_object('completedAt',previous_shift.completed_at),
    'instructions',instructions,
    'note',coalesce(previous_shift.payload->>'handoverNote',''),
    'acknowledged',acknowledged,'events',entries);
end
$body$;

create or replace function public.sentinelle_agent_update_mission(p_mission text,p_patch jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare p public.profiles; m public.missions; patch jsonb; source public.shifts;
begin
 select * into p from public.profiles where id=public.current_profile_id();
 if p.id is null or p.role not in ('agent','admin','superviseur') then raise exception 'Agent actif requis' using errcode='42501'; end if;
 if jsonb_typeof(p_patch) is distinct from 'object' or exists(select from jsonb_object_keys(p_patch) k where k<>all(array[
 'status','actualStart','actualEnd','shiftId','updatedAt','updatedBy','acknowledgedAt','acknowledgedBy','acknowledgedRevision',
 'reportsCount','roundsCount','incidentsCount','conformityScore'])) then
 raise exception 'Champs de mission interdits' using errcode='42501'; end if;
 select * into m from public.missions where organization_id=p.organization_id and firebase_agent_uid=p.external_uid and firebase_id=p_mission for update;
 if not found then raise exception 'Mission non personnelle' using errcode='42501'; end if;
 patch:=p_patch||jsonb_build_object('updatedBy',p.external_uid,'updatedAt',clock_timestamp());
 if p_patch ?| array['acknowledgedAt','acknowledgedBy','acknowledgedRevision'] then
 patch:=patch||jsonb_build_object('acknowledgedAt',clock_timestamp(),'acknowledgedBy',p.external_uid,
 'acknowledgedRevision',coalesce((m.payload->>'planningRevision')::integer,1));
 end if;
 if p_patch ?| array['status','actualStart','actualEnd','shiftId'] then
  select * into source from public.shifts where organization_id=p.organization_id
    and firebase_agent_uid=p.external_uid and firebase_mission_id=m.firebase_id
    and firebase_site_id=m.firebase_site_id and firebase_id=p_patch->>'shiftId' for share;
  if source.id is null then raise exception 'Poste personnel correspondant requis' using errcode='42501'; end if;
  patch:=patch||jsonb_build_object('status',source.status,'actualStart',source.started_at,'actualEnd',source.completed_at);
 end if;
 update public.missions set payload=coalesce(m.payload,'{}')||patch,
 status=case when patch?'status' then patch->>'status' else m.status end,
 actual_start=case when patch?'actualStart' then (patch->>'actualStart')::timestamptz else m.actual_start end,
 actual_end=case when patch?'actualEnd' then (patch->>'actualEnd')::timestamptz else m.actual_end end,
 updated_at=clock_timestamp() where id=m.id;
 -- Existing SP02 guard derives lifecycle from the real shift and rejects forged transitions.
 return jsonb_build_object('ok',true,'firebase_id',m.firebase_id);
end $$;


-- The display mode never changes a role or Auth identity. Only the caller's
-- own field operation can use this RPC; QG management routes remain unchanged.
create function public.sentinelle_field_shift(p_id text,p_patch jsonb,p_create boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a public.profiles; s public.shifts; site public.sites; m public.missions; stamp timestamptz; body jsonb;
begin
 select * into a from public.profiles where id=public.current_profile_id();
 if a.id is null or a.role not in ('admin','superviseur') or nullif(a.external_uid,'') is null then
  raise exception 'Compte QG actif requis' using errcode='42501'; end if;
 if p_id is null or length(p_id)>220 or jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'Operation invalide' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.organization_id::text||'/field/'||p_id,0));
 select * into s from public.shifts where organization_id=a.organization_id and firebase_id=p_id for update;
 if s.id is not null and s.firebase_agent_uid is distinct from a.external_uid then raise exception 'Poste non personnel' using errcode='42501'; end if;
 if p_patch ? 'agentId' and p_patch->>'agentId' is distinct from a.external_uid then raise exception 'Identite immuable' using errcode='42501'; end if;
 if p_create then
  if s.id is not null then return to_jsonb(s); end if;
  select * into site from public.sites where organization_id=a.organization_id and firebase_id=p_patch->>'siteId' for share;
  if site.id is null then raise exception 'Site hors organisation' using errcode='42501'; end if;
  if nullif(p_patch->>'missionId','') is not null then
   select * into m from public.missions where organization_id=a.organization_id and firebase_id=p_patch->>'missionId'
    and firebase_site_id=site.firebase_id and firebase_agent_uid=a.external_uid for share;
   if m.id is null then raise exception 'Mission non personnelle' using errcode='42501'; end if;
  end if;
  stamp:=clock_timestamp();
  body:=p_patch||jsonb_build_object('agentId',a.external_uid,'agentNom',concat_ws(' ',a.first_name,a.last_name),
   'createdBy',a.external_uid,'createdAt',stamp,'siteId',site.firebase_id,'siteNom',site.name,'missionId',m.firebase_id,
   'startTime',stamp,'completedAt',null,'status','active');
  insert into public.shifts(organization_id,firebase_id,firebase_agent_uid,firebase_site_id,firebase_mission_id,status,started_at,payload)
   values(a.organization_id,p_id,a.external_uid,site.firebase_id,m.firebase_id,'active',stamp,body) returning * into s;
 else
  if s.id is null then raise exception 'Poste personnel introuvable' using errcode='42501'; end if;
  if (p_patch ? 'siteId' and p_patch->>'siteId' is distinct from s.firebase_site_id)
   or (p_patch ? 'missionId' and nullif(p_patch->>'missionId','') is distinct from s.firebase_mission_id) then raise exception 'Association immuable' using errcode='42501'; end if;
  if s.status='completed' then return to_jsonb(s); end if;
  if p_patch ? 'status' and p_patch->>'status' not in ('active','completed') then raise exception 'Transition interdite' using errcode='42501'; end if;
  stamp:=case when p_patch->>'status'='completed' then clock_timestamp() else null end;
  body:=s.payload||p_patch||jsonb_build_object('agentId',a.external_uid,'createdBy',s.payload->>'createdBy',
   'createdAt',s.created_at,'siteId',s.firebase_site_id,'missionId',s.firebase_mission_id,'startTime',s.started_at,
   'completedAt',stamp,'status',case when stamp is null then 'active' else 'completed' end,'updatedBy',a.external_uid);
  update public.shifts set status=case when stamp is null then 'active' else 'completed' end,
   completed_at=stamp,payload=body,updated_at=clock_timestamp() where id=s.id returning * into s;
 end if;
 return to_jsonb(s);
end $$;
revoke all on function public.sentinelle_field_shift(text,jsonb,boolean) from public,anon;
grant execute on function public.sentinelle_field_shift(text,jsonb,boolean) to authenticated;
create policy phase2_qg_own_report_insert on public.reports for insert to authenticated with check(
 public.current_role() in ('admin','superviseur') and organization_id=public.current_organization_id()
 and firebase_agent_uid=public.current_profile_external_uid() and payload->>'isLocked'='true'
 and exists(select 1 from public.shifts s where s.organization_id=reports.organization_id
  and s.firebase_id=reports.firebase_shift_id and s.firebase_agent_uid=public.current_profile_external_uid()
  and s.firebase_site_id=reports.firebase_site_id and s.firebase_mission_id is not distinct from reports.firebase_mission_id));


create or replace function sentinelle_private.guard_report()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $body$
declare actor public.profiles%rowtype; parent public.shifts%rowtype;
begin
  if tg_op = 'INSERT' then new.server_received_at := clock_timestamp();
  else new.server_received_at := old.server_received_at; end if;
  if auth.uid() is null then return new; end if;
  select * into actor from public.profiles where id = public.current_profile_id();
  if actor.id is null then raise exception using errcode='42501', message='Profil actif requis'; end if;
  if actor.role <> 'agent' and not (tg_op='INSERT' and new.firebase_agent_uid=actor.external_uid) then return new; end if;
  if tg_op = 'UPDATE' then
    raise exception using errcode='42501', message='Evenement agent en lecture seule apres enregistrement';
  end if;
  select * into parent from public.shifts
    where organization_id = actor.organization_id and firebase_id = new.firebase_shift_id
      and firebase_agent_uid = actor.external_uid for share;
  if parent.id is null or new.organization_id is distinct from actor.organization_id
    or new.firebase_agent_uid is distinct from actor.external_uid
    or new.firebase_site_id is distinct from parent.firebase_site_id
    or new.firebase_mission_id is distinct from parent.firebase_mission_id then
    raise exception using errcode='42501', message='Evenement non associe au poste personnel';
  end if;
  -- Pas de condition active : conserve fin de service et reprises photo tardives.
  new.payload := coalesce(new.payload,'{}'::jsonb) || jsonb_build_object(
    'agentId',actor.external_uid,'siteId',parent.firebase_site_id,
    'shiftId',parent.firebase_id,'missionId',parent.firebase_mission_id,
    'createdBy',actor.external_uid,'isLocked',true);
  return new;
end
$body$;

create or replace function sentinelle_private.guard_qg_end_report()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $body$
declare actor public.profiles%rowtype; parent public.shifts%rowtype;
begin
  if auth.uid() is null then return new; end if;
  select * into actor from public.profiles where id=public.current_profile_id();
  if actor.role not in ('admin','superviseur') or actor.id is null then return new; end if;
  select * into parent from public.shifts
    where organization_id=actor.organization_id and firebase_id=new.firebase_shift_id for share;
  -- Field operation: same real author and own shift; guard_report validates all associations.
  if parent.firebase_agent_uid=actor.external_uid and new.firebase_agent_uid=actor.external_uid
    and coalesce(new.payload->>'qgClosedBy','')='' then return new; end if;
  if parent.id is null or new.organization_id is distinct from actor.organization_id
    or new.firebase_agent_uid is distinct from parent.firebase_agent_uid
    or new.firebase_site_id is distinct from parent.firebase_site_id
    or new.firebase_mission_id is distinct from parent.firebase_mission_id
    or new.payload->>'qgClosedBy' is distinct from actor.external_uid then
    raise exception using errcode='42501',message='Rapport QG sans poste et identite correspondants';
  end if;
  new.payload := coalesce(new.payload,'{}'::jsonb) || jsonb_build_object(
    'agentId',parent.firebase_agent_uid,'siteId',parent.firebase_site_id,
    'shiftId',parent.firebase_id,'missionId',parent.firebase_mission_id,
    'createdBy',actor.external_uid,'qgClosedBy',actor.external_uid);
  return new;
end
$body$;

commit;
