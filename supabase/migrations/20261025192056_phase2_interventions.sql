-- LOCAL CANDIDATE. Additive intervention module; shared document and delivery engine.
begin;
create table public.interventions (
 id uuid primary key default gen_random_uuid(),
 number bigint generated always as identity unique,
 organization_id uuid not null references public.organizations(id),
 client_id uuid not null references public.clients(id),
 site_id uuid not null references public.sites(id),
 mission_id uuid references public.missions(id),
 assigned_profile_id uuid not null references public.profiles(id),
 created_by uuid not null references public.profiles(id),
 created_auth_id uuid not null,
 request_fingerprint text not null,
 reason text not null check(length(reason) between 1 and 500),
 kind text not null check(length(kind) between 1 and 120),
 description text not null default '' check(length(description)<=8000),
 instructions text not null default '' check(length(instructions)<=8000),
 scheduled_at timestamptz,
 status text not null default 'planned' check(status in ('planned','active','completed')),
 created_at timestamptz not null default clock_timestamp(),
 started_at timestamptz,
 completed_at timestamptz,
 completed_by uuid references public.profiles(id),
 conclusion text not null default '' check(length(conclusion)<=8000),
 published boolean not null default false,
 document_id uuid references public.generated_documents(id),
 archive_state text not null default 'waiting' check(archive_state in ('waiting','uploading','failed','archived')),
 archive_error text,
 archive_token uuid,
 archive_until timestamptz,
 pdf_sha256 text,
 pdf_bytes bigint,
 updated_at timestamptz not null default clock_timestamp(),
 constraint intervention_dates check ((status='planned' and started_at is null and completed_at is null) or
  (status='active' and started_at is not null and completed_at is null) or
  (status='completed' and started_at is not null and completed_at>=started_at)),
 constraint intervention_publication check(not published or (status='completed' and archive_state='archived' and document_id is not null))
);
create index interventions_org_status on public.interventions(organization_id,status,created_at desc);
create index interventions_assignee on public.interventions(assigned_profile_id,created_at desc);
create table public.intervention_entries (
 id uuid primary key,
 intervention_id uuid not null references public.interventions(id),
 actor_id uuid not null references public.profiles(id),
 actor_auth_id uuid not null,
 received_at timestamptz not null default clock_timestamp(),
 kind text not null check(kind in ('observation','action')),
 message text not null check(length(message) between 1 and 8000),
 photo_path text,
 photo_state text not null default 'none' check(photo_state in ('none','pending','ready')),
 request_fingerprint text not null
);
create index intervention_entries_parent on public.intervention_entries(intervention_id,received_at);
alter table public.generated_documents add column intervention_id uuid references public.interventions(id);
create unique index generated_documents_one_intervention on public.generated_documents(intervention_id) where intervention_id is not null;
alter table public.interventions enable row level security;
alter table public.intervention_entries enable row level security;
revoke all on public.interventions,public.intervention_entries from public,anon,authenticated;
grant select on public.interventions,public.intervention_entries to authenticated;
grant all on public.interventions,public.intervention_entries to service_role;
create policy intervention_staff_read on public.interventions for select to authenticated using (
 organization_id=public.current_organization_id() and (public.current_role() in ('admin','superviseur') or
 (public.current_role()='agent' and assigned_profile_id=public.current_profile_id())));
-- Clients only get a bounded projection after publication, never raw private work notes.
create policy intervention_entries_staff_read on public.intervention_entries for select to authenticated using(
 exists(select 1 from public.interventions i where i.id=intervention_id));

create function public.sentinelle_intervention_options() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,
   'client_id',c.id,'client_name',c.name,'external_id',s.firebase_id) order by s.name)
   from public.sites s join public.clients c on c.id=s.client_id and c.organization_id=s.organization_id
   where s.organization_id=p.organization_id),'[]'::jsonb),
  'operators',case when p.role in ('admin','superviseur') then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',concat_ws(' ',a.first_name,a.last_name),'role',a.role))
   from public.profiles a where a.organization_id=p.organization_id and a.active and a.role in ('admin','superviseur','agent')),'[]')
   else jsonb_build_array(jsonb_build_object('id',p.id,'name',concat_ws(' ',p.first_name,p.last_name),'role',p.role)) end,
  'missions',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'site_id',s.id,'assigned_profile_id',a.id,
   'label',concat_ws(' · ',s.name,m.scheduled_start::text,m.status))) from public.missions m
   join public.sites s on s.organization_id=m.organization_id and s.firebase_id=m.firebase_site_id
   join public.profiles a on a.organization_id=m.organization_id and a.external_uid=m.firebase_agent_uid
   where m.organization_id=p.organization_id and (p.role in ('admin','superviseur') or a.id=p.id)),'[]'::jsonb))
 from public.profiles p where p.id=public.current_profile_id() and p.role in ('admin','superviseur','agent')
$$;

