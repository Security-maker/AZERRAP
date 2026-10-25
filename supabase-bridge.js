import { supabaseConfig } from './supabase-config.js?v=510';
import { getSupabaseClient } from './supabase-compat.js?v=online-20261025-r1';

function isConfigured(){
  return Boolean(
    supabaseConfig.enabled &&
    supabaseConfig.mode === 'supabase' &&
    supabaseConfig.url &&
    supabaseConfig.publishableKey &&
    supabaseConfig.organizationId
  );
}

export function supabaseBridgeEnabled(){ return isConfigured(); }

function slug(value){
  return String(value || 'document')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase() || 'document';
}

export async function mirrorGeneratedDocument({ firebaseUser, profile, document, pdfBlob, closureCreateOnly=false }){
  if (!isConfigured()) return { skipped:true };
  if (!(pdfBlob instanceof Blob)) throw new Error('PDF absent pour Supabase Storage.');
  const client = getSupabaseClient();
  if(closureCreateOnly) return archiveClosureOnce(client,document,pdfBlob,firebaseUser,profile);
  const organizationId = supabaseConfig.organizationId;
  const ownerId = String(firebaseUser?.uid || profile?.uid || 'qg');
  const siteId = String(document.siteId || 'sans-site');
  const missionId = String(document.missionId || document.id || 'sans-mission');
  const filename = `${slug(document.title || document.id)}.pdf`;
  const storagePath = `${organizationId}/${slug(ownerId)}/${slug(siteId)}/${slug(missionId)}/${document.id}-${filename}`;

  const upload = await client.storage
    .from(supabaseConfig.reportBucket)
    .upload(storagePath, pdfBlob, { contentType:'application/pdf', upsert:false, cacheControl:'3600' });
  if (upload.error) {
    // Retry a lost upload response only when the existing bytes are identical.
    const saved=await client.storage.from(supabaseConfig.reportBucket).download(storagePath);
    if(saved.error || !saved.data) throw upload.error;
    const hash=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).join(',');
    if(await hash(saved.data)!==await hash(pdfBlob)) throw new Error('PDF existant différent : nouvelle version à valider, aucun écrasement.');
  }

  const record = {
    organization_id: organizationId,
    firebase_id: document.id,
    firebase_site_id: document.siteId || null,
    firebase_mission_id: document.missionId || null,
    type: document.type || 'mission',
    title: document.title || 'Main courante',
    row_count: Number(document.rowCount || 0),
    storage_bucket: supabaseConfig.reportBucket,
    storage_path: storagePath,
    payload: document.payload || {},
    status: 'active',
    created_by_external_uid: ownerId,
    delivery_status: 'supabase_archived'
  };

  const { data, error } = await client
    .from('generated_documents')
    .upsert(record, { onConflict:'organization_id,firebase_id' })
    .select('id')
    .single();
  if (error) throw error;

  let emailQueued = false;
  let emailStatus = null;
  let emailError = null;
  if (supabaseConfig.autoEmail && document.type === 'mission') {
    const invoke = await client.functions.invoke(supabaseConfig.emailFunction, { body:{ documentId:data.id } });
    if (invoke.error) {
      // Le PDF est déjà correctement archivé : une panne de fonction/e-mail ne doit
      // jamais annuler l'archivage. On place explicitement le document dans la file
      // de relance afin que le cron serveur puisse reprendre sans intervention agent.
      emailError = String(invoke.error?.message || invoke.error);
      emailStatus = 'retry_pending';
      emailQueued = true;
      const nextAttempt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const queued = await client.from('generated_documents').update({
        delivery_status:'retry_pending',
        next_delivery_attempt_at:nextAttempt,
        delivery_error:emailError,
        updated_at:new Date().toISOString()
      }).eq('id',data.id);
      if (queued.error) console.warn('Mise en file de relance impossible', queued.error);
      console.warn('Envoi immédiat main courante indisponible, reprise cron prévue', invoke.error);
    } else {
      emailStatus = invoke.data?.status || null;
      emailQueued = Boolean(invoke.data?.sent || invoke.data?.alreadySent || invoke.data?.queued || invoke.data?.status === 'sent' || invoke.data?.status === 'retry_pending');
    }
  }
  return { documentId:data.id, storagePath, emailQueued, emailStatus, emailError };
}

// Scoped to atomic QG closures. Never overwrite or resend on recovery.
async function archiveClosureOnce(client,document,pdfBlob,user,profile){
  const org=supabaseConfig.organizationId;
  if(document.payload?.qgClosureKey!==document.id || !document.id.startsWith('qg-close-')) throw Error('archive_failed');
  const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const storage=client.storage.from(supabaseConfig.reportBucket);
  const lookup=async()=>{
    const result=await client.from('generated_documents').select('id,storage_path,storage_bucket,payload,delivery_status')
      .eq('organization_id',org).eq('firebase_id',document.id).maybeSingle();
    if(result.error) throw result.error;
    return result.data;
  };
  const verified=async row=>{
    if(row.payload?.qgClosureKey!==document.id || row.storage_bucket!==supabaseConfig.reportBucket || !row.payload?.pdfSha256) throw Error('archive_uncertain');
    const file=await storage.download(row.storage_path);
    if(file.error || !file.data || await digest(file.data)!==row.payload.pdfSha256) throw Error('archive_uncertain');
    return {documentId:row.id,storagePath:row.storage_path,emailStatus:row.delivery_status,alreadyArchived:true};
  };
  const existing=await lookup();
  if(existing) return verified(existing);
  // An old client may already have archived this operation under its legacy key.
  const source=document.missionId||document.payload?.shift?.id;
  if(source){
    const legacyKey=`mission-${String(source).replace(/[^a-zA-Z0-9_-]/g,'-')}`.slice(0,120);
    const prior=await client.from('generated_documents').select('id').eq('organization_id',org).in('firebase_id',[legacyKey,legacyKey.toLowerCase()]).limit(1);
    if(prior.error || prior.data?.length) throw Error('archive_uncertain');
  }

  if(pdfBlob.size===0 || !(await pdfBlob.slice(0,5).text()).startsWith('%PDF-')) throw Error('archive_failed');
  const hash=await digest(pdfBlob);
  const path=`${org}/qg-closures/${document.id}.pdf`;
  const upload=await storage.upload(path,pdfBlob,{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
  if(upload.error){
    // Lost response or orphan upload: reuse only byte-identical content.
    const orphan=await storage.download(path);
    if(orphan.error || !orphan.data || await digest(orphan.data)!==hash) throw Error('archive_uncertain');
  }
  const autoEmail=Boolean(supabaseConfig.autoEmail && document.type==='mission');
  const record={organization_id:org,firebase_id:document.id,firebase_site_id:document.siteId||null,
    firebase_mission_id:document.missionId||null,type:document.type,title:document.title,row_count:document.rowCount,
    storage_bucket:supabaseConfig.reportBucket,storage_path:path,payload:{...document.payload,pdfSha256:hash},
    status:'active',created_by_external_uid:String(user?.uid||profile?.uid||''),
    delivery_status:autoEmail?'retry_pending':'supabase_archived',next_delivery_attempt_at:autoEmail?new Date().toISOString():null};
  const inserted=await client.from('generated_documents').insert(record).select('id').single();
  if(inserted.error){const recovered=await lookup();if(recovered)return verified(recovered);throw Error('archive_uncertain');}
  // The existing Cron owns automatic delivery. Recovery never invokes the sender
  // or resets sent/retry counters. Client preferences remain checked by Cron.
  return {documentId:inserted.data.id,storagePath:path,emailQueued:autoEmail,emailStatus:record.delivery_status};
}
