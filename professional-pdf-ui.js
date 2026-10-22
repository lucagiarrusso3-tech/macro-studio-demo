'use strict';
// Only presentation settings are stored here. Nutrition, professional overrides and generator state are read-only.
globalThis.ProfessionalPdfUI=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount({host,key,mealNames,snapshot,existingDownload,initial={}}){
  if(globalThis.SharedMealsApp)mealNames=['Pranzo','Cena'];
  let saved={},pdfStorageBlocked=false;
  try{const raw=localStorage.getItem(key);if(raw!==null){saved=JSON.parse(raw);if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Impostazioni non leggibili');}}catch{saved={};pdfStorageBlocked=true;}
  const panel=document.createElement('section');panel.className='professional-pdf no-print';panel.id='professionalPdfPanel';panel.innerHTML='<h2>PDF professionale</h2><p>Personalizza il documento, controlla l’anteprima e scaricalo sul dispositivo. Nessun servizio esterno.</p><div class="pdf-fields"><label>Nome dello studio<input data-pdf="studio" maxlength="120" placeholder="Macro Studio"></label><label>Riferimenti del professionista<input data-pdf="contacts" maxlength="400" placeholder="Titolo, recapiti e riferimenti professionali"></label><label>Destinatario del PDF<input data-pdf="client" maxlength="120" autocomplete="off" placeholder="Facoltativo"></label><label>Professionista nel PDF<input data-pdf="professional" maxlength="150" autocomplete="off" placeholder="Facoltativo"></label><label>Identificativo del piano<input data-pdf="planId" maxlength="60"></label><label>Data di elaborazione<input data-pdf="date" type="date"></label></div><h3>Indicazioni generali</h3><label>Indicazioni generali<textarea data-pdf="notes" rows="6" placeholder="Indicazioni valide per tutto il piano alimentare"></textarea></label><details><summary>Sostituzioni alimentari autorizzate (facoltative)</summary><p>Una sostituzione per riga, con quantità e condizioni concordate. Il testo non modifica gli alimenti o i calcoli del piano.</p><textarea data-pdf="substitutions" rows="4" maxlength="6000" aria-label="Sostituzioni autorizzate"></textarea><label><input data-pdf="substitutionsAuthorized" type="checkbox">Confermo che queste sostituzioni sono autorizzate per questo piano</label></details><div class="pdf-buttons"><button id="professionalPdfPreview" type="button" class="secondary">Anteprima PDF</button><button id="professionalPdfExport" type="button">Scarica PDF professionale</button></div><p data-pdf="status" role="status"></p><small>Con dati o grammature sconosciuti il documento riporta una bozza e i totali non completamente quantificabili. Non dichiara il raggiungimento degli obiettivi.</small>';
  host.appendChild(panel);const field=name=>panel.querySelector('[data-pdf="'+name+'"]');
  const defaults={studio:'Macro Studio',contacts:'',client:initial.client||'',professional:initial.professional||'',planId:'MS-'+ProfessionalPdfModel.today().replaceAll('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase(),date:ProfessionalPdfModel.today(),notes:'',mealNotes:{},substitutions:'',substitutionsAuthorized:false};
  let draft=ProfessionalPdfModel.migrateIndications({...defaults,...saved,mealNotes:{...(saved.mealNotes||{})}},initial.notes||'');
  if(saved.indicationsVersion===1&&initial.notes!==undefined)draft.notes=initial.notes;
  if(!pdfStorageBlocked&&saved.indicationsVersion!==1){try{const raw=localStorage.getItem(key),backup=key+':before-general-indications-v1';if(raw!==null&&localStorage.getItem(backup)===null){localStorage.setItem(backup,raw);if(localStorage.getItem(backup)!==raw)throw Error('Copia precedente non salvata.');}Nutrition.write(localStorage,key,draft);}catch{pdfStorageBlocked=true;}}
  for(const name of ['studio','contacts','client','professional','planId','date','notes','substitutions'])field(name).value=draft[name];field('substitutionsAuthorized').checked=draft.substitutionsAuthorized===true;
  function read(){const result={...draft,mealNotes:{...draft.mealNotes}};for(const name of ['studio','contacts','client','professional','planId','date','notes','substitutions'])result[name]=field(name).value;result.substitutionsAuthorized=field('substitutionsAuthorized').checked;ProfessionalPdfModel.options(result);return result;}
  function save(updatePlan=false){try{const next=read();if(pdfStorageBlocked)throw Error('Impostazioni precedenti non leggibili o migrazione non salvata: originali conservati.');if(updatePlan===true&&key==='macro-studio-pdf-settings-v1:main'){if(storageBlocked)throw Error('Piano precedente non leggibile: dati conservati.');const nextPlan={...state,notes:next.notes};FoodCatalog.writeMany(localStorage,[[key,next],[KEY,nextPlan]]);state=nextPlan;}else Nutrition.write(localStorage,key,next);draft=next;field('status').textContent='Impostazioni PDF salvate su questo dispositivo.';}catch(error){field('status').textContent='Impostazioni PDF non salvate: '+error.message;}}
  panel.addEventListener('change',()=>save());panel.addEventListener('input',e=>{if(e.target===field('notes'))save(true);});if(pdfStorageBlocked)field('status').textContent='Impostazioni PDF non leggibili o migrazione non salvata: originali conservati.';
  const dialog=document.createElement('dialog');dialog.className='professional-pdf-preview';dialog.id='professionalPdfDialog';dialog.innerHTML='<h2>Anteprima del documento</h2><p data-view="summary"></p><iframe title="Anteprima PDF settimanale"></iframe><div class="pdf-modal-actions"><button type="button" data-view="download">Scarica questo PDF</button><a data-view="open" target="_blank" rel="noopener">Apri il PDF in una nuova scheda</a><button type="button" data-view="close">Chiudi anteprima</button></div>';document.body.appendChild(dialog);
  let cache=null;
  async function generate(){
   if(globalThis.SharedMealsLoadError)throw Error('Alternative non leggibili: '+SharedMealsLoadError);
   const settings=read();const model=globalThis.SharedMealsApp?SharedMealsApp.pdf(settings):snapshot(settings),signature=JSON.stringify(model);
   if(cache?.signature===signature)return cache;
   const bytes=await buildWeeklyPdf({...model,pdfModel:true});if(cache)URL.revokeObjectURL(cache.url);
   cache={bytes,url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),signature,model};return cache;
  }
  function download(result){const name=('Menu_settimanale_'+result.model.planId).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_');const a=document.createElement('a');a.href=result.url;a.download=name+'.pdf';document.body.appendChild(a);a.click();a.remove();field('status').textContent='PDF generato localmente e scaricato. Controlla il documento prima della consegna.';}
  async function run(preview){const buttons=[panel.querySelector('#professionalPdfExport'),panel.querySelector('#professionalPdfPreview'),existingDownload].filter(Boolean);buttons.forEach(b=>b.disabled=true);field('status').textContent='Generazione locale del PDF…';try{const result=await generate();if(preview){dialog.querySelector('iframe').src=result.url;dialog.querySelector('[data-view="open"]').href=result.url;dialog.querySelector('[data-view="summary"]').textContent='Piano '+result.model.planId+' · 7 giorni · '+(result.model.incomplete?'BOZZA: pasti o dati incompleti.':'Riepiloghi nutrizionali disponibili; nessuna dichiarazione automatica dei target.');dialog.showModal();field('status').textContent='Anteprima del PDF generata localmente.';}else download(result);if(document.getElementById('pdferror'))document.getElementById('pdferror').textContent='';}catch(error){field('status').textContent='PDF non generato: '+error.message;if(document.getElementById('pdferror'))document.getElementById('pdferror').textContent='PDF non generato: '+error.message;}finally{buttons.forEach(b=>b.disabled=false);}}
  panel.querySelector('#professionalPdfPreview').onclick=()=>run(true);panel.querySelector('#professionalPdfExport').onclick=()=>run(false);if(existingDownload)existingDownload.onclick=()=>run(false);
  dialog.querySelector('[data-view="close"]').onclick=()=>dialog.close();dialog.querySelector('[data-view="download"]').onclick=()=>{if(cache)download(cache);};
  function restore(settings){ProfessionalPdfModel.options(settings);draft=JSON.parse(JSON.stringify(settings));for(const name of ['studio','contacts','client','professional','planId','date','notes','substitutions'])field(name).value=draft[name]??'';field('substitutionsAuthorized').checked=draft.substitutionsAuthorized===true;if(cache){URL.revokeObjectURL(cache.url);cache=null;}if(dialog.open)dialog.close();}
  return {generate,panel,dialog,save,read,restore,key};
 }
 function start(){
  if(document.getElementById('clientexport')||document.querySelector('.clientexport')){
   const previous=document.querySelector('.clientexport');
   const ui=mount({host:previous,key:'macro-studio-pdf-settings-v1:main',mealNames:['Colazione','Spuntino','Pranzo','Merenda','Cena'],snapshot:settings=>ProfessionalPdfModel.fromMain(JSON.parse(JSON.stringify(state)),catalog(),settings),initial:{client:state.client,professional:state.professional,notes:state.notes}});
   globalThis.ProfessionalPdfApp=ui;
   // Keep the original plan fields and their save handlers, with one visible PDF panel.
   for(const name of ['client','professional']){
    const original=document.getElementById(name),field=ui.panel.querySelector('[data-pdf="'+name+'"]');
    original.dataset.pdf=name;original.value=field.value;field.replaceWith(original);
   }
   const notes=document.getElementById('notes'),replacement=ui.panel.querySelector('[data-pdf="notes"]');
   notes.dataset.pdf='notes';notes.removeAttribute('maxlength');notes.rows=6;notes.value=replacement.value;replacement.replaceWith(notes);
   // The lower unified field persists in both the plan and PDF settings. Identity handlers above stay intact.
   notes.oninput=null;
   if(notes.value!==state.notes)ui.save(true);

   for(const id of ['pdfstatus','pdferror'])ui.panel.appendChild(document.getElementById(id));
   previous.replaceWith(ui.panel);
  }else if(document.getElementById('stage-plans')){
   globalThis.ProfessionalPdfApp=mount({host:document.getElementById('stage-plans'),key:'macro-studio-pdf-settings-v1:generator',mealNames:MEALS,snapshot:settings=>ProfessionalPdfModel.fromGenerator({meals:MEALS,totals:d=>{const input=dayInputs(d),t=WeeklyGenerator.totals(input.templates,input.grams,input.db).day;return {k:t.kcal,p:t.p,c:t.c,f:t.f};},foods:(d,m)=>{const slot=plan[d][m],template=current(d,m);return [...(template?.ingredients||[]).map((key,i)=>({name:db[key]?.officialName||db[key]?.name||key,grams:slot.grams?.[i]??null})),...WeeklyManualPlan.entries(slot).map(entry=>({name:db[entry.key]?.officialName||db[entry.key]?.name||entry.key,grams:entry.g}))];}},settings)});
  }
 }
 return {mount,start};
})();
ProfessionalPdfUI.start();
