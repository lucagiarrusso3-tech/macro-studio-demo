'use strict';
const BASE=FoodCatalog.catalog(localStorage);
let storageBlocked=false;
let editingFood=null;
let equivalencesPanel=null;
const MEALS=['Colazione','Spuntino','Pranzo','Merenda','Cena'];
const DAYS=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const KEY='macro-studio-v2';
const blankDay=()=>({target:2000,percent:{c:50,f:30,p:20},entries:[]});
let state={days:DAYS.map(blankDay),activeDay:0,custom:[],client:'',professional:'',notes:'',weight:null,overrides:{}};
try{
 const s=JSON.parse(localStorage.getItem(KEY));
 if(s&&Array.isArray(s.days)&&s.days.length===7&&s.days.every(d=>Number.isFinite(d.target)&&d.target>0&&d.percent&&['c','f','p'].every(k=>Number.isFinite(d.percent[k])&&d.percent[k]>=0)&&Math.abs(d.percent.c+d.percent.f+d.percent.p-100)<.001&&Array.isArray(d.entries))&&Array.isArray(s.custom))state={...state,...s,activeDay:Number.isInteger(s.activeDay)&&s.activeDay>=0&&s.activeDay<7?s.activeDay:0};
 else {if(s!==null)storageBlocked=true;const old=JSON.parse(localStorage.getItem('macro-studio-v1'));if(old&&old.target>0&&old.percent&&Array.isArray(old.entries)&&Array.isArray(old.custom)){state.days[0]={target:old.target,percent:old.percent,entries:old.entries};state.custom=old.custom;}}
}catch{storageBlocked=true;}
if(!state.overrides||typeof state.overrides!=='object'||Array.isArray(state.overrides)){storageBlocked=true;state.overrides={};}
if(!Number.isFinite(state.weight)||state.weight<=0)state.weight=null;
try{state=storageBlocked?FoodCatalog.migrateMain(state):FoodCatalog.migrateStored(localStorage,KEY,state);}catch{storageBlocked=true;state=FoodCatalog.migrateMain(state);}
const FACTORS={c:4,f:9,p:4};
function legacyGrams(d){return Object.fromEntries(['c','f','p'].map(k=>[k,d.target*d.percent[k]/100/FACTORS[k]]));}
for(const d of state.days){if(!d.rates||!['c','f','p'].every(k=>Number.isFinite(d.rates[k])&&d.rates[k]>=0))d.rates=null;}
const day=()=>state.days[state.activeDay];
const $=id=>document.getElementById(id),fmt=NutritionDisplay.number,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=()=>FoodCatalog.planCatalog(state,localStorage);
function nutrients(food,g){return Nutrition.portion(food,g);}
function total(entries){const rows=entries.map(e=>nutrients(catalog().find(f=>f.id===e.food),e.g));return Object.fromEntries(['k','c','f','p'].map(k=>[k,Nutrition.sum(rows.map(n=>n[k]))]));}
function targetGrams(d=day()){return state.weight&&d.rates?Object.fromEntries(['c','f','p'].map(k=>[k,state.weight*d.rates[k]])):legacyGrams(d);}
function macroEnergy(grams){return Nutrition.sum(['c','f','p'].map(k=>Nutrition.known(grams[k])?grams[k]*FACTORS[k]:null));}
function macroBreakdown(grams){const energy=macroEnergy(grams);return {energy,percent:Object.fromEntries(['c','f','p'].map(k=>[k,energy===null?null:energy>0?grams[k]*FACTORS[k]/energy*100:0]))};}
function draftTargets(){const weight=Number($('weight').value),target=Number($('kcal').value),rates=Object.fromEntries(['c','f','p'].map(k=>[k,Number($(k+'kg').value)]));if(!Number.isFinite(weight)||weight<1||weight>500||!Number.isFinite(target)||target<1||target>20000||['c','f','p'].some(k=>!$(k+'kg').value||!Number.isFinite(rates[k])||rates[k]<0||rates[k]>50))return null;const grams=Object.fromEntries(['c','f','p'].map(k=>[k,weight*rates[k]]));return {weight,target,rates,grams,...macroBreakdown(grams)};}
function renderTargetPreview(){const draft=draftTargets();if(!draft){$('macropreview').innerHTML='<p class="small">Inserisci peso e g/kg per visualizzare grammi e percentuali.</p>';return;}
 const labels={c:'Carboidrati',f:'Grassi',p:'Proteine'};$('macropreview').innerHTML=['c','f','p'].map(k=>`<div><span>${labels[k]}</span><strong>${fmt(draft.grams[k])} g <small>· ${draft.energy?fmt(draft.percent[k])+'%':'—'}</small></strong></div>`).join('')+`<p class="small">Ripartizione dell’energia dei macro (4/9/4). Energia dai macro: <b>${fmt(draft.energy,0)} kcal</b> · Scostamento dal target: ${draft.energy>=draft.target?'+':'−'}${fmt(Math.abs(draft.energy-draft.target),0)} kcal (${fmt(Math.abs(draft.energy/draft.target*100-100))}%). Anteprima: premi Applica per salvare.</p>`;
}
function save(next=state){try{if(next.sharedMeals)SharedMeals.validate(next.sharedMeals);if(storageBlocked)throw Error('Dati locali non leggibili: conservarli prima di ripristinare il salvataggio.');Nutrition.write(localStorage,KEY,next);$('saved').textContent='✓ Salvato su questo dispositivo';return true;}catch{$('toast').style.display='none';$('saved').textContent='Salvataggio non riuscito · dati precedenti conservati; modifiche non salvate';return false;}}
function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2500);}
function renderTotals(){if(globalThis.SharedMealsApp)return SharedMealsApp.renderMainTotals();const n=total(day().entries),t=targetGrams(),breakdown=macroBreakdown(t),actual=macroBreakdown(n);$('energy').textContent=fmt(n.k,0);$('goal').textContent='su '+fmt(day().target,0)+' kcal di obiettivo';$('energybar').style.width=(n.k===null?0:Math.min(n.k/day().target*100,100))+'%';const diff=n.k===null?null:day().target-n.k;$('remaining').textContent=diff===null?'Totale energetico incompleto':(diff>=0?'Restano ':'Oltre il target: ')+fmt(Math.abs(diff),0)+' kcal';$('difference').textContent=n.k===null?'Scostamento sconosciuto · dati incompleti':'Scostamento: '+(n.k>=day().target?'+':'−')+fmt(Math.abs(diff/day().target*100))+'% · Stima 4/9/4: '+fmt(macroEnergy(n),0)+' kcal';$('macroenergy').textContent='Energia obiettivi macro: '+fmt(breakdown.energy,0)+' kcal · '+(breakdown.energy>=day().target?'+':'−')+fmt(Math.abs(breakdown.energy-day().target),0)+' kcal rispetto al target';$('tanks').innerHTML=[['c','Carboidrati','#c85d8b','#fff0f6'],['f','Grassi','#db8ead','#fff3f8'],['p','Proteine','#ac6d9b','#f9eff7']].map(([key,name,col,pale])=>{const v=n[key],goal=t[key],pct=v===null?0:goal>0?v/goal*100:0,over=v!==null&&v>goal;return `<div class="tankcard" style="--col:${col};--pale:${pale}"><h3>${name}</h3><div class="vessel"><div class="liquid" style="height:${goal===0&&v>0?100:Math.min(pct,100)}%"></div><span class="pct">${v===null?'Sconosciuto':goal===0?'—':fmt(pct,0)+'%'}</span></div><strong>${fmt(v)} <small>g</small></strong><p>obiettivo ${fmt(goal)} g · ${breakdown.energy?fmt(breakdown.percent[key])+'%':'—'}</p><p class="small">Ripartizione inserita: ${actual.energy?fmt(actual.percent[key])+'%':'—'}</p><p class="gkgdetail">${state.weight?`Inseriti ${fmt(v===null?null:v/state.weight,2)} g/kg · Target ${fmt(goal/state.weight,2)} g/kg`:"Peso da impostare"}</p><p class="${over?'over':''}">${over?'Eccesso':'Residuo'} ${fmt(v===null?null:Math.abs(goal-v))} g</p></div>`;}).join('');}
function normalizeSearch(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function renderFoods(){
 const tokens=normalizeSearch($('search').value).split(/\s+/).filter(Boolean),category=$('category').value,all=catalog();
 const filtered=all.filter(f=>!f.historicalOnly&&(!category||(f.category||'Personalizzati')===category)&&tokens.every(token=>normalizeSearch(f.name+' '+f.id+' '+(f.category||'Personalizzati')).includes(token)));
 $('catalogcount').textContent=`${filtered.length} risultati · ${BASE.length} alimenti Excel · valori per 100 g`;
 $('foods').innerHTML=filtered.map(f=>`<div class="food"><button class="choose" data-food="${esc(f.id)}"><strong>${esc(f.name)}</strong><small>${NutritionDisplay.kcal(f.k)} · ${NutritionDisplay.compact(f)}</small><small>${esc(f.category||'Personalizzati')}${f.sourceWarning?' · '+esc(f.sourceWarning):''}${f.traces?.length?' · Tracce: '+f.traces.map(k=>({c:'carboidrati',f:'grassi',p:'proteine',k:'energia'}[k])).join(', ')+' (quantità sconosciuta)':''}</small></button><button type="button" class="textbtn" data-edit-food="${esc(f.id)}">Modifica valori</button><small>Fonte Excel · energia dai macro</small></div>`).join('')||'<p class="small">Nessun risultato. Modifica i filtri o aggiungi un alimento personalizzato.</p>';
 const selected=$('foodselect').value;$('foodselect').innerHTML=filtered.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
 if(filtered.some(f=>f.id===selected))$('foodselect').value=selected;
 $('addbutton').disabled=!filtered.length;preview();
}
function initCategories(){const selected=$('category').value;const categories=[...new Set([...catalog().filter(f=>!f.historicalOnly).map(f=>f.category||'Excel'),...[]])].sort((a,b)=>a.localeCompare(b,'it'));$('category').innerHTML='<option value="">Tutte le categorie</option>'+categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if(categories.includes(selected))$('category').value=selected;$('creacount').textContent=BASE.length;}
function preview(){const f=catalog().find(f=>f.id===$('foodselect').value),g=Number($('grams').value);if(!f){$('portion').textContent='Seleziona un alimento dal catalogo.';return;}if(!Number.isFinite(g)||g<=0){$('portion').textContent='Inserisci una quantità positiva.';return;}const n=nutrients(f,g);$('portion').textContent=`Porzione: ${NutritionDisplay.kcal(n.k)} · ${NutritionDisplay.compact(n)}`;}
function renderMeals(){const all=catalog();$('meals').innerHTML=MEALS.filter(meal=>!globalThis.SharedMealsApp||['Pranzo','Cena'].includes(meal)).map(meal=>{const entries=day().entries.filter(e=>e.meal===meal);return `<div class="mealblock"><div class="mealhead">${meal}<span>${fmt(total(entries).k,0)} kcal</span></div>${entries.length?entries.map(e=>{const f=all.find(f=>f.id===e.food);if(!f)return '';const n=nutrients(f,e.g);return `<div class="entry"><div><strong>${esc(f.name)}</strong><p>${NutritionDisplay.compact(n)}</p><p>${esc(f.source)}</p></div><label>g edibili<input aria-label="Grammi di ${esc(f.name)}" data-qty="${e.id}" type="number" min="0.1" max="10000" step="any" value="${e.g}"></label><span class="value">${fmt(n.k,0)}<br><small>kcal</small></span><button data-remove="${e.id}" aria-label="Rimuovi ${esc(f.name)}">×</button></div>`;}).join(''):'<p class="empty">Nessun alimento inserito</p>'}</div>`;}).join('');}
function renderDays(){
 $('days').innerHTML=DAYS.map((name,i)=>`<button type="button" role="tab" aria-selected="${i===state.activeDay}" aria-controls="dayworkspace" id="day-${i}" tabindex="${i===state.activeDay?0:-1}" data-day="${i}" class="daytab ${i===state.activeDay?'active':''}"><strong>${name}</strong><small>${state.days[i].entries.length} alimenti</small></button>`).join('');
 $('dayname').textContent=DAYS[state.activeDay];
 $('dayworkspace').setAttribute('aria-labelledby','day-'+state.activeDay);
 const count=state.days.filter(d=>d.entries.length).length;
 $('weekstatus').textContent=`${count} giorni con alimenti su 7. Il PDF include tutti i giorni; quelli vuoti saranno indicati come non compilati.`;
 $('pdfstatus').textContent=count===7?'Tutti i giorni contengono alimenti. Controlla i pasti prima di inviare.':`Settimana parziale: ${7-count} giorni vuoti. Il PDF riporterà “Bozza - settimana incompleta”.`;
}
function syncTargets(){
 $('kcal').value=day().target;$('weight').value=state.weight??'';
 for(const k of ['c','f','p'])$(k+'kg').value=state.weight?(day().rates?.[k]??Number((targetGrams()[k]/state.weight).toFixed(4))):'';
 $('weighthelp').textContent=state.weight?'Peso condiviso dalla settimana: se lo modifichi, i target dei giorni impostati in g/kg vengono ricalcolati.':'Inserisci il peso per convertire gli obiettivi già presenti in g/kg. Finché non premi Applica, i target precedenti restano attivi.';
 $('targeterror').textContent='';renderTargetPreview();
}
function render(persist=true){renderTotals();renderMeals();renderDays();equivalencesPanel?.update();globalThis.SharedMealsApp?.refresh();return persist?save():false;}
syncTargets();
$('targets').onsubmit=e=>{e.preventDefault();const draft=draftTargets();if(!draft){$('targeterror').textContent='Controlla peso, target calorico e g/kg: inserisci valori numerici validi.';return;}
 // Convert untouched legacy days with the first supplied weight, preserving their gram targets.
 if(!state.weight){for(const d of state.days){if(!d.rates){const g=legacyGrams(d);d.rates=Object.fromEntries(['c','f','p'].map(k=>[k,g[k]/draft.weight]));}}}
 state.weight=draft.weight;day().target=draft.target;day().rates=draft.rates;
 syncTargets();if(render())toast('Peso e obiettivi in g/kg salvati');else toast('Obiettivi non salvati');};
$('weight').oninput=()=>{const weight=Number($('weight').value);if(weight>=1&&weight<=500){for(const k of ['c','f','p'])if(!$(k+'kg').value)$(k+'kg').value=Number((targetGrams()[k]/weight).toFixed(4));}renderTargetPreview();};
for(const id of ['kcal','ckg','fkg','pkg'])$(id).oninput=renderTargetPreview;
$('search').oninput=renderFoods;$('category').onchange=renderFoods;$('foodselect').onchange=preview;$('grams').oninput=preview;
$('foods').onclick=e=>{const edit=e.target.closest('[data-edit-food]');if(edit){openFood(edit.dataset.editFood);return;}const b=e.target.closest('[data-food]');if(b){$('foodselect').value=b.dataset.food;preview();$('grams').focus();}};
$('add').onsubmit=e=>{e.preventDefault();if(!catalog().some(f=>f.id===$('foodselect').value)||!$('grams').value||!Number.isFinite(Number($('grams').value))||Number($('grams').value)<=0)return;day().entries.push({id:crypto.randomUUID(),food:$('foodselect').value,g:Number($('grams').value),meal:$('meal').value});if(render())toast('Alimento aggiunto e salvato');else toast('Alimento non salvato');};
$('meals').addEventListener('input',e=>{const el=e.target;if(!el.dataset.qty||!el.value||!el.validity.valid)return;const entry=day().entries.find(x=>x.id===el.dataset.qty);entry.g=Number(el.value);const n=nutrients(catalog().find(f=>f.id===entry.food),entry.g),row=el.closest('.entry');row.querySelector('p').textContent=NutritionDisplay.compact(n);row.querySelector('.value').innerHTML=NutritionDisplay.kcal(n.k);row.closest('.mealblock').querySelector('.mealhead span').textContent=NutritionDisplay.kcal(total(day().entries.filter(x=>x.meal===entry.meal)).k);save();renderTotals();if(globalThis.SharedMealsApp)SharedMealsApp.refresh();});
$('meals').onchange=e=>{if(e.target.dataset.qty){if(!e.target.validity.valid||!e.target.value){e.target.reportValidity();return;}const entry=day().entries.find(x=>x.id===e.target.dataset.qty);if(entry.g===Number(e.target.value))return;entry.g=Number(e.target.value);render();}};
$('meals').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){day().entries=day().entries.filter(x=>x.id!==b.dataset.remove);render();}};
$('clear').onclick=()=>{if(day().entries.length&&confirm('Svuotare gli alimenti della giornata? Il catalogo e gli obiettivi restano disponibili.')){day().entries=[];render();}};
function openFood(id=null){
 editingFood=id;const f=id?catalog().find(x=>x.id===id):null;
 $('customform').reset();$('customerror').textContent='';
 $('custom').querySelector('h2').textContent=f?'Modifica alimento':'Nuovo alimento';
 for(const key of ['name','source','k','c','f','p'])$('customform').elements.namedItem(key).value=f?.[key]??'';
 $('customform').elements.namedItem('k').readOnly=true;$('customform').elements.namedItem('source').required=false;$('custom').showModal();
}
$('newfood').textContent='Modifica alimento selezionato';$('newfood').onclick=()=>openFood($('foodselect').value);$('close').onclick=()=>$('custom').close();
$('customform').onsubmit=e=>{e.preventDefault();
 try{
  const form=new FormData(e.target),item={id:editingFood||crypto.randomUUID(),name:String(form.get('name')||'').trim(),source:String(form.get('source')||'').trim()};
  if(!item.name)throw Error('Inserisci il nome.');if(!editingFood||(!FoodCatalog.source.has(editingFood)&&!state.dietFoods?.[editingFood]))throw Error('Seleziona un alimento del nuovo Excel da modificare.');
  for(const k of ['c','f','p'])item[k]=Nutrition.number(form.get(k));item.k=FoodCatalog.energy(item);
  const valid=Nutrition.validate(item),next={...state,custom:[...state.custom],overrides:{...state.overrides}};
  if(editingFood)next.overrides[editingFood]={...state.overrides[editingFood],...valid,traces:[],sourceWarning:null,rawPer100g:undefined};else next.custom.push(valid);
  if(storageBlocked)throw Error('Dati precedenti non leggibili: salvataggio bloccato.');if(state.dietFoods?.[editingFood]){next.dietFoods={...state.dietFoods,[editingFood]:{...state.dietFoods[editingFood],...valid,k:FoodCatalog.energy(valid)}};Nutrition.write(localStorage,KEY,next);}else FoodCatalog.edit(localStorage,editingFood,valid,[[KEY,next]]);
  state=next;$('search').value='';$('category').value='';initCategories();renderFoods();$('foodselect').value=item.id;preview();render(false);$('custom').close();e.target.reset();toast('Alimento salvato nel catalogo');
 }catch(error){$('customerror').textContent=error.message;}
};
$('export').onclick=()=>{const n=total(day().entries);const rows=[['Macro Studio — riepilogo professionista',DAYS[state.activeDay]],['Peso corporeo kg',state.weight??'Non impostato'],['Target kcal',day().target],['Target C g/kg',state.weight?targetGrams().c/state.weight:'Non impostato'],['Target G g/kg',state.weight?targetGrams().f/state.weight:'Non impostato'],['Target P g/kg',state.weight?targetGrams().p/state.weight:'Non impostato'],['Ripartizione C %',macroBreakdown(targetGrams()).percent.c],['Ripartizione G %',macroBreakdown(targetGrams()).percent.f],['Ripartizione P %',macroBreakdown(targetGrams()).percent.p],['Target C g',targetGrams().c],['Target G g',targetGrams().f],['Target P g',targetGrams().p],[],['Pasto','Alimento','g edibili','kcal fonte','Carboidrati g','Grassi g','Proteine g','Fonte','URL'],...day().entries.map(e=>{const f=catalog().find(f=>f.id===e.food),v=nutrients(f,e.g);return[e.meal,f.name,e.g,v.k,v.c,v.f,v.p,f.source,f.url||''];}),['TOTALE','','',n.k,n.c,n.f,n.p],[],['Calcoli senza arrotondamenti intermedi. Stato crudo/cotto come indicato.']];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v===null?'Sconosciuto':typeof v==='number'?v.toFixed(3).replace('.',','):v).replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Macro_Studio_'+DAYS[state.activeDay]+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('days').onclick=e=>{const b=e.target.closest('[data-day]');if(b){state.activeDay=Number(b.dataset.day);syncTargets();render();$('day-'+state.activeDay).focus();}};
$('days').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();state.activeDay=e.key==='Home'?0:e.key==='End'?6:(state.activeDay+(e.key==='ArrowRight'?1:6))%7;syncTargets();render();$('day-'+state.activeDay).focus();};
for(const field of ['client','professional','notes']){$(field).value=state[field]||'';$(field).oninput=()=>{state[field]=$(field).value;save();};}
$('pdf').onclick=async()=>{
 if(!state.days.some(d=>d.entries.length)){toast('Aggiungi almeno un alimento prima di generare il PDF.');return;}
 const button=$('pdf');button.disabled=true;button.textContent='Generazione PDF…';$('pdferror').textContent='';
 try{const bytes=await buildWeeklyPdf(JSON.parse(JSON.stringify(state)),catalog());const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download='Menu_settimanale'+(state.client?'_'+state.client.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,70):'')+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('PDF settimanale generato');}
 catch(error){$('pdferror').textContent='Impossibile generare il PDF. I dati sono conservati: riprova o ricarica la pagina.';console.error('PDF generation failed',error);}
 finally{button.disabled=false;button.textContent='↓ Genera PDF per il cliente';}
};
initCategories();renderFoods();render(false);
if(FoodCatalog.persistenceError){storageBlocked=true;$('saved').textContent=FoodCatalog.persistenceError;}
if(storageBlocked)$('saved').textContent='Dati locali non leggibili: originali conservati, salvataggio bloccato';

if($('equivalences'))equivalencesPanel=EquivalencesUI.mount($('equivalences'),catalog);

window.addEventListener('storage',e=>{if(e.key===FoodCatalog.key){initCategories();renderFoods();render(false);}});
window.addEventListener('focus',()=>{initCategories();renderFoods();render(false);});
