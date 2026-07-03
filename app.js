import { firebaseConfig, DEFAULT_QG_WHATSAPP } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

const $app = document.querySelector('#app');
const $toast = document.querySelector('#toast-root');

let fbApp = null;
let auth = null;
let db = null;
let storage = null;
let currentUser = null;
let currentProfile = null;
let currentRoute = 'home';
let unsubscribeList = [];
let latestFlashUnsub = null;
let mapInstance = null;
let mapMarkers = [];
let sosTimer = null;
let sosArming = false;
let activeShiftCache = null;
let lastSitesCache = [];

const rolePortal = role => role === 'agent' ? 'agent' : 'qg';
const nowText = () => new Date().toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' });
const dateText = value => {
  if (!value) return '—';
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' });
};
const safe = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const id = () => Math.random().toString(36).slice(2, 10);
const isConfigured = () => firebaseConfig?.apiKey && !String(firebaseConfig.apiKey).includes('REMPLACE_MOI');
const isOnline = () => navigator.onLine;

function toast(message, type='info'){
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $toast.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function clearSubs(){
  unsubscribeList.forEach(fn => { try { fn(); } catch(e){} });
  unsubscribeList = [];
  if (latestFlashUnsub) { try { latestFlashUnsub(); } catch(e){} latestFlashUnsub = null; }
}

function getGPS(options={ enableHighAccuracy:true, timeout:8000, maximumAge:20000 }){
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, capturedAt: new Date().toISOString() }),
      () => resolve(null),
      options
    );
  });
}

function collectionRef(name){ return collection(db, name); }
function docRef(name, docId){ return doc(db, name, docId); }

function page(title, subtitle, body, options={}){
  const profileName = currentProfile ? `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim() : '';
  const portal = currentProfile ? rolePortal(currentProfile.role) : 'public';
  const nav = portal === 'agent' ? agentNav() : qgNav();
  const gpsPill = portal === 'agent' ? `<span class="pill ${currentProfile?.statut === 'en_poste' ? 'green' : ''}">${currentProfile?.statut === 'en_poste' ? 'GPS actif pendant le service' : 'GPS inactif hors poste'}</span>` : '';
  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <img src="assets/logo.png" alt="Sentinelle Pro">
          <div><div class="brand-name">Sentinelle Pro</div><div class="brand-kicker">Centre opérationnel</div></div>
        </div>
        <nav class="nav">${nav}</nav>
        <div class="side-footer">
          <div><strong>${safe(profileName || 'Utilisateur')}</strong></div>
          <div>${safe(currentProfile?.role || '')}</div>
          <div class="divider"></div>
          <button class="btn ghost full small" data-action="logout">Déconnexion</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div class="page-title"><h1>${safe(title)}</h1><p>${safe(subtitle || '')}</p></div>
          <div class="top-actions">
            ${gpsPill}
            <span class="pill ${navigator.onLine ? 'green':'red'}">${navigator.onLine ? 'En ligne':'Hors ligne'}</span>
            <span class="pill blue" id="clock-pill">${nowText()}</span>
            <button class="btn ghost small" data-action="logout">Quitter</button>
          </div>
        </div>
        ${body}
      </main>
      <nav class="mobile-tabbar">${nav}</nav>
      ${portal === 'agent' ? sosButton() : ''}
    </div>
  `;
}

function navBtn(route, icon, label){
  return `<button class="nav-btn ${currentRoute === route ? 'active':''}" data-route="${route}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`;
}
function agentNav(){
  return [
    navBtn('home','⌂','Accueil'), navBtn('mci','▤','MCI'), navBtn('round','◎','Ronde'), navBtn('docs','▣','Docs'), navBtn('flash','⚡','Flash')
  ].join('');
}
function qgNav(){
  return [
    navBtn('home','⌂','Dashboard'), navBtn('reports','▤','MCI'), navBtn('device','◉','Dispositif'), navBtn('sites','▣','Sites'), navBtn('agents','☷','Agents'), navBtn('alerts','!','SOS'), navBtn('flash','⚡','Flash'), navBtn('history','⇩','Exports')
  ].join('');
}
function sosButton(){
  return `<div class="sos-help hidden" id="sos-help">Maintenir 3 secondes pour déclencher. Relâcher annule l’armement.</div><div class="sos-fixed"><button class="sos-btn" id="sos-btn">SOS<br><small>PTI</small></button></div>`;
}

function boot(){
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  window.addEventListener('online', () => toast('Connexion rétablie', 'success'));
  window.addEventListener('offline', () => toast('Mode hors ligne — SOS non garanti', 'warning'));

  if (!isConfigured()) return renderSetupMissing();
  try {
    fbApp = initializeApp(firebaseConfig);
    auth = getAuth(fbApp);
    db = getFirestore(fbApp);
    storage = getStorage(fbApp);
  } catch (error) {
    console.error(error);
    return renderFatal('Configuration Firebase invalide', error.message);
  }

  onAuthStateChanged(auth, async user => {
    clearSubs();
    currentUser = user;
    activeShiftCache = null;
    if (!user) return renderLogin();
    await loadProfile(user);
  });
}

async function loadProfile(user){
  try {
    const snap = await getDoc(docRef('users', user.uid));
    if (!snap.exists()) return renderMissingProfile(user);
    currentProfile = { uid:user.uid, ...snap.data() };
    await updateDoc(docRef('users', user.uid), { lastSeen: serverTimestamp(), isOnline: true }).catch(() => {});
    currentRoute = 'home';
    if (rolePortal(currentProfile.role) === 'agent') renderAgentHome(); else renderQGHome();
    startFlashListener();
  } catch (error) {
    console.error(error);
    renderFatal('Accès refusé', 'Impossible de charger le profil utilisateur. Vérifie Firestore et les règles de sécurité.');
  }
}

function render(html){
  $app.className = '';
  $app.innerHTML = html;
  bindGlobalEvents();
  const clock = document.querySelector('#clock-pill');
  if (clock) setInterval(() => { const c=document.querySelector('#clock-pill'); if(c) c.textContent=nowText(); }, 30000);
}

function bindGlobalEvents(){
  document.querySelectorAll('[data-route]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.route)));
  document.querySelectorAll('[data-action="logout"]').forEach(btn => btn.addEventListener('click', async () => {
    if (currentUser) await updateDoc(docRef('users', currentUser.uid), { isOnline:false, lastSeen: serverTimestamp() }).catch(()=>{});
    await signOut(auth);
  }));
  bindSos();
}

function navigate(route){
  currentRoute = route;
  clearSubs();
  const portal = rolePortal(currentProfile.role);
  if (portal === 'agent') {
    ({ home:renderAgentHome, mci:renderAgentMCI, round:renderAgentRound, docs:renderAgentDocs, flash:renderAgentFlash }[route] || renderAgentHome)();
  } else {
    ({ home:renderQGHome, reports:renderQGReports, device:renderQGDevice, sites:renderQGSites, agents:renderQGAgents, alerts:renderQGAlerts, flash:renderQGFlash, history:renderQGHistory }[route] || renderQGHome)();
  }
}

function renderSetupMissing(){
  render(`
    <div class="login-page"><section class="login-card">
      <img src="assets/logo.png" class="login-logo" alt="Sentinelle Pro">
      <h1>Configuration requise</h1>
      <p class="subtitle">Portail opérationnel sécurisé</p>
      <div class="setup-box">
        L’application est en mode production uniquement. Aucun mode démo n’est activé.<br><br>
        Ouvre <strong>firebase-config.js</strong> et remplace les valeurs <strong>REMPLACE_MOI</strong> par celles de ton projet Firebase.
      </div>
      <div class="card compact">
        <div class="item-meta">À faire : Firebase Console → Paramètres du projet → Général → Application Web → copier apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId.</div>
      </div>
    </section></div>`);
}
function renderFatal(title, message){
  render(`<div class="login-page"><section class="login-card"><img src="assets/logo.png" class="login-logo"><h1>${safe(title)}</h1><p class="subtitle">Erreur système</p><div class="setup-box danger-copy">${safe(message)}</div></section></div>`);
}
function renderLogin(){
  currentProfile = null;
  render(`
    <div class="login-page">
      <form class="login-card" id="login-form">
        <img src="assets/logo.png" class="login-logo" alt="Sentinelle Pro">
        <h1>Sentinelle Pro</h1>
        <p class="subtitle">Portail opérationnel sécurisé</p>
        <div class="field"><label>Email</label><input class="input" name="email" type="email" autocomplete="email" required placeholder="agent@agence.fr"></div>
        <div class="field"><label>Mot de passe</label><input class="input" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></div>
        <button class="btn primary full" type="submit">Connexion sécurisée</button>
        <div class="divider"></div>
        <p class="muted" style="font-size:12px;line-height:1.55">Les comptes se créent dans Firebase Authentication. Le rôle se règle dans Firestore collection <strong>users</strong>.</p>
      </form>
    </div>`);
  document.querySelector('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await signInWithEmailAndPassword(auth, fd.get('email'), fd.get('password'));
      toast('Connexion validée', 'success');
    } catch (error) {
      toast('Connexion refusée. Vérifie email et mot de passe.', 'error');
    }
  });
}
function renderMissingProfile(user){
  render(`
    <div class="login-page"><section class="login-card">
      <img src="assets/logo.png" class="login-logo"><h1>Profil non configuré</h1><p class="subtitle">UID Firebase requis</p>
      <div class="setup-box">Le compte existe dans Authentication, mais son profil rôle n’existe pas encore dans Firestore.</div>
      <div class="field"><label>UID à copier</label><input class="input mono" readonly value="${safe(user.uid)}"></div>
      <div class="card compact"><div class="item-meta">Crée un document dans <strong>users</strong> avec cet UID. Champs minimum : uid, nom, prenom, email, role: "admin" ou "agent", statut: "actif".</div></div>
      <div class="divider"></div><button class="btn full" data-action="logout">Déconnexion</button>
    </section></div>`);
}

