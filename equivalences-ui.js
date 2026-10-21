'use strict';
globalThis.EquivalencesUI=(()=>{
 const labels={kcal:'Calorie (kcal)',carbs:'Carboidrati (g)',protein:'Proteine (g)',fat:'Grassi (g)'};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=(n,d=1)=>NutritionDisplay.number(n,d);
 function resultHtml(result,from,to){
  if(result.error)return '<p role="alert">'+esc(result.error)+'</p>';
  return '<p><strong>'+NutritionDisplay.grams(result.grams)+' di '+esc(to.name)+'</strong> equivalgono alla porzione di '+esc(from.name)+' per '+labels[result.criterion]+'.</p>'+(result.warning?'<p>'+esc(result.warning)+'</p>':'')+'<table><thead><tr><th>Nutriente</th><th>Originale</th><th>Sostituto</th><th>Differenza (sostituto − originale)</th></tr></thead><tbody>'+Object.keys(labels).map(k=>'<tr><th>'+labels[k]+'</th><td>'+format(result.original[k],k==='kcal'?0:1)+'</td><td>'+format(result.replacement[k],k==='kcal'?0:1)+'</td><td>'+(result.differences[k]!==null&&result.differences[k]>0?'+':'')+format(result.differences[k],k==='kcal'?0:1)+'</td></tr>').join('')+'</tbody></table>';
 }
 function mount(root,getFoods){
  const find=name=>root.querySelector('[data-eq="'+name+'"]');
  let ids='';
  function update(){
   const foods=getFoods();const next=JSON.stringify(foods.map(f=>[f.id,f.name]));
   if(ids!==next){for(const key of ['from','to']){const el=find(key),selected=el.value;el.innerHTML=foods.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name)+'</option>').join('');if(foods.some(f=>f.id===selected))el.value=selected;}ids=next;}
   const from=foods.find(f=>f.id===find('from').value),to=foods.find(f=>f.id===find('to').value);
   find('result').innerHTML=resultHtml(equivalent(from,to,Number(find('grams').value),find('criterion').value),from,to);
  }
  root.addEventListener('input',update);root.addEventListener('change',update);
  window.addEventListener('storage',update);window.addEventListener('focus',update);update();return {update};
 }
 return {resultHtml,mount};
})();
