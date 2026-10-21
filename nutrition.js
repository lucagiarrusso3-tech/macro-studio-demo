'use strict';
// Nutrition policy shared by the current catalog and the editable standalone app.
// Source catalogs remain untouched. Empty means unknown; zero must be explicit.
globalThis.Nutrition = (() => {
 const keys = ['k','p','c','f'];
 const unknowns = globalThis.NUTRITION_UNKNOWN_FIELDS || {};
 const byName = new Map(Object.values(unknowns).map(row => [row.name,row.keys]));
 function number(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw Error('Valore nutrizionale non numerico.');
  const text = String(value).trim().replace(',','.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw Error('Valore nutrizionale non numerico.');
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) throw Error('I valori devono essere numeri finiti non negativi.');
  return n;
 }
 function validate(food, energyKey='k') {
  const result={...food};
  for(const key of [energyKey,'p','c','f'])result[key]=number(food[key]);
  if(result[energyKey]!==null && result[energyKey]>900)throw Error('Energia superiore a 900 kcal per 100 g.');
  if(['p','c','f'].some(k=>result[k]!==null&&result[k]>100) || ['p','c','f'].reduce((s,k)=>s+(result[k]??0),0)>100.1)throw Error('I macronutrienti non possono superare 100 g per 100 g (tolleranza 0,1 g).');
  return result;
 }
 function safe(food,energyKey='k') {
  // Preserve stored input elsewhere; invalid legacy fields cannot enter calculations.
  const result={...food};
  for(const k of [energyKey,'p','c','f']){try{result[k]=number(food?.[k]);}catch{result[k]=null;}}
  try{return validate(result,energyKey);}catch{return {...result,[energyKey]:null,p:null,c:null,f:null};}
 }
 function original(food,energyKey='k') {
  const result={...food};
  for(const k of [energyKey,'p','c','f']){try{result[k]=number(food[k]);}catch{result[k]=null;}}
  const missing=unknowns[food.id]?.keys || byName.get(food.originalName||food.sourceName||food.name)||[];
  for(const k of missing)result[k==='k'?energyKey:k]=null;
  try{validate(result,energyKey);}catch{result.sourceWarning='Valori originali della fonte da verificare: non modificati.';}
  return result;
 }
 const known=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const format=(n,d=1)=>known(n)?n.toLocaleString('it-IT',{maximumFractionDigits:d,minimumFractionDigits:d}):'Sconosciuto';
 const sum=values=>values.every(known)?values.reduce((a,b)=>a+b,0):null;
 function portion(food,grams,energyKey='k') {
  return Object.fromEntries([energyKey,'c','f','p'].map(k=>[k,known(food?.[k])&&known(grams)?food[k]*grams/100:null]));
 }
 function write(storage,key,value) {
  const serialized=JSON.stringify(value);
  storage.setItem(key,serialized);
  if(storage.getItem(key)!==serialized)throw Error('Salvataggio non confermato.');
 }
 return {keys,number,validate,safe,original,known,format,sum,portion,write};
})();
