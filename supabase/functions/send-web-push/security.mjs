// Known browser push services only. Never accept an arbitrary HTTPS server.
export function safePushEndpoint(value){
  try {
    if(typeof value!=='string' || value.length>4096 || /[\\\s]/.test(value)) return false;
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || u.port || u.hash || u.pathname==='/') return false;
    return ['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(u.hostname)
      || /^[a-z0-9-]+\.push\.apple\.com$/.test(u.hostname)
      || /^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname);
  } catch (_) { return false; }
}
export function safePushNavigation(base,route,explicit){
  try {
    const b=new URL(base);
    if(b.protocol!=='https:' || b.username || b.password) return '';
    if(b.pathname.endsWith('/')) b.pathname+='index.html';
    const fallback=new URL(b);fallback.searchParams.set('route',route||'home');
    const u=new URL(explicit||fallback.href,b);
    if(u.origin===b.origin && u.pathname===b.pathname && !u.username && !u.password) return u.href;
    return fallback.href;
  } catch (_) { return ''; }
}
