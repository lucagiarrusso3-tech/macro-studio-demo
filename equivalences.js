'use strict';
// Pure engine: supports the current flat catalog and the historical Equivalenze schema.
function equivalent(from,to,grams,criterion){
 const fields={kcal:'k',carbs:'c',protein:'p',fat:'f'};
 if(!Object.hasOwn(fields,criterion))return {error:'Seleziona calorie, carboidrati, proteine oppure grassi.'};
 if(typeof grams!=='number'||!Number.isFinite(grams)||grams<=0||grams>10000)return {error:'La quantità deve essere maggiore di zero e non superiore a 10.000 g.'};
 if(!from||!to)return {error:'Seleziona entrambi gli alimenti.'};
 const value=(food,key)=>Object.hasOwn(food,fields[key])?food[fields[key]]:food.values?.[key];
 const known=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const a=value(from,criterion),b=value(to,criterion);
 if(!known(a)||!known(b))return {error:'Il nutriente selezionato è sconosciuto o non valido: equivalenza non calcolabile.'};
 if(b===0)return {error:'Il sostituto contiene zero del nutriente selezionato: equivalenza non calcolabile.'};
 const amount=grams*a/b;
 if(a>0&&amount===0)return {error:'La quantità equivalente è troppo piccola per essere rappresentata in modo affidabile.'};
 if(!Number.isFinite(amount))return {error:'La quantità equivalente supera i limiti numerici.'};
 const original={},replacement={},differences={};
 for(const key of Object.keys(fields)){
  const x=value(from,key),y=value(to,key);
  original[key]=known(x)?grams*x/100:null;
  replacement[key]=known(y)?amount*y/100:null;
  differences[key]=original[key]===null||replacement[key]===null?null:replacement[key]-original[key];
 }
 if(Object.values(original).some(n=>n!==null&&!Number.isFinite(n))||Object.values(replacement).some(n=>n!==null&&!Number.isFinite(n)))return {error:'Il risultato supera i limiti numerici.'};
 return {grams:amount,criterion,original,replacement,differences,warning:amount>10000?'Quantità equivalente superiore a 10.000 g: verifica la scelta.':null};
}
globalThis.Equivalences={equivalent};
