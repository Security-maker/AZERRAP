// Sentinelle Pro V5.8.1 — Cloudflare Worker notifications opérationnelles
// Secrets/variables Cloudflare requis :
// ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, SENTINELLE_PUSH_SECRET, ALLOWED_ORIGIN, FIREBASE_PROJECT_ID

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigin = String(env.ALLOWED_ORIGIN || '*').trim();
  const origin = allowedOrigin === '*' || requestOrigin === allowedOrigin ? (allowedOrigin === '*' ? '*' : requestOrigin) : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sentinelle-push-secret, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request, env), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function tagFilter(key, value) {
  return { field:'tag', key, relation:'=', value:String(value || '') };
}

function buildTarget(payload) {
  const ids = Array.isArray(payload.subscriptionIds)
    ? [...new Set(payload.subscriptionIds.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 20000)
    : [];
  if (ids.length) return { include_subscription_ids:ids };

  const target = String(payload.target || 'all');
  if (target.startsWith('agent:')) {
    return { include_aliases:{ external_id:[target.slice('agent:'.length)] }, target_channel:'push' };
  }
  if (target.startsWith('site:')) {
    return { filters:[tagFilter('role','agent'), { operator:'AND' }, tagFilter('siteActuel', target.slice('site:'.length))] };
  }
  if (target === 'working') {
    return { filters:[tagFilter('role','agent'), { operator:'AND' }, tagFilter('statut','en_poste')] };
  }
  if (target === 'qg') {
    return { filters:[tagFilter('role','admin'), { operator:'OR' }, tagFilter('role','superviseur')] };
  }
  return { filters:[tagFilter('role','agent')] };
}


let firebaseJwksCache = { expiresAt:0, keys:{} };
function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g,'+').replace(/_/g,'/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}
async function firebaseJwks() {
  if (firebaseJwksCache.expiresAt > Date.now() && Object.keys(firebaseJwksCache.keys).length) return firebaseJwksCache.keys;
  const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('Clés Firebase indisponibles');
  const payload = await response.json();
  const cacheControl = response.headers.get('Cache-Control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  const keys = {};
  for (const jwk of payload.keys || []) keys[jwk.kid] = jwk;
  firebaseJwksCache = { keys, expiresAt:Date.now() + Math.max(300, maxAge - 60) * 1000 };
  return keys;
}
async function verifyFirebaseIdToken(token, projectId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Jeton Firebase invalide');
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Signature Firebase invalide');
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` || !claims.sub || claims.exp <= now || claims.iat > now + 60 || !claims.auth_time || claims.auth_time > now + 60) {
    throw new Error('Jeton Firebase refusé');
  }
  const keys = await firebaseJwks();
  const jwk = keys[header.kid];
  if (!jwk) throw new Error('Clé Firebase inconnue');
  const key = await crypto.subtle.importKey('jwk', jwk, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) throw new Error('Signature Firebase incorrecte');
  return claims;
}
async function stableUuid(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || 'sentinelle'))));
  const bytes = digest.slice(0,16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(v => v.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function firestoreString(fields, key) {
  const value = fields?.[key];
  if (!value || typeof value !== 'object') return '';
  return String(value.stringValue ?? value.referenceValue ?? '');
}
async function verifyShiftDocument({ projectId, shiftId, token, uid }) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/shifts/${encodeURIComponent(shiftId)}`;
  const response = await fetch(url, {
    headers:{ 'Authorization':`Bearer ${token}`, 'Accept':'application/json' }
  });
  if (!response.ok) throw new Error('Prise de poste introuvable ou non autorisée');
  const document = await response.json();
  const fields = document?.fields || {};
  const agentId = firestoreString(fields, 'agentId');
  const status = firestoreString(fields, 'status');
  if (!agentId || agentId !== String(uid || '')) throw new Error('Cette prise de poste ne correspond pas au compte connecté');
  if (status !== 'active') throw new Error('La prise de poste n’est pas active');
  return {
    agentId,
    agentNom:firestoreString(fields, 'agentNom'),
    siteId:firestoreString(fields, 'siteId'),
    siteNom:firestoreString(fields, 'siteNom'),
    missionId:firestoreString(fields, 'missionId')
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers:corsHeaders(request, env) });

    if (request.method === 'GET') {
      return jsonResponse(request, env, {
        ok:true,
        service:'sentinelle-pro-push',
        appConfigured:Boolean(env.ONESIGNAL_APP_ID),
        apiKeyConfigured:Boolean(env.ONESIGNAL_REST_API_KEY),
        secretConfigured:Boolean(env.SENTINELLE_PUSH_SECRET),
        firebaseProjectConfigured:Boolean(env.FIREBASE_PROJECT_ID),
        allowedOrigin:String(env.ALLOWED_ORIGIN || '*')
      });
    }

    if (request.method !== 'POST') return jsonResponse(request, env, { ok:false, error:'Méthode non autorisée' }, 405);

    const secret = request.headers.get('x-sentinelle-push-secret') || '';
    const secretAuthorized = Boolean(env.SENTINELLE_PUSH_SECRET && secret === env.SENTINELLE_PUSH_SECRET);
    let firebaseClaims = null;
    let firebaseBearer = '';
    if (!secretAuthorized) {
      firebaseBearer = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'').trim();
      if (!firebaseBearer || !env.FIREBASE_PROJECT_ID) return jsonResponse(request, env, { ok:false, error:'Authentification push absente' }, 401);
      try { firebaseClaims = await verifyFirebaseIdToken(firebaseBearer, String(env.FIREBASE_PROJECT_ID)); }
      catch (error) { return jsonResponse(request, env, { ok:false, error:error.message || 'Jeton Firebase invalide' }, 401); }
    }
    if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
      return jsonResponse(request, env, { ok:false, error:'Variables OneSignal absentes dans Cloudflare' }, 500);
    }

    let payload;
    try { payload = await request.json(); }
    catch { return jsonResponse(request, env, { ok:false, error:'Corps JSON invalide' }, 400); }

    let verifiedShift = null;
    if (firebaseClaims) {
      const shiftId = String(payload?.data?.shiftId || '').trim();
      const allowed = payload.notificationType === 'shift_start' && payload.target === 'qg' && shiftId && String(payload?.data?.agentId || '') === String(firebaseClaims.sub || '');
      if (!allowed) return jsonResponse(request, env, { ok:false, error:'Action push non autorisée pour ce compte' }, 403);
      try {
        verifiedShift = await verifyShiftDocument({
          projectId:String(env.FIREBASE_PROJECT_ID),
          shiftId,
          token:firebaseBearer,
          uid:firebaseClaims.sub
        });
      } catch (error) {
        return jsonResponse(request, env, { ok:false, error:error.message || 'Prise de poste non vérifiable' }, 403);
      }
      payload.data = {
        ...(payload.data && typeof payload.data === 'object' ? payload.data : {}),
        shiftId,
        agentId:verifiedShift.agentId,
        siteId:verifiedShift.siteId,
        missionId:verifiedShift.missionId,
        route:'home'
      };
    }

    const title = firebaseClaims ? 'Agent en poste' : String(payload.title || 'Sentinelle Pro').slice(0, 100);
    const message = firebaseClaims
      ? `${verifiedShift?.agentNom || 'Un agent'} vient de confirmer sa prise de poste${verifiedShift?.siteNom ? ` sur ${verifiedShift.siteNom}` : ''}. Ouvrez Sentinelle Pro pour consulter les détails.`
      : String(payload.message || 'Nouvelle information opérationnelle').slice(0, 480);
    const priority = String(payload.priority || 'Information');
    const notificationType = String(payload.notificationType || 'flash').slice(0, 40);
    const notificationId = String(payload.notificationId || payload.flashId || Date.now()).slice(0, 120);
    const url = /^https:\/\//i.test(String(payload.url || '')) ? String(payload.url) : undefined;
    const target = buildTarget(payload);

    const body = {
      app_id:env.ONESIGNAL_APP_ID,
      ...target,
      headings:{ en:title, fr:title },
      contents:{ en:message, fr:message },
      name:`Sentinelle Pro ${notificationType} ${notificationId}`.slice(0, 128),
      idempotency_key:await stableUuid(`${notificationType}:${notificationId}`),
      priority:priority === 'Critique' || priority === 'Urgent' ? 10 : 5,
      ios_interruption_level:priority === 'Critique' || priority === 'Urgent' ? 'time_sensitive' : 'active',
      web_url:url,
      data:{
        type:notificationType,
        notificationId,
        flashId:payload.flashId || '',
        priority,
        target:payload.target || 'direct',
        ...(payload.data && typeof payload.data === 'object' ? payload.data : {})
      }
    };

    const oneSignalResponse = await fetch('https://api.onesignal.com/notifications?c=push', {
      method:'POST',
      headers:{
        'Authorization':`Key ${env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(body)
    });

    const rawText = await oneSignalResponse.text();
    let oneSignalResult = {};
    try { oneSignalResult = rawText ? JSON.parse(rawText) : {}; }
    catch { oneSignalResult = { raw:rawText }; }

    if (!oneSignalResponse.ok) {
      return jsonResponse(request, env, {
        ok:false,
        error:'OneSignal a refusé la notification',
        status:oneSignalResponse.status,
        errors:oneSignalResult.errors || oneSignalResult.error || oneSignalResult
      }, oneSignalResponse.status);
    }

    if (!oneSignalResult.id) {
      return jsonResponse(request, env, {
        ok:false,
        error:'Aucun abonnement OneSignal valide dans la cible',
        recipients:oneSignalResult.recipients || 0,
        details:oneSignalResult
      }, 409);
    }

    return jsonResponse(request, env, {
      ok:true,
      id:oneSignalResult.id,
      recipients:oneSignalResult.recipients ?? (Array.isArray(payload.subscriptionIds) ? payload.subscriptionIds.length : null),
      externalId:oneSignalResult.external_id || null
    });
  }
};
