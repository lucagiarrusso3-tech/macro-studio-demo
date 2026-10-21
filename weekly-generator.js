'use strict';
// Discrete, bounded heuristic. Feasibility is always checked independently of its score.
globalThis.WeeklyGenerator=(()=>{
 const keys=['kcal','p','c','f'],shares=[.25,.10,.35,.30];
 const known=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 function targets(input){
  const weight=Number(input.weight),kcal=Number(input.kcal),rates={};
  if(!Number.isFinite(weight)||weight<1||weight>500||!Number.isFinite(kcal)||kcal<700||kcal>4000)throw Error('Peso 1–500 kg e target energetico 700–4.000 kcal richiesti.');
  for(const key of ['p','c','f']){const raw=input[key];if(raw===null||raw===undefined||String(raw).trim()==='')throw Error('Inserisci tutti i target in g/kg.');const n=Number(raw);if(!known(n)||n>50)throw Error('Target g/kg non valido: '+key);rates[key]=n;}
  const tolerance={kcal:Number(input.energyTolerance??3)/100,macro:Number(input.macroTolerance??5)/100,meal:Number(input.mealTolerance??3)/100};
  if(Object.values(tolerance).some(n=>!Number.isFinite(n)||n<=0||n>.5))throw Error('Tolleranze richieste: maggiori di 0 e non oltre 50%.');
  return {weight,kcal,p:weight*rates.p,c:weight*rates.c,f:weight*rates.f,rates,tolerance,dailyOnly:input.dailyOnly===true};
 }
 function validRange(r){return Array.isArray(r)&&r.length===3&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=r[0]&&r[1]<=10000&&r[2]>0;}
 function validGrams(g,r){return known(g)&&validRange(r)&&g>=r[0]-1e-8&&g<=r[1]+1e-8&&Math.abs((g-r[0])/r[2]-Math.round((g-r[0])/r[2]))<1e-7;}
 function totals(templates,grams,db){
  const meals=templates.map((t,m)=>Object.fromEntries(keys.map(k=>{const values=t?.ingredients.map((name,i)=>known(db[name]?.[k])&&known(grams[m]?.[i])?db[name][k]*grams[m][i]/100:null)||[null];return [k,values.every(known)?values.reduce((a,b)=>a+b,0):null];})));
  return {meals,day:Object.fromEntries(keys.map(k=>[k,meals.every(row=>known(row[k]))?meals.reduce((s,row)=>s+row[k],0):null]))};
 }
 function checkDay(templates,grams,db,range,target){
  const mealShares=target.shares||shares;
  if(!target.dailyOnly&&(mealShares.length!==templates.length||mealShares.some(x=>!known(x))||Math.abs(mealShares.reduce((a,b)=>a+b,0)-1)>1e-7))throw Error("Quote dei pasti non valide.");
  const result=totals(templates,grams,db),issues=[];
  templates.forEach((t,m)=>{if(!t){issues.push('Pasto '+(m+1)+': modello mancante');return;}t.ingredients.forEach((name,i)=>{const r=range(name);if(!validGrams(grams[m]?.[i],r))issues.push('Pasto '+(m+1)+', '+name+': grammatura/intervallo/passo non valido');});});
  for(const key of keys){const actual=result.day[key],goal=target[key],limit=Math.max(goal,1)*(key==='kcal'?target.tolerance.kcal:target.tolerance.macro);if(!known(actual))issues.push(key+': dati sconosciuti o grammature mancanti');else if(Math.abs(actual-goal)>limit+1e-7)issues.push(key+': '+actual.toFixed(1)+' / '+goal.toFixed(1)+' fuori tolleranza');}
  if(!target.dailyOnly)result.meals.forEach((meal,m)=>{const goal=target.kcal*mealShares[m];if(!known(meal.kcal)||Math.abs(meal.kcal-goal)>goal*target.tolerance.meal+1e-7)issues.push('Pasto '+(m+1)+': calorie fuori quota '+mealShares[m]*100+'%');});
  return {...result,issues,ok:issues.length===0};
 }
 function optimizeDay(templates,slots,db,range,target){
  const mealShares=target.shares||shares;
  const variables=[],issues=[];
  if(templates.length!==mealShares.length||templates.some(t=>!t))return {grams:slots.map(x=>x.grams),issues:['Modelli mancanti: servono tutti i pasti configurati.'],ok:false};
  templates.forEach((t,m)=>t.ingredients.forEach((name,i)=>{
   const food=db[name],r=range(name);
   if(!food||keys.some(k=>!known(food[k])))issues.push(name+': calorie o macronutrienti sconosciuti');
   if(!validRange(r))issues.push(name+': intervallo di porzione mancante o non valido');
   if(food&&validRange(r)&&keys.every(k=>known(food[k]))){let min=r[0],max=r[0]+Math.floor((r[1]-r[0])/r[2]+1e-9)*r[2];if(slots[m].locked&&slots[m].grams){const g=slots[m].grams[i];if(!validGrams(g,r))issues.push(name+': porzione bloccata non valida');else min=max=g;}
    variables.push({m,i,name,min,max,step:r[2],vector:[...keys.map(k=>food[k]/100),...(target.dailyOnly?[]:mealShares.map((_,j)=>j===m?food.kcal/100:0))]});}
  }));
  if(issues.length)return {grams:slots.map(x=>x.grams),issues:[...new Set(issues)],ok:false};
  const goals=[...keys.map(k=>target[k]),...(target.dailyOnly?[]:mealShares.map(x=>target.kcal*x))],limits=goals.map((g,i)=>Math.max(g,1)*(i===0?target.tolerance.kcal:i<4?target.tolerance.macro:target.tolerance.meal));
  for(let k=0;k<goals.length;k++){const lo=variables.reduce((s,v)=>s+v.min*v.vector[k],0),hi=variables.reduce((s,v)=>s+v.max*v.vector[k],0);if(goals[k]+limits[k]<lo-1e-8||goals[k]-limits[k]>hi+1e-8)issues.push((k<4?keys[k]:'calorie pasto '+(k-3))+': target incompatibile con intervalli/blocchi (raggiungibile '+lo.toFixed(1)+'–'+hi.toFixed(1)+')');}
  if(issues.length)return {grams:slots.map(x=>x.grams),issues,ok:false};
  const vector=x=>goals.map((_,k)=>variables.reduce((s,v,j)=>s+x[j]*v.vector[k],0));
  const loss=values=>values.reduce((s,n,k)=>{const z=Math.abs(n-goals[k])/limits[k];return s+100*Math.max(0,z-1)**2+.01*z*z;},0);
  let best=null;
  for(const fraction of [0,.5,1,.25,.75]){
   const x=variables.map(v=>v.min+Math.round((v.max-v.min)*fraction/v.step)*v.step);let values=vector(x),score=loss(values);
   for(let iteration=0;iteration<180;iteration++){
    let move=null;
    function consider(changes){const next=values.map((n,k)=>n+changes.reduce((s,[j,delta])=>s+delta*variables[j].vector[k],0)),value=loss(next);if(value<score-1e-10&&(!move||value<move.score))move={changes,values:next,score:value};}
    for(let j=0;j<x.length;j++){const v=variables[j];for(const stride of [1,2,5,10,25])for(const sign of [-1,1]){const delta=sign*stride*v.step;if(x[j]+delta>=v.min-1e-8&&x[j]+delta<=v.max+1e-8)consider([[j,delta]]);}}
    if(!move){for(let j=0;j<x.length;j++)for(let l=j+1;l<x.length;l++)for(const sj of [-1,1])for(const sl of [-1,1]){const dj=sj*variables[j].step,dl=sl*variables[l].step;if(x[j]+dj>=variables[j].min&&x[j]+dj<=variables[j].max&&x[l]+dl>=variables[l].min&&x[l]+dl<=variables[l].max)consider([[j,dj],[l,dl]]);}}
    if(!move)break;for(const [j,delta] of move.changes)x[j]+=delta;values=move.values;score=move.score;
   }
   if(!best||score<best.score)best={x:[...x],score};
  }
  const grams=templates.map(t=>t.ingredients.map(()=>0));variables.forEach((v,j)=>grams[v.m][v.i]=best.x[j]);
  const checked=checkDay(templates,grams,db,range,target);
  return {...checked,grams,issues:checked.ok?[]:['Soluzione entro tolleranze non trovata con modelli, passi e blocchi attuali.',...checked.issues]};
 }
 function varietyScore(template,selected){const ids=selected.filter(Boolean),uses=new Map();for(const t of ids)for(const name of new Set(t.ingredients))uses.set(name,(uses.get(name)||0)+1);return ids.filter(t=>t.id===template.id).length*10+template.ingredients.reduce((s,n)=>s+(uses.get(n)||0),0);}
 return {keys,shares,targets,validRange,validGrams,totals,checkDay,optimizeDay,varietyScore};
})();
