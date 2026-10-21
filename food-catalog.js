'use strict';
// Sole runtime catalog. Historical identities contain no nutritional numbers.
globalThis.FoodCatalog=(()=>{
 const data=FOOD_CATALOG_DATA,version=data.meta.sourceSHA256,key='macro-studio-excel-overrides-v1';
 const normalize=s=>String(s??'').normalize('NFC').trim().toLocaleLowerCase('it').replace(/’/g,"'");
 const source=new Map(data.foods.map(f=>[f.id,Object.freeze({...f})]));
 const names=new Map();for(const f of source.values()){const n=normalize(f.name);if(!names.has(n))names.set(n,[]);names.get(n).push(f.id);}
 const energy=f=>['p','c','f'].every(k=>Nutrition.known(f[k]))?4*f.c+4*f.p+9*f.f:null;
 function validated(row){const food={...row,k:energy(row)};return Nutrition.validate(food);}
 function read(storage){const raw=storage.getItem(key);if(raw===null)return {};const saved=JSON.parse(raw);if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('Personalizzazioni Excel non leggibili: conservate.');const result={};for(const [id,row] of Object.entries(saved)){if(!source.has(id))continue;result[id]=validated({...source.get(id),...row,id});}return result;}
 let persistenceError='';const catalogCache=new WeakMap();
 function catalog(storage=localStorage,changes={}){
  const signature=storage.getItem(key)+'\n'+JSON.stringify(changes),cached=catalogCache.get(storage);if(cached?.signature===signature)return cached.rows;
  let saved={};try{saved=read(storage);persistenceError='';}catch(error){persistenceError=error.message;}
  const rows=[...source.values()].map(original=>{const candidate={...original,...saved[original.id],...changes[original.id],id:original.id};const food=validated(candidate);return Object.freeze({...food,source:'Excel · '+data.meta.source+' · energia dai macro 4/4/9',category:'Excel',basis:'100g',catalogVersion:version,excelOriginal:original,energyDerived:true,traces:[],k:energy(food)});});catalogCache.set(storage,{signature,rows});return rows;
 }
 function writeMany(storage,entries){
  const before=entries.map(([k])=>[k,storage.getItem(k)]);try{for(const [k,v] of entries)Nutrition.write(storage,k,v);}catch(error){for(const [k,v] of before)try{if(v===null)storage.removeItem(k);else storage.setItem(k,v);}catch{}throw error;}
 }
 function changes(storage,rows){const next={...read(storage)};for(const [id,row] of Object.entries(rows)){if(!source.has(id))throw Error('Modifica consentita solo a un alimento dell’Excel.');next[id]=validated({...source.get(id),...next[id],...row,id});}return next;}
 function edit(storage,id,row,entries=[]){writeMany(storage,[[key,changes(storage,{[id]:row})],...entries]);}
 function match(name){const found=names.get(normalize(name));return found?.length===1?found[0]:null;}
 function identify(id,custom=[]){if(source.has(id))return id;const customFood=custom.find(f=>f.id===id);return match(data.legacy.identities[id]||customFood?.originalName||customFood?.offOriginal?.nome||customFood?.name||id);}
 function historical(id,name){return {id,name:name||data.legacy.identities[id]||id,k:null,p:null,c:null,f:null,source:'Piano storico: associazione al nuovo Excel da verificare',category:'Storico del piano',historicalOnly:true,sourceWarning:'Alimento storico non associato: valori esclusi dai calcoli.'};}
 function migrateMain(input){
  const next=JSON.parse(JSON.stringify(input));if(next.catalogVersion===version)return next;
  next.legacyFoodData=next.legacyFoodData||{catalogVersion:next.catalogVersion||'pre-excel',custom:next.custom||[],overrides:next.overrides||{}};
  const custom=next.custom||[],unresolved={};
  const resolve=id=>{const found=identify(id,custom);if(found)return found;unresolved[id]=historical(id,custom.find(f=>f.id===id)?.name);return id;};
  for(const d of next.days||[])for(const row of d.entries||[])row.food=resolve(row.food);
  for(const pool of Object.values(next.sharedMeals?.pools||{}))for(const alt of pool)for(const row of alt.foods)row.key=resolve(row.key);
  next.historicalFoods={...(next.historicalFoods||{}),...unresolved};next.custom=[];next.overrides={};next.catalogVersion=version;return next;
 }
 function planCatalog(state,storage=localStorage){return [...catalog(storage),...Object.values(state.historicalFoods||{}).filter(f=>!source.has(f.id)).map(f=>historical(f.id,f.name))];}
 function migrateStored(storage,stateKey,input){const next=migrateMain(input);if(input.catalogVersion!==version){const raw=storage.getItem(stateKey),backup='macro-studio-before-excel:'+stateKey;if(raw!==null&&storage.getItem(backup)===null)Nutrition.write(storage,backup,JSON.parse(raw));Nutrition.write(storage,stateKey,next);}return next;}
 const bindingKey='macro-studio-excel-bindings-v1';
 function validBindings(saved){if(!saved||typeof saved!=='object'||Array.isArray(saved)||Object.entries(saved).some(([name,id])=>!name||!source.has(id)))throw Error('Associazioni ingredienti non valide: servono identità dell’Excel.');return {...saved};}
 function bindings(storage=localStorage){return validBindings(JSON.parse(storage.getItem(bindingKey)||'{}'));}
 function bind(storage,name,id){if(!source.has(id))throw Error('Alimento Excel non disponibile.');Nutrition.write(storage,bindingKey,{...bindings(storage),[name]:id});}
 function generator(aliases={}){
  const byKey=new Map(),history=new Map(),entries=data.foods.map(f=>({id:f.id,key:f.id,name:f.name,historicalName:null}));
  for(const f of data.foods)byKey.set(f.name,f.id);
  for(const [alias,official] of Object.entries(aliases)){const id=match(official)||match(alias);if(id)byKey.set(alias,id);}
  function resolveKey(name){return source.has(name)?name:bindings()[name]||byKey.get(name)||identify(name)||null;}
  function effective(rows={}){
   const applicable=Object.fromEntries(Object.entries(rows).filter(([id])=>source.has(id))),flat=catalog(localStorage,applicable),db={};
   for(const f of flat)db[f.id]={...f,kcal:f.k,officialName:f.name,creaId:null};
   for(const [name,id] of byKey)db[name]={...db[bindings()[name]||id],recipeAlias:true};
   for(const [name,id] of Object.entries(bindings()))db[name]={...db[id],recipeAlias:true};
   for(const name of Object.keys(aliases))if(!db[name])db[name]={...historical(name),kcal:null,creaId:null};
   for(const [name,food] of history)if(!resolveKey(name))db[name]=food;
   return db;
  }
  function update(rows,key,row){const id=resolveKey(key);if(!id)throw Error('Ingrediente non associato all’Excel: scegli prima un alimento esatto.');rows[id]=validated({...source.get(id),...read(localStorage)[id],...row,id});}
  return {entries,history,resolveKey,effective,rows:db=>entries.map(e=>({...e,name:db[e.key].name,food:db[e.key]})),update,manualConflicts:()=>[],base:effective(),imported:data.foods.length,retained:0,added:data.foods.length,conflicts:[]};
 }
 function migrateGeneratorDraft(draft,db,adapter){
  const resolve=(name,id)=>{const found=adapter.resolveKey(name)||identify(id||name);if(found)return found;const food={...historical(name),kcal:null,creaId:null};adapter.history.set(name,food);db[name]=food;return name;};
  for(const row of draft.plan||[])for(const slot of row)for(const entry of slot.manualFoods||[]){entry.key=resolve(entry.key,entry.creaId);entry.creaId=null;}
  for(const pool of Object.values(draft.sharedMeals?.pools||{}))for(const alt of pool)for(const row of alt.foods)row.key=resolve(row.key);
  return draft;
 }
 return {version,key,bindingKey,bindings,validBindings,bind,source,meta:data.meta,get persistenceError(){return persistenceError;},energy,read,catalog,edit,changes,writeMany,match,identify,historical,migrateMain,migrateStored,planCatalog,generator,migrateGeneratorDraft};
})();