create function public.sentinelle_intervention_step(p_id uuid,p_action text,p_data jsonb default '{}'::jsonb,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a public.profiles; i public.interventions; s public.sites; assignee public.profiles;
 m public.missions; e public.intervention_entries; d public.generated_documents; path text;
 fingerprint text; stamp timestamptz; snapshot jsonb; token uuid; entry_count integer; object_size bigint;
begin
 select * into a from public.profiles where id=public.current_profile_id();
 if a.id is null or a.role not in ('agent','admin','superviseur') or auth.uid() is null then raise exception 'Profil actif requis' using errcode='42501'; end if;
 if p_id is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Operation invalide' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('intervention/'||p_id::text,0));
 select * into i from public.interventions where id=p_id for update;
 if i.id is not null and (i.organization_id<>a.organization_id or (a.role='agent' and i.assigned_profile_id<>a.id)) then
  raise exception 'Intervention non autorisee' using errcode='42501'; end if;
 if p_action='create' then
  fingerprint:=md5(p_data::text);
  if i.id is not null then
   if i.created_by<>a.id or i.request_fingerprint<>fingerprint then raise exception 'Identifiant deja utilise pour une autre operation' using errcode='23505'; end if;
   return to_jsonb(i);
  end if;
  select * into s from public.sites where id=(p_data->>'site_id')::uuid and organization_id=a.organization_id for share;
  if s.id is null or s.client_id is null or (p_data ? 'client_id' and (p_data->>'client_id')::uuid is distinct from s.client_id)
   or not exists(select 1 from public.clients c where c.id=s.client_id and c.organization_id=a.organization_id) then
   raise exception 'Client et site non autorises' using errcode='42501'; end if;
  select * into assignee from public.profiles where id=coalesce(nullif(p_data->>'assigned_profile_id','')::uuid,a.id)
   and organization_id=a.organization_id and active and role in ('agent','admin','superviseur') for share;
  if assignee.id is null or (a.role='agent' and assignee.id<>a.id) then raise exception 'Attribution interdite' using errcode='42501'; end if;
  if nullif(p_data->>'mission_id','') is not null then
   select * into m from public.missions where id=(p_data->>'mission_id')::uuid and organization_id=a.organization_id
    and firebase_site_id=s.firebase_id and firebase_agent_uid=assignee.external_uid for share;
   if m.id is null then raise exception 'Mission non associee' using errcode='42501'; end if;
  end if;
  insert into public.interventions(id,organization_id,client_id,site_id,mission_id,assigned_profile_id,created_by,created_auth_id,request_fingerprint,
   reason,kind,description,instructions,scheduled_at)
   values(p_id,a.organization_id,s.client_id,s.id,m.id,assignee.id,a.id,auth.uid(),fingerprint,btrim(p_data->>'reason'),btrim(p_data->>'kind'),
    coalesce(p_data->>'description',''),coalesce(p_data->>'instructions',''),nullif(p_data->>'scheduled_at','')::timestamptz) returning * into i;
 elsif i.id is null then raise exception 'Intervention introuvable' using errcode='42501';
 elsif p_action='assign' then
  if a.role not in ('admin','superviseur') or i.status<>'planned' then raise exception 'Attribution QG avant demarrage uniquement' using errcode='42501'; end if;
  select * into assignee from public.profiles where id=(p_data->>'assigned_profile_id')::uuid and organization_id=a.organization_id
   and active and role in ('agent','admin','superviseur') for share;
  if assignee.id is null or (i.mission_id is not null and not exists(select 1 from public.missions m
    where m.id=i.mission_id and m.firebase_agent_uid=assignee.external_uid and m.organization_id=a.organization_id)) then
   raise exception 'Intervenant incompatible' using errcode='42501'; end if;
  update public.interventions set assigned_profile_id=assignee.id,updated_at=clock_timestamp() where id=i.id returning * into i;
 elsif p_action='start' then
  if i.assigned_profile_id<>a.id then raise exception 'Seul l intervenant attribue peut demarrer' using errcode='42501'; end if;
  if i.status<>'planned' then return to_jsonb(i); end if;
  update public.interventions set status='active',started_at=clock_timestamp(),updated_at=clock_timestamp() where id=i.id returning * into i;
 elsif p_action='entry' then
  if i.assigned_profile_id<>a.id or p_request is null then raise exception 'Intervenant et identifiant requis' using errcode='42501'; end if;
  fingerprint:=md5(p_data::text);
  select * into e from public.intervention_entries where id=p_request;
  if e.id is not null then
   if e.intervention_id<>i.id or e.actor_id<>a.id or e.request_fingerprint<>fingerprint then raise exception 'Reprise incoherente' using errcode='23505'; end if;
   return jsonb_build_object('intervention',to_jsonb(i),'entry',to_jsonb(e));
  end if;
  if i.status<>'active' then raise exception 'Intervention active requise' using errcode='42501'; end if;
  path:=case when coalesce((p_data->>'photo')::boolean,false) then a.organization_id::text||'/'||public.sentinelle_media_owner_segment()||'/interventions/'||i.id::text||'/'||p_request::text||'.jpg' else null end;
  insert into public.intervention_entries(id,intervention_id,actor_id,actor_auth_id,kind,message,photo_path,photo_state,request_fingerprint)
   values(p_request,i.id,a.id,auth.uid(),p_data->>'kind',btrim(p_data->>'message'),path,case when path is null then 'none' else 'pending' end,fingerprint) returning * into e;
  return jsonb_build_object('intervention',to_jsonb(i),'entry',to_jsonb(e));
 elsif p_action='photo' then
  select * into e from public.intervention_entries where id=p_request and intervention_id=i.id and actor_id=a.id for update;
  if e.id is null or e.photo_path is null or i.archive_state in ('uploading','archived') then raise exception 'Photo non autorisee' using errcode='42501'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='report-photos' and o.name=e.photo_path
    and (o.metadata->>'size')::bigint between 1 and 10000000 and o.metadata->>'mimetype'='image/jpeg') then
   raise exception 'Photo non archivee' using errcode='55000'; end if;
  update public.intervention_entries set photo_state='ready' where id=e.id returning * into e;
  return jsonb_build_object('intervention',to_jsonb(i),'entry',to_jsonb(e));
 elsif p_action='complete' then
  if i.assigned_profile_id<>a.id then raise exception 'Seul l intervenant peut finaliser' using errcode='42501'; end if;
  if i.status='completed' then return to_jsonb(i); end if;
  if i.status<>'active' then raise exception 'Demarrage requis' using errcode='55000'; end if;
  update public.interventions set status='completed',completed_at=clock_timestamp(),completed_by=a.id,
   conclusion=coalesce(p_data->>'conclusion',''),updated_at=clock_timestamp() where id=i.id returning * into i;
 elsif p_action='archive_claim' then
  if i.status<>'completed' then raise exception 'Intervention terminee requise' using errcode='55000'; end if;
  if i.archive_state='archived' then return jsonb_build_object('state','archived','intervention',to_jsonb(i)); end if;
  if i.archive_until>clock_timestamp() then return jsonb_build_object('state','busy'); end if;
  if exists(select 1 from public.intervention_entries where intervention_id=i.id and photo_state='pending') then
   update public.interventions set archive_state='failed',archive_error='photo_pending' where id=i.id;
   return jsonb_build_object('state','photo_pending'); end if;
  select * into s from public.sites where id=i.site_id and organization_id=i.organization_id for share;
  if s.client_id is distinct from i.client_id then raise exception 'Association client modifiee : rapprochement QG requis' using errcode='42501'; end if;
  select * into d from public.generated_documents where id=i.document_id for update;
  if d.id is null then
   select jsonb_build_object('intervention',to_jsonb(i)-array['request_fingerprint','created_auth_id','archive_token'],
    'clientName',(select name from public.clients where id=i.client_id), 'siteNom',s.name,
    'agentNom',(select concat_ws(' ',first_name,last_name) from public.profiles where id=i.assigned_profile_id),
    'entries',coalesce(jsonb_agg(to_jsonb(x)-array['actor_auth_id','request_fingerprint'] order by x.received_at) filter(where x.id is not null),'[]'::jsonb))
    into snapshot from public.intervention_entries x where x.intervention_id=i.id;
   insert into public.generated_documents(id,organization_id,client_id,firebase_id,firebase_site_id,firebase_mission_id,type,title,row_count,
    storage_bucket,storage_path,payload,status,created_by_external_uid,delivery_status,intervention_id)
   values(i.id,i.organization_id,i.client_id,'intervention-'||i.id,s.firebase_id,
    (select firebase_id from public.missions where id=i.mission_id),'intervention','Bon d’intervention INT-'||to_char(i.created_at,'YYYY')||'-'||lpad(i.number::text,6,'0'),
    (select count(*) from public.intervention_entries where intervention_id=i.id),'main-courantes',
    i.organization_id::text||'/interventions/'||i.id::text||'/document.pdf',snapshot,'pending',a.external_uid,'pending',i.id) returning * into d;
  end if;
  token:=gen_random_uuid();
  update public.interventions set document_id=d.id,archive_state='uploading',archive_token=token,
   archive_until=clock_timestamp()+interval '5 minutes',archive_error=null where id=i.id returning * into i;
  return jsonb_build_object('state','claimed','token',token,'intervention',to_jsonb(i),'document',to_jsonb(d));
 elsif p_action in ('archive_digest','archive_confirm','archive_failed') then
  if p_action='archive_confirm' and i.archive_state='archived' and i.pdf_sha256=p_data->>'sha256' then return to_jsonb(i); end if;
  if i.archive_token is distinct from p_request or i.archive_until<=clock_timestamp() or i.archive_state<>'uploading' then
   raise exception 'Reservation documentaire expiree' using errcode='40001'; end if;
  select * into d from public.generated_documents where id=i.document_id for update;
  if p_action='archive_digest' then
   if coalesce(p_data->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce((p_data->>'bytes')::bigint,0) not between 100 and 50000000 then
    raise exception 'PDF invalide' using errcode='22023'; end if;
   if i.pdf_sha256 is not null and (i.pdf_sha256 is distinct from p_data->>'sha256' or i.pdf_bytes is distinct from (p_data->>'bytes')::bigint) then
    raise exception 'Version PDF deja reservee : aucun ecrasement' using errcode='23505'; end if;
   update public.interventions set pdf_sha256=p_data->>'sha256',pdf_bytes=(p_data->>'bytes')::bigint where id=i.id returning * into i;
  elsif p_action='archive_confirm' then
   select (o.metadata->>'size')::bigint into object_size from storage.objects o where o.bucket_id=d.storage_bucket and o.name=d.storage_path
    and o.metadata->>'mimetype'='application/pdf';
   if i.pdf_sha256 is null or i.pdf_sha256 is distinct from p_data->>'sha256' or object_size is distinct from i.pdf_bytes then
    raise exception 'Archivage non confirme' using errcode='55000'; end if;
   update public.interventions set archive_state='archived',published=true,archive_token=null,archive_until=null,archive_error=null where id=i.id returning * into i;
   update public.generated_documents set status='active',delivery_status='retry_pending',next_delivery_attempt_at=clock_timestamp(),updated_at=clock_timestamp() where id=d.id;
  else
   update public.interventions set archive_state='failed',archive_error='archive_failed',archive_token=null,archive_until=null where id=i.id returning * into i;
  end if;
 elsif p_action in ('withdraw','publish') then
  if a.role not in ('admin','superviseur') or i.archive_state<>'archived' then raise exception 'Publication QG non autorisee' using errcode='42501'; end if;
  update public.interventions set published=(p_action='publish'),updated_at=clock_timestamp() where id=i.id returning * into i;
  update public.generated_documents set status=case when i.published then 'active' else 'withdrawn' end,updated_at=clock_timestamp() where id=i.document_id;
  -- No reset of delivery state: re-publication never resends an accepted/uncertain email.
 else raise exception 'Action inconnue' using errcode='22023'; end if;
 insert into sentinelle_private.operation_events(organization_id,actor_auth_id,entity,entity_id,operation,next_state)
  values(a.organization_id,auth.uid(),'interventions',i.id,p_action,jsonb_build_object('status',i.status,'assignee',i.assigned_profile_id,'published',i.published,'archive',i.archive_state));
 return to_jsonb(i);
end $$;

-- Only the RPC may reserve/bind/publish intervention documents. Existing documents untouched.
create policy phase2_doc_insert on public.generated_documents as restrictive for insert to authenticated with check(intervention_id is null and type<>'intervention');
create policy phase2_doc_update on public.generated_documents as restrictive for update to authenticated using(intervention_id is null and type<>'intervention') with check(intervention_id is null and type<>'intervention');
create policy phase2_doc_delete on public.generated_documents as restrictive for delete to authenticated using(intervention_id is null and type<>'intervention');

create function public.sentinelle_intervention_document_readable(d public.generated_documents) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.interventions i join public.profiles p on p.id=public.current_profile_id()
 join public.sites s on s.id=i.site_id and s.organization_id=i.organization_id
 where i.id=d.intervention_id and i.document_id=d.id and d.type='intervention'
 and d.organization_id=i.organization_id and p.organization_id=i.organization_id and d.client_id=i.client_id
 and d.firebase_site_id=s.firebase_id and d.storage_bucket='main-courantes'
 and d.storage_path=i.organization_id::text||'/interventions/'||i.id::text||'/document.pdf'
 and (p.role in ('admin','superviseur') or (p.role='agent' and i.assigned_profile_id=p.id) or
 (p.role='client' and i.published and i.archive_state='archived' and d.status='active'
 and public.sentinelle_client_document_access(i.client_id,s.firebase_id))))
