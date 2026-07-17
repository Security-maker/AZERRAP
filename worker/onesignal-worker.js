// Sentinelle Pro V5.6 — Cloudflare Worker notifications opérationnelles
// Secrets/variables Cloudflare requis :
// ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, SENTINELLE_PUSH_SECRET, ALLOWED_ORIGIN

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigin = String(env.ALLOWED_ORIGIN || '*').trim();
  const origin = allowedOrigin === '*' || requestOrigin === allowedOrigin ? (allowedOrigin === '*' ? '*' : requestOrigin) : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sentinelle-push-secret',
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
  return { filters:[tagFilter('role','agent')] };
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
        allowedOrigin:String(env.ALLOWED_ORIGIN || '*')
      });
    }

    if (request.method !== 'POST') return jsonResponse(request, env, { ok:false, error:'Méthode non autorisée' }, 405);

    const secret = request.headers.get('x-sentinelle-push-secret') || '';
    if (!env.SENTINELLE_PUSH_SECRET || secret !== env.SENTINELLE_PUSH_SECRET) {
      return jsonResponse(request, env, { ok:false, error:'Clé push incorrecte' }, 401);
    }
    if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
      return jsonResponse(request, env, { ok:false, error:'Variables OneSignal absentes dans Cloudflare' }, 500);
    }

    let payload;
    try { payload = await request.json(); }
    catch { return jsonResponse(request, env, { ok:false, error:'Corps JSON invalide' }, 400); }

    const title = String(payload.title || 'Sentinelle Pro').slice(0, 100);
    const message = String(payload.message || 'Nouvelle information opérationnelle').slice(0, 480);
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
