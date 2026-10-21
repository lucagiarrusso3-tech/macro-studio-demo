'use strict';
let foods=[];
let customFoods=[];
let byId={};
let categories=[];
let lastResult=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validCustomFood(food){
 try{
  if(!food||!String(food.name||'').trim()||!String(food.sourceNote||'').trim()||!food.values)return false;
  Nutrition.validate({k:food.values.kcal,p:food.values.protein,c:food.values.carbs,f:food.values.fat});
  const fiber=Nutrition.number(food.values.fiber);return fiber===null||fiber<=100;
 }catch{return false;}
}
function renderCustom(){
 const query=($('customSearch').value||'').trim().toLocaleLowerCase('it');
 const rows=customFoods.filter(f=>f.name.toLocaleLowerCase('it').includes(query));
 $('dbCount').textContent=rows.length+' alimenti';
 $('dbBody').innerHTML=rows.map(f=>'<tr><td>'+esc(f.name)+'</td><td>Personale</td><td>'+esc(f.sourceNote)+'</td></tr>').join('');
}
function refreshFoods(){
 for(const key of ['fromFood','toFood']){const old=$(key).value;$(key).innerHTML=foods.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name)+'</option>').join('');if(foods.some(f=>f.id===old))$(key).value=old;}
 byId=Object.fromEntries(foods.map(f=>[f.id,f]));renderCustom();calculate();
}
function calculate(){
 const all=[...foods,...customFoods.filter(f=>!foods.some(x=>x.id===f.id))];
 const from=all.find(f=>f.id===$('fromFood').value),to=all.find(f=>f.id===$('toFood').value);
 const result=equivalent(from,to,Number($('grams').value),$('criterion').value);
 lastResult=result.error?null:{from:from.id,to:to.id,inputGrams:Number($('grams').value),...result};
 $('resultContent').innerHTML=EquivalencesUI.resultHtml(result,from,to);
 $('save').disabled=!!result.error;
 for(const [id,food] of [['fromSource',from],['toSource',to]]){$(id).hidden=!food?.url||!!food?.custom;$(id).textContent=food?.url&&!food?.custom?'Fonte: '+food.url:'';}
}
$('customForm').onsubmit=e=>{e.preventDefault();try{
 const id=$('fromFood').value,row={name:$('customName').value.trim(),c:Nutrition.number($('customCarbs').value),p:Nutrition.number($('customProtein').value),f:Nutrition.number($('customFat').value)};
 if(!row.name)throw Error('Inserisci il nome.');FoodCatalog.edit(localStorage,id,row);foods=EquivalenceCatalog.load(localStorage);refreshFoods();$('customMessage').textContent='Modifica salvata nel catalogo condiviso.';
 }catch(error){$('customMessage').dataset.error='true';$('customMessage').textContent='Salvataggio non riuscito: '+error.message;}};

function init(){
 function editSelection(){const food=foods.find(f=>f.id===$('fromFood').value);if(!food)return;for(const [field,key] of Object.entries({customName:'name',customKcal:'k',customCarbs:'c',customProtein:'p',customFat:'f'}))$(field).value=food[key]??'';$('customSource').value=food.source;$('customSource').required=false;}
 $('fromFood').addEventListener('change',editSelection);
 function reload(){foods=EquivalenceCatalog.load(localStorage);customFoods=[];refreshFoods();} $('customKcal').readOnly=true;
 reload();editSelection();
 for(const id of ['fromFood','toFood','grams','criterion']){for(const event of ['input','change'])$(id).addEventListener(event,calculate);}
 $('customSearch').addEventListener('input',renderCustom);
 window.addEventListener('storage',reload);window.addEventListener('focus',reload);
 $('save').onclick=()=>{if(!lastResult)return;const url=URL.createObjectURL(new Blob([JSON.stringify(lastResult,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='equivalenza.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
init();