$$;
create policy phase2_intervention_docs_read on public.generated_documents for select to authenticated using(public.sentinelle_intervention_document_readable(generated_documents));

create function public.sentinelle_intervention_object(p_bucket text,p_name text,p_write boolean default false) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.interventions i join public.profiles p on p.id=public.current_profile_id()
 where p.organization_id=i.organization_id and (p.role in ('admin','superviseur') or (p.role='agent' and i.assigned_profile_id=p.id))
 and ((p_bucket='main-courantes' and p_name=i.organization_id::text||'/interventions/'||i.id::text||'/document.pdf'
   and i.document_id is not null and (not p_write or (i.archive_state='uploading' and i.archive_until>clock_timestamp() and i.pdf_sha256 is not null)))
  or (p_bucket='report-photos' and exists(select 1 from public.intervention_entries e where e.intervention_id=i.id and e.photo_path=p_name
   and (not p_write or (e.actor_id=p.id and e.photo_state='pending' and i.archive_state not in ('uploading','archived')))))))
$$;
create policy phase2_intervention_object_insert on storage.objects for insert to authenticated with check(public.sentinelle_intervention_object(bucket_id,name,true));
create policy phase2_intervention_object_read on storage.objects for select to authenticated using(public.sentinelle_intervention_object(bucket_id,name,false));
create policy phase2_intervention_object_gate_insert on storage.objects as restrictive for insert to authenticated with check(
 name !~ '/interventions/' or public.sentinelle_intervention_object(bucket_id,name,true));
