import { supabaseConfig } from './supabase-config.js';

const root=document.querySelector('#client-app');
let supabase=null;
let profile=null;
let clients=[];
let sites=[];
let documents=[];
let interventions=[];
let recoveryMode=false;
let portalEpoch=0;

function safe(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function configured(){return supabaseConfig.enabled&&supabaseConfig.url&&!supabaseConfig.url.includes('REMPLACE_MOI')&&supabaseConfig.publishableKey&&!supabaseConfig.publishableKey.includes('REMPLACE_MOI');}
function asDate(value){if(value===null||value===undefined||value==='')return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function dateText(value){const d=asDate(value);return d?d.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'—';}
function shortDate(value){const d=asDate(value);return d?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—';}
function monthKey(value){const d=asDate(value);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:'';}
function documentRowDate(row={}){
  return asDate(row.createdAt||row.occurredAt||row.scannedAt||row.capturedAt||row.photoCapturedAt||row.heure||row.date||null);
}
function titleBusinessPeriod(title=''){
  const matches=String(title||'').match(/(20\d{2}-\d{2}-\d{2})/g)||[];
  const start=matches[0]?asDate(`${matches[0]}T12:00:00`):null;
  const end=matches[1]?asDate(`${matches[1]}T12:00:00`):start;
  return {start,end};
}
function documentBusinessPeriod(document={}){
  const payload=document.payload&&typeof document.payload==='object'?document.payload:{};
  const type=String(document.type||'').toLowerCase();
  if(type==='intervention')return {start:asDate(payload.intervention?.started_at),end:asDate(payload.intervention?.completed_at)};
  let start=asDate(payload.businessPeriodStart||payload.periodStart||payload.dateFrom||null);
  let end=asDate(payload.businessPeriodEnd||payload.periodEnd||payload.dateTo||null);
  if(type==='mission'){
    const mission=payload.mission||{};
    const shift=payload.shift||{};
    start=start||asDate(mission.actualStart||shift.startTime||mission.scheduledStart||shift.scheduledStart||null);
    end=end||asDate(mission.actualEnd||shift.completedAt||mission.scheduledEnd||shift.scheduledEnd||null);
  }
  if(!start||!end){
    const rows=Array.isArray(payload.rows)?payload.rows:[];
    const dates=rows.map(documentRowDate).filter(Boolean).sort((a,b)=>a-b);
    start=start||dates[0]||null;
    end=end||dates[dates.length-1]||null;
  }
  if(!start||!end){
    const fromTitle=titleBusinessPeriod(document.title);
    start=start||fromTitle.start;
    end=end||fromTitle.end;
  }
  start=start||asDate(document.created_at);
  end=end||start;
  return {start,end,sortDate:type==='mission'?start:(end||start)};
}
function documentBusinessDate(document={}){return documentBusinessPeriod(document).sortDate||asDate(document.created_at);}
function documentBusinessLabel(document={}){
  const {start,end}=documentBusinessPeriod(document);
  if(!start)return '—';
  const type=String(document.type||'').toLowerCase();
  const sameDay=end&&start.toLocaleDateString('fr-FR')===end.toLocaleDateString('fr-FR');
  if(type==='mission')return dateText(start);
  if(end&&!sameDay)return `Du ${shortDate(start)} au ${shortDate(end)}`;
  return shortDate(start);
}
function docTypeLabel(type){return ({intervention:'Bon d’intervention',mission:'Rapport de mission',mci:'Main courante',rounds:'Rapport de rondes',alerts:'Rapport SOS / PTI'}[String(type||'').toLowerCase()]||'Document opérationnel');}
function message(text,type='error'){const box=document.querySelector('#client-message');if(box){box.className=type;box.textContent=text;}}
function toast(text,type='error'){
  document.querySelector('.client-toast')?.remove();
  const el=document.createElement('div');el.className=`client-toast ${type}`;el.setAttribute('role','status');el.textContent=text;document.body.appendChild(el);
  setTimeout(()=>el.remove(),4200);
}
async function registerClientPwa(){
  if(!('serviceWorker' in navigator))return;
  try{await navigator.serviceWorker.register('./service-worker.js?v=597',{scope:'./',updateViaCache:'none'});}catch(error){console.warn('[Sentinelle Client] Service Worker',error);}
}
async function getSupabase(){
  if(supabase)return supabase;
  if(!configured())throw new Error('Le portail client n’est pas relié au projet Supabase.');
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
  supabase=createClient(supabaseConfig.url,supabaseConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sentinelle-client-v591-auth'}});
  return supabase;
}

async function boot(){
  registerClientPwa();
  try{
    const client=await getSupabase();
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){recoveryMode=true;renderPasswordRecovery();return;}
      if(event==='SIGNED_OUT'){portalEpoch++;profile=null;clients=[];sites=[];documents=[];interventions=[];renderLogin();}
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
  const redirectTo=new URL('./reset-password.html?return=client',location.href).href;
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)return message('Impossible d’envoyer le lien de réinitialisation.');
  message('Un lien de réinitialisation vient d’être envoyé si ce compte existe. Pensez à vérifier les indésirables.','success');
}
function renderLogin(){location.replace('./client.html');}
function renderError(error){
  root.className='client-shell';
  root.innerHTML=`<section class="error-panel"><img src="./assets/client-logo.png" class="client-logo" alt="Sentinelle Pro"><h1>Espace client indisponible</h1><p>${safe(error?.message||error)}</p><button class="secondary" id="client-retry">Réessayer</button></section>`;
  document.querySelector('#client-retry')?.addEventListener('click',()=>location.reload());
}
function renderPasswordRecovery(){
  root.className='client-shell auth-shell';
  root.innerHTML=`<section class="auth-layout"><div class="auth-showcase"><div class="auth-brandline"><span class="brand-mark"><img src="./assets/client-logo.png" alt=""></span><div><strong>Sentinelle Pro</strong><span>par Azzera Protect</span></div></div><div class="auth-showcase-copy"><span class="eyebrow-light">ESPACE SÉCURISÉ</span><h1>Un nouvel accès<br><em>En toute sécurité</em></h1><p>Choisissez votre nouveau mot de passe pour retrouver votre portail client Sentinelle Pro</p></div><div class="trust-grid"><div><span class="trust-icon">✓</span><strong>Accès privé</strong><small>Authentification sécurisée</small></div><div><span class="trust-icon">8+</span><strong>Mot de passe</strong><small>8 caractères minimum</small></div><div><span class="trust-icon">↗</span><strong>Reconnexion</strong><small>Après validation</small></div></div></div><div class="auth-panel"><div class="auth-card"><div class="auth-mobile-brand"><span class="brand-mark"><img src="./assets/client-logo.png" alt="Sentinelle Pro"></span><div><strong>Sentinelle Pro</strong><span>Espace client</span></div></div><span class="eyebrow">RÉINITIALISATION</span><h2>Nouveau mot de passe</h2><p class="lead">Utilisez au moins 8 caractères · Vous devrez ensuite vous reconnecter</p><form id="client-reset-form" class="reset-box"><label>Nouveau mot de passe<input type="password" name="password" minlength="8" autocomplete="new-password" required></label><label>Confirmer<input type="password" name="confirm" minlength="8" autocomplete="new-password" required></label><button type="submit" class="primary-button"><span>Mettre à jour</span><span class="button-arrow">→</span></button></form><div id="client-message"></div><div class="security-note"><span class="security-dot"></span><span>Votre session de récupération est protégée</span></div></div></div></section>`;
  document.querySelector('#client-reset-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);const password=String(fd.get('password')||'');const confirm=String(fd.get('confirm')||'');
    if(password.length<8)return message('Le mot de passe doit contenir au moins 8 caractères.');
    if(password!==confirm)return message('Les deux mots de passe ne correspondent pas.');
    const button=e.currentTarget.querySelector('button');button.disabled=true;
    const {error}=await supabase.auth.updateUser({password});
    if(error){button.disabled=false;return message('Impossible de modifier le mot de passe.');}
    recoveryMode=false;await supabase.auth.signOut({scope:'local'}).catch(()=>supabase.auth.signOut().catch(()=>{}));message('Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.','success');setTimeout(()=>location.replace('./client.html'),850);
  });
}

async function loadPortal(){
  const ticket=++portalEpoch;
  const {data:{user}}=await supabase.auth.getUser();
  if(ticket!==portalEpoch)return;
  if(!user)return renderLogin();
  const {data:profileData,error:profileError}=await supabase.from('profiles').select('id,organization_id,role,first_name,last_name,email,active').eq('auth_user_id',user.id).maybeSingle();
  if(ticket!==portalEpoch)return;
  if(profileError)throw profileError;
  if(!profileData||profileData.role!=='client'||profileData.active===false)throw new Error('Aucun accès client actif n’est associé à ce compte.');
  const nextProfile=profileData;

  const {data:links,error:linkError}=await supabase.from('client_users').select('client_id,clients(id,name,report_email,billing_email,address,portal_enabled,active)').eq('profile_id',nextProfile.id);
  if(ticket!==portalEpoch)return;
  if(linkError)throw linkError;
  const nextClients=(links||[]).map(row=>row.clients).filter(Boolean).filter(c=>c.active!==false&&c.portal_enabled!==false);
  if(!nextClients.length)throw new Error('Votre compte n’est rattaché à aucun client autorisé.');
  const clientIds=nextClients.map(c=>c.id);

  const {data:siteLinks,error:siteError}=await supabase.from('client_sites').select('site_id,client_id,sites(id,firebase_id,name,address,active)').in('client_id',clientIds);
  if(ticket!==portalEpoch)return;
  if(siteError)throw siteError;
  const nextSites=(siteLinks||[]).map(row=>row.sites).filter(Boolean).filter(s=>s.active!==false);

  const {data:docs,error:docsError}=await supabase.from('generated_documents')
    .select('id,client_id,title,type,row_count,created_at,firebase_site_id,storage_bucket,storage_path,delivery_status,status,payload')
    .eq('organization_id',nextProfile.organization_id).eq('status','active').order('created_at',{ascending:false}).limit(500);
  if(ticket!==portalEpoch)return;
  if(docsError)throw docsError;
  const interventionResult=await supabase.rpc('sentinelle_client_interventions');
  if(ticket!==portalEpoch)return;
  if(interventionResult.error)throw interventionResult.error;
  interventions=interventionResult.data||[];
  profile=nextProfile;clients=nextClients;sites=nextSites;
  documents=(docs||[]).sort((a,b)=>(documentBusinessDate(b)?.getTime()||0)-(documentBusinessDate(a)?.getTime()||0));
  renderPortal();
}

function renderPortal(){
  root.className='client-shell';
  const clientNames=clients.map(c=>c.name).join(' · ');
  const latest=documents[0]||null;
  const latestMainCourante=documents.find(d=>{
    const type=String(d.type||'').toLowerCase();
    const title=String(d.title||'').toLowerCase();
    return type==='mission'||type==='mci'||title.includes('main courante');
  })||null;
  const last30=documents.filter(d=>{const dt=asDate(d.created_at);return dt&&Date.now()-dt.getTime()<=30*86400000;}).length;
  const sitePills=sites.length?sites.map(s=>`<span class="site-pill"><span class="site-pill-name">${safe(s.name)}</span>${s.address?`<span class="site-pill-address">${safe(s.address)}</span>`:''}</span>`).join(''):'<span class="site-pill site-pill-empty"><span class="site-pill-name">Aucun site affiché</span></span>';
  const siteOptions=sites.map(s=>`<option value="${safe(s.firebase_id||s.id)}">${safe(s.name)}</option>`).join('');
  const monthOptions=[...new Set(documents.map(d=>monthKey(documentBusinessDate(d))).filter(Boolean))].slice(0,18).map(m=>{const [y,mo]=m.split('-');const label=new Date(Number(y),Number(mo)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});return `<option value="${m}">${safe(label)}</option>`;}).join('');
  root.innerHTML=`
    <header class="client-topbar">
      <div class="client-brand"><span class="client-brand-mark"><img src="./assets/client-logo.png" alt=""></span><div class="client-brand-text"><h1>Sentinelle Pro <span class="portal-label">ESPACE CLIENT</span></h1><p>${safe(clientNames)}</p></div></div>
      <div class="client-actions"><button class="secondary" id="client-refresh">Actualiser</button><button class="ghost" id="client-logout">Déconnexion</button></div>
    </header>

    <section class="portal-hero">
      <div class="hero-card hero-main"><span class="hero-kicker">ACCÈS SÉCURISÉ ACTIF</span><h2>Bonjour ${safe(profile.first_name||'')}</h2><p>Votre espace de suivi opérationnel pour ${safe(clientNames)} · Consultez les rapports mis à votre disposition et retrouvez rapidement les documents de chacun de vos sites</p><div class="sites-strip">${sitePills}</div></div>
      <div class="hero-card hero-side latest-main-courante"><div class="hero-side-top"><span class="hero-side-icon">▤</span><span class="hero-side-status">ACCÈS DIRECT</span></div><div><div class="hero-side-label">DERNIÈRE MAIN COURANTE</div><div class="big">${latestMainCourante?shortDate(documentBusinessDate(latestMainCourante)):'—'}</div><div class="hero-side-title">${latestMainCourante?safe(latestMainCourante.title):'Aucune main courante disponible'}</div>${latestMainCourante?`<div class="hero-side-actions"><button id="client-open-latest-main-courante" data-document-id="${safe(latestMainCourante.id)}">Ouvrir</button><button class="secondary" id="client-download-latest-main-courante" data-document-id="${safe(latestMainCourante.id)}">Télécharger</button></div>`:'<div class="hero-side-empty">Le dernier PDF apparaîtra ici dès sa génération</div>'}</div></div>
    </section>

    <section class="client-metrics">
      <div class="metric-card"><div class="metric-icon">▤</div><div class="metric-copy"><span>DOCUMENTS DISPONIBLES</span><strong>${documents.length}</strong></div></div>
      <div class="metric-card"><div class="metric-icon">⌖</div><div class="metric-copy"><span>SITES ACCESSIBLES</span><strong>${sites.length}</strong></div></div>
      <div class="metric-card"><div class="metric-icon">＋</div><div class="metric-copy"><span>NOUVEAUX SUR 30 JOURS</span><strong>${last30}</strong></div></div>
    </section>

    <section class="portal-card" id="client-interventions">
      <div class="panel-head"><div><span class="eyebrow">OPÉRATIONS PONCTUELLES</span><h2>Interventions</h2><p>Vos bons finalisés et publiés, classés du plus récent au plus ancien.</p></div><span class="panel-count">${interventions.length} intervention(s)</span></div>
      <div class="document-grid">${interventions.map(i=>`<article class="document-card"><div class="doc-icon" aria-hidden="true">↗</div><div class="doc-main"><div class="doc-eyebrow"><span class="tag">${safe(i.number)}</span><span class="tag sent">Terminée</span></div><h3>${safe(i.reason)}</h3><p>${safe(i.site_name)} · ${safe(dateText(i.completed_at))}</p><p>${safe(i.kind)}</p></div><div class="doc-actions"><button data-intervention-open="${safe(i.document_id)}">Ouvrir le bon</button><button class="secondary" data-intervention-download="${safe(i.document_id)}">Télécharger</button></div></article>`).join('')||'<div class="empty">Aucun bon d’intervention publié pour le moment.</div>'}</div>
    </section>
    <section class="portal-card">
      <div class="panel-head"><div><h2>Mains courantes & rapports</h2><p>Consultez, recherchez et téléchargez vos PDF opérationnels</p></div><span class="panel-count" id="client-result-count">${documents.length} document${documents.length>1?'s':''}</span></div>
      <div class="filters"><select id="client-site-filter" aria-label="Filtrer par site"><option value="">Tous les sites</option>${siteOptions}</select><select id="client-type-filter" aria-label="Filtrer par type"><option value="">Tous les types</option><option value="mission">Rapports de mission</option><option value="intervention">Bons d’intervention</option><option value="mci">Mains courantes</option><option value="rounds">Rondes</option><option value="alerts">SOS / PTI</option></select><select id="client-month-filter" aria-label="Filtrer par période"><option value="">Toutes les périodes</option>${monthOptions}</select><input id="client-search" type="search" placeholder="Rechercher un rapport…" aria-label="Rechercher un rapport"></div>
      <div id="client-document-list" class="document-grid"></div>
    </section>
    <div class="footer-note"><strong>Sentinelle Pro</strong> · Portail client sécurisé · Azzera Protect — Sécurité privée</div>`;
  document.querySelector('#client-logout').addEventListener('click',()=>supabase.auth.signOut());
  document.querySelector('#client-refresh').addEventListener('click',async()=>{const button=document.querySelector('#client-refresh');if(button)button.disabled=true;try{await loadPortal();toast('Données actualisées','success');}catch(error){renderError(error);}});
  const latestOpen=document.querySelector('#client-open-latest-main-courante');
  const latestDownload=document.querySelector('#client-download-latest-main-courante');
  if(latestOpen)latestOpen.addEventListener('click',()=>openDocument(latestOpen.dataset.documentId,latestOpen,false));
  if(latestDownload)latestDownload.addEventListener('click',()=>openDocument(latestDownload.dataset.documentId,latestDownload,true));
  ['client-site-filter','client-type-filter','client-month-filter'].forEach(id=>document.querySelector(`#${id}`)?.addEventListener('change',drawDocuments));
  document.querySelector('#client-search')?.addEventListener('input',drawDocuments);
  document.querySelectorAll('[data-intervention-open]').forEach(b=>b.onclick=()=>openDocument(b.dataset.interventionOpen,b,false));
  document.querySelectorAll('[data-intervention-download]').forEach(b=>b.onclick=()=>openDocument(b.dataset.interventionDownload,b,true));
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
    return d.status==='active'&&siteAllowed&&(!site||dSite===site)&&(!type||String(d.type||'')===type)&&(!month||monthKey(documentBusinessDate(d))===month)&&matchSearch;
  });
  const count=document.querySelector('#client-result-count');if(count)count.textContent=`${rows.length} document${rows.length>1?'s':''}`;
  box.innerHTML=rows.length?rows.map(d=>{
    const siteName=siteMap.get(String(d.firebase_site_id||''))?.name||'Site rattaché';
    return `<article class="document-card"><div class="doc-icon" aria-hidden="true"></div><div class="doc-main"><div class="doc-eyebrow"><span class="tag">${safe(docTypeLabel(d.type))}</span>${d.delivery_status==='sent'?'<span class="tag sent">Envoyé par e-mail</span>':''}</div><h3 title="${safe(d.title||'Document')}">${safe(d.title||'Document')}</h3><p>${safe(siteName)} · ${safe(documentBusinessLabel(d))} · ${Number(d.row_count||0)} événement(s)</p></div><div class="doc-actions"><button data-open-document="${safe(d.id)}">Ouvrir PDF</button><button class="secondary" data-download-document="${safe(d.id)}">Télécharger</button></div></article>`;
  }).join(''):'<div class="empty">Aucun document ne correspond à ces filtres.</div>';
  box.querySelectorAll('[data-open-document]').forEach(button=>button.addEventListener('click',()=>openDocument(button.dataset.openDocument,button,false)));
  box.querySelectorAll('[data-download-document]').forEach(button=>button.addEventListener('click',()=>openDocument(button.dataset.downloadDocument,button,true)));
}

