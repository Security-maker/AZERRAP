// Basemap only: business markers, permissions and positions stay in app.js.
export const BASEMAP_STYLES = Object.freeze({
  light:'https://tiles.openfreemap.org/styles/positron',
  dark:'https://tiles.openfreemap.org/styles/dark'
});
const ATTRIBUTION = '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>';
let libraries;
function script(name){
  return new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=new URL('./vendor/maps/'+name,import.meta.url).href;
    el.onload=resolve;el.onerror=()=>{el.remove();reject(new Error('map_library_unavailable'));};document.head.append(el);
  });
}
function loadLibraries(){
  if(!libraries)libraries=(async()=>{
    if(!document.querySelector('[data-maplibre-css]')){
      const el=document.createElement('link');el.rel='stylesheet';el.dataset.maplibreCss='';
      el.href=new URL('./vendor/maps/maplibre-gl-5.24.0.css',import.meta.url).href;document.head.append(el);
    }
    if(!window.maplibregl)await script('maplibre-gl-5.24.0.js');
    if(!window.L.maplibreGL)await script('leaflet-maplibre-gl-0.0.22.js');
  })().catch(error=>{libraries=null;throw error;});
  return libraries;
}

export function installOperationalBasemap(map,L,{sites,agents}){
  const host=map.getContainer();
  const notice=document.createElement('div');notice.className='map-service-status';notice.setAttribute('role','status');
  const text=document.createElement('span'),retry=document.createElement('button');
  retry.type='button';retry.textContent='Réessayer';retry.className='btn small';notice.append(text,retry);host.after(notice);
  let disposed=false,layer,gl,mode='light',timer,failed=false,loading=false;
  const controls=new (L.Control.extend({options:{position:'topright'},onAdd(){
    const box=L.DomUtil.create('div','sp-map-controls');
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent='▱';summary.setAttribute('aria-label','Fond de carte et calques');summary.title='Fond de carte et calques';details.append(summary);
    const group=document.createElement('div');group.className='sp-map-options';details.append(group);
    const add=(title,type,checked,change)=>{const label=document.createElement('label'),input=document.createElement('input');input.type=type;input.checked=checked;
      if(type==='radio')input.name='basemap-'+map._leaflet_id;input.addEventListener('change',()=>change(input.checked));label.append(input,document.createTextNode(title));group.append(label);};
    add('Carte claire','radio',true,()=>{mode='light';void begin();});
    add('Mode nuit','radio',false,()=>{mode='dark';void begin();});
    add('Agents en poste','checkbox',true,on=>on?map.addLayer(agents):map.removeLayer(agents));
    add('Sites','checkbox',true,on=>on?map.addLayer(sites):map.removeLayer(sites));
    box.append(details);L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box);
    map.on('click',()=>{details.open=false;});return box;
  }}))().addTo(map);
  map.attributionControl.addAttribution(ATTRIBUTION);
  const status=(message,error=false)=>{if(disposed)return;notice.hidden=!message;text.textContent=message;retry.hidden=!error;notice.dataset.state=error?'unavailable':'loading';};
  const failure=()=>{failed=true;clearTimeout(timer);status('Fond de carte indisponible ou incomplet. Les marqueurs et les données métier restent accessibles.',true);};
  const pending=()=>{failed=false;status('Chargement du fond de carte…');clearTimeout(timer);timer=setTimeout(failure,15000);};
  const ready=()=>{if(!disposed&&!failed&&gl?.isStyleLoaded()&&gl?.areTilesLoaded()){clearTimeout(timer);status('');}};
  const begin=async()=>{
    if(disposed||loading)return;loading=true;pending();
    try{
      await loadLibraries();if(disposed)return;
      if(!layer){
        // Leaflet owns gestures. Keep the basemap in step with its markers while dragging.
        layer=L.maplibreGL({style:BASEMAP_STYLES[mode],interactive:false,maxZoom:20,updateInterval:0}).addTo(map);
        gl=layer.getMaplibreMap();gl.on('error',failure);gl.on('idle',ready);
        gl.getCanvas().addEventListener('webglcontextlost',failure);
      }else gl.setStyle(BASEMAP_STYLES[mode]);
    }catch(_){failure();}finally{loading=false;}
  };
  retry.addEventListener('click',begin);
  map.once('unload',()=>{disposed=true;clearTimeout(timer);retry.removeEventListener('click',begin);notice.remove();});
  void begin();
  return controls;
}

// Fit once when both initial reads settle. Later data/size changes must not undo a user's view.
export function preserveOperationalMapView(map, fitAll, {sources=['sites','agents']}={}){
  const pending=new Set(sources),host=map.getContainer();
  let initial=true,disposed=false,frame;
  const interacted=()=>{initial=false;};
  const resize=()=>{
    if(disposed)return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      if(!disposed)map.invalidateSize({animate:false,pan:true,debounceMoveend:true});
    });
  };
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  observer?.observe(host);
  if(!observer)window.addEventListener('resize',resize,{passive:true});
  for(const event of ['pointerdown','touchstart','wheel','keydown'])host.addEventListener(event,interacted,{passive:true});
  map.on('movestart',interacted);
  map.once('unload',()=>{
    disposed=true;cancelAnimationFrame(frame);observer?.disconnect();
    window.removeEventListener('resize',resize);map.off('movestart',interacted);
    for(const event of ['pointerdown','touchstart','wheel','keydown'])host.removeEventListener(event,interacted);
  });
  return source=>{
    pending.delete(source);
    if(!disposed&&initial&&!pending.size){initial=false;fitAll();}
  };
}
