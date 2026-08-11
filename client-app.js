import { supabaseConfig } from './supabase-config.js';

const root=document.querySelector('#client-app');
let supabase=null;
let profile=null;
let clients=[];
let sites=[];
let documents=[];
let recoveryMode=false;

function safe(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function configured(){return supabaseConfig.enabled&&supabaseConfig.url&&!supabaseConfig.url.includes('REMPLACE_MOI')&&supabaseConfig.publishableKey&&!supabaseConfig.publishableKey.includes('REMPLACE_MOI');}
function asDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function dateText(value){const d=asDate(value);return d?d.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'—';}
function shortDate(value){const d=asDate(value);return d?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—';}
function monthKey(value){const d=asDate(value);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:'';}
function docTypeLabel(type){return ({mission:'Rapport de mission',mci:'Main courante',rounds:'Rapport de rondes',alerts:'Rapport SOS / PTI'}[String(type||'').toLowerCase()]||'Document opérationnel');}
function message(text,type='error'){const box=document.querySelector('#client-message');if(box){box.className=type;box.textContent=text;}}
async function getSupabase(){
  if(supabase)return supabase;
  if(!configured())throw new Error('Le portail client n’est pas relié au projet Supabase.');
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase=createClient(supabaseConfig.url,supabaseConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sentinelle-client-v591-auth'}});
  return supabase;
}

async function boot(){
  try{
    const client=await getSupabase();
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){recoveryMode=true;renderPasswordRecovery();return;}
      if(event==='SIGNED_OUT')renderLogin();
      if(event==='SIGNED_IN'&&session&&!recoveryMode)loadPortal().catch(renderError);
    });
    const {data:{session}}=await client.auth.getSession();
    if(session)await loadPortal();else bindLogin();
  }catch(error){renderError(error);}
}

function bindLogin(){
  const form=document.querySelector('#client-login-form');
  form?.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;message('Connexion sécurisée en cours…','success');
    const fd=new FormData(form);
    const {error}=await supabase.auth.signInWithPassword({email:String(fd.get('email')||'').trim().toLowerCase(),password:String(fd.get('password')||'')});
    if(error){button.disabled=false;message('Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.');}
  });
  document.querySelector('#client-forgot-password')?.addEventListener('click',forgotPassword);
}
async function forgotPassword(){
  const email=String(document.querySelector('[name="email"]')?.value||'').trim().toLowerCase();
  if(!email){message('Saisissez votre adresse e-mail avant de demander un nouveau mot de passe.');return;}
  const redirectTo=new URL('./client.html',location.href).href;
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)return message('Impossible d’envoyer le lien de réinitialisation.');
  message('Un lien de réinitialisation vient d’être envoyé si ce compte existe.','success');
}
function renderLogin(){location.replace('./client.html');}
function renderError(error){root.innerHTML=`<section class="error-panel"><img src="./assets/logo.png" class="client-logo" alt="Sentinelle Pro"><h1>Espace client indisponible</h1><p>${safe(error?.message||error)}</p><button class="secondary" onclick="location.reload()">Réessayer</button></section>`;}
function renderPasswordRecovery(){
  root.innerHTML=`<section class="auth-wrap"><div class="auth-card"><div class="brand-lockup"><img src="./assets/logo.png" class="client-logo" alt="Sentinelle Pro"><span>SÉCURITÉ</span></div><h1>Choisir un nouveau mot de passe</h1><p class="lead">Utilisez au moins 8 caractères. Votre session sera conservée après la modification.</p><form id="client-reset-form" class="reset-box"><label>Nouveau mot de passe<input type="password" name="password" minlength="8" required></label><label>Confirmer<input type="password" name="confirm" minlength="8" required></label><button type="submit">Mettre à jour</button></form><div id="client-message"></div></div></section>`;
  document.querySelector('#client-reset-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);const password=String(fd.get('password')||'');const confirm=String(fd.get('confirm')||'');
    if(password.length<8)return message('Le mot de passe doit contenir au moins 8 caractères.');
    if(password!==confirm)return message('Les deux mots de passe ne correspondent pas.');
    const button=e.currentTarget.querySelector('button');button.disabled=true;
    const {error}=await supabase.auth.updateUser({password});
    if(error){button.disabled=false;return message('Impossible de modifier le mot de passe.');}
    recoveryMode=false;message('Mot de passe modifié. Ouverture de votre espace…','success');setTimeout(()=>loadPortal().catch(renderError),650);
  });
}

