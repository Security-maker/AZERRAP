// UI lifecycle only: no queued writes, no durable business-data cache.
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