create policy phase2_intervention_object_gate_read on storage.objects as restrictive for select to authenticated using(
 name !~ '/interventions/' or public.sentinelle_intervention_object(bucket_id,name,false) or
 (bucket_id='main-courantes' and exists(select 1 from public.generated_documents d where d.storage_bucket=objects.bucket_id and d.storage_path=objects.name)));
create policy phase2_intervention_object_no_update on storage.objects as restrictive for update to authenticated using(name !~ '/interventions/') with check(name !~ '/interventions/');
create policy phase2_intervention_object_no_delete on storage.objects as restrictive for delete to authenticated using(name !~ '/interventions/');

create function public.sentinelle_client_interventions() returns setof jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('id',i.id,'number','INT-'||to_char(i.created_at,'YYYY')||'-'||lpad(i.number::text,6,'0'),
 'reason',i.reason,'kind',i.kind,'site_name',s.name,'started_at',i.started_at,'completed_at',i.completed_at,'status',i.status,'document_id',d.id)
 from public.interventions i join public.sites s on s.id=i.site_id and s.organization_id=i.organization_id
 join public.generated_documents d on d.id=i.document_id and d.intervention_id=i.id
 where i.published and i.archive_state='archived' and d.status='active' and public.current_role()='client'
 and public.sentinelle_client_document_access(i.client_id,s.firebase_id) and public.sentinelle_intervention_document_readable(d)
 order by i.completed_at desc
$$;

revoke all on function public.sentinelle_intervention_options(),public.sentinelle_intervention_step(uuid,text,jsonb,uuid),
 public.sentinelle_intervention_document_readable(public.generated_documents),public.sentinelle_intervention_object(text,text,boolean),public.sentinelle_client_interventions() from public,anon;
grant execute on function public.sentinelle_intervention_options(),public.sentinelle_intervention_step(uuid,text,jsonb,uuid),
 public.sentinelle_intervention_document_readable(public.generated_documents),public.sentinelle_intervention_object(text,text,boolean),public.sentinelle_client_interventions() to authenticated;

create or replace function sentinelle_private.guard_document() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare actor public.profiles%rowtype; source public.shifts%rowtype; site public.sites%rowtype;
 expected text; placeholder text; transition boolean:=false; item public.interventions;