async function loadPortal(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return renderLogin();
  const {data:profileData,error:profileError}=await supabase.from('profiles').select('id,organization_id,role,first_name,last_name,email,active').eq('auth_user_id',user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profileData||profileData.role!=='client'||profileData.active===false)throw new Error('Aucun accès client actif n’est associé à ce compte.');
  profile=profileData;

  const {data:links,error:linkError}=await supabase.from('client_users').select('client_id,clients(id,name,report_email,billing_email,address,portal_enabled,active)').eq('profile_id',profile.id);
  if(linkError)throw linkError;
  clients=(links||[]).map(row=>row.clients).filter(Boolean).filter(c=>c.active!==false&&c.portal_enabled!==false);
  if(!clients.length)throw new Error('Votre compte n’est rattaché à aucun client autorisé.');
  const clientIds=clients.map(c=>c.id);

  const {data:siteLinks,error:siteError}=await supabase.from('client_sites').select('site_id,client_id,sites(id,firebase_id,name,address,active)').in('client_id',clientIds);
  if(siteError)throw siteError;
  sites=(siteLinks||[]).map(row=>row.sites).filter(Boolean).filter(s=>s.active!==false);

  const {data:docs,error:docsError}=await supabase.from('generated_documents')
    .select('id,client_id,title,type,row_count,created_at,firebase_site_id,storage_bucket,storage_path,delivery_status,status')
    .eq('organization_id',profile.organization_id).eq('status','active').order('created_at',{ascending:false}).limit(500);
  if(docsError)throw docsError;
  documents=docs||[];
  renderPortal();
}

function renderPortal(){
  const clientNames=clients.map(c=>c.name).join(' · ');
  const latest=documents[0]||null;
  const last30=documents.filter(d=>{const dt=asDate(d.created_at);return dt&&Date.now()-dt.getTime()<=30*86400000;}).length;
  const sitePills=sites.length?sites.map(s=>`<span class="site-pill"><strong>${safe(s.name)}</strong>${s.address?` · ${safe(s.address)}`:''}</span>`).join(''):'<span class="site-pill">Aucun site affiché</span>';
  const siteOptions=sites.map(s=>`<option value="${safe(s.firebase_id||s.id)}">${safe(s.name)}</option>`).join('');
  const monthOptions=[...new Set(documents.map(d=>monthKey(d.created_at)).filter(Boolean))].slice(0,18).map(m=>{const [y,mo]=m.split('-');const label=new Date(Number(y),Number(mo)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});return `<option value="${m}">${safe(label)}</option>`;}).join('');
  root.innerHTML=`
    <header class="client-topbar"><div class="client-brand"><img src="./assets/logo.png" alt="Sentinelle Pro"><div class="client-brand-text"><h1>Espace client</h1><p>${safe(clientNames)}</p></div></div><div class="client-actions"><button class="secondary" id="client-refresh">Actualiser</button><button class="ghost" id="client-logout">Déconnexion</button></div></header>
    <section class="portal-hero"><div class="hero-card"><span class="hero-kicker">ACCÈS SÉCURISÉ ACTIF</span><h2>Bonjour ${safe(profile.first_name||'')}</h2><p>Retrouvez ici les documents opérationnels disponibles pour ${safe(clientNames)}. Les accès sont limités aux sites rattachés à votre compte.</p><div class="sites-strip">${sitePills}</div></div><div class="hero-card hero-side"><span>Dernier document</span><div class="big">${latest?shortDate(latest.created_at):'—'}</div><span>${latest?safe(latest.title):'Aucun rapport disponible'}</span></div></section>
    <section class="client-metrics"><div class="metric-card"><span>Documents disponibles</span><strong>${documents.length}</strong></div><div class="metric-card"><span>Sites accessibles</span><strong>${sites.length}</strong></div><div class="metric-card"><span>Nouveaux sur 30 jours</span><strong>${last30}</strong></div></section>
    <section class="portal-card"><div class="panel-head"><div><h2>Mains courantes & rapports</h2><p>Recherche, consultation et téléchargement sécurisé des PDF.</p></div></div><div class="filters"><select id="client-site-filter"><option value="">Tous les sites</option>${siteOptions}</select><select id="client-type-filter"><option value="">Tous les types</option><option value="mission">Rapports de mission</option><option value="mci">Mains courantes</option><option value="rounds">Rondes</option><option value="alerts">SOS / PTI</option></select><select id="client-month-filter"><option value="">Toutes les périodes</option>${monthOptions}</select><input id="client-search" type="search" placeholder="Rechercher un rapport…"></div><div id="client-document-list" class="document-grid"></div></section>
    <div class="footer-note">Sentinelle Pro · Portail sécurisé · Les documents sont servis depuis un stockage privé.</div>`;
  document.querySelector('#client-logout').addEventListener('click',()=>supabase.auth.signOut());
  document.querySelector('#client-refresh').addEventListener('click',()=>loadPortal().catch(renderError));
  ['client-site-filter','client-type-filter','client-month-filter'].forEach(id=>document.querySelector(`#${id}`)?.addEventListener('change',drawDocuments));
  document.querySelector('#client-search')?.addEventListener('input',drawDocuments);
  drawDocuments();
}

