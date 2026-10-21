'use strict';
// Presentation only: retain raw values in state and in every calculation.
globalThis.NutritionDisplay=(()=>{
 const number=(n,d=1)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('it-IT',{useGrouping:'always',minimumFractionDigits:d,maximumFractionDigits:d}):'Sconosciuto';
 const macro=n=>number(n)+' g',kcal=n=>number(n,0)+' kcal',percent=n=>number(n)+'%';
 const grams=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('it-IT',{useGrouping:'always',maximumFractionDigits:2})+' g':'Sconosciuto';
 const compact=t=>'C: '+macro(t.c)+' | P: '+macro(t.p)+' | G: '+macro(t.f);
 return {number,macro,kcal,percent,grams,compact};
})();