boot();

// -------------------- AGENT --------------------
async function findActiveShift(){
  if (!currentUser) return null;
  const q = query(collectionRef('shifts'), where('agentId','==',currentUser.uid), where('status','==','active'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id:d.id, ...d.data() };
}
async function getActiveSites(){
  const snap = await getDocs(query(collectionRef('sites'), where('isActive','==',true), orderBy('name'))).catch(async () => getDocs(query(collectionRef('sites'), where('isActive','==',true))));
  lastSitesCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  return lastSitesCache;
}

async function renderAgentHome(){
  currentRoute = 'home';
  const shift = await findActiveShift();
  activeShiftCache = shift;
  const isWorking = !!shift;
  const body = `
    <section class="grid cols-3">
      <div class="card stat ${isWorking?'green':'orange'}"><div class="stat-label">Statut agent</div><div class="stat-value">${isWorking?'En poste':'Hors poste'}</div><div class="muted">${safe(currentProfile.prenom || '')} ${safe(currentProfile.nom || '')}</div></div>
      <div class="card stat blue"><div class="stat-label">Site actuel</div><div class="stat-value" style="font-size:24px">${safe(shift?.siteNom || 'Aucun')}</div><div class="muted">${isWorking ? 'Mission active' : 'Prise de poste requise'}</div></div>
      <div class="card stat ${navigator.onLine?'green':'red'}"><div class="stat-label">Réseau</div><div class="stat-value">${navigator.onLine?'OK':'OFF'}</div><div class="muted">${navigator.onLine?'Synchronisation active':'SOS non garanti'}</div></div>
    </section>
    <section class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <div class="card-title"><div><h2>${isWorking?'Poste en cours':'Prise de poste'}</h2><p>${isWorking?'Terminer ou consulter le résumé':'Sélectionne le site et démarre la mission'}</p></div></div>
        ${isWorking ? shiftSummary(shift) + `<button class="btn danger full" id="end-shift-btn">Terminer poste</button>` : takeShiftForm()}
      </div>
      <div class="card">
        <div class="card-title"><div><h2>Actions rapides</h2><p>Terrain, main courante et ronde</p></div></div>
        <div class="grid cols-2">
          <button class="btn primary full" data-route="mci">Main courante</button>
          <button class="btn full" data-route="round">Ronde</button>
          <button class="btn full" data-route="docs">Documentation</button>
          <button class="btn warning full" data-route="flash">Messages Flash</button>
        </div>
        <div class="divider"></div>
        <button class="btn full" id="whatsapp-qg">Contacter le QG WhatsApp</button>
        <p class="muted" style="font-size:12px;margin-top:12px">Canal non critique. En urgence, utiliser SOS/PTI.</p>
      </div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="card-title"><div><h2>Derniers rapports envoyés</h2><p>Flux personnel</p></div></div>
      <div id="agent-recent-reports" class="timeline"><div class="empty">Chargement...</div></div>
    </section>`;
  render(page('Accueil Agent', 'Exécution terrain rapide et sécurisée', body));
  bindAgentHome(shift);
  listenAgentRecentReports();
}

function shiftSummary(shift){
  return `<div class="list" style="margin-bottom:16px">
    <div class="item"><div class="item-main"><div class="item-title">${safe(shift.siteNom)}</div><div class="item-meta">Prise de poste : ${dateText(shift.startTime)}<br>Status : ${safe(shift.status)}</div></div></div>
  </div>`;
}
function takeShiftForm(){
  return `<form id="take-shift-form">
    <div class="field"><label>Site</label><select class="select" name="siteId" id="site-select" required><option value="">Chargement des sites...</option></select></div>
    <div id="site-info" class="empty">Sélectionne un site pour afficher les consignes.</div>
    <div class="divider"></div>
    <button class="btn primary full" type="submit">Prendre poste</button>
  </form>`;
}
async function bindAgentHome(shift){
  document.querySelectorAll('[data-route]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.route)));
  const whatsappBtn = document.querySelector('#whatsapp-qg');
  if (whatsappBtn) whatsappBtn.addEventListener('click', () => openWhatsapp(shift));
  if (!shift) {
    const sites = await getActiveSites();
    const select = document.querySelector('#site-select');
    if (select) {
      select.innerHTML = `<option value="">Choisir un site</option>` + sites.map(s => `<option value="${safe(s.id)}">${safe(s.name)}</option>`).join('');
      select.addEventListener('change', () => {
        const site = sites.find(s => s.id === select.value);
        const box = document.querySelector('#site-info');
        box.innerHTML = site ? `<div class="item"><div class="item-main"><div class="item-title">${safe(site.name)}</div><div class="item-meta">Client : ${safe(site.clientName || '—')}<br>Adresse : ${safe(site.address || '—')}<br>Contact urgence : ${safe(site.emergencyContact || '—')}<br><br>${safe(site.instructions || 'Aucune consigne renseignée.')}</div></div></div>` : 'Sélectionne un site pour afficher les consignes.';
      });
    }
    const form = document.querySelector('#take-shift-form');
    form?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!isOnline()) return toast('Réseau indisponible — prise de poste impossible.', 'error');
      const site = sites.find(s => s.id === new FormData(form).get('siteId'));
      if (!site) return toast('Sélectionne un site.', 'warning');
      await takeShift(site);
    });
  } else {
    document.querySelector('#end-shift-btn')?.addEventListener('click', () => endShift(shift));
  }
}
async function takeShift(site){
  try {
    const existing = await findActiveShift();
    if (existing) return toast('Un poste est déjà ouvert. Termine-le avant d’en ouvrir un autre.', 'warning');
    const gps = await getGPS();
    const agentNom = `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim();
    const shiftDoc = await addDoc(collectionRef('shifts'), {
      agentId: currentUser.uid, agentNom, siteId: site.id, siteNom: site.name,
      startTime: serverTimestamp(), positionGPS: gps, status:'active', createdAt: serverTimestamp(), createdBy: currentUser.uid
    });
    await updateDoc(docRef('users', currentUser.uid), { statut:'en_poste', siteActuel: site.id, siteActuelNom: site.name, lastSeen: serverTimestamp() });
    await addAudit('shift_start', { shiftId: shiftDoc.id, siteId: site.id });
    toast('Poste démarré', 'success');
    renderAgentHome();
  } catch(error){ console.error(error); toast('Erreur prise de poste. Vérifie les droits Firebase.', 'error'); }
}
async function endShift(shift){
  const ok = confirm(`Terminer le poste sur ${shift.siteNom} ?`);
  if (!ok) return;
  try {
    const reportsSnap = await getDocs(query(collectionRef('reports'), where('agentId','==',currentUser.uid), where('shiftId','==',shift.id)));
    const roundsSnap = await getDocs(query(collectionRef('rounds'), where('agentId','==',currentUser.uid), where('shiftId','==',shift.id)));
    await updateDoc(docRef('shifts', shift.id), {
      completedAt: serverTimestamp(), status:'completed', reportsCount: reportsSnap.size, roundsCount: roundsSnap.size, updatedAt: serverTimestamp(), updatedBy: currentUser.uid
    });
    await updateDoc(docRef('users', currentUser.uid), { statut:'hors_poste', siteActuel:null, siteActuelNom:null, lastSeen: serverTimestamp() });
    await addAudit('shift_end', { shiftId: shift.id, reportsCount: reportsSnap.size, roundsCount: roundsSnap.size });
    toast('Poste terminé', 'success');
    renderAgentHome();
  } catch(error){ console.error(error); toast('Erreur fin de poste.', 'error'); }
}
function listenAgentRecentReports(){
  const box = document.querySelector('#agent-recent-reports');
  if (!box) return;
  const q = query(collectionRef('reports'), where('agentId','==',currentUser.uid), orderBy('createdAt','desc'), limit(8));
  const unsub = onSnapshot(q, snap => {
    if (snap.empty) return box.innerHTML = `<div class="empty">Aucun rapport envoyé.</div>`;
    box.innerHTML = snap.docs.map(d => reportTimeline(d.data())).join('');
  }, () => box.innerHTML = `<div class="empty">Flux indisponible. Vérifie les index Firestore.</div>`);
  unsubscribeList.push(unsub);
}
function reportTimeline(r){
  const sev = String(r.severity || 'normal').toLowerCase();
  return `<div class="timeline-entry ${sev}"><div class="item-title">${safe(r.category || 'Rapport')} · ${safe(r.siteNom || '')}</div><div class="item-meta">${dateText(r.createdAt)} · Gravité ${safe(r.severity || 'Normal')}</div><div style="margin-top:6px">${safe(r.message || '')}</div></div>`;
}

async function renderAgentMCI(){
  currentRoute = 'mci';
  const shift = await findActiveShift();
  const body = `<section class="grid cols-2">
    <div class="card">
      <div class="card-title"><div><h2>Main courante intelligente</h2><p>Maximum 2 clics pour déclarer</p></div></div>
      ${!shift ? `<div class="setup-box">Tu dois prendre poste avant d’envoyer une main courante.</div>` : mciForm(shift)}
    </div>
    <div class="card"><div class="card-title"><div><h2>Flux du site</h2><p>Rapports récents</p></div></div><div id="site-report-feed" class="timeline"><div class="empty">Chargement...</div></div></div>
  </section>`;
  render(page('Main Courante Agent', 'Rapport opérationnel envoyé au QG en temps réel', body));
  if (shift) bindMCIForm(shift);
  listenSiteReports(shift?.siteId);
}
function mciForm(shift){
  const cats = ['Ronde','Anomalie','Incident','Information','Intervention','Consigne reçue','Prise de service','Fin de service'];
  return `<form id="mci-form">
    <div class="field"><label>Catégorie</label><div class="category-grid">${cats.map((c,i)=>`<button type="button" class="cat-btn ${i===0?'active':''}" data-cat="${safe(c)}">${safe(c)}</button>`).join('')}</div><input type="hidden" name="category" value="Ronde"></div>
    <div class="field"><label>Niveau</label><select class="select" name="severity"><option>Normal</option><option>À surveiller</option><option>Important</option><option>Critique</option></select></div>
    <div class="field"><label>Rapport</label><textarea class="textarea" name="message" required placeholder="Décrire l’événement de manière factuelle..."></textarea></div>
    <div class="btn-row"><button type="button" class="btn" id="voice-btn">🎙️ Micro</button><label class="btn"><input type="file" name="photo" accept="image/*" hidden>📷 Photo</label><button type="button" class="btn" id="gps-btn">◎ GPS</button></div>
    <input type="hidden" name="gpsRequested" value="false">
    <div id="voice-state" class="muted" style="margin:12px 0;font-size:12px"></div>
    <div class="divider"></div><button class="btn primary full" type="submit">Envoyer au QG</button>
  </form>`;
}
function bindMCIForm(shift){
  const form = document.querySelector('#mci-form');
  document.querySelectorAll('.cat-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); form.category.value = btn.dataset.cat;
  }));
  document.querySelector('#voice-btn')?.addEventListener('click', () => {
    const box = document.querySelector('#voice-state');
    box.textContent = 'Dictée en cours... simulation de transcription.';
    setTimeout(() => {
      form.message.value = (form.message.value ? form.message.value + '\n' : '') + 'Observation terrain à compléter : présence constatée, zone sécurisée, information transmise au QG.';
      box.textContent = 'Transcription ajoutée. Corrige le texte avant envoi.';
    }, 900);
  });
  document.querySelector('#gps-btn')?.addEventListener('click', () => { form.gpsRequested.value = 'true'; toast('Position GPS demandée pour ce rapport.', 'success'); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!isOnline()) return toast('Réseau indisponible — rapport conservé impossible dans cette version production.', 'error');
    const fd = new FormData(form);
    const file = fd.get('photo');
    let photoUrl = null;
    try {
      if (file && file.name) {
        const path = `reports/${currentUser.uid}/${Date.now()}-${file.name}`;
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file);
        photoUrl = await getDownloadURL(fileRef);
      }
      const gps = fd.get('gpsRequested') === 'true' ? await getGPS() : null;
      await addDoc(collectionRef('reports'), {
        agentId: currentUser.uid,
        agentNom: `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim(),
        siteId: shift.siteId, siteNom: shift.siteNom, shiftId: shift.id,
        category: fd.get('category'), severity: fd.get('severity'), message: fd.get('message'),
        photoUrl, gps, status:'new', isLocked:true, createdAt: serverTimestamp(), createdBy: currentUser.uid
      });
      await updateDoc(docRef('users', currentUser.uid), { lastSeen: serverTimestamp() }).catch(()=>{});
      await addAudit('report_create', { siteId: shift.siteId, category: fd.get('category'), severity: fd.get('severity') });
      form.reset(); form.category.value = 'Ronde'; toast('Rapport envoyé au QG', 'success');
    } catch(error){ console.error(error); toast('Erreur envoi rapport.', 'error'); }
  });
}
function listenSiteReports(siteId){
  const box = document.querySelector('#site-report-feed'); if (!box || !siteId) return;
  const q = query(collectionRef('reports'), where('siteId','==',siteId), orderBy('createdAt','desc'), limit(12));
  const unsub = onSnapshot(q, snap => box.innerHTML = snap.empty ? `<div class="empty">Aucun rapport pour ce site.</div>` : snap.docs.map(d => reportTimeline(d.data())).join(''));
  unsubscribeList.push(unsub);
}