function drawDocuments(){
  const box=document.querySelector('#client-document-list');if(!box)return;
  const site=document.querySelector('#client-site-filter')?.value||'';
  const type=document.querySelector('#client-type-filter')?.value||'';
  const month=document.querySelector('#client-month-filter')?.value||'';
  const search=String(document.querySelector('#client-search')?.value||'').trim().toLowerCase();
  const siteMap=new Map(sites.map(s=>[String(s.firebase_id||s.id),s]));
  const allowedSiteIds=new Set(siteMap.keys());
  const rows=documents.filter(d=>{
    const dSite=String(d.firebase_site_id||'');
    const siteAllowed=!dSite||allowedSiteIds.has(dSite);
    const matchSearch=!search||String(d.title||'').toLowerCase().includes(search)||String(siteMap.get(dSite)?.name||'').toLowerCase().includes(search);
    return d.status==='active'&&siteAllowed&&(!site||dSite===site)&&(!type||String(d.type||'')===type)&&(!month||monthKey(d.created_at)===month)&&matchSearch;
  });
  box.innerHTML=rows.length?rows.map(d=>{
    const siteName=siteMap.get(String(d.firebase_site_id||''))?.name||'Site rattaché';
    return `<article class="document-card"><div class="doc-main"><div class="doc-eyebrow"><span class="tag">${safe(docTypeLabel(d.type))}</span>${d.delivery_status==='sent'?'<span class="tag sent">Envoyé par e-mail</span>':''}</div><h3 title="${safe(d.title||'Document')}">${safe(d.title||'Document')}</h3><p>${safe(siteName)} · ${dateText(d.created_at)} · ${Number(d.row_count||0)} événement(s)</p></div><div class="doc-actions"><button data-open-document="${safe(d.id)}">Ouvrir PDF</button><button class="secondary" data-download-document="${safe(d.id)}">Télécharger</button></div></article>`;
  }).join(''):'<div class="empty">Aucun document ne correspond à ces filtres.</div>';
  box.querySelectorAll('[data-open-document]').forEach(button=>button.addEventListener('click',()=>openDocument(button.dataset.openDocument,button,false)));
  box.querySelectorAll('[data-download-document]').forEach(button=>button.addEventListener('click',()=>openDocument(button.dataset.downloadDocument,button,true)));
}

async function signedDocumentUrl(d,expires=120){
  const {data,error}=await supabase.storage.from(d.storage_bucket||supabaseConfig.reportBucket).createSignedUrl(d.storage_path,expires);
  if(error)throw error;if(!data?.signedUrl)throw new Error('Lien PDF indisponible.');return data.signedUrl;
}
async function openDocument(documentId,button,download){
  const original=button.textContent;button.disabled=true;button.textContent=download?'Téléchargement…':'Ouverture…';
  try{
    const d=documents.find(row=>row.id===documentId);if(!d)throw new Error('Document introuvable.');
    const url=await signedDocumentUrl(d,180);
    if(!download){window.open(url,'_blank','noopener');return;}
    const response=await fetch(url);if(!response.ok)throw new Error('Téléchargement impossible.');
    const blob=await response.blob();const a=document.createElement('a');const objectUrl=URL.createObjectURL(blob);a.href=objectUrl;a.download=`${String(d.title||'main-courante').replace(/[^a-z0-9-_]+/gi,'-')}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  }catch(error){alert(error?.message||'Ouverture impossible.');}
  finally{button.disabled=false;button.textContent=original;}
}

boot();
