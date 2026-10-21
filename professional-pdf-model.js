'use strict';
// Read-only presentation adapters: use the existing nutrition helpers/totals, never infer missing values.
globalThis.ProfessionalPdfModel=(()=>{
 const days=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
 const mainMeals=['Colazione','Spuntino','Pranzo','Merenda','Cena'];
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 // Preserve full text blocks and line breaks; never mutate archived per-meal notes.
 function generalNotes(blocks){const seen=new Set();return blocks.map(v=>String(v??'').replace(/\r\n?/g,'\n').trim()).filter(v=>v&&!seen.has(v)&&seen.add(v)).join('\n\n');}
 function migrateIndications(input={},initial=''){
  if(input.indicationsVersion===1)return {...input};
  const mealNotes=input.mealNotes||{},ordered=Object.entries(mealNotes).sort(([a],[b])=>{const [da,ma]=a.split(':'),[db,mb]=b.split(':');return Number(da)-Number(db)||mainMeals.indexOf(ma)-mainMeals.indexOf(mb)||a.localeCompare(b,'it');});
  return {...input,indicationsVersion:1,legacyIndications:{notes:input.notes||'',planNotes:initial,mealNotes:{...mealNotes}},notes:generalNotes([initial,input.notes,...ordered.map(([,text])=>text)])};
 }
 function normalizeIndications(data){return {...data,notes:generalNotes([data.notes,...(data.days||[]).flatMap(day=>day.meals.map(meal=>meal.notes))]),days:data.days.map(day=>({...day,meals:day.meals.map(meal=>({...meal,notes:''}))}))};}
 function options(input={}){
  const date=input.date||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Data di elaborazione non valida.');
  const text=(key,max)=>{const value=String(input[key]??'').trim();if(value.length>max)throw Error('Testo troppo lungo: '+key);return value;};
  return {studio:text('studio',120)||'Macro Studio',contacts:text('contacts',400),client:text('client',120),professional:text('professional',150),planId:text('planId',60)||'MS-'+date.replaceAll('-',''),date,notes:migrateIndications(input).notes||'',mealNotes:input.mealNotes||{},substitutions:input.substitutionsAuthorized===true?text('substitutions',6000).split(/\r?\n/).map(v=>v.trim()).filter(Boolean):[]};
 }
 function finish(data,input){
  const config=options(input),result={...data,studio:config.studio,contacts:config.contacts,planId:config.planId,date:config.date,client:config.client||data.client,professional:config.professional||data.professional,notes:generalNotes([data.notes,config.notes]),substitutions:config.substitutions};
  result.days=result.days.map((day,d)=>({...day,name:days[d],meals:day.meals.map(meal=>({...meal,notes:input?.indicationsVersion===1?'':String(meal.notes||'')})),quantified:day.meals.some(m=>m.foods.length)&&['k','p','c','f'].every(k=>Nutrition.known(day.totals?.[k]))&&day.meals.every(m=>m.foods.every(f=>Nutrition.known(f.grams)))}));
  result.incomplete=result.days.some(day=>!day.quantified||day.meals.some(meal=>!meal.foods.length));return normalizeIndications(result);
 }
 function fromShared(week,foods,input={}){
  if(!Array.isArray(week.days)||week.days.length!==7)throw Error('Il PDF richiede sette giorni.');
  const c=SharedMeals.validate(week.sharedMeals),map=new Map(foods.map(f=>[f.id,f])),resolve=key=>map.get(key),rows=SharedMeals.mainRows(week);
  const toPdf=items=>items.map(r=>({name:resolve(r.key)?.name||r.key,grams:r.g,note:r.note||''}));
  const evaluated=rows.map((row,d)=>{const day=week.days[d],grams=week.weight&&day.rates?Object.fromEntries(['p','c','f'].map(k=>[k,week.weight*day.rates[k]])):Object.fromEntries(['p','c','f'].map(k=>[k,day.target*day.percent[k]/100/(k==='f'?9:4)]));return SharedMeals.assess(c,row,resolve,{k:day.target,...grams,tolerance:c.tolerance});});
  const data={client:week.client||'',professional:week.professional||'',notes:week.notes||'',sharedGroups:SharedMeals.groups.filter(g=>SharedMeals.enabled(c,g)).map(g=>({name:SharedMeals.labels[g],alternatives:c.pools[g].map(a=>({...a,foods:toPdf(a.foods),totals:SharedMeals.nutrients(a.foods,resolve)}))})),days:rows.map((row,d)=>({meals:['lunch','dinner',...(row.other?.length?['other']:[])].map(g=>({name:SharedMeals.labels[g]||'Altri pasti',foods:toPdf(row[g])})),totals:Object.fromEntries(['k','p','c','f'].map(k=>[k,evaluated[d].ranges[k]?.min??null])),ranges:evaluated[d].ranges,conform:evaluated[d].ok}))};return finish(data,input);
 }
 function fromMain(week,foods,input={}){
  if(week.sharedMeals)return fromShared(week,foods,input);
  const map=new Map(foods.map(f=>[f.id,f]));
  if(!Array.isArray(week.days)||week.days.length!==7)throw Error('Il PDF richiede sette giorni.');
  const data={client:week.client||'',professional:week.professional||'',notes:week.notes||'',days:week.days.map(day=>{
   const entries=day.entries||[],portions=entries.map(e=>Nutrition.portion(map.get(e.food),e.g));
   return {meals:mainMeals.map(name=>({name,foods:entries.filter(e=>e.meal===name).map(e=>{const food=map.get(e.food);if(!food)throw Error('Alimento mancante nel catalogo');return {name:food.name,grams:e.g,note:e.note||''};})})),totals:Object.fromEntries(['k','p','c','f'].map(k=>[k,Nutrition.sum(portions.map(p=>p[k]))]))};
  })};return finish(data,input);
 }
 function fromGenerator(source,input={}){
  // source supplies totals already computed by WeeklyGenerator; approved templates and state are never changed here.
  const data={client:'',professional:'',notes:'',days:days.map((name,d)=>({meals:source.meals.map((meal,m)=>({name:meal,foods:source.foods(d,m).map(f=>({...f}))})),totals:{...source.totals(d)}}))};return finish(data,input);
 }
 return {today,options,fromMain,fromGenerator,generalNotes,migrateIndications,normalizeIndications};
})();
