'use strict';
// Loaded by the fresh HTML with a new URL, independent of the legacy offline.js cache.
(() => {
  const revision='excel-2000-1';
  async function identifyCheckout(){
    const marker=document.getElementById('previewVersionMarker');
    if(!marker||typeof fetch!=='function'||!['http:','https:'].includes(location.protocol)||!/^\/(?:index\.html)?$/.test(location.pathname))return;
    try{
      const response=await fetch('./__macro_studio__/status.json',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)return;
      const info=await response.json();
      if(info.repository!=='https://github.com/lucagiarrusso3-tech/Marco-Studio-2'||info.entrypoint!=='/index.html'||!/^macro-studio-[a-f0-9]{16}$/.test(info.contentRevision))return;
      const commit=/^[a-f0-9]{40}$/.test(info.commit||'')?info.commit.slice(0,8):'non disponibile';
      marker.textContent='MACRO STUDIO 2.0 · index.html · commit '+commit+' · contenuti '+info.contentRevision.slice(-16)+(info.trackedChanges?' · modifiche locali':'')+(info.offlineCurrent?'':' · cache da rigenerare');
      marker.dataset.commit=info.commit||'';marker.dataset.contentRevision=info.contentRevision;
      marker.title='Copia verificata dal server del progetto. GitHub e il Codespace devono essere sincronizzati separatamente.';
    }catch{/* Static hosting and the standalone HTML have no checkout endpoint. */}
  }
  function unavailable() {
    const status=document.getElementById('sharedMealsBootStatus');
    if(status&&!globalThis.SharedMealsApp){globalThis.SharedMealsLoadError=globalThis.SharedMealsLoadError||'Impossibile caricare le alternative settimanali.';status.setAttribute('role','alert');status.textContent='Le alternative non sono state caricate. Ricarica la pagina; se il problema persiste, verifica l’anteprima. I dati salvati non sono stati cancellati.';}
  }
  addEventListener('load',()=>{if(!globalThis.SharedMealsApp)unavailable();identifyCheckout();});
  addEventListener('error',event=>{if(event.target?.tagName==='SCRIPT')unavailable();},true);
  if(!('serviceWorker' in navigator)||!isSecureContext)return;
  const hadController=!!navigator.serviceWorker.controller;
  let refreshQueued=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController||refreshQueued)return;
    refreshQueued=true;
    const refresh=()=>{
      // Let the initial navigation finish before refreshing the updated shell.
      try{const key='macro-studio-shell-reloaded';if(sessionStorage.getItem(key)===revision)return;sessionStorage.setItem(key,revision);}catch{return;}
      location.reload();
    };
    if(document.readyState==='complete')setTimeout(refresh,0);
    else addEventListener('load',()=>setTimeout(refresh,0),{once:true});
  });
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
})();
