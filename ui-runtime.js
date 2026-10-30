// UI lifecycle only: no queued writes, no durable business-data cache.
// iOS can move the visible viewport independently of the layout viewport (browser bars/keyboard).
// Measure the native fixed position, then compensate only its real offset, without scrolling content.
export function pinMobileNavigation(dock,win=globalThis.window){
  if(!dock)return ()=>{};
  const viewport=win.visualViewport,mobile=win.matchMedia('(max-width: 699px)');
  let frame,offset=0,stopped=false;
  const update=()=>{
    frame=undefined;if(stopped)return;
    let next=0;
    if(mobile.matches&&viewport&&Math.abs(viewport.scale-1)<.01){
      const rect=dock.getBoundingClientRect();
      if(rect.height)next=viewport.offsetTop+viewport.height-(rect.bottom-offset);
    }
    if(Math.abs(next-offset)>.5){offset=next;dock.style.setProperty('--dock-offset',`${offset}px`);}
  };
  const schedule=()=>{if(frame===undefined)frame=win.requestAnimationFrame(update);};
  const targets=[[win,'resize'],[win,'scroll'],[win,'pageshow'],[viewport,'resize'],[viewport,'scroll'],[mobile,'change']];
  targets.forEach(([target,event])=>target?.addEventListener(event,schedule,{passive:true}));
  update();
  return ()=>{stopped=true;win.cancelAnimationFrame(frame);targets.forEach(([target,event])=>target?.removeEventListener(event,schedule));dock.style.removeProperty('--dock-offset');};
}

export function createClock(update, {setInterval:every=globalThis.setInterval,clearInterval:clear=globalThis.clearInterval}={}) {
  let timer;
  return {start(){this.stop();update();timer=every(update,30000);},stop(){if(timer!==undefined)clear(timer);timer=undefined;}};
}

export function debounce(fn,delay=120){let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};}

// Concurrent reads only. No reuse after completion, and no reuse across identity/mode.
export function singleFlight(){
  const pending=new Map();
  return (key,read)=>{
    if(pending.has(key))return pending.get(key);
    const task=Promise.resolve().then(read).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
    pending.set(key,task);return task;
  };
}

export function startVisiblePoll(read,{interval=3500,doc=globalThis.document,win=globalThis.window,pauseWhenHidden=true,onError=()=>{}}={}){
  let stopped=false,running=false,timer;
  const poll=async()=>{
    if(stopped||running||(pauseWhenHidden&&doc?.hidden)||win?.navigator?.onLine===false)return;
    running=true;
    try{await read();}catch(error){if(!stopped)onError(error);}finally{running=false;}
  };
  const resume=()=>{if(!pauseWhenHidden||!doc?.hidden)void poll();};
  doc?.addEventListener('visibilitychange',resume);win?.addEventListener('online',resume);
  void poll();timer=setInterval(poll,interval);
  return ()=>{stopped=true;clearInterval(timer);doc?.removeEventListener('visibilitychange',resume);win?.removeEventListener('online',resume);};
}
