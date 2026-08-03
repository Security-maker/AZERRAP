import { supabaseConfig } from './supabase-config.js';

const root = document.querySelector('#client-app');
let supabase = null;
let profile = null;
let clientRecord = null;
let documents = [];
let sites = [];

function safe(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function dateText(value){const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});}
function configured(){return supabaseConfig.enabled&&supabaseConfig.url&&!supabaseConfig.url.includes('REMPLACE_MOI')&&supabaseConfig.publishableKey&&!supabaseConfig.publishableKey.includes('REMPLACE_MOI');}
async function getSupabase(){
  if(supabase)return supabase;
  if(!configured())throw new Error('L’espace client n’est pas encore relié au projet Supabase.');
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase=createClient(supabaseConfig.url,supabaseConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return supabase;
}
function message(text,type='error'){const box=document.querySelector('#client-message');if(box){box.className=type;box.textContent=text;}}

async function boot(){
  try{
    const client=await getSupabase();
    const {data:{session}}=await client.auth.getSession();
    if(session)await loadPortal();
    else bindLogin();
    client.auth.onAuthStateChange((_event,next)=>{if(next)loadPortal().catch(renderError);else renderLogin();});
  }catch(error){renderError(error);}
}
function bindLogin(){
  const form=document.querySelector('#client-login-form');
  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('button');button.disabled=true;message('Connexion en cours…','success');
    const fd=new FormData(form);
    const {error}=await supabase.auth.signInWithPassword({email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')});
    if(error){button.disabled=false;message('Connexion impossible. Vérifiez vos identifiants.');}
  });
}
function renderLogin(){location.reload();}
function renderError(error){root.innerHTML=`<section class="client-login-card"><img src="./assets/logo.png" class="client-logo" alt="Sentinelle Pro"><h1>Espace client indisponible</h1><p class="error">${safe(error?.message||error)}</p></section>`;}

async function loadPortal(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return renderLogin();
  const {data:profileData,error:profileError}=await supabase.from('profiles').select('id,organization_id,role,first_name,last_name,email').eq('auth_user_id',user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profileData||profileData.role!=='client')throw new Error('Aucun accès client n’est associé à ce compte.');
  profile=profileData;
  const {data:links,error:linkError}=await supabase.from('client_users').select('client_id,clients(id,name)').eq('profile_id',profile.id);
  if(linkError)throw linkError;
  clientRecord=links?.[0]?.clients||null;
  const clientIds=(links||[]).map(link=>link.client_id).filter(Boolean);
  if(clientIds.length){
    const {data:siteLinks,error:siteError}=await supabase.from('client_sites').select('site_id,sites(id,firebase_id,name)').in('client_id',clientIds);
    if(siteError)throw siteError;
    sites=(siteLinks||[]).map(row=>row.sites).filter(Boolean);
  }else sites=[];
  const {data:docs,error:docsError}=await supabase.from('generated_documents').select('id,title,type,row_count,created_at,firebase_site_id,storage_bucket,storage_path,delivery_status,status').eq('organization_id',profile.organization_id).order('created_at',{ascending:false}).limit(250);
  if(docsError)throw docsError;
  documents=docs||[];
  renderPortal();
}
function renderPortal(){
  const siteOptions=[...new Map(sites.map(s=>[s.firebase_id||s.id,s])).values()].map(s=>`<option value="${safe(s.firebase_id||s.id)}">${safe(s.name)}</option>`).join('');
  root.innerHTML=`
    <header class="client-topbar"><div class="client-brand"><img src="./assets/logo.png" alt="Sentinelle Pro"><div><h1>Espace client</h1><p>${safe(clientRecord?.name||profile.email||'Client')}</p></div></div><div class="client-actions"><button class="secondary" id="client-refresh">Actualiser</button><button class="secondary" id="client-logout">Déconnexion</button></div></header>
    <section class="client-metrics"><div class="client-metric"><span>Documents disponibles</span><strong>${documents.length}</strong></div><div class="client-metric"><span>Sites accessibles</span><strong>${sites.length}</strong></div><div class="client-metric"><span>Dernier rapport</span><strong style="font-size:16px">${documents[0]?dateText(documents[0].created_at):'—'}</strong></div></section>
    <section class="client-panel"><div class="client-panel-head"><div><h2>Mains courantes</h2><p>Rapports PDF générés par le QG après les missions.</p></div><div class="client-filters"><select id="client-site-filter"><option value="">Tous les sites</option>${siteOptions}</select><select id="client-type-filter"><option value="">Tous les documents</option><option value="mission">Rapports de mission</option><option value="mci">Mains courantes MCI</option></select></div></div><div id="client-document-list" class="document-list"></div></section>`;
  document.querySelector('#client-logout').addEventListener('click',()=>supabase.auth.signOut());
  document.querySelector('#client-refresh').addEventListener('click',()=>loadPortal().catch(renderError));
  ['client-site-filter','client-type-filter'].forEach(id=>document.querySelector(`#${id}`).addEventListener('change',drawDocuments));
  drawDocuments();
}
function drawDocuments(){
  const box=document.querySelector('#client-document-list');
  const site=document.querySelector('#client-site-filter')?.value||'';
  const type=document.querySelector('#client-type-filter')?.value||'';
  const allowedSiteIds=new Set(sites.map(s=>s.firebase_id||s.id));
  const rows=documents.filter(d=>d.status==='active'&&(!type||d.type===type)&&(!site||d.firebase_site_id===site)&&(!d.firebase_site_id||allowedSiteIds.has(d.firebase_site_id)||sites.length===0));
  box.innerHTML=rows.length?rows.map(d=>`<article class="document-row"><div><h3>${safe(d.title||'Main courante')}</h3><p>${dateText(d.created_at)} · ${Number(d.row_count||0)} événement(s)</p><span class="badge">${d.delivery_status==='sent'?'Envoyé par e-mail':'Disponible dans le portail'}</span></div><button data-download-document="${safe(d.id)}">Consulter le PDF</button></article>`).join(''):'<div class="empty">Aucun document ne correspond aux filtres.</div>';
  box.querySelectorAll('[data-download-document]').forEach(button=>button.addEventListener('click',()=>openDocument(button.dataset.downloadDocument,button)));
}
async function openDocument(documentId,button){
  button.disabled=true;button.textContent='Ouverture…';
  try{
    const d=documents.find(row=>row.id===documentId);if(!d)throw new Error('Document introuvable.');
    const {data,error}=await supabase.storage.from(d.storage_bucket||supabaseConfig.reportBucket).createSignedUrl(d.storage_path,120);
    if(error)throw error;
    window.open(data.signedUrl,'_blank','noopener');
  }catch(error){alert(error.message||'Ouverture impossible.');}
  finally{button.disabled=false;button.textContent='Consulter le PDF';}
}
boot();
