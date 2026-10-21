'use strict';
// Professional additions are stored separately from approved templates. Nutrients always resolve from the current catalog.
globalThis.WeeklyManualPlan=(()=>{
 const fields=['kcal','p','c','f'];
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it').trim();
 const category=row=>row.food.catalogOriginal?.category||row.food.category||'Personalizzati';
 function filter(rows,query='',selectedCategory=''){
  const tokens=normalize(query).split(/\s+/).filter(Boolean);
  return rows.filter(row=>(!selectedCategory||category(row)===selectedCategory)&&tokens.every(token=>normalize([row.name,row.historicalName,row.id,row.key,category(row)].join(' ')).includes(token)));
 }
 function quantity(raw){if(!['string','number'].includes(typeof raw)||String(raw).trim()==='')throw Error('Inserisci una grammatura.');const g=Number(raw);if(!Number.isFinite(g)||g<=0||g>10000)throw Error('Grammatura richiesta: maggiore di zero e non oltre 10.000 g.');return g;}
 function entries(slot){return Array.isArray(slot?.manualFoods)?slot.manualFoods:[];}
 function validateEntry(entry,db){
  if(!entry||typeof entry.key!=='string'||!Object.hasOwn(db,entry.key))throw Error('Alimento manuale non disponibile nel catalogo.');
  if((db[entry.key].creaId||null)!==(entry.creaId||null))throw Error('ID CREA dell’alimento manuale non corrispondente.');
  if(typeof entry.g!=='number')throw Error('Grammatura manuale non numerica.');quantity(entry.g);return entry;
 }
 function validatePlan(plan,db){
  if(!Array.isArray(plan)||plan.length!==7||plan.some(row=>!Array.isArray(row)||row.length!==4))throw Error('Piano manuale: servono sette giorni e quattro pasti.');
  for(const row of plan)for(const slot of row){if(!slot||typeof slot!=='object')throw Error('Pasto non valido.');if(slot.manualFoods!==undefined&&!Array.isArray(slot.manualFoods))throw Error('Elenco alimenti manuali non valido.');for(const entry of entries(slot))validateEntry(entry,db);}return plan;
 }
 function copy(plan){return plan.map(row=>row.map(slot=>({...slot,manualFoods:entries(slot).map(entry=>({...entry}))})));}
 function position(plan,d,m){if(!Number.isInteger(d)||d<0||d>6||!Number.isInteger(m)||m<0||m>3||!plan[d]?.[m])throw Error('Giorno o pasto non valido.');}
 function add(plan,d,m,key,g,db){position(plan,d,m);const entry={key,creaId:db[key]?.creaId||null,g:quantity(g)};validateEntry(entry,db);const next=copy(plan);next[d][m].manualFoods.push(entry);return next;}
 function edit(plan,d,m,i,g,db){position(plan,d,m);const next=copy(plan),entry=next[d][m].manualFoods[i];if(!entry)throw Error('Riga manuale non disponibile.');entry.g=quantity(g);validateEntry(entry,db);return next;}
 function remove(plan,d,m,i){position(plan,d,m);const next=copy(plan);if(!next[d][m].manualFoods[i])throw Error('Riga manuale non disponibile.');next[d][m].manualFoods.splice(i,1);return next;}
 function carry(previous,next){return next.map((row,d)=>row.map((slot,m)=>({...slot,manualFoods:entries(previous[d]?.[m]).map(entry=>({...entry}))})));}
 function inputs(row,templates,db,baseRange){
  const resolved={...db},ranges=new Map(),grams=[],effective=[];
  row.forEach((slot,m)=>{
   if(slot.manualFoods!==undefined&&!Array.isArray(slot.manualFoods))throw Error('Elenco alimenti manuali non valido.');
   const original=templates[m],manual=entries(slot);
   if(!original&&!manual.length){effective.push(null);grams.push([]);return;}
   const ingredients=[...(original?.ingredients||[])],g=ingredients.map((_,i)=>slot.grams?.[i]??null);
   manual.forEach((entry,i)=>{validateEntry(entry,db);const food=db[entry.key];const key='Manuale: '+(food.officialName||food.name||entry.key)+' · '+(entry.creaId||'personalizzato')+' · pasto '+(m+1)+' riga '+(i+1);resolved[key]=food;ranges.set(key,[entry.g,entry.g,1]);ingredients.push(key);g.push(entry.g);});
   effective.push({...original,title:original?.title||'Pasto manuale',ingredients});grams.push(g);
  });
  return {templates:effective,grams,db:resolved,range:key=>ranges.get(key)||baseRange(key)};
 }
 function unknowns(food){return fields.filter(k=>!Nutrition.known(food?.[k]));}
 return {filter,category,quantity,entries,validateEntry,validatePlan,add,edit,remove,carry,inputs,unknowns};
})();