async function signedDocumentUrl(d,expires=120){
  const latest=await supabase.from('generated_documents').select('id,storage_bucket,storage_path').eq('id',d.id).maybeSingle();
  if(latest.error || !latest.data) throw new Error('Document retiré ou accès désactivé.');
  const {data,error}=await supabase.storage.from(latest.data.storage_bucket).createSignedUrl(latest.data.storage_path,expires);
  if(error)throw error;if(!data?.signedUrl)throw new Error('Lien PDF indisponible.');return data.signedUrl;
}
async function openDocument(documentId,button,download){
  const original=button.textContent;button.disabled=true;button.textContent=download?'Téléchargement…':'Ouverture…';
  const requestEpoch=portalEpoch;
  let preview=null;
  try{
    const intervention=interventions.find(row=>row.document_id===documentId);
    const d=documents.find(row=>row.id===documentId)||(intervention?{id:documentId,title:intervention.number}:null);if(!d)throw new Error('Document introuvable.');
    // Reserve the preview during the click gesture; Safari can block a popup
    // created after asynchronous authorization. No file is opened before checks.
    if(!download){
      preview=window.open('about:blank','_blank');
      if(!preview)throw new Error('Ouverture bloquée par le navigateur. Utilise le bouton Télécharger.');
      preview.opener=null;
    }
    const url=await signedDocumentUrl(d,180);
    if(requestEpoch!==portalEpoch)throw new Error('Session modifiée. Reconnecte-toi avant d’ouvrir le document.');
    if(!download){
      if(preview.closed)throw new Error('La fenêtre du document a été fermée.');
      preview.location.replace(url);return;
    }
    const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('Téléchargement impossible.');
    const blob=await response.blob();
    if(requestEpoch!==portalEpoch)throw new Error('Session modifiée. Reconnecte-toi avant d’ouvrir le document.');
    const a=document.createElement('a');const objectUrl=URL.createObjectURL(blob);a.href=objectUrl;a.download=`${String(d.title||'main-courante').replace(/[^a-z0-9-_]+/gi,'-')}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  }catch(error){if(preview&&!preview.closed)preview.close();toast(error?.message||'Ouverture impossible.');}
  finally{button.disabled=false;button.textContent=original;}
}

boot();
