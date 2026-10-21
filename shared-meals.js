'use strict';
// Shared choices are mutually exclusive. The Cartesian extrema are exact for each additive nutrient.
globalThis.SharedMeals=(()=>{
 const keys=['k','p','c','f'],groups=['breakfast','morning','afternoon'],labels={breakfast:'Colazioni — valide tutti i giorni',morning:'Spuntino mattutino',afternoon:'Spuntino pomeridiano',lunch:'Pranzo',dinner:'Cena'};
 const copy=x=>JSON.parse(JSON.stringify(x)),known=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 function defaults(){return {version:1,active:{morning:true,afternoon:false},shares:{breakfast:25,morning:10,afternoon:0,lunch:35,dinner:30},tolerance:{kcal:.03,macro:.05,meal:.03},pools:{breakfast:[],morning:[],afternoon:[]},legacy:null};}
 function enabled(config,g){return g==='breakfast'||config.active[g]===true;}
 function validate(c){
  if(!c||c.version!==1||!c.active||typeof c.active.morning!=='boolean'||typeof c.active.afternoon!=='boolean'||(!c.active.morning&&!c.active.afternoon))throw Error('Attiva almeno uno spuntino; formato alternative non valido.');
  if(!c.shares||Object.keys(labels).some(g=>!known(c.shares[g])||c.shares[g]>100))throw Error('Quote indicative non valide.');
  if(!c.dailyOnly&&(!c.shares||Object.keys(labels).some(g=>!known(c.shares[g])||c.shares[g]>100)||Math.abs(Object.keys(labels).reduce((sum,g)=>sum+c.shares[g],0)-100)>1e-7))throw Error('Le percentuali dei cinque pasti devono sommare a 100.');
  for(const g of groups)if(!c.dailyOnly&&!enabled(c,g)&&c.shares[g]!==0)throw Error('Uno spuntino disattivato deve avere quota zero.');
  for(const g of Object.keys(labels))if(!c.dailyOnly&&(g==='lunch'||g==='dinner'||enabled(c,g))&&c.shares[g]<=0)throw Error('Ogni pasto attivo richiede una percentuale positiva.');
  if(!c.tolerance||['kcal','macro','meal'].some(k=>!known(c.tolerance[k])||c.tolerance[k]<=0||c.tolerance[k]>.5))throw Error('Tolleranze richieste: maggiori di zero e non oltre 50%.');
  if(!c.pools)throw Error('Alternative mancanti.');const ids=new Set();
  for(const g of groups){if(!Array.isArray(c.pools[g]))throw Error('Elenco alternative non valido.');for(const a of c.pools[g]){if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.title!=='string'||a.title.length>150||typeof (a.note??'')!=='string'||(a.note||'').length>4000||!Array.isArray(a.foods))throw Error('Alternativa non valida o identificativo duplicato.');ids.add(a.id);for(const r of a.foods)if(!r||typeof r.key!=='string'||!r.key||!(r.g===null||(known(r.g)&&r.g>0&&r.g<=10000)))throw Error('Alimento o grammatura non valida (0 < g ≤ 10.000).');}}
  return c;
 }
 function migrate(rows){
  if(!Array.isArray(rows)||rows.length!==7)throw Error('La migrazione richiede sette giorni.');const c=defaults();c.legacy=copy(rows);
  for(const g of groups){const seen=new Set();for(const day of rows){const foods=copy(day[g]||[]);if(!foods.length)continue;const signature=JSON.stringify(foods.map(r=>({key:r.key,g:r.g,note:r.note||''})));if(seen.has(signature))continue;seen.add(signature);c.pools[g].push({id:g+'-'+c.pools[g].length,title:'Alternativa '+(c.pools[g].length+1),foods,note:''});}}
  if(c.pools.afternoon.length){c.active.afternoon=true;c.active.morning=c.pools.morning.length>0;c.shares.morning=c.active.morning?5:0;c.shares.afternoon=c.active.morning?5:10;}
  return validate(c);
 }
 function toggle(config,g,value){const c=copy(config);if(!['morning','afternoon'].includes(g))throw Error('Spuntino non valido.');c.active[g]=!!value;if(!c.active.morning&&!c.active.afternoon)throw Error('Almeno uno spuntino deve restare attivo.');const budget=c.shares.morning+c.shares.afternoon;c.shares.morning=c.active.morning?budget/(c.active.afternoon?2:1):0;c.shares.afternoon=c.active.afternoon?budget/(c.active.morning?2:1):0;return validate(c);}
 function nutrients(rows,resolve){
  if(!Array.isArray(rows)||!rows.length)return Object.fromEntries(keys.map(k=>[k,null]));
  const parts=rows.map(r=>{const food=resolve(r.key);return Object.fromEntries(keys.map(k=>[k,food&&known(food[k])&&known(r.g)&&r.g>0?food[k]*r.g/100:null]));});
  return Object.fromEntries(keys.map(k=>[k,parts.every(r=>known(r[k]))?parts.reduce((s,r)=>s+r[k],0):null]));
 }
 function assess(c,fixed,resolve,target){
  validate(c);const issues=[],alternatives={};let count=1;
  const fixedMeals={lunch:nutrients(fixed.lunch,resolve),dinner:nutrients(fixed.dinner,resolve)};if(fixed.other?.length)fixedMeals.other=nutrients(fixed.other,resolve);
  for(const g of groups)if(enabled(c,g)){const pool=c.pools[g];count*=pool.length;alternatives[g]=pool.map(a=>({...a,totals:nutrients(a.foods,resolve)}));if(!pool.length)issues.push(labels[g]+': nessuna alternativa.');}
  const ranges=Object.fromEntries(keys.map(k=>{const choices=Object.values(alternatives);if(Object.values(fixedMeals).some(t=>!known(t[k]))||choices.some(list=>!list.length||list.some(a=>!known(a.totals[k]))))return [k,null];const base=Object.values(fixedMeals).reduce((sum,t)=>sum+t[k],0);return [k,{min:base+choices.reduce((s,list)=>s+Math.min(...list.map(a=>a.totals[k])),0),max:base+choices.reduce((s,list)=>s+Math.max(...list.map(a=>a.totals[k])),0)}];}));
  const quantified=keys.every(k=>ranges[k]!==null);if(!quantified)issues.push('Calcolo di conformità bloccato: nutrienti o grammature sconosciuti, oppure pasti incompleti.');
  if(!target||keys.some(k=>!known(target[k])))issues.push('Target nutrizionali non configurati.');
  else{
   const tol=target.tolerance||c.tolerance;
   for(const k of keys){const range=ranges[k],limit=Math.max(target[k],1)*(k==='k'?tol.kcal:tol.macro);if(range&&(range.min<target[k]-limit-1e-7||range.max>target[k]+limit+1e-7))issues.push(k+': non tutte le combinazioni rispettano il target ('+range.min.toFixed(1)+'–'+range.max.toFixed(1)+' / '+target[k].toFixed(1)+').');}
   const check=(name,value,g)=>{if(target.dailyOnly)return;const goal=target.k*c.shares[g]/100;if(!known(value)||Math.abs(value-goal)>Math.max(goal,1)*tol.meal+1e-7)issues.push(name+': calorie fuori quota '+c.shares[g]+'%.');};
   for(const [g,list] of Object.entries(alternatives))for(const a of list)check(labels[g]+' · '+a.title,a.totals.k,g);
   for(const g of ['lunch','dinner'])check(labels[g],fixedMeals[g].k,g);
  }
  return {ranges,alternatives,fixedMeals,combinations:count,quantified,issues:[...new Set(issues)],ok:issues.length===0};
 }
 // Display only the contributions already entered. Omitted meals/empty alternatives
 // remain explicitly incomplete; this never replaces assess() or certifies a plan.
 function progress(c,fixed,resolve){
  validate(c);const components=[],omitted=[];
  for(const g of groups)if(enabled(c,g)){
   const pool=c.pools[g],entered=pool.filter(a=>a.foods.length>0);
   if(!pool.length)omitted.push(labels[g]);
   for(const a of pool)if(!a.foods.length)omitted.push(labels[g]+' · '+a.title);
   if(entered.length)components.push(entered.map(a=>nutrients(a.foods,resolve)));
  }
  for(const g of ['lunch','dinner']){
   const rows=fixed[g]||[];
   if(rows.length)components.push([nutrients(rows,resolve)]);else omitted.push(labels[g]);
  }
  if(fixed.other?.length)components.push([nutrients(fixed.other,resolve)]);
  const ranges=Object.fromEntries(keys.map(k=>{
   if(!components.length||components.some(choices=>choices.some(t=>!known(t[k]))))return [k,null];
   return [k,{min:components.reduce((sum,choices)=>sum+Math.min(...choices.map(t=>t[k])),0),max:components.reduce((sum,choices)=>sum+Math.max(...choices.map(t=>t[k])),0)}];
  }));
  return {ranges,omitted,partial:omitted.length>0,hasEntries:components.length>0};
 }
 function missing(c,fixed,resolve){
  validate(c);const result=Object.fromEntries(keys.map(k=>[k,[]]));
  const inspect=(rows,group,alternative)=>{for(const row of rows){
   const food=resolve(row.key);
   for(const k of keys){
    const reason=!food?'food':!known(row.g)||row.g<=0?'portion':!known(food[k])?(food.traces?.includes(k)?'trace':'nutrient'):null;
    if(reason)result[k].push({group,alternative,key:row.key,name:food?.name||row.key,reason});
   }
  }};
  for(const g of groups)if(enabled(c,g))for(const a of c.pools[g])inspect(a.foods,g,a.title);
  for(const g of ['lunch','dinner'])inspect(fixed[g]||[],g,null);
  inspect(fixed.other||[],'other',null);return result;
 }
 // Descriptive daily mean, independent from strict all-combinations conformity.
 function average(c,fixed,resolve){
  validate(c);const zero=()=>Object.fromEntries(keys.map(k=>[k,0])),meals={};
  for(const g of groups){const choices=enabled(c,g)?c.pools[g].filter(a=>a.foods.length).map(a=>nutrients(a.foods,resolve)):[];meals[g]=Object.fromEntries(keys.map(k=>[k,choices.length?(choices.every(t=>known(t[k]))?choices.reduce((n,t)=>n+t[k],0)/choices.length:null):0]));}
  for(const g of ['lunch','dinner','other'])meals[g]=fixed[g]?.length?nutrients(fixed[g],resolve):zero();
  const totals=Object.fromEntries(keys.map(k=>[k,Object.values(meals).every(t=>known(t[k]))?Object.values(meals).reduce((n,t)=>n+t[k],0):null]));
  totals.k=['c','p','f'].every(k=>known(totals[k]))?4*totals.c+4*totals.p+9*totals.f:null;
  const percentages=Object.fromEntries(['c','p','f'].map(k=>[k,totals.k===null?null:totals.k===0?0:totals[k]*(k==='f'?9:4)/totals.k*100]));
  return {totals,meals,percentages};
 }
 function mainRows(week){return week.days.map(day=>({...Object.fromEntries([...groups,'lunch','dinner'].map(g=>[g,day.entries.filter(r=>r.meal===({breakfast:'Colazione',morning:'Spuntino',afternoon:'Merenda',lunch:'Pranzo',dinner:'Cena'}[g])).map(r=>({key:r.food,g:r.g??null,note:r.note||''}))])),other:day.entries.filter(r=>!['Colazione','Spuntino','Merenda','Pranzo','Cena'].includes(r.meal)).map(r=>({key:r.food,g:r.g??null}))}));}
 return {keys,groups,labels,copy,known,defaults,enabled,validate,migrate,toggle,nutrients,assess,progress,missing,mainRows,average};
})();