begin
 if new.type='intervention' or new.intervention_id is not null then
  select * into item from public.interventions where id=new.intervention_id;
  if item.id is null or new.id<>item.id or new.organization_id<>item.organization_id or new.client_id is distinct from item.client_id
   or new.firebase_id<>'intervention-'||item.id or new.storage_bucket<>'main-courantes'
   or new.storage_path<>item.organization_id::text||'/interventions/'||item.id::text||'/document.pdf'
   or not exists(select 1 from public.sites s where s.id=item.site_id and s.organization_id=item.organization_id and s.firebase_id=new.firebase_site_id)
   or new.firebase_mission_id is distinct from (select firebase_id from public.missions where id=item.mission_id) then
   raise exception 'Association intervention documentaire invalide' using errcode='42501'; end if;
  if tg_op='UPDATE' and (to_jsonb(new)-array['status','delivery_status','delivery_attempts','delivery_error','next_delivery_attempt_at','delivered_at','updated_at','delivery_lease','delivery_lease_until','delivery_actor','delivery_managed'])
   is distinct from (to_jsonb(old)-array['status','delivery_status','delivery_attempts','delivery_error','next_delivery_attempt_at','delivered_at','updated_at','delivery_lease','delivery_lease_until','delivery_actor','delivery_managed']) then
   raise exception 'Bon intervention immuable' using errcode='42501'; end if;
  return new;
 end if;
 -- Privileged backend delivery updates stay possible. They do not authorize browser access.
 if auth.uid() is null then return new; end if;
 select * into actor from public.profiles where id=public.current_profile_id();
 if actor.id is null or actor.role not in ('admin','superviseur','agent')
   or new.organization_id is distinct from actor.organization_id then
   raise exception using errcode='42501',message='Auteur documentaire non autorise'; end if;
 if tg_op='INSERT' and new.created_by_external_uid is distinct from actor.external_uid then
   raise exception using errcode='42501',message='Auteur serveur attendu'; end if;
 if new.storage_bucket is distinct from 'main-courantes' or new.storage_path is null
   or split_part(new.storage_path,'/',1)<>actor.organization_id::text
   or new.storage_path ~ '(^|/)\.{1,2}(/|$)' then
   raise exception using errcode='42501',message='Chemin documentaire invalide'; end if;
 -- Serialize concurrent attempts to bind the same object under two metadata IDs.
 perform pg_advisory_xact_lock(hashtextextended(new.storage_bucket||'/'||new.storage_path,0));
 if exists(select 1 from public.generated_documents d where d.storage_bucket=new.storage_bucket
   and d.storage_path=new.storage_path and d.id<>new.id) then
   raise exception using errcode='42501',message='Objet deja associe a un autre document'; end if;
 placeholder:=new.organization_id::text||'/v587-metadata/'||new.firebase_id||'.pdf';
 if tg_op='UPDATE' then
   transition:=old.storage_path=placeholder and new.storage_path<>placeholder and not exists(
     select 1 from storage.objects o where o.bucket_id=old.storage_bucket and o.name=old.storage_path);
   if row(new.id,new.organization_id,new.firebase_id,new.firebase_site_id,new.firebase_mission_id,new.client_id,new.created_by_external_uid,new.storage_bucket)
     is distinct from row(old.id,old.organization_id,old.firebase_id,old.firebase_site_id,old.firebase_mission_id,old.client_id,old.created_by_external_uid,old.storage_bucket)
     or (new.storage_path is distinct from old.storage_path and not transition) then
     raise exception using errcode='42501',message='Associations documentaires immuables'; end if;
 end if;
 if tg_op='UPDATE' and row(new.payload,new.type,new.title,new.row_count) is distinct from row(old.payload,old.type,old.title,old.row_count)
   and exists(select 1 from storage.objects o where o.bucket_id=old.storage_bucket and o.name=old.storage_path) then
   raise exception using errcode='42501',message='PDF archive : nouvelle version explicite requise'; end if;
 -- A QG can withdraw an unchanged historical association even after site archival.
 if tg_op='UPDATE' and actor.role in ('admin','superviseur') and not transition then return new; end if;
 if actor.role in ('admin','superviseur') and nullif(new.payload->'shift'->>'id','') is not null then
   select * into source from public.shifts where organization_id=actor.organization_id and firebase_id=new.payload->'shift'->>'id' for share;
   if source.id is null or source.firebase_site_id is distinct from new.firebase_site_id
     or source.firebase_mission_id is distinct from new.firebase_mission_id then
     raise exception using errcode='42501',message='Poste documentaire incoherent'; end if;
 end if;
 if new.firebase_site_id is not null then
   select * into site from public.sites where organization_id=actor.organization_id and firebase_id=new.firebase_site_id for share;
   if site.id is null then raise exception using errcode='42501',message='Site documentaire hors organisation'; end if;
   if tg_op='INSERT' then new.client_id:=site.client_id; end if;
 end if;
 if new.client_id is not null and not exists(select 1 from public.clients c where c.id=new.client_id and c.organization_id=actor.organization_id) then
   raise exception using errcode='42501',message='Client documentaire hors organisation'; end if;
 if actor.role='agent' then
   select * into source from public.shifts where organization_id=actor.organization_id
     and firebase_id=new.payload->'shift'->>'id' and firebase_agent_uid=actor.external_uid for share;
 end if;
 if new.firebase_mission_id is not null and not exists(select 1 from public.missions m where m.organization_id=actor.organization_id
   and m.firebase_id=new.firebase_mission_id and m.firebase_site_id is not distinct from new.firebase_site_id)
   and not (actor.role='agent' and source.id is not null
     and source.firebase_mission_id is null and new.firebase_mission_id=source.firebase_id
     and (tg_op='INSERT' or old.firebase_mission_id=new.firebase_mission_id)) then
   raise exception using errcode='42501',message='Mission documentaire incoherente'; end if;
 if actor.role='agent' then
   if new.created_by_external_uid is distinct from actor.external_uid or new.type is distinct from 'mission' then
     raise exception using errcode='42501',message='Rapport personnel requis'; end if;
   select * into source from public.shifts where organization_id=actor.organization_id
     and firebase_id=new.payload->'shift'->>'id' and firebase_agent_uid=actor.external_uid for share;
   if source.id is null or source.firebase_site_id is distinct from new.firebase_site_id
      or (source.firebase_mission_id is distinct from new.firebase_mission_id and not
       (source.firebase_mission_id is null and new.firebase_mission_id=source.firebase_id and (tg_op='INSERT' or old.firebase_mission_id=new.firebase_mission_id))) then
     raise exception using errcode='42501',message='Document sans poste personnel correspondant'; end if;
   if tg_op='UPDATE' and (new.status is distinct from old.status or new.payload->'shift'->>'id' is distinct from old.payload->'shift'->>'id') then
     raise exception using errcode='42501',message='Publication et rattachement reserves'; end if;
   if tg_op='INSERT' and new.status is distinct from 'active' then
     raise exception using errcode='42501',message='Publication automatique attendue'; end if;
   -- Fail closed for slug collisions; do not silently grant the other identity's folder.
   if (select count(*) from public.profiles p where p.organization_id=actor.organization_id
     and sentinelle_private.document_segment(p.external_uid)=sentinelle_private.document_segment(actor.external_uid))<>1 then
     raise exception using errcode='42501',message='Chemin auteur ambigu'; end if;
   expected:=actor.organization_id::text||'/'||sentinelle_private.document_segment(actor.external_uid)||'/'||
     sentinelle_private.document_segment(new.firebase_site_id)||'/'||sentinelle_private.document_segment(coalesce(new.firebase_mission_id,new.firebase_id))||'/';
   if new.storage_path<>placeholder and (left(new.storage_path,length(expected))<>expected
      or position('/' in substring(new.storage_path from length(expected)+1))>0
      or left(substring(new.storage_path from length(expected)+1),length(new.firebase_id)+1)<>new.firebase_id||'-'
      or right(new.storage_path,4)<>'.pdf') then
     raise exception using errcode='42501',message='Objet hors chemin du rapport personnel'; end if;
 end if;
 return new;
