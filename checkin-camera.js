// Android check-in capture stays in the page: no external camera activity,
// persistent draft, upload, audio track or background capture.
let activeCapture=null;

export const usesInlineCheckInCamera=(nav=globalThis.navigator)=>
  /Android/i.test(nav?.userAgent||'') && Boolean(nav?.mediaDevices?.getUserMedia) && globalThis.isSecureContext;

export function stopCheckInCamera(){ activeCapture?.close(); }

export function captureVideoPhoto(video,doc=globalThis.document){
  const width=video.videoWidth,height=video.videoHeight;
  if(video.readyState<2||!width||!height) return Promise.reject(new Error('La caméra n’est pas encore prête.'));
  const scale=Math.min(1,640/Math.max(width,height));
  const canvas=doc.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d',{alpha:false});
  if(!context) return Promise.reject(new Error('Photo impossible à préparer sur ce navigateur.'));
  context.drawImage(video,0,0,canvas.width,canvas.height);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Le traitement de la photo a expiré. Réessaie.')),5000);
    canvas.toBlob(blob=>{clearTimeout(timer);if(blob?.size)resolve(blob);else reject(new Error('Photo vide. Reprends la photo.'));},'image/jpeg',.82);
  });
}

function cameraError(error){
  if(['NotAllowedError','SecurityError'].includes(error?.name))return 'Accès caméra refusé. Autorise l’appareil photo pour Sentinelle dans les paramètres du navigateur, puis réessaie.';
  if(error?.name==='NotFoundError')return 'Aucune caméra disponible sur cet appareil.';
  if(error?.name==='NotReadableError')return 'La caméra est utilisée par une autre application. Ferme-la, puis réessaie.';
  return error?.message||'La caméra est indisponible. Réessaie.';
}

export function bindCheckInCamera({input,onFile,onError=()=>{}}){
  if(!input||!usesInlineCheckInCamera())return ()=>{};
  const trigger=input.parentElement?.querySelector(`label[for="${input.id}"]`);
  if(!trigger)return ()=>{};
  trigger.setAttribute('role','button');trigger.tabIndex=0;
  const open=event=>{
    event.preventDefault();
    if(!input.isConnected||input.disabled||activeCapture?.input===input)return;
    stopCheckInCamera();
    const panel=document.createElement('section');panel.className='checkin-camera-panel';
    panel.setAttribute('aria-label','Photo dans Sentinelle');
    panel.innerHTML=`<video class="checkin-camera-video" autoplay muted playsinline aria-label="Aperçu de la caméra"></video>
      <p class="checkin-camera-status" role="status" aria-live="polite">Autorise l’appareil photo si ton navigateur le demande.</p>
      <div class="checkin-camera-actions"><button type="button" class="btn primary" data-camera-capture disabled>Prendre la photo</button><button type="button" class="btn" data-camera-cancel>Annuler</button></div>
      <button type="button" class="btn small" data-camera-retry hidden>Réessayer la caméra</button>
      <button type="button" class="btn small" data-camera-native hidden>Utiliser l’appareil photo du téléphone</button>
      <small data-camera-native-help hidden>Cette autre méthode quitte temporairement Sentinelle et peut provoquer son rechargement sur certains Android.</small>`;
    input.insertAdjacentElement('afterend',panel);
    const video=panel.querySelector('video'),status=panel.querySelector('[role="status"]');
    const capture=panel.querySelector('[data-camera-capture]'),cancel=panel.querySelector('[data-camera-cancel]');
    let stream=null,closed=false,failed=false,taking=false,timer=null;
    const tracks=[];
    const releaseMedia=()=>{
      clearTimeout(timer);video.removeEventListener('loadeddata',ready);video.removeEventListener('canplay',ready);
      for(const track of tracks){track.removeEventListener('ended',ended);track.stop();}
      tracks.length=0;video.pause();video.srcObject=null;stream=null;
    };
    const close=()=>{
      if(closed)return;closed=true;releaseMedia();panel.remove();
      document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',close);
      document.removeEventListener('keydown',escape);
      if(activeCapture?.close===close)activeCapture=null;
      trigger.removeAttribute('aria-expanded');
    };
    const fail=error=>{
      if(closed||failed)return;failed=true;releaseMedia();capture.disabled=true;
      status.textContent=cameraError(error);status.classList.add('error');
      panel.querySelectorAll('[data-camera-retry],[data-camera-native],[data-camera-native-help]').forEach(el=>el.hidden=false);
    };
    const ready=()=>{
      if(closed||failed||!input.isConnected)return;
      if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0){clearTimeout(timer);capture.disabled=false;status.textContent='Cadre le poste ou ta présence sur site, puis prends la photo.';}
    };
    const ended=()=>fail(new Error('La caméra a été interrompue. Réessaie.'));
    const hidden=()=>{if(document.hidden)close();};
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
    activeCapture={input,close};trigger.setAttribute('aria-expanded','true');
    cancel.addEventListener('click',()=>{close();if(trigger.isConnected)trigger.focus();});
    panel.querySelector('[data-camera-retry]').addEventListener('click',()=>{close();open({preventDefault(){}});});
    panel.querySelector('[data-camera-native]').addEventListener('click',()=>{close();input.value='';input.click();});
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',close);document.addEventListener('keydown',escape);
    video.addEventListener('loadeddata',ready);video.addEventListener('canplay',ready);
    capture.addEventListener('click',async()=>{
      if(closed||failed||taking||capture.disabled)return;
      taking=true;capture.disabled=true;status.textContent='Préparation de la photo…';
      try{
        const blob=await captureVideoPhoto(video);
        if(closed||failed||!input.isConnected)return;
        close();
        await onFile(new File([blob],'prise-de-poste.jpg',{type:'image/jpeg',lastModified:Date.now()}));
      }catch(error){if(!closed)fail(error);else onError(error);}
    });
    timer=setTimeout(()=>fail(new Error('La caméra ne répond pas. Vérifie son autorisation, puis réessaie.')),20000);
    Promise.resolve().then(()=>navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:15}}}))
      .then(async media=>{
        if(closed||failed||!input.isConnected){media.getTracks().forEach(t=>t.stop());if(!closed)close();return;}
        stream=media;tracks.push(...stream.getTracks());tracks.forEach(t=>t.addEventListener('ended',ended));
        video.srcObject=stream;video.muted=true;await video.play();ready();
      }).catch(fail);
    cancel.focus();
  };
  const keyboard=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(event);}};
  trigger.addEventListener('click',open);trigger.addEventListener('keydown',keyboard);
  return ()=>{if(activeCapture?.input===input)stopCheckInCamera();trigger.removeEventListener('click',open);trigger.removeEventListener('keydown',keyboard);};
}