async function renderAgentDocs(){
  currentRoute = 'docs';
  const shift = await findActiveShift();
  const body = `<section class="grid cols-2">
    <div class="card"><div class="card-title"><div><h2>Consignes site</h2><p>Consultation opérationnelle</p></div></div><div id="docs-consignes">${shift?'Chargement...':'<div class="empty">Prends poste pour accéder aux consignes du site.</div>'}</div></div>
    <div class="card"><div class="card-title"><div><h2>Documents et plans</h2><p>PDF, images, contacts</p></div></div><div class="field"><label>Recherche rapide</label><input class="input" id="doc-search" placeholder="incendie, intrusion, évacuation..."></div><div id="docs-list" class="list"><div class="empty">Chargement...</div></div><div id="doc-viewer" class="doc-viewer" style="margin-top:14px"><div class="empty" style="margin:20px">Sélectionne un document.</div></div></div>
  </section>`;
  render(page('Documentation Site', 'Consignes, plans et procédures spécifiques', body));
  if (shift) loadSiteDocs(shift.siteId);
}
async function loadSiteDocs(siteId){
  const siteSnap = await getDoc(docRef('sites', siteId));
  const site = siteSnap.exists() ? siteSnap.data() : {};
  document.querySelector('#docs-consignes').innerHTML = `<div class="list">
    <div class="item"><div class="item-main"><div class="item-title">${safe(site.name || 'Site')}</div><div class="item-meta">Client : ${safe(site.clientName || '—')}<br>Adresse : ${safe(site.address || '—')}<br>Contact urgence : ${safe(site.emergencyContact || '—')}<br>Contact client : ${safe(site.contactPhone || '—')}</div></div></div>
    <div class="item"><div class="item-main"><div class="item-title">Consignes principales</div><div class="item-meta">${safe(site.instructions || 'Aucune consigne renseignée.')}</div></div></div>
  </div>`;
  const docsSnap = await getDocs(query(collectionRef('documents'), where('siteId','==',siteId), where('status','==','active'))).catch(()=>({docs:[]}));
  const docs = docsSnap.docs.map(d => ({id:d.id, ...d.data()}));
  renderDocList(docs);
  document.querySelector('#doc-search')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    renderDocList(docs.filter(doc => `${doc.title} ${doc.type} ${doc.description}`.toLowerCase().includes(term)));
  });
}
function renderDocList(docs){
  const list = document.querySelector('#docs-list');
  if (!docs.length) return list.innerHTML = `<div class="empty">Aucun document lié au site.</div>`;
  list.innerHTML = docs.map(d => `<div class="item"><div class="item-main"><div class="item-title">${safe(d.title || 'Document')}</div><div class="item-meta">${safe(d.type || 'document')} · ${safe(d.description || '')}</div></div><div class="item-actions"><button class="btn small" data-open-doc="${safe(d.id)}">Ouvrir</button></div></div>`).join('');
  document.querySelectorAll('[data-open-doc]').forEach(btn => btn.addEventListener('click', () => {
    const doc = docs.find(d => d.id === btn.dataset.openDoc);
    const url = doc?.url || doc?.fileUrl;
    if (!url) return toast('URL document manquante.', 'warning');
    const v = document.querySelector('#doc-viewer');
    if ((doc.type || '').toLowerCase().includes('image') || /\.(png|jpg|jpeg|webp)$/i.test(url)) v.innerHTML = `<img src="${safe(url)}" alt="${safe(doc.title)}">`;
    else v.innerHTML = `<iframe src="${safe(url)}" title="${safe(doc.title)}"></iframe>`;
  }));
}