end $$;

create or replace function public.sentinelle_document_readable(p_doc public.generated_documents)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare d public.generated_documents%rowtype; p public.profiles%rowtype; source public.shifts%rowtype; expected text; bound boolean;
begin
 select * into p from public.profiles where id=public.current_profile_id();
 d:=p_doc;
 if d.type='intervention' or d.intervention_id is not null then return public.sentinelle_intervention_document_readable(d); end if;
 if p.id is null or d.id is null or d.organization_id is distinct from p.organization_id then return false; end if;
 if p.role in ('admin','superviseur') then return true; end if;
 expected:=d.organization_id::text||'/'||sentinelle_private.document_segment(d.created_by_external_uid)||'/'||
  sentinelle_private.document_segment(coalesce(d.firebase_site_id,'sans-site'))||'/'||
  sentinelle_private.document_segment(coalesce(d.firebase_mission_id,d.firebase_id))||'/';
 bound:=d.storage_bucket='main-courantes' and left(d.storage_path,length(expected))=expected
   and position('/' in substring(d.storage_path from length(expected)+1))=0
   and left(substring(d.storage_path from length(expected)+1),length(d.firebase_id)+1)=d.firebase_id||'-'
   and right(d.storage_path,4)='.pdf';
 if not coalesce(bound,false) then
   bound:=d.storage_bucket='main-courantes' and d.storage_path=d.organization_id::text||'/qg-closures/'||d.firebase_id||'.pdf'
    and exists(select 1 from sentinelle_private.qg_closures c join public.shifts sh on sh.id=c.shift_id
      where c.document_key=d.firebase_id and c.organization_id=d.organization_id and sh.firebase_site_id=d.firebase_site_id
        and sh.firebase_mission_id is not distinct from d.firebase_mission_id);
 end if;
 if p.role='agent' then
   select * into source from public.shifts where organization_id=p.organization_id and firebase_agent_uid=p.external_uid
     and firebase_id=d.payload->'shift'->>'id';
   return d.created_by_external_uid=p.external_uid and source.id is not null
     and source.firebase_site_id=d.firebase_site_id
     and (source.firebase_mission_id is not distinct from d.firebase_mission_id
       or (source.firebase_mission_id is null and d.firebase_mission_id=source.firebase_id))
     and (coalesce(bound,false) or d.storage_path=d.organization_id::text||'/v587-metadata/'||d.firebase_id||'.pdf');
 end if;
 return p.role='client' and d.status='active' and coalesce(bound,false)
   and public.sentinelle_client_document_access(d.client_id,d.firebase_site_id);
end $$;

create or replace function public.sentinelle_document_delivery_allowed(p_document uuid,p_profile uuid default null)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select case when exists(select 1 from public.generated_documents where id=p_document and (type='intervention' or intervention_id is not null)) then
 exists(select 1 from public.generated_documents d join public.interventions i on i.id=d.intervention_id and i.document_id=d.id
 join public.sites s on s.id=i.site_id and s.organization_id=i.organization_id
 join public.clients c on c.id=i.client_id and c.organization_id=i.organization_id
 where d.id=p_document and d.type='intervention' and d.organization_id=i.organization_id and d.client_id=i.client_id
 and d.firebase_site_id=s.firebase_id and s.client_id=i.client_id and d.firebase_mission_id is not distinct from (select firebase_id from public.missions where id=i.mission_id)
 and d.status='active' and i.published and i.archive_state='archived' and i.status='completed' and c.active
 and d.storage_bucket='main-courantes' and d.storage_path=i.organization_id::text||'/interventions/'||i.id::text||'/document.pdf'
 and exists(select 1 from storage.objects o where o.bucket_id=d.storage_bucket and o.name=d.storage_path)
 and (p_profile is null or exists(select 1 from public.profiles p where p.id=p_profile and p.active and p.organization_id=i.organization_id
 and (p.role in ('admin','superviseur') or (p.role='agent' and p.id=i.assigned_profile_id)))))
 else (select exists(select 1 from public.generated_documents d
 join public.clients c on c.id=d.client_id and c.organization_id=d.organization_id
 where d.id=p_document and d.status='active' and c.active=true and d.storage_bucket='main-courantes'
   and split_part(d.storage_path,'/',1)=d.organization_id::text and split_part(d.storage_path,'/',2)<>'v587-metadata'
   and (
     (split_part(d.storage_path,'/',2)=sentinelle_private.document_segment(d.created_by_external_uid)
      and split_part(d.storage_path,'/',3)=sentinelle_private.document_segment(coalesce(d.firebase_site_id,'sans-site'))
      and split_part(d.storage_path,'/',4)=sentinelle_private.document_segment(coalesce(d.firebase_mission_id,d.firebase_id))
      and left(split_part(d.storage_path,'/',5),length(d.firebase_id)+1)=d.firebase_id||'-'
      and split_part(d.storage_path,'/',6)='' and right(d.storage_path,4)='.pdf')
     or exists(select 1 from sentinelle_private.qg_closures q join public.shifts sh on sh.id=q.shift_id
       where q.document_key=d.firebase_id and q.organization_id=d.organization_id
        and sh.firebase_site_id=d.firebase_site_id and sh.firebase_mission_id is not distinct from d.firebase_mission_id
        and d.storage_path=d.organization_id::text||'/qg-closures/'||d.firebase_id||'.pdf'))
   and (d.firebase_site_id is null or exists(select 1 from public.sites s where s.organization_id=d.organization_id
      and s.firebase_id=d.firebase_site_id and s.client_id=d.client_id))
   and (p_profile is null or exists(select 1 from public.profiles p where p.id=p_profile and p.active=true
     and p.organization_id=d.organization_id and (p.role in ('admin','superviseur') or
       (p.role='agent' and p.external_uid=d.created_by_external_uid and exists(select 1 from public.shifts sh
         where sh.organization_id=p.organization_id and sh.firebase_agent_uid=p.external_uid
          and sh.firebase_id=d.payload->'shift'->>'id' and sh.firebase_site_id=d.firebase_site_id)))))
 )) end
