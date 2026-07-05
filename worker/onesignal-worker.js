// Sentinelle Pro — Cloudflare Worker OneSignal
// À déployer sur Cloudflare Workers.
// Variables/secrets à créer dans Cloudflare :
// ONESIGNAL_APP_ID       = ton App ID OneSignal
// ONESIGNAL_REST_API_KEY = ta clé REST API OneSignal
// SENTINELLE_PUSH_SECRET = une clé secrète que tu choisis pour autoriser l'envoi depuis le QG
// ALLOWED_ORIGIN         = optionnel, ex: https://tonpseudo.github.io

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sentinelle-push-secret',
    'Access-Control-Max-Age': '86400'
  };
}

function tagFilter(key, value) {
  return { field: 'tag', key, relation: '=', value: String(value || '') };
}

function buildTarget(payload) {
  const target = String(payload.target || 'all');
  if (target.startsWith('agent:')) {
    const uid = target.slice('agent:'.length);
    return {
      include_aliases: { external_id: [uid] },
      target_channel: 'push'
    };
  }
  if (target.startsWith('site:')) {
    const siteId = target.slice('site:'.length);
    return {
      filters: [tagFilter('role', 'agent'), { operator: 'AND' }, tagFilter('siteActuel', siteId)]
    };
  }
  if (target === 'working') {
    return {
      filters: [tagFilter('role', 'agent'), { operator: 'AND' }, tagFilter('statut', 'en_poste')]
    };
  }
  return { filters: [tagFilter('role', 'agent')] };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

    const secret = request.headers.get('x-sentinelle-push-secret') || '';
    if (!env.SENTINELLE_PUSH_SECRET || secret !== env.SENTINELLE_PUSH_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized push request' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    let payload = {};
    try { payload = await request.json(); } catch (e) {}
    const title = String(payload.title || 'Message Flash QG').slice(0, 100);
    const message = String(payload.message || 'Nouveau message opérationnel').slice(0, 480);
    const priority = String(payload.priority || 'Information');
    const url = payload.url || undefined;

    const body = {
      app_id: env.ONESIGNAL_APP_ID,
      ...buildTarget(payload),
      headings: { fr: title, en: title },
      contents: { fr: message, en: message },
      name: `Sentinelle Pro Flash ${payload.flashId || Date.now()}`,
      priority: priority === 'Critique' || priority === 'Urgent' ? 10 : 5,
      ios_interruption_level: priority === 'Critique' || priority === 'Urgent' ? 'time_sensitive' : 'active',
      web_url: url,
      chrome_web_icon: url ? new URL('./assets/icons/icon-192.png', url).href : undefined,
      chrome_web_badge: url ? new URL('./assets/icons/icon-192.png', url).href : undefined,
      custom_data: {
        flashId: payload.flashId || '',
        priority,
        target: payload.target || 'all'
      }
    };

    const res = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${env.ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};