async function renderAgentRound(){
  currentRoute = 'round';
  const shift = await findActiveShift();
  const body = `<section class="grid cols-2">
    <div class="card"><div class="card-title"><div><h2>Validation de ronde</h2><p>QR prioritaire, NFC si compatible</p></div></div>${shift ? roundUI() : `<div class="setup-box">Tu dois prendre poste avant de démarrer une ronde.</div>`}</div>
    <div class="card"><div class="card-title"><div><h2>Points de contrôle</h2><p>Progression en temps réel</p></div></div><div id="round-checkpoints" class="list"><div class="empty">Chargement...</div></div></div>
  </section>`;
  render(page('Ronde Agent', 'Certification des passages terrain', body));
  if (shift) bindRound(shift);
}
function roundUI(){
  return `<div class="qr-zone"><div style="font-weight:900;font-size:20px">Scanner QR / NFC</div><p class="muted">NFC disponible uniquement sur navigateur compatible. QR obligatoire en fallback.</p><div class="field"><label>Code point de ronde</label><input class="input mono" id="checkpoint-code" placeholder="Scanner ou saisir le code"></div><div class="btn-row"><button class="btn primary" id="validate-checkpoint">Valider point</button><button class="btn" id="nfc-read">Lire NFC</button></div></div><div class="divider"></div><div class="progress-shell"><div id="round-progress" class="progress-bar" style="width:0%"></div></div><p class="muted" id="round-progress-text">0% validé</p>`;
}
async function bindRound(shift){
  const snap = await getDocs(query(collectionRef('roundCheckpoints'), where('siteId','==',shift.siteId), where('isActive','==',true), orderBy('order'))).catch(async()=>getDocs(query(collectionRef('roundCheckpoints'), where('siteId','==',shift.siteId), where('isActive','==',true))));
  const points = snap.docs.map(d => ({id:d.id, ...d.data()}));
  const state = { roundId:null, validated:new Set(), points };
  renderCheckpoints(state);
  document.querySelector('#validate-checkpoint')?.addEventListener('click', async () => {
    const code = document.querySelector('#checkpoint-code').value.trim();
    const point = points.find(p => p.qrCode === code || p.nfcId === code || p.id === code);
    if (!point) return toast('Point non reconnu.', 'error');
    await validateCheckpoint(shift, state, point, 'QR');
  });
  document.querySelector('#nfc-read')?.addEventListener('click', async () => {
    if (!('NDEFReader' in window)) return toast('NFC non compatible. Utilise le QR code.', 'warning');
    try {
      const reader = new NDEFReader();
      await reader.scan();
      toast('Approche le téléphone du tag NFC.', 'success');
      reader.onreading = async event => {
        const serial = event.serialNumber;
        const point = points.find(p => p.nfcId === serial);
        if (point) await validateCheckpoint(shift, state, point, 'NFC'); else toast('Tag NFC non reconnu.', 'error');
      };
    } catch { toast('Lecture NFC refusée ou indisponible.', 'warning'); }
  });
}
function renderCheckpoints(state){
  const list = document.querySelector('#round-checkpoints');
  if (!state.points.length) return list.innerHTML = `<div class="empty">Aucun point de ronde configuré pour ce site.</div>`;
  list.innerHTML = state.points.map(p => `<div class="item"><div class="item-main"><div class="item-title">${state.validated.has(p.id)?'✅':'○'} ${safe(p.name)}</div><div class="item-meta">Zone : ${safe(p.zone || '—')} · Ordre : ${safe(p.order || '—')}<br>${safe(p.description || '')}</div></div></div>`).join('');
  const percent = Math.round((state.validated.size / state.points.length) * 100);
  const bar = document.querySelector('#round-progress'); if (bar) bar.style.width = `${percent}%`;
  const txt = document.querySelector('#round-progress-text'); if (txt) txt.textContent = `${percent}% validé · ${state.validated.size}/${state.points.length}`;
}
async function validateCheckpoint(shift, state, point, method){
  try {
    if (!state.roundId) {
      const round = await addDoc(collectionRef('rounds'), { agentId:currentUser.uid, agentNom:`${currentProfile.prenom||''} ${currentProfile.nom||''}`.trim(), siteId:shift.siteId, siteNom:shift.siteNom, shiftId:shift.id, startedAt:serverTimestamp(), status:'active', checkpointsValidated:[] });
      state.roundId = round.id;
    }
    if (state.validated.has(point.id)) return toast('Point déjà contrôlé.', 'warning');
    const gps = await getGPS();
    await addDoc(collectionRef('roundCheckpointsLogs'), { roundId:state.roundId, agentId:currentUser.uid, siteId:shift.siteId, checkpointId:point.id, checkpointName:point.name, scanMethod:method, gps, scannedAt:serverTimestamp(), isValid:true, createdBy:currentUser.uid });
    state.validated.add(point.id);
    await updateDoc(docRef('rounds', state.roundId), { checkpointsValidated:[...state.validated], status:state.validated.size === state.points.length ? 'completed':'active', completedAt:state.validated.size === state.points.length ? serverTimestamp() : null });
    document.querySelector('#checkpoint-code').value = '';
    renderCheckpoints(state);
    toast('Point contrôlé', 'success');
  } catch(error){ console.error(error); toast('Erreur validation ronde.', 'error'); }
}