$$;

create or replace function public.sentinelle_delivery_source_valid(p_document uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select case when exists(select 1 from public.generated_documents where id=p_document and (type='intervention' or intervention_id is not null)) then
 public.sentinelle_document_delivery_allowed(p_document,null)
 else (select exists(select from public.generated_documents d join public.shifts s on s.organization_id=d.organization_id
  and s.firebase_id=d.payload->'shift'->>'id' and s.firebase_site_id=d.firebase_site_id
 where d.id=p_document and (s.firebase_mission_id is not distinct from d.firebase_mission_id
  or (s.firebase_mission_id is null and d.firebase_mission_id=s.firebase_id))
 and (s.firebase_mission_id is null or exists(select from public.missions m where m.organization_id=d.organization_id
  and m.firebase_id=s.firebase_mission_id and m.firebase_site_id=s.firebase_site_id)))
 or exists(select from public.generated_documents d join sentinelle_private.qg_closures q on q.document_key=d.firebase_id and q.organization_id=d.organization_id
  join public.shifts s on s.id=q.shift_id where d.id=p_document and s.firebase_site_id=d.firebase_site_id
  and s.firebase_mission_id is not distinct from d.firebase_mission_id)) end
$$;

create or replace function public.sentinelle_delivery_step(p_document uuid,p_action text,p_token uuid default null,
 p_email text default null,p_outcome text default null,p_message text default null,p_profile uuid default null,p_manual boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare d public.generated_documents; e public.email_deliveries; t uuid; s text; n integer; eligible boolean;
begin
 select * into d from public.generated_documents where id=p_document for update;
 if not found then return jsonb_build_object('status','missing'); end if;
 if p_action='claim' then
  if p_profile is not null and not public.sentinelle_document_delivery_allowed(d.id,p_profile) then return jsonb_build_object('status','blocked'); end if;
  if d.delivery_lease_until>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  -- An expired dispatcher may already have submitted a message. Never resend it blindly.
  update public.email_deliveries set status='uncertain',error_message='Interrupted or legacy attempt: acceptance unknown',next_attempt_at=null,
   updated_at=clock_timestamp(),dispatch_history=dispatch_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'state','uncertain','reason','expired or legacy ambiguous attempt'))
   where document_id=d.id and (status='sending' or (status='failed' and dispatch_history='[]'::jsonb));
  if exists(select from public.email_deliveries where document_id=d.id and status='uncertain') then
   update public.generated_documents set delivery_status='uncertain',delivery_lease=null,delivery_lease_until=null,next_delivery_attempt_at=null,delivery_managed=true where id=d.id;
   return jsonb_build_object('status','uncertain');
  end if;
  if d.delivery_status='sent' then return jsonb_build_object('status','sent','sent',true,'alreadySent',true,'recipients','[]'::jsonb); end if;
  if exists(select from public.document_recipients r where r.document_id=d.id and (r.organization_id is distinct from d.organization_id or (r.client_id is not null and r.client_id is distinct from d.client_id))) or not public.sentinelle_document_delivery_allowed(d.id,p_profile) or not public.sentinelle_delivery_source_valid(d.id) or d.type not in ('mission','intervention') then
   -- A denied caller cannot mutate a valid document's queue state.
   if p_profile is not null then return jsonb_build_object('status','blocked'); end if;
   update public.generated_documents set delivery_status='blocked',next_delivery_attempt_at=null,delivery_managed=true where id=d.id;
   return jsonb_build_object('status','blocked');
  end if;
  if not exists(select from public.clients where id=d.client_id and organization_id=d.organization_id and active=true and auto_email=true) then
   update public.generated_documents set delivery_status='disabled',next_delivery_attempt_at=null,delivery_managed=true where id=d.id;
   return jsonb_build_object('status','disabled');
  end if;
  if p_manual and p_profile is null then return jsonb_build_object('status','blocked'); end if;
  if d.delivery_status='uncertain' then return jsonb_build_object('status','uncertain'); end if;
  -- Recover a lost final summary after all recipient receipts were committed.
  if exists(select from public.sentinelle_delivery_recipients(d.id)) and not exists(
   select from public.sentinelle_delivery_recipients(d.id) r where not exists(
    select from public.email_deliveries ed where ed.document_id=d.id and ed.recipient_email=r.email and ed.status='sent')) then
   update public.generated_documents set delivery_status='sent',delivery_lease=null,delivery_lease_until=null,next_delivery_attempt_at=null,
    delivered_at=(select max(sent_at) from public.email_deliveries where document_id=d.id),delivery_managed=true,delivery_error=null where id=d.id;
   return jsonb_build_object('status','sent','sent',true,'alreadySent',true);
  end if;
  if not p_manual and coalesce(d.delivery_attempts,0)>=3 then
   update public.generated_documents set delivery_status='failed',next_delivery_attempt_at=null where id=d.id;
   return jsonb_build_object('status','failed','exhausted',true);
  end if;
  if not p_manual and d.next_delivery_attempt_at>clock_timestamp() then return jsonb_build_object('status','deferred'); end if;
  t:=gen_random_uuid();
  update public.generated_documents set delivery_lease=t,delivery_lease_until=clock_timestamp()+interval '2 minutes',
   delivery_actor=p_profile,delivery_managed=true,delivery_status='sending',delivery_attempts=case when p_manual then 1 else coalesce(delivery_attempts,0)+1 end,
   next_delivery_attempt_at=null,delivery_error=null,updated_at=clock_timestamp() where id=d.id returning delivery_attempts into n;
  return jsonb_build_object('status','claimed','token',t,'attempt',n);
 end if;
 if p_token is null or d.delivery_lease is distinct from p_token or d.delivery_lease_until<=clock_timestamp() then
  return jsonb_build_object('status','stale');
 end if;
 if p_action='begin' then
  if exists(select from public.document_recipients r where r.document_id=d.id and (r.organization_id is distinct from d.organization_id or (r.client_id is not null and r.client_id is distinct from d.client_id))) or not public.sentinelle_document_delivery_allowed(d.id,d.delivery_actor) or not public.sentinelle_delivery_source_valid(d.id)
   or not exists(select from public.clients where id=d.client_id and organization_id=d.organization_id and active=true and auto_email=true)
   or not exists(select from public.sentinelle_delivery_recipients(d.id) r where r.email=p_email) then
   return jsonb_build_object('status','blocked');
  end if;
  insert into public.email_deliveries(organization_id,document_id,recipient_email,idempotency_key)
   values(d.organization_id,d.id,p_email,'main-courante:'||d.id||':'||p_email) on conflict(idempotency_key) do nothing;
  select * into e from public.email_deliveries where idempotency_key='main-courante:'||d.id||':'||p_email for update;
  if e.document_id<>d.id or e.organization_id<>d.organization_id or e.recipient_email<>p_email then raise exception 'Delivery association mismatch'; end if;
  if e.status='sent' then return jsonb_build_object('status','sent'); end if;
  if e.status in ('sending','uncertain') then return jsonb_build_object('status','uncertain'); end if;
  update public.email_deliveries set status='sending',dispatch_token=p_token,attempt_count=attempt_count+1,last_attempt_at=clock_timestamp(),next_attempt_at=null,
   dispatch_history=dispatch_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'state','sending','token',p_token)),updated_at=clock_timestamp()
   where id=e.id;
  update public.generated_documents set delivery_lease_until=clock_timestamp()+interval '2 minutes' where id=d.id;
  return jsonb_build_object('status','sending','key',e.id);
 elsif p_action='result' then
  if p_outcome not in ('sent','failed','uncertain') or p_outcome is null then raise exception 'Invalid outcome'; end if;
  update public.email_deliveries set status=p_outcome,provider_message_id=case when p_outcome='sent' then p_message else provider_message_id end,
   sent_at=case when p_outcome='sent' then clock_timestamp() else sent_at end,
   error_message=case when p_outcome='sent' then null else left(p_message,4000) end,
   dispatch_history=dispatch_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'state',p_outcome,'detail',left(p_message,4000))),updated_at=clock_timestamp()
   where document_id=d.id and recipient_email=p_email and dispatch_token=p_token and status='sending';
  if not found then return jsonb_build_object('status','stale'); end if;
  return jsonb_build_object('status',p_outcome);
 elsif p_action='finish' then
  if exists(select from public.email_deliveries where document_id=d.id and status in ('sending','uncertain')) then s:='uncertain';
  elsif p_outcome in ('blocked','no_recipient','disabled') then s:=p_outcome;
  elsif p_outcome='failed' or exists(select from public.sentinelle_delivery_recipients(d.id) r where not exists(select from public.email_deliveries ed where ed.document_id=d.id and ed.recipient_email=r.email and ed.status='sent')) then
   s:=case when d.delivery_attempts<3 then 'retry_pending' else 'failed' end;
  elsif not exists(select from public.sentinelle_delivery_recipients(d.id)) then s:='no_recipient';
  else s:='sent'; end if;
  update public.generated_documents set delivery_status=s,delivery_lease=null,delivery_lease_until=null,
   next_delivery_attempt_at=case when s='retry_pending' then clock_timestamp()+case when d.delivery_attempts=1 then interval '5 minutes' else interval '30 minutes' end end,
   delivery_error=case when s='sent' then null else coalesce(left(p_message,4000),s) end,
   delivered_at=case when s='sent' then clock_timestamp() else delivered_at end,updated_at=clock_timestamp() where id=d.id;
  return jsonb_build_object('status',s,'sent',s='sent','queued',s='retry_pending','attempt',d.delivery_attempts,'maxAttempts',3);
 end if;
 raise exception 'Unknown delivery action';
end $$;

create or replace function public.sentinelle_delivery_candidates() returns table(id uuid)
language sql security definer set search_path=pg_catalog as $$
 select id from public.generated_documents where type in ('mission','intervention') and (
 (delivery_status='retry_pending' and next_delivery_attempt_at<=clock_timestamp()) or
 (delivery_status='sending' and (delivery_lease_until is null or delivery_lease_until<=clock_timestamp())))
 order by coalesce(next_delivery_attempt_at,updated_at) limit 20
$$;
commit;
