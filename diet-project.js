'use strict';
// Versioned, self-contained diet documents. No browser state is changed by parsing or validation.
globalThis.DietProject=(()=>{
 const format='MacroStudioDiet',version=1,copy=value=>JSON.parse(JSON.stringify(value));
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function fail(message){throw Error(message);}
 function inspect(value){
  if(typeof value==='number'&&!Number.isFinite(value))fail('Numero non finito nel progetto.');
  if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
   if(['__proto__','prototype','constructor'].includes(key))fail('Chiave non consentita nel progetto.');inspect(item);
  }
 }
 function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(object(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
 async function digest(value){if(!globalThis.crypto?.subtle)fail('Il controllo di integrità richiede HTTPS o localhost.');const bytes=new TextEncoder().encode(canonical(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function foodMap(foods){
  if(!object(foods))fail('Valori nutrizionali del progetto mancanti.');
  for(const [key,f] of Object.entries(foods)){
   if(!key||!object(f)||typeof f.id!=='string'||!f.id||typeof f.name!=='string'||!f.name.trim())fail('Identità alimentare non valida.');
   for(const k of ['k','c','p','f'])if(f[k]!==null&&(typeof f[k]!=='number'||!Number.isFinite(f[k])))fail('Nutriente non numerico: '+f.name);
   for(const field of ['source','category','sourceWarning'])if(f[field]!==undefined&&f[field]!==null&&typeof f[field]!=='string')fail('Metadato alimentare non valido.');if(f.traces!==undefined&&(!Array.isArray(f.traces)||f.traces.some(k=>!['k','c','p','f'].includes(k))))fail('Tracce nutrizionali non valide.');if(f.historicalOnly!==undefined&&typeof f.historicalOnly!=='boolean')fail('Scheda storica non valida.');Nutrition.validate(f);
  }
  return foods;
 }
 const quantity=g=>g===null||(typeof g==='number'&&Number.isFinite(g)&&g>0&&g<=10000);
 function shared(config,foods){SharedMeals.validate(config);for(const pool of Object.values(config.pools))for(const a of pool)for(const r of a.foods)if(!Object.hasOwn(foods,r.key))fail('Manca la scheda nutrizionale di un alimento dell’alternativa.');}
 function main(data){
  const s=data.state;if(Object.entries(data.foods).some(([id,f])=>id!==f.id))fail('Identificativo della scheda alimentare non corrispondente.');if(!object(s)||!Array.isArray(s.days)||s.days.length!==7||!Array.isArray(s.custom)||!object(s.overrides))fail('Struttura del piano non valida.');
  if(!Number.isInteger(s.activeDay)||s.activeDay<0||s.activeDay>6)fail('Giorno attivo non valido.');
  if(s.weight!==null&&s.weight!==undefined&&(!Nutrition.known(s.weight)||s.weight<1||s.weight>500))fail('Peso del piano non valido.');
  for(const k of ['client','professional','notes'])if(typeof s[k]!=='string')fail('Informazioni del piano non valide.');
  for(const day of s.days){
   if(!object(day)||!Nutrition.known(day.target)||day.target<=0||!object(day.percent)||['c','p','f'].some(k=>!Nutrition.known(day.percent[k]))||Math.abs(day.percent.c+day.percent.p+day.percent.f-100)>1e-6||!Array.isArray(day.entries))fail('Giorno o target non valido.');
   if(day.rates!==null&&day.rates!==undefined&&(!object(day.rates)||['c','p','f'].some(k=>!Nutrition.known(day.rates[k])||day.rates[k]>50)))fail('Target g/kg non valido.');
   const ids=new Set();for(const r of day.entries){if(!object(r)||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.food!=='string'||!Object.hasOwn(data.foods,r.food)||!['Colazione','Spuntino','Merenda','Pranzo','Cena'].includes(r.meal)||!quantity(r.g)||r.g===null)fail('Alimento o grammatura giornaliera non valido.');ids.add(r.id);}
  }
  if(s.historicalFoods!==undefined&&(!object(s.historicalFoods)||Object.values(s.historicalFoods).some(f=>!object(f)||typeof f.id!=='string'||typeof f.name!=='string')))fail('Identità storiche del piano non valide.');for(const f of [...s.custom,...Object.values(s.overrides)]){if(!object(f))fail('Personalizzazione alimentare non valida.');Nutrition.validate(f);}
  shared(s.sharedMeals,data.foods);
 }
 function generator(data){
  const c=data.context;if(!object(c)||!Array.isArray(c.templates)||!object(c.bindings)||!object(data.draft)||!object(data.ranges)||!object(data.changes)||!Array.isArray(data.approvedExtra))fail('Progetto del generatore non valido.');
  const ids=new Set(),meals=['Colazione','Spuntino mattutino','Pranzo','Cena'];
  for(const t of c.templates){if(!object(t)||!Number.isInteger(t.id)||t.id<0||ids.has(t.id)||typeof t.title!=='string'||!t.title||!['Colazione','Spuntino','Spuntino mattutino','Pranzo','Cena'].includes(t.meal)||!Array.isArray(t.ingredients)||!t.ingredients.length||t.ingredients.some(k=>typeof k!=='string'||!k||!Object.hasOwn(data.foods,k)))fail('Modello del piano non valido o dati nutrizionali mancanti.');ids.add(t.id);}
  for(const [name,id] of Object.entries(c.bindings))if(!name||typeof id!=='string'||!Object.values(data.foods).some(f=>f.id===id))fail('Associazione alimentare non valida.');
  if(!Array.isArray(data.draft.plan)||data.draft.plan.length!==7)fail('Il generatore richiede sette giorni.');
  for(const row of data.draft.plan){if(!Array.isArray(row)||row.length!==4)fail('Pasti del generatore non validi.');for(const [m,slot] of row.entries()){
   const t=c.templates.find(t=>t.id===slot?.id);if(!object(slot)||typeof slot.locked!=='boolean'||(slot.id!==null&&(!t||(m===1?!['Spuntino','Spuntino mattutino'].includes(t.meal):t.meal!==meals[m]))))fail('Modello selezionato non valido.');
   if(slot.grams!==null&&slot.grams!==undefined&&(!Array.isArray(slot.grams)||slot.grams.some(g=>g!==null&&(!Nutrition.known(g)||g>10000))||(t&&slot.grams.length!==t.ingredients.length)))fail('Grammature del modello non valide.');
   if(slot.manualFoods!==undefined&&!Array.isArray(slot.manualFoods))fail('Alimenti manuali non validi.');for(const r of slot.manualFoods||[])if(!Object.hasOwn(data.foods,r.key)||!quantity(r.g)||r.g===null||(r.creaId??null)!==null)fail('Alimento manuale o grammatura non valida.');
  }}
  for(const t of data.approvedExtra)if(!object(t)||!c.templates.some(model=>canonical(model)===canonical(t)))fail('Modello aggiuntivo non coerente con il progetto.');
  for(const [id,row] of Object.entries(data.changes)){if(!object(row)||!Object.values(data.foods).some(f=>f.id===id)||('name' in row&&typeof row.name!=='string'))fail('Personalizzazione del progetto non valida.');const original=Object.values(data.foods).find(f=>f.id===id);if(row.id!==undefined&&row.id!==id)fail('Identità della personalizzazione non corrispondente.');foodMap({[id]:{...original,...row,id}});}
  for(const range of Object.values(data.ranges))if(!WeeklyGenerator.validRange(range))fail('Intervallo di grammature non valido.');
  const limits={weight:[1,500],kcal:[1,20000],protein:[0,10000],carbs:[0,10000],fat:[0,10000],proteinKg:[0,50],carbsKg:[0,50],fatKg:[0,50],energyTolerance:[0,50],macroTolerance:[0,50],mealTolerance:[0,50]};
  for(const [key,[lo,hi]] of Object.entries(limits)){const raw=data.draft[key];if(raw!==undefined&&raw!==''&&(typeof raw!=='number'&&typeof raw!=='string'||!Number.isFinite(Number(raw))||Number(raw)<lo||Number(raw)>hi))fail('Target del generatore non valido: '+key);}
  shared(data.draft.sharedMeals,data.foods);
 }
 function validate(kind,data){
  inspect(data);if(!object(data)||!object(data.pdfSettings))fail('Impostazioni PDF mancanti.');foodMap(data.foods);for(const key of ['studio','contacts','client','professional','planId','date','notes','substitutions'])if(data.pdfSettings[key]!==undefined&&typeof data.pdfSettings[key]!=='string')fail('Campo PDF non testuale: '+key);if(data.pdfSettings.substitutionsAuthorized!==undefined&&typeof data.pdfSettings.substitutionsAuthorized!=='boolean')fail('Autorizzazione sostituzioni non valida.');ProfessionalPdfModel.options(data.pdfSettings);
  if(data.editor!==undefined&&(!object(data.editor)||!SharedMeals.groups.includes(data.editor.group)||typeof data.editor.alternative!=='string'))fail('Selezione alternativa non valida.');
  if(kind==='main')main(data);else if(kind==='generator')generator(data);else fail('Tipo di progetto non supportato.');return data;
 }
 async function create(kind,data){validate(kind,data);const document={format,version,createdAt:new Date().toISOString(),catalogVersion:FoodCatalog.version,catalogMetadata:copy(FoodCatalog.meta),kind,data:copy(data)};return {...document,integrity:{algorithm:'SHA-256',digest:await digest(document)}};}
 async function parse(text){
  if(typeof text!=='string'||text.length>50*1024*1024)fail('File progetto troppo grande o non leggibile.');
  let doc;try{doc=JSON.parse(text);}catch{fail('File JSON danneggiato o non leggibile.');}inspect(doc);
  if(!object(doc)||doc.format!==format)fail('Formato non riconosciuto. Per i vecchi JSON usa «Ripristina piano».');
  if(doc.version!==version)fail('Versione del progetto non supportata ('+String(doc.version)+'). Aggiorna l’app; i dati attuali non sono stati modificati.');
  const {integrity,...payload}=doc;
  if(!object(integrity)||integrity.algorithm!=='SHA-256'||!/^[a-f0-9]{64}$/.test(integrity.digest)||await digest(payload)!==integrity.digest)fail('Controllo di integrità fallito: file incompleto o modificato.');
  validate(doc.kind,doc.data);return doc;
 }
 function commit(storage,kind,entries){
  const backupKey='macro-studio-diet-before-import:'+kind+':'+Date.now()+':'+crypto.randomUUID();
  const backup={format:'MacroStudioDietBackup',version:1,createdAt:new Date().toISOString(),entries:entries.map(([key])=>[key,storage.getItem(key)])};
  FoodCatalog.writeMany(storage,[[backupKey,backup],...entries]);return backupKey;
 }
 return {format,version,copy,canonical,digest,foodMap,validate,create,parse,commit};
})();