function openWhatsapp(shift){
  const phone = shift?.whatsappQG || DEFAULT_QG_WHATSAPP;
  const msg = `Bonjour QG, ici ${currentProfile.prenom || ''} ${currentProfile.nom || ''}, site ${shift?.siteNom || 'non renseigné'}, je vous contacte concernant :`;
  window.open(`https://wa.me/${String(phone).replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function renderAgentFlash(){
  currentRoute = 'flash';
  const body = `<section class="card"><div class="card-title"><div><h2>Messages Flash reçus</h2><p>Confirmation de lecture obligatoire</p></div></div><div id="agent-flash-list" class="list"><div class="empty">Chargement...</div></div></section>`;
  render(page('Messages Flash', 'Alertes descendantes du QG', body));
  listenAgentFlashList();
}
function listenAgentFlashList(){
  const box = document.querySelector('#agent-flash-list'); if (!box) return;
  const q = query(collectionRef('flashMessages'), orderBy('sentAt','desc'), limit(30));
  const unsub = onSnapshot(q, snap => {
    const data = snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(f => flashTargetsMe(f));
    if (!data.length) return box.innerHTML = `<div class="empty">Aucun message Flash.</div>`;
    box.innerHTML = data.map(f => `<div class="item"><div class="item-main"><div class="item-title">${safe(f.title)}</div><div class="item-meta">${safe(f.priority || 'Information')} · ${dateText(f.sentAt)}<br>${safe(f.message)}</div></div><div class="item-actions">${f.readBy?.[currentUser.uid] ? '<span class="pill green">Lu</span>' : `<button class="btn small primary" data-read-flash="${safe(f.id)}">Confirmer lecture</button>`}</div></div>`).join('');
    document.querySelectorAll('[data-read-flash]').forEach(btn => btn.addEventListener('click', () => markFlashRead(btn.dataset.readFlash)));
  });
  unsubscribeList.push(unsub);
}

// -------------------- QG --------------------
function roleAllowedAdmin(){ return ['admin','superviseur'].includes(currentProfile?.role); }

async function renderQGHome(){
  currentRoute = 'home';
  const body = `
    <section class="grid cols-4" id="qg-stats">
      <div class="card stat green"><div class="stat-label">Agents en poste</div><div class="stat-value" id="stat-working">—</div></div>
      <div class="card stat red"><div class="stat-label">Alertes actives</div><div class="stat-value" id="stat-alerts">—</div></div>
      <div class="card stat orange"><div class="stat-label">Incidents 24h</div><div class="stat-value" id="stat-incidents">—</div></div>
      <div class="card stat blue"><div class="stat-label">Rapports du jour</div><div class="stat-value" id="stat-reports">—</div></div>
    </section>
    <section class="grid cols-2" style="margin-top:16px">
      <div class="card"><div class="card-title"><div><h2>Carte opérationnelle</h2><p>Agents en poste et positions connues</p></div></div><div id="qg-map" class="map"></div></div>
      <div class="card"><div class="card-title"><div><h2>Alertes prioritaires</h2><p>SOS/PTI actifs</p></div></div><div id="qg-alerts-feed" class="list"><div class="empty">Chargement...</div></div></div>
    </section>
    <section class="card" style="margin-top:16px"><div class="card-title"><div><h2>Derniers rapports MCI</h2><p>Temps réel</p></div><button class="btn small" data-route="reports">Voir journal</button></div><div id="qg-reports-feed" class="timeline"><div class="empty">Chargement...</div></div></section>`;
  render(page('Dashboard QG', 'Centre de commandement temps réel', body));
  listenQGStats(); listenQGReportsFeed(); listenQGAlertsFeed(); initQGMap();
}
function listenQGStats(){
  const usersQ = query(collectionRef('users'));
  const alertsQ = query(collectionRef('alerts'), where('statut','==','active'));
  const reportsQ = query(collectionRef('reports'), orderBy('createdAt','desc'), limit(200));
  unsubscribeList.push(onSnapshot(usersQ, snap => {
    const users = snap.docs.map(d=>d.data());
    const working = users.filter(u => u.statut === 'en_poste').length;
    setText('#stat-working', working);
  }));
  unsubscribeList.push(onSnapshot(alertsQ, snap => setText('#stat-alerts', snap.size)));
  unsubscribeList.push(onSnapshot(reportsQ, snap => {
    const since = Date.now() - 24*60*60*1000;
    const rows = snap.docs.map(d=>d.data());
    setText('#stat-reports', rows.length);
    setText('#stat-incidents', rows.filter(r => ['Incident','Intervention'].includes(r.category) && (r.createdAt?.toDate?.()?.getTime() || 0) > since).length);
  }));
}
function setText(sel, value){ const el=document.querySelector(sel); if(el) el.textContent=value; }
function listenQGReportsFeed(){
  const box = document.querySelector('#qg-reports-feed'); if(!box) return;
  const q = query(collectionRef('reports'), orderBy('createdAt','desc'), limit(12));
  unsubscribeList.push(onSnapshot(q, snap => box.innerHTML = snap.empty ? `<div class="empty">Aucun rapport.</div>` : snap.docs.map(d=>reportTimeline(d.data())).join('')));
}
function listenQGAlertsFeed(){
  const box = document.querySelector('#qg-alerts-feed'); if(!box) return;
  const q = query(collectionRef('alerts'), where('statut','==','active'));
  unsubscribeList.push(onSnapshot(q, snap => {
    if (snap.empty) return box.innerHTML = `<div class="empty">Aucune alerte active.</div>`;
    box.innerHTML = snap.docs.map(d => alertItem({id:d.id,...d.data()}, true)).join('');
    bindAlertActions();
  }));
}
function alertItem(a, compact=false){
  return `<div class="item" style="border-color:rgba(255,46,46,.4)"><div class="item-main"><div class="item-title">🚨 ${safe(a.typeAlerte || 'SOS/PTI')} · ${safe(a.agentNom)}</div><div class="item-meta">Site : ${safe(a.siteActuelNom || a.siteActuel || '—')}<br>Heure : ${dateText(a.heure || a.createdAt)}<br>${a.positionGPS ? `GPS : ${a.positionGPS.lat?.toFixed?.(5)}, ${a.positionGPS.lng?.toFixed?.(5)}` : 'GPS : indisponible'}</div></div><div class="item-actions"><button class="btn small danger" data-take-alert="${safe(a.id)}">Prendre en charge</button><button class="btn small" data-close-alert="${safe(a.id)}">Clôturer</button></div></div>`;
}
async function initQGMap(){
  const el = document.querySelector('#qg-map'); if (!el) return;
  if (!window.L) { el.innerHTML = '<div class="empty" style="margin:20px">Carte indisponible. Connexion CDN Leaflet requise.</div>'; return; }
  mapInstance = L.map('qg-map', { zoomControl:true }).setView([46.6, 2.4], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(mapInstance);
  const q = query(collectionRef('shifts'), where('status','==','active'));
  unsubscribeList.push(onSnapshot(q, snap => {
    mapMarkers.forEach(m => m.remove()); mapMarkers = [];
    const points = [];
    snap.docs.forEach(d => {
      const s = d.data(); const gps = s.positionGPS;
      if (!gps?.lat || !gps?.lng) return;
      const marker = L.marker([gps.lat, gps.lng]).addTo(mapInstance).bindPopup(`<strong>${safe(s.agentNom)}</strong><br>${safe(s.siteNom)}`);
      mapMarkers.push(marker); points.push([gps.lat, gps.lng]);
    });
    if (points.length) mapInstance.fitBounds(points, { padding:[40,40], maxZoom:14 });
  }));
}

function renderQGReports(){
  currentRoute = 'reports';
  const body = `<section class="card"><div class="card-title"><div><h2>Journal MCI</h2><p>Filtres et traitement des rapports</p></div><button class="btn small" id="export-reports">Export CSV</button></div>
    <div class="form-grid"><div class="field"><label>Recherche</label><input class="input" id="report-search" placeholder="Agent, site, message..."></div><div class="field"><label>Gravité</label><select class="select" id="severity-filter"><option value="">Toutes</option><option>Normal</option><option>À surveiller</option><option>Important</option><option>Critique</option></select></div></div>
    <div id="reports-table" class="table-wrap"><div class="empty">Chargement...</div></div></section>`;
  render(page('Supervision MCI', 'Journal de bord temps réel', body));
  let rows = [];
  const q = query(collectionRef('reports'), orderBy('createdAt','desc'), limit(200));
  const redraw = () => renderReportsTable(rows);
  unsubscribeList.push(onSnapshot(q, snap => { rows = snap.docs.map(d=>({id:d.id,...d.data()})); redraw(); }));
  document.querySelector('#report-search').addEventListener('input', redraw);
  document.querySelector('#severity-filter').addEventListener('change', redraw);
  document.querySelector('#export-reports').addEventListener('click', () => exportCSV(rows, 'mci-reports.csv'));
}
function renderReportsTable(rows){
  const term = document.querySelector('#report-search')?.value.toLowerCase() || '';
  const sev = document.querySelector('#severity-filter')?.value || '';
  const filtered = rows.filter(r => (!sev || r.severity === sev) && `${r.agentNom} ${r.siteNom} ${r.category} ${r.message}`.toLowerCase().includes(term));
  const box = document.querySelector('#reports-table');
  if (!filtered.length) return box.innerHTML = `<div class="empty">Aucun rapport trouvé.</div>`;
  box.innerHTML = `<table class="table"><thead><tr><th>Heure</th><th>Agent</th><th>Site</th><th>Catégorie</th><th>Gravité</th><th>Message</th><th>Statut</th><th>Action</th></tr></thead><tbody>${filtered.map(r => `<tr><td>${dateText(r.createdAt)}</td><td>${safe(r.agentNom)}</td><td>${safe(r.siteNom)}</td><td>${safe(r.category)}</td><td>${safe(r.severity)}</td><td>${safe(r.message)}</td><td>${safe(r.status || 'new')}</td><td><button class="btn small" data-report-detail="${safe(r.id)}">Détail</button></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-report-detail]').forEach(btn => btn.addEventListener('click', () => showReportDetail(filtered.find(r=>r.id===btn.dataset.reportDetail))));
}
function showReportDetail(r){
  showModal('Détail rapport MCI', `<div class="list"><div class="item"><div class="item-main"><div class="item-title">${safe(r.category)} · ${safe(r.severity)}</div><div class="item-meta">${safe(r.agentNom)} · ${safe(r.siteNom)} · ${dateText(r.createdAt)}</div><p>${safe(r.message)}</p>${r.photoUrl?`<img src="${safe(r.photoUrl)}" style="border-radius:16px;margin-top:12px">`:''}${r.gps?`<p class="muted">GPS : ${r.gps.lat}, ${r.gps.lng}</p>`:''}</div></div></div><div class="field"><label>Note superviseur</label><textarea class="textarea" id="supervisor-note" placeholder="Ajouter une note...">${safe(r.supervisorNote || '')}</textarea></div><button class="btn primary full" id="mark-treated">Marquer comme traité</button>`);
  document.querySelector('#mark-treated')?.addEventListener('click', async () => {
    await updateDoc(docRef('reports', r.id), { status:'treated', supervisorNote:document.querySelector('#supervisor-note').value, treatedBy:currentUser.uid, treatedAt:serverTimestamp() });
    await addAudit('report_treated', { reportId:r.id });
    closeModal(); toast('Rapport traité', 'success');
  });
}

function renderQGDevice(){
  currentRoute = 'device';
  const body = `<section class="card"><div class="card-title"><div><h2>Dispositif opérationnel</h2><p>Liste vivante des agents</p></div></div><div id="device-list" class="list"><div class="empty">Chargement...</div></div></section>`;
  render(page('Dispositif', 'Agents, statuts et activité terrain', body));
  const q = query(collectionRef('users'), orderBy('nom'));
  unsubscribeList.push(onSnapshot(q, snap => {
    const rows = snap.docs.map(d=>({id:d.id,...d.data()}));
    const box = document.querySelector('#device-list');
    box.innerHTML = rows.map(u => `<div class="item"><div class="item-main"><div class="item-title">${safe(u.prenom)} ${safe(u.nom)} <span class="pill ${u.statut==='en_poste'?'green':u.statut==='alerte'?'red':''}">${safe(u.statut || 'actif')}</span></div><div class="item-meta">Rôle : ${safe(u.role)}<br>Site : ${safe(u.siteActuelNom || u.siteActuel || '—')}<br>Dernière activité : ${dateText(u.lastSeen)}<br>Téléphone : ${safe(u.telephone || '—')}</div></div><div class="item-actions">${u.telephone?`<a class="btn small" href="tel:${safe(u.telephone)}">Appeler</a>`:''}</div></div>`).join('') || `<div class="empty">Aucun agent.</div>`;
  }));
}

function renderQGAgents(){
  currentRoute = 'agents';
  const body = `<section class="card"><div class="card-title"><div><h2>Gestion Agents</h2><p>Profils, rôles et statut</p></div><button class="btn primary small" id="add-agent-profile">Ajouter profil</button></div><div id="agents-table" class="table-wrap"><div class="empty">Chargement...</div></div></section>`;
  render(page('Gestion Agents', 'Administration opérationnelle des accès', body));
  document.querySelector('#add-agent-profile').addEventListener('click', () => showAgentForm());
  const q = query(collectionRef('users'), orderBy('nom'));
  unsubscribeList.push(onSnapshot(q, snap => renderAgentsTable(snap.docs.map(d=>({id:d.id,...d.data()})))));
}
function renderAgentsTable(rows){
  const box = document.querySelector('#agents-table');
  if (!rows.length) return box.innerHTML = `<div class="empty">Aucun profil agent.</div>`;
  box.innerHTML = `<table class="table"><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Rôle</th><th>Statut</th><th>Site actuel</th><th>Action</th></tr></thead><tbody>${rows.map(u=>`<tr><td>${safe(u.prenom)} ${safe(u.nom)}</td><td>${safe(u.email)}</td><td>${safe(u.telephone || '')}</td><td>${safe(u.role)}</td><td>${safe(u.statut)}</td><td>${safe(u.siteActuelNom || '—')}</td><td><button class="btn small" data-edit-agent="${safe(u.id)}">Modifier</button></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-edit-agent]').forEach(btn => btn.addEventListener('click', () => showAgentForm(rows.find(u=>u.id===btn.dataset.editAgent))));
}
function showAgentForm(u={}){
  showModal(u.id?'Modifier profil':'Ajouter profil agent', `<form id="agent-form"><div class="form-grid">
    <div class="field"><label>UID Firebase Auth</label><input class="input mono" name="uid" value="${safe(u.id || u.uid || '')}" required ${u.id?'readonly':''}></div>
    <div class="field"><label>Email</label><input class="input" name="email" type="email" value="${safe(u.email || '')}" required></div>
    <div class="field"><label>Prénom</label><input class="input" name="prenom" value="${safe(u.prenom || '')}" required></div>
    <div class="field"><label>Nom</label><input class="input" name="nom" value="${safe(u.nom || '')}" required></div>
    <div class="field"><label>Téléphone</label><input class="input" name="telephone" value="${safe(u.telephone || '')}"></div>
    <div class="field"><label>Matricule</label><input class="input" name="matricule" value="${safe(u.matricule || '')}"></div>
    <div class="field"><label>Rôle</label><select class="select" name="role"><option ${u.role==='agent'?'selected':''}>agent</option><option ${u.role==='superviseur'?'selected':''}>superviseur</option><option ${u.role==='admin'?'selected':''}>admin</option></select></div>
    <div class="field"><label>Statut</label><select class="select" name="statut"><option ${u.statut==='actif'?'selected':''}>actif</option><option ${u.statut==='hors_poste'?'selected':''}>hors_poste</option><option ${u.statut==='désactivé'?'selected':''}>désactivé</option></select></div>
  </div><button class="btn primary full" type="submit">Enregistrer profil</button></form>`);
  document.querySelector('#agent-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const uid = fd.get('uid');
    await setDoc(docRef('users', uid), { uid, email:fd.get('email'), prenom:fd.get('prenom'), nom:fd.get('nom'), telephone:fd.get('telephone'), matricule:fd.get('matricule'), role:fd.get('role'), statut:fd.get('statut'), updatedAt:serverTimestamp(), updatedBy:currentUser.uid, createdAt:u.createdAt || serverTimestamp() }, { merge:true });
    await addAudit('user_profile_saved', { uid, role:fd.get('role') });
    closeModal(); toast('Profil enregistré', 'success');
  });
}

function renderQGSites(){
  currentRoute = 'sites';
  const body = `<section class="card"><div class="card-title"><div><h2>Gestion Sites</h2><p>Consignes, contacts, points de ronde</p></div><button class="btn primary small" id="add-site">Ajouter site</button></div><div id="sites-table" class="table-wrap"><div class="empty">Chargement...</div></div></section>`;
  render(page('Gestion Sites', 'Configuration opérationnelle des missions', body));
  document.querySelector('#add-site').addEventListener('click', () => showSiteForm());
  const q = query(collectionRef('sites'), orderBy('name'));
  unsubscribeList.push(onSnapshot(q, snap => renderSitesTable(snap.docs.map(d=>({id:d.id,...d.data()})))));
}
function renderSitesTable(rows){
  const box = document.querySelector('#sites-table');
  if (!rows.length) return box.innerHTML = `<div class="empty">Aucun site configuré.</div>`;
  box.innerHTML = `<table class="table"><thead><tr><th>Site</th><th>Client</th><th>Adresse</th><th>Contact urgence</th><th>Actif</th><th>Action</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${safe(s.name)}</td><td>${safe(s.clientName || '')}</td><td>${safe(s.address || '')}</td><td>${safe(s.emergencyContact || '')}</td><td>${s.isActive?'Oui':'Non'}</td><td><button class="btn small" data-edit-site="${safe(s.id)}">Modifier</button><button class="btn small" data-points-site="${safe(s.id)}">Points</button></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-edit-site]').forEach(btn => btn.addEventListener('click', () => showSiteForm(rows.find(s=>s.id===btn.dataset.editSite))));
  document.querySelectorAll('[data-points-site]').forEach(btn => btn.addEventListener('click', () => showCheckpointsManager(btn.dataset.pointsSite)));
}
function showSiteForm(s={}){
  showModal(s.id?'Modifier site':'Ajouter site', `<form id="site-form"><div class="form-grid">
    <div class="field"><label>Nom du site</label><input class="input" name="name" value="${safe(s.name || '')}" required></div>
    <div class="field"><label>Client</label><input class="input" name="clientName" value="${safe(s.clientName || '')}"></div>
    <div class="field"><label>Adresse</label><input class="input" name="address" value="${safe(s.address || '')}"></div>
    <div class="field"><label>Contact client</label><input class="input" name="contactName" value="${safe(s.contactName || '')}"></div>
    <div class="field"><label>Téléphone client</label><input class="input" name="contactPhone" value="${safe(s.contactPhone || '')}"></div>
    <div class="field"><label>Urgence</label><input class="input" name="emergencyContact" value="${safe(s.emergencyContact || '')}"></div>
    <div class="field"><label>WhatsApp QG</label><input class="input" name="whatsappQG" value="${safe(s.whatsappQG || DEFAULT_QG_WHATSAPP)}"></div>
    <div class="field"><label>Actif</label><select class="select" name="isActive"><option value="true" ${s.isActive!==false?'selected':''}>Oui</option><option value="false" ${s.isActive===false?'selected':''}>Non</option></select></div>
  </div><div class="field"><label>Consignes principales</label><textarea class="textarea" name="instructions">${safe(s.instructions || '')}</textarea></div><button class="btn primary full" type="submit">Enregistrer site</button></form>`, 'wide');
  document.querySelector('#site-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const siteId = s.id || `site_${Date.now()}`;
    await setDoc(docRef('sites', siteId), { siteId, name:fd.get('name'), clientName:fd.get('clientName'), address:fd.get('address'), contactName:fd.get('contactName'), contactPhone:fd.get('contactPhone'), emergencyContact:fd.get('emergencyContact'), whatsappQG:fd.get('whatsappQG'), instructions:fd.get('instructions'), isActive:fd.get('isActive')==='true', updatedAt:serverTimestamp(), updatedBy:currentUser.uid, createdAt:s.createdAt || serverTimestamp(), createdBy:s.createdBy || currentUser.uid }, { merge:true });
    await addAudit('site_saved', { siteId }); closeModal(); toast('Site enregistré', 'success');
  });
}
async function showCheckpointsManager(siteId){
  showModal('Points de ronde', `<div class="card compact"><form id="checkpoint-form"><div class="form-grid"><div class="field"><label>Nom point</label><input class="input" name="name" required></div><div class="field"><label>Zone</label><input class="input" name="zone"></div><div class="field"><label>Ordre</label><input class="input" name="order" type="number" value="1"></div><div class="field"><label>QR code</label><input class="input mono" name="qrCode" value="QR-${Date.now()}"></div></div><div class="field"><label>Description</label><input class="input" name="description"></div><button class="btn primary full" type="submit">Ajouter point</button></form></div><div class="divider"></div><div id="checkpoint-list" class="list"><div class="empty">Chargement...</div></div>`, 'wide');
  const renderList = async () => {
    const snap = await getDocs(query(collectionRef('roundCheckpoints'), where('siteId','==',siteId))).catch(()=>({docs:[]}));
    const rows = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||0)-(b.order||0));
    document.querySelector('#checkpoint-list').innerHTML = rows.length ? rows.map(p=>`<div class="item"><div class="item-main"><div class="item-title">${safe(p.name)}</div><div class="item-meta">Zone : ${safe(p.zone||'—')} · Ordre : ${safe(p.order||'—')}<br>QR : <span class="mono">${safe(p.qrCode||p.id)}</span></div></div><div class="item-actions"><button class="btn small" data-print-qr="${safe(p.qrCode||p.id)}">Imprimer QR</button></div></div>`).join('') : `<div class="empty">Aucun point.</div>`;
    document.querySelectorAll('[data-print-qr]').forEach(btn => btn.addEventListener('click', () => printQRCode(btn.dataset.printQr)));
  };
  document.querySelector('#checkpoint-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    await addDoc(collectionRef('roundCheckpoints'), { siteId, name:fd.get('name'), zone:fd.get('zone'), order:Number(fd.get('order')||0), qrCode:fd.get('qrCode'), description:fd.get('description'), isActive:true, createdAt:serverTimestamp(), createdBy:currentUser.uid });
    await addAudit('checkpoint_created', { siteId }); e.currentTarget.reset(); toast('Point créé', 'success'); renderList();
  });
  renderList();
}
function printQRCode(code){
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(code)}`;
  const w = window.open('', '_blank');
  w.document.write(`<title>QR Point de ronde</title><body style="font-family:Arial;text-align:center;padding:40px"><h1>Point de ronde</h1><img src="${url}"><p>${safe(code)}</p><script>setTimeout(()=>print(),600)<\/script></body>`);
}

function renderQGAlerts(){
  currentRoute = 'alerts';
  const body = `<section class="card"><div class="card-title"><div><h2>Alertes SOS/PTI</h2><p>Prise en charge et clôture tracée</p></div></div><div id="alerts-list" class="list"><div class="empty">Chargement...</div></div></section>`;
  render(page('Alertes critiques', 'Traitement prioritaire des urgences terrain', body));
  const q = query(collectionRef('alerts'), orderBy('createdAt','desc'), limit(100));
  unsubscribeList.push(onSnapshot(q, snap => {
    const box = document.querySelector('#alerts-list');
    box.innerHTML = snap.empty ? `<div class="empty">Aucune alerte.</div>` : snap.docs.map(d=>alertItem({id:d.id,...d.data()})).join('');
    bindAlertActions();
  }));
}
function bindAlertActions(){
  document.querySelectorAll('[data-take-alert]').forEach(btn => btn.addEventListener('click', async () => {
    await updateDoc(docRef('alerts', btn.dataset.takeAlert), { statut:'taken', takenAt:serverTimestamp(), takenBy:currentUser.uid });
    await addAudit('alert_taken', { alertId:btn.dataset.takeAlert }); toast('Alerte prise en charge', 'success');
  }));
  document.querySelectorAll('[data-close-alert]').forEach(btn => btn.addEventListener('click', () => closeAlertFlow(btn.dataset.closeAlert)));
}
function closeAlertFlow(alertId){
  const reason = prompt('Justification obligatoire de clôture :');
  if (!reason || reason.trim().length < 5) return toast('Justification trop courte.', 'warning');
  updateDoc(docRef('alerts', alertId), { statut:'closed', closedAt:serverTimestamp(), closedBy:currentUser.uid, closeReason:reason.trim() })
    .then(()=>addAudit('alert_closed', { alertId, reason:reason.trim() }))
    .then(()=>toast('Alerte clôturée avec trace', 'success'))
    .catch(()=>toast('Erreur clôture alerte', 'error'));
}

function renderQGFlash(){
  currentRoute = 'flash';
  const body = `<section class="grid cols-2"><div class="card"><div class="card-title"><div><h2>Envoyer Flash</h2><p>Alerte descendante prioritaire</p></div></div><form id="flash-form"><div class="field"><label>Titre</label><input class="input" name="title" required placeholder="Message Flash reçu"></div><div class="field"><label>Message</label><textarea class="textarea" name="message" required></textarea></div><div class="form-grid"><div class="field"><label>Priorité</label><select class="select" name="priority"><option>Information</option><option>Important</option><option>Urgent</option><option>Critique</option></select></div><div class="field"><label>Cible</label><select class="select" name="target"><option value="all">Tous les agents</option><option value="working">Agents en poste</option></select></div></div><button class="btn primary full" type="submit">Envoyer en temps réel</button></form></div><div class="card"><div class="card-title"><div><h2>Historique Flash</h2><p>Confirmations de lecture</p></div></div><div id="flash-history" class="list"><div class="empty">Chargement...</div></div></div></section>`;
  render(page('Messages Flash QG', 'Communication descendante immédiate', body));
  document.querySelector('#flash-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    await addDoc(collectionRef('flashMessages'), { title:fd.get('title'), message:fd.get('message'), priority:fd.get('priority'), target:fd.get('target'), sentBy:currentUser.uid, sentAt:serverTimestamp(), readBy:{}, status:'sent' });
    await addAudit('flash_sent', { priority:fd.get('priority'), target:fd.get('target') }); e.currentTarget.reset(); toast('Message Flash envoyé', 'success');
  });
  const q = query(collectionRef('flashMessages'), orderBy('sentAt','desc'), limit(30));
  unsubscribeList.push(onSnapshot(q, snap => {
    const box = document.querySelector('#flash-history');
    box.innerHTML = snap.empty ? `<div class="empty">Aucun Flash envoyé.</div>` : snap.docs.map(d=>{ const f={id:d.id,...d.data()}; return `<div class="item"><div class="item-main"><div class="item-title">${safe(f.title)} <span class="pill ${f.priority==='Critique'?'red':f.priority==='Urgent'?'orange':'blue'}">${safe(f.priority)}</span></div><div class="item-meta">${dateText(f.sentAt)} · Cible ${safe(f.target)}<br>${safe(f.message)}<br>Lectures : ${Object.keys(f.readBy || {}).length}</div></div></div>`}).join('');
  }));
}

function renderQGHistory(){
  currentRoute = 'history';
  const body = `<section class="grid cols-3"><button class="card stat blue" id="export-reports-all"><div class="stat-label">Exporter</div><div class="stat-value">MCI</div></button><button class="card stat orange" id="export-rounds-all"><div class="stat-label">Exporter</div><div class="stat-value">Rondes</div></button><button class="card stat red" id="export-alerts-all"><div class="stat-label">Exporter</div><div class="stat-value">SOS</div></button></section><section class="card" style="margin-top:16px"><div class="card-title"><div><h2>Audit logs</h2><p>Actions sensibles tracées</p></div></div><div id="audit-list" class="timeline"><div class="empty">Chargement...</div></div></section>`;
  render(page('Historique / Exports', 'Traçabilité et extractions professionnelles', body));
  document.querySelector('#export-reports-all').onclick = () => exportCollection('reports','reports.csv');
  document.querySelector('#export-rounds-all').onclick = () => exportCollection('rounds','rounds.csv');
  document.querySelector('#export-alerts-all').onclick = () => exportCollection('alerts','alerts.csv');
  const q = query(collectionRef('auditLogs'), orderBy('createdAt','desc'), limit(50));
  unsubscribeList.push(onSnapshot(q, snap => document.querySelector('#audit-list').innerHTML = snap.empty ? `<div class="empty">Aucun audit log.</div>` : snap.docs.map(d=>{const a=d.data(); return `<div class="timeline-entry"><div class="item-title">${safe(a.action)}</div><div class="item-meta">${dateText(a.createdAt)} · ${safe(a.userId)}</div><div>${safe(JSON.stringify(a.details || {}))}</div></div>`}).join('')));
}
async function exportCollection(name, filename){
  const snap = await getDocs(query(collectionRef(name), limit(500)));
  exportCSV(snap.docs.map(d=>({id:d.id,...d.data()})), filename);
  await addAudit('export_data', { collection:name });
}
function exportCSV(rows, filename){
  if (!rows.length) return toast('Aucune donnée à exporter.', 'warning');
  const flat = rows.map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k, v?.toDate ? v.toDate().toISOString() : typeof v === 'object' ? JSON.stringify(v) : v])));
  const headers = [...new Set(flat.flatMap(r=>Object.keys(r)))];
  const csv = [headers.join(';'), ...flat.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(';'))].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

// -------------------- FLASH / SOS / UTILS --------------------
function flashTargetsMe(f){
  if (!currentProfile || rolePortal(currentProfile.role) !== 'agent') return false;
  if (f.target === 'all') return true;
  if (f.target === 'working') return currentProfile.statut === 'en_poste';
  if (f.target === `agent:${currentUser.uid}`) return true;
  if (currentProfile.siteActuel && f.target === `site:${currentProfile.siteActuel}`) return true;
  return false;
}
function startFlashListener(){
  if (!currentUser || rolePortal(currentProfile.role) !== 'agent') return;
  const q = query(collectionRef('flashMessages'), orderBy('sentAt','desc'), limit(5));
  latestFlashUnsub = onSnapshot(q, snap => {
    snap.docs.map(d => ({id:d.id,...d.data()})).filter(flashTargetsMe).forEach(f => {
      if (!f.readBy?.[currentUser.uid] && !document.querySelector(`[data-flash-overlay="${CSS.escape(f.id)}"]`)) showFlashOverlay(f);
    });
  });
}
function showFlashOverlay(f){
  const div = document.createElement('div');
  div.className = 'flash-overlay';
  div.dataset.flashOverlay = f.id;
  div.innerHTML = `<div class="flash-card ${f.priority === 'Critique' ? 'critique':''}"><div class="flash-priority">${safe(f.priority || 'Information')}</div><h2>${safe(f.title)}</h2><p>${safe(f.message)}</p><button class="btn primary full" data-confirm-flash="${safe(f.id)}">Confirmer lecture</button></div>`;
  document.body.appendChild(div);
  div.querySelector('[data-confirm-flash]').addEventListener('click', async () => { await markFlashRead(f.id); div.remove(); });
  if (navigator.vibrate) navigator.vibrate([120,80,120]);
}
async function markFlashRead(flashId){
  const field = `readBy.${currentUser.uid}`;
  await updateDoc(docRef('flashMessages', flashId), { [field]: { readAt: Timestamp.now(), agentNom:`${currentProfile.prenom||''} ${currentProfile.nom||''}`.trim() } });
  await addAudit('flash_read', { flashId });
  toast('Lecture confirmée', 'success');
}

function bindSos(){
  const btn = document.querySelector('#sos-btn');
  const help = document.querySelector('#sos-help');
  if (!btn) return;
  const start = e => {
    e.preventDefault();
    if (sosArming) return;
    sosArming = true;
    btn.classList.add('arming');
    help?.classList.remove('hidden');
    if (navigator.vibrate) navigator.vibrate(70);
    sosTimer = setTimeout(triggerSOS, 3000);
  };
  const stop = () => {
    if (!sosArming) return;
    clearTimeout(sosTimer);
    sosTimer = null;
    sosArming = false;
    btn.classList.remove('arming');
    help?.classList.add('hidden');
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
}
async function triggerSOS(){
  sosArming = false;
  document.querySelector('#sos-btn')?.classList.remove('arming');
  document.querySelector('#sos-help')?.classList.add('hidden');
  if (!isOnline()) {
    alert('Réseau indisponible — appelez directement le QG ou les secours. L’alerte SOS n’a pas été transmise.');
    return;
  }
  const confirmSend = confirm('Déclencher une alerte SOS/PTI au QG ?');
  if (!confirmSend) return;
  try {
    const shift = await findActiveShift();
    const gps = await getGPS();
    const agentNom = `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim();
    const alertDoc = await addDoc(collectionRef('alerts'), {
      agentId: currentUser.uid, agentNom, siteActuel: shift?.siteId || currentProfile.siteActuel || null, siteActuelNom: shift?.siteNom || currentProfile.siteActuelNom || null,
      positionGPS: gps, heure: serverTimestamp(), typeAlerte:'SOS/PTI', statut:'active', message:'Alerte PTI déclenchée par l’agent', niveau:'critique', createdAt:serverTimestamp(), createdBy:currentUser.uid
    });
    await updateDoc(docRef('users', currentUser.uid), { statut:'alerte', lastSeen:serverTimestamp() }).catch(()=>{});
    await addAudit('sos_triggered', { alertId: alertDoc.id, siteId: shift?.siteId || null });
    if (navigator.vibrate) navigator.vibrate([200,80,200,80,200]);
    showSOSSent(alertDoc.id);
  } catch(error){
    console.error(error);
    alert('L’alerte SOS n’a pas pu être transmise. Appelez directement le QG ou les secours.');
  }
}
function showSOSSent(alertId){
  showModal('Alerte envoyée au QG', `<div class="setup-box danger-copy">QG notifié. Restez en sécurité.</div><div class="grid cols-2"><a class="btn danger full" href="tel:112">Appeler secours 112</a><button class="btn full" id="false-alert">Fausse alerte</button></div><p class="muted" style="font-size:12px;margin-top:14px">La fausse alerte est tracée et ne supprime pas silencieusement l’historique.</p>`);
  document.querySelector('#false-alert')?.addEventListener('click', async () => {
    const reason = prompt('Confirme la fausse alerte avec une justification :');
    if (!reason || reason.trim().length < 5) return toast('Justification trop courte.', 'warning');
    await updateDoc(docRef('alerts', alertId), { statut:'false_alert_requested', falseAlertReason:reason.trim(), falseAlertAt:serverTimestamp(), falseAlertBy:currentUser.uid });
    await addAudit('sos_false_alert_requested', { alertId, reason:reason.trim() });
    toast('Fausse alerte signalée au QG', 'warning'); closeModal();
  });
}

async function addAudit(action, details={}){
  if (!db || !currentUser) return;
  try {
    await addDoc(collectionRef('auditLogs'), { action, details, userId: currentUser.uid, userRole: currentProfile?.role || null, createdAt: serverTimestamp(), userAgent:navigator.userAgent });
  } catch(e) { console.warn('audit failed', e); }
}
function showModal(title, body, size=''){
  closeModal();
  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'modal-root';
  div.innerHTML = `<div class="modal ${size === 'wide' ? 'wide':''}"><div class="modal-head"><h2>${safe(title)}</h2><button class="btn small ghost" id="modal-close">Fermer</button></div>${body}</div>`;
  document.body.appendChild(div);
  document.querySelector('#modal-close').addEventListener('click', closeModal);
  div.addEventListener('click', e => { if (e.target === div) closeModal(); });
}
function closeModal(){ document.querySelector('#modal-root')?.remove(); }

window.addEventListener('beforeunload', () => {
  if (currentUser && db) updateDoc(docRef('users', currentUser.uid), { isOnline:false, lastSeen:serverTimestamp() }).catch(()=>{});
});
