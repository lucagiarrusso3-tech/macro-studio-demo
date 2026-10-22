'use strict';
// Archive adapter for both existing editors. Uses their real state, catalog and PDF composer.
globalThis.DietProjectUI=(()=>{
 function start(){
  const pdf=globalThis.ProfessionalPdfApp;if(!pdf||!globalThis.SharedMealsApp)return;
  const generator=!!document.getElementById('stage-plans'),kind=generator?'generator':'main',stateKey=generator?NUTRITION_STATE_KEY:KEY;
  const panel=pdf.panel,controls=document.createElement('div');controls.className='pdf-buttons';
  controls.innerHTML='<button type="button" id="dietFolderExport">Esporta dieta (cartella PDF + progetto)</button><button type="button" id="dietProjectImport" class="secondary">Importa dieta esistente</button><input id="dietProjectFile" type="file" accept=".json,application/json" hidden style="display:none">';
  panel.appendChild(controls);
  const fallback=document.createElement('div');fallback.id='dietProjectFallback';fallback.hidden=true;
  fallback.innerHTML='<p>Questo browser non consente il salvataggio diretto di una cartella. Crea una cartella sul dispositivo e salva al suo interno entrambi i file, senza ZIP. Il JSON serve per riaprire e modificare la dieta.</p><div class="pdf-buttons"><button type="button" id="dietFallbackPdf">Scarica PDF</button><button type="button" id="dietFallbackJson">Scarica progetto JSON</button></div>';
  panel.appendChild(fallback);
  const status=document.createElement('p');status.id='dietProjectStatus';status.role='status';panel.appendChild(status);
  const button=document.getElementById('dietFolderExport'),input=document.getElementById('dietProjectFile');let prepared=null,busy=false,importing=false;
  const copy=DietProject.copy;
  function view(){return {group:document.getElementById('sharedGroup').value,alternative:document.getElementById('sharedAlternative').value};}
  function capture(settings=pdf.read()){
   if(storageBlocked||globalThis.SharedMealsLoadError)throw Error('Salvataggi locali non leggibili: originali conservati.');
   if(!generator){
    const selected=new Set([...state.days.flatMap(d=>d.entries.map(r=>r.food)),...Object.values(state.sharedMeals.pools).flatMap(pool=>pool.flatMap(a=>a.foods.map(r=>r.key))),...Object.keys(state.dietFoods||{})]),bank=new Map(catalog().map(f=>[f.id,f])),foods={};
    for(const id of selected){if(!bank.has(id))throw Error('Un alimento del piano non è disponibile: completa la scheda prima di esportare.');foods[id]=copy(bank.get(id));}
    return {state:copy(state),foods,pdfSettings:copy(settings),editor:view()};
   }
   const draft=copy(currentDraft()),templates=copy(T),bindings=copy(dietContext?.bindings||FoodCatalog.bindings(localStorage)),selected=new Set([...templates.flatMap(t=>t.ingredients),...plan.flatMap(row=>row.flatMap(slot=>WeeklyManualPlan.entries(slot).map(r=>r.key))),...Object.values(SharedMealsApp.get().pools).flatMap(pool=>pool.flatMap(a=>a.foods.map(r=>r.key))),...Object.keys(foodChanges),...Object.values(bindings)]),foods={};
   for(const key of selected){const f=db[key]||{...FoodCatalog.historical(key),kcal:null};foods[key]=copy({...f,id:f.id||key,name:f.officialName||f.name||key,k:f.k===undefined?f.kcal:f.k});}
   return {draft,context:{templates,bindings},foods,changes:copy(foodChanges),ranges:copy(customRanges),approvedExtra:copy(approvedExtra),pdfSettings:copy(settings),editor:view()};
  }
  async function prepare(){
   const settings=pdf.read(),data=capture(settings);
   // Both models are captured synchronously before either asynchronous operation can yield.
   const resultPromise=pdf.generate(),documentPromise=DietProject.create(kind,data);
   const [document,result]=await Promise.all([documentPromise,resultPromise]);
   const name=('Dieta_'+result.model.planId).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'Dieta_MacroStudio';
   return {name,document,json:JSON.stringify(document,null,2),bytes:result.bytes};
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  async function childDirectory(parent,name){
   const stem=name+'_'+new Date().toISOString().replace(/[-:.TZ]/g,'');
   for(let n=0;n<100;n++){const candidate=stem+(n?'_'+n:'');try{await parent.getDirectoryHandle(candidate);continue;}catch(error){if(error.name!=='NotFoundError')throw error;}return {name:candidate,handle:await parent.getDirectoryHandle(candidate,{create:true})};}
   throw Error('Impossibile creare una cartella nuova senza sovrascrivere file esistenti.');
  }
  async function write(handle,name,bytes){
   const file=await handle.getFileHandle(name,{create:true}),writer=await file.createWritable();
   try{await writer.write(bytes);await writer.close();}catch(error){try{await writer.abort();}catch{}throw error;}
   const saved=new Uint8Array(await (await file.getFile()).arrayBuffer()),expected=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;
   if(saved.length!==expected.length||saved.some((value,i)=>value!==expected[i]))throw Error('Verifica dei file salvati non riuscita.');
  }
  function offerFallback(data,message){prepared=data;fallback.hidden=false;status.textContent=message||'PDF e progetto pronti: scarica entrambi e salvali nella stessa cartella. Il browser non può crearla automaticamente.';}
  button.onclick=async()=>{
   if(busy)return;busy=true;button.disabled=true;fallback.hidden=true;status.textContent='Preparazione della dieta…';let directory=null,created=[];
   try{
    let parent=null;
    if(typeof window.showDirectoryPicker==='function')try{parent=await window.showDirectoryPicker({id:'macro-studio-diets',mode:'readwrite'});}catch(error){if(error.name==='AbortError'){status.textContent='Esportazione annullata. Nessun piano modificato.';return;}if(!['SecurityError','NotAllowedError'].includes(error.name))throw error;}
    const data=await prepare();
    if(!parent){offerFallback(data);return;}
    directory=await childDirectory(parent,data.name);
    const pdfName=data.name+'.pdf',jsonName=data.name+'.dieta.json';
    created.push(pdfName);await write(directory.handle,pdfName,data.bytes);created.push(jsonName);await write(directory.handle,jsonName,data.json);
    status.textContent='Dieta esportata nella cartella «'+directory.name+'»: PDF e progetto JSON salvati e verificati.';
   }catch(error){if(directory)for(const name of created)try{await directory.handle.removeEntry(name);}catch{}status.textContent='Esportazione non completata: '+error.message+' Nessun piano modificato.';}
   finally{busy=false;button.disabled=false;}
  };
  document.getElementById('dietFallbackPdf').onclick=()=>{if(prepared)download(new Blob([prepared.bytes],{type:'application/pdf'}),prepared.name+'.pdf');};
  document.getElementById('dietFallbackJson').onclick=()=>{if(prepared)download(new Blob([prepared.json],{type:'application/json'}),prepared.name+'.dieta.json');};
  function apply(doc){
   if(storageBlocked)throw Error('Dati locali non leggibili: ripristino bloccato per conservarli.');
   if(doc.kind!==kind)throw Error(doc.kind==='generator'?'Questo progetto si apre nel generatore automatico: usa lì «Importa dieta esistente».':'Questo progetto si apre in index.html: usa lì «Importa dieta esistente».');
   const data=copy(doc.data),settings=data.pdfSettings;
   if(!generator){
    const next={...data.state,dietFoods:data.foods,dietProject:{format:doc.format,version:doc.version,catalogVersion:doc.catalogVersion},catalogVersion:FoodCatalog.version};
    DietProject.commit(localStorage,kind,[[stateKey,next],[pdf.key,settings]]);
    state=next;pdf.restore(settings);syncTargets();initCategories();renderFoods();render(false);
   }else{
    const context={...data.context,foods:data.foods},draft={...data.draft,dietContext:context,catalogBindings:context.bindings};
    const restoredDb=generatorCatalog.effective(data.changes,context);WeeklyManualPlan.validatePlan(draft.plan,restoredDb);
    const saved={catalogVersion:FoodCatalog.version,db:data.changes,ranges:data.ranges,draft,approvedExtra:data.approvedExtra};
    DietProject.commit(localStorage,kind,[[stateKey,saved],[pdf.key,settings]]);
    dietContext=context;foodChanges=data.changes;customRanges=data.ranges;approvedExtra=data.approvedExtra;T.splice(0,T.length,...context.templates);db=restoredDb;plan=draft.plan;SharedMealsApp.restore(draft.sharedMeals);pdf.restore(settings);restoreGeneratorFields(draft);refreshFoods();updateMacro();render();
   }
   if(data.editor?.group&&SharedMealsApp.get().pools[data.editor.group]?.some(a=>a.id===data.editor.alternative))SharedMealsApp.selectAlternative(data.editor.group,data.editor.alternative);
   prepared=null;fallback.hidden=true;status.textContent='Dieta importata e salvata. Alimenti, grammature, valori nutrizionali e impostazioni PDF ripristinati; il piano precedente è conservato in un backup locale.';
  }
  async function importFile(file){
   if(!file)return;if(importing)throw Error('Attendi il completamento dell’importazione in corso.');if(file.size>50*1024*1024)throw Error('File progetto troppo grande (massimo 50 MB).');
   importing=true;document.getElementById('dietProjectImport').disabled=true;try{const doc=await DietProject.parse(await file.text());apply(doc);return doc;}finally{importing=false;document.getElementById('dietProjectImport').disabled=false;}
  }
  document.getElementById('dietProjectImport').onclick=()=>input.click();
  input.onchange=async event=>{event.stopPropagation();const file=input.files[0];input.value='';if(!file)return;status.textContent='Verifica del progetto…';try{await importFile(file);}catch(error){status.textContent='Importazione non riuscita: '+error.message;}};
  const api={capture,prepare,importFile};globalThis.DietProjectApp=api;return api;
 }
 return {start};
})();
DietProjectUI.start();
