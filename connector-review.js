import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
import {supabaseConfig as config} from './supabase-config.js';
const sb=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'sentinelle-pro-v590-auth'}});
const $=s=>document.querySelector(s),params=new URL(location.href).searchParams;
let plan,authorization,documentRow;
const state=t=>{$('#state').textContent=t;};
const text=(tag,value,parent)=>{const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;};
async function rpc(name,args={}){const {data,error}=await sb.rpc('sentinelle_mcp_'+name,args);if(error)throw new Error(error.message);return data;}
async function oauth(method,path,body){
 const {data:{session}}=await sb.auth.getSession();if(!session)throw new Error('Session requise.');
 const r=await fetch(config.url+'/auth/v1/'+path,{method,headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 if(!r.ok)throw new Error('Autorisation OAuth indisponible.');return r.json();
}
const domains={missions:'Mission',interventions:'Intervention',agents:'Agent',clients:'Client',sites:'Site',documents:'Document',postes:'Poste',flash:'Message Flash',destinataires:'Destinataire',points_ronde:'Point de ronde',alertes:'Alerte',factures:'Facture'};
const actions={create:'Créer',update:'Modifier',assign:'Affecter',start:'Démarrer',entry:'Ajouter une observation',complete:'Terminer',cancel:'Annuler',archive:'Archiver',delete:'Supprimer définitivement',close:'Clôturer',publish:'Publier',withdraw:'Retirer de publication',take:'Prendre en charge'};
const fields={name:'Nom',siteId:'Site',agentId:'Agent',scheduledStart:'Début prévu',scheduledEnd:'Fin prévue',scheduled_start:'Début prévu',scheduled_end:'Fin prévue',site_id:'Site',client_id:'Client',assigned_profile_id:'Intervenant',reason:'Motif',instructions:'Consignes',description:'Description',active:'Actif',portal_enabled:'Portail ouvert',auto_email:'Envoi automatique',status:'Statut',message:'Message',target:'Destinataires',title:'Titre',conclusion:'Conclusion',end:'Heure de fin',first_name:'Prénom',last_name:'Nom',phone:'Téléphone',address:'Adresse',scheduled_at:'Date prévue'};
function valueText(value){if(value===true)return 'Oui';if(value===false)return 'Non';if(value===null)return 'Non renseigné';return typeof value==='object'?JSON.stringify(value):String(value);}
function showFields(data,parent){const list=document.createElement('dl');parent.append(list);for(const [key,value] of Object.entries(data||{})){text('dt',fields[key]||key,list);text('dd',valueText(value),list);}}
function renderOps(items){
 const root=$('#details');root.replaceChildren();root.hidden=false;text('p',items.length+' opération(s) · aucun changement avant votre accord et l’exécution du plan.',root);
 for(const o of items){const card=document.createElement('article');card.className='operation';root.append(card);text('h2',(actions[o.action]||o.action)+' · '+(domains[o.resource]||o.resource),card);text('p',o.label||o.id,card);text('p',o.consequence,card);const grid=document.createElement('div');grid.className='comparison';card.append(grid);for(const [title,data] of [['Situation actuelle',o.before],['Changements proposés',o.data]]){const section=document.createElement('section');grid.append(section);text('h3',title,section);if(data)showFields(data,section);else text('p','Nouvel élément',section);}if(o.references)showFields(o.references,card);}
}
async function load(){
 if(window.top!==window.self)throw new Error('Ouvrez cette page directement dans votre navigateur.');
 const {data:{user},error}=await sb.auth.getUser();if(error||!user){$('#login').hidden=false;state('Connectez-vous avec votre propre compte QG. Aucun mot de passe n’est transmis à ChatGPT.');return;}
 $('#login').hidden=true;
 if(params.has('plan')){
  plan=await rpc('review',{p_id:params.get('plan')});renderOps(plan.preview);state('État : '+plan.state+' · Valable jusqu’au '+new Date(plan.expires_at).toLocaleString('fr-FR'));
  if(plan.state==='applied')for(const op of plan.preview||[]){
   if(op.resource==='interventions'&&/^[0-9a-f-]{36}$/i.test(op.id||'')){
    const link=text('a','Ouvrir l’intervention et vérifier son bon PDF',$('#details'));
    const url=new URL('./index.html',location.href);url.searchParams.set('route','interventions');url.searchParams.set('intervention',op.id);link.href=url.href;
   }
  }
  $('#decision').hidden=plan.state!=='pending';const destructive=plan.preview.some(o=>o.destructive);$('#destructive').hidden=!destructive;if(destructive){$('#phrase').placeholder='SUPPRIMER '+plan.plan_id;$('#phrase').required=true;text('p','Confirmation renforcée : SUPPRIMER '+plan.plan_id,$('#details'));}
 }else if(params.has('authorization_id')){
  authorization=await oauth('GET','oauth/authorizations/'+encodeURIComponent(params.get('authorization_id')));
  // Never authorize an arbitrary registered app. Server checks client and member allowlists.
  if(authorization.redirect_url){
   // Auth may immediately complete a previously consented request. The destination
   // still needs the operator's exact callback allowlist and the current QG gate.
   await rpc('validate_redirect',{p_redirect:authorization.redirect_url});
   location.assign(authorization.redirect_url);return;
  }
  if(!authorization.client?.id)throw new Error('Demande OAuth incomplète : reconnectez le connecteur depuis ChatGPT.');
  const access=await rpc('consent',{p_client:authorization.client.id});$('#details').hidden=false;$('#details').replaceChildren();text('h2',authorization.client.name||'Connecteur Sentinelle',$('#details'));text('p','Demandes OAuth : '+authorization.scope,$('#details'));text('p','Destination : '+authorization.redirect_uri,$('#details'));text('p','Les lectures suivent vos droits. Chaque écriture exige un plan et une nouvelle confirmation personnelle. Écriture activée : '+access.can_write,$('#details'));$('#decision').hidden=false;$('#approve').textContent='Connecter ce compte';state('Vérifiez que cette demande vient de votre conversation ChatGPT.');
 }else if(params.has('document')){
  const {data,error}=await sb.from('generated_documents').select('id,title,storage_bucket,storage_path').eq('id',params.get('document')).maybeSingle();if(error||!data)throw new Error('Document absent ou non autorisé.');documentRow=data;state(data.title);$('#open-document').hidden=false;
 }else state('Ouvrez le lien de confirmation reçu dans votre conversation, ou révoquez votre accès ci-dessous.');
}
async function decide(decision){
 if(!navigator.onLine)throw new Error('Non envoyé : connexion requise.');
 if(plan){const r=await rpc('review',{p_id:plan.plan_id,p_decision:decision,p_phrase:$('#phrase').value});$('#decision').hidden=true;state(r.state==='approved'?'Plan approuvé. Revenez à ChatGPT pour demander son exécution.':'Plan refusé.');}
 else if(authorization){const r=await oauth('POST','oauth/authorizations/'+encodeURIComponent(params.get('authorization_id'))+'/consent',{action:decision});await rpc('validate_redirect',{p_redirect:r.redirect_url});location.assign(r.redirect_url);}
}
async function safe(fn){const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){state(e.message||'Opération non confirmée. Actualisez son état avant de réessayer.');}finally{buttons.forEach(b=>b.disabled=false);}}
$('#login').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);void safe(async()=>{const {error}=await sb.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))});e.target.password.value='';if(error)throw new Error('Connexion refusée.');await load();});};
$('#decision').onsubmit=e=>{e.preventDefault();void safe(()=>decide('approve'));};$('#deny').onclick=()=>safe(()=>decide('deny'));
$('#revoke').onclick=()=>{if(confirm('Révoquer immédiatement vos lectures et actions via le connecteur ?'))void safe(async()=>{await rpc('revoke');state('Accès au connecteur révoqué. Les plans non exécutés sont annulés.');$('#decision').hidden=true;});};
$('#open-document').onclick=()=>{const win=window.open('about:blank','_blank');if(win)win.opener=null;void safe(async()=>{const {data,error}=await sb.storage.from(documentRow.storage_bucket).createSignedUrl(documentRow.storage_path,60);if(error||!data?.signedUrl){win?.close();throw new Error('Téléchargement refusé.');}const u=new URL(data.signedUrl,config.url);if(u.origin!==new URL(config.url).origin){win?.close();throw new Error('Origine du fichier refusée.');}if(win)win.location.replace(u.href);else{const a=text('a','Télécharger le PDF (lien temporaire)',$('#details'));$('#details').hidden=false;a.href=u.href;a.rel='noopener noreferrer';}});};
void safe(load);
