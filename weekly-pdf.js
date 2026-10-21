'use strict';
// Entirely local PDF composition. A normalized presentation model contains no targets or solver logic.
async function buildWeeklyPdf(week,foods,options={}){
 const model=ProfessionalPdfModel.normalizeIndications(week.pdfModel===true?week:ProfessionalPdfModel.fromMain(week,foods,options));
 const {PDFDocument,rgb}=PDFLib,doc=await PDFDocument.create();
 doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(PdfEmbeddedFonts.bytes('regular'),{subset:true}),bold=await doc.embedFont(PdfEmbeddedFonts.bytes('bold'),{subset:true}),serif=await doc.embedFont(PdfEmbeddedFonts.bytes('serif'),{subset:true}),serifBold=await doc.embedFont(PdfEmbeddedFonts.bytes('serifBold'),{subset:true});
 const supported=new Set(regular.getCharacterSet());
 const ink=rgb(.17,.18,.18),muted=rgb(.42,.41,.39),ruleColor=rgb(.82,.80,.76),beige=rgb(.96,.95,.93),white=rgb(1,1,1);
 const width=595.28,height=841.89,margin=46,right=width-margin,usable=right-margin,bottom=79;
 const formattedDate=new Date(model.date+'T12:00:00Z').toLocaleDateString('it-IT',{timeZone:'Europe/Rome'});
 let page,y,context,capacity;
 function clean(value){return Array.from(String(value??'').replace(/[\r\n\t]+/g,' ').normalize('NFC')).map(ch=>{return supported.has(ch.codePointAt(0))?ch:'?';}).join('');}
 function draw(text,x,baseline,size=10,font=regular,color=ink){page.drawText(clean(text),{x,y:baseline,size,font,color});}
 function rightText(text,baseline,size=10,font=regular,color=ink){const value=clean(text);draw(value,right-font.widthOfTextAtSize(value,size),baseline,size,font,color);}
 function line(baseline){page.drawLine({start:{x:margin,y:baseline},end:{x:right,y:baseline},color:ruleColor,thickness:.6});}
 function wrap(text,font=regular,size=10,maxWidth=usable){
  const rows=[];let row='';
  for(const word of clean(text).split(/\s+/).filter(Boolean)){
   if(font.widthOfTextAtSize(row?row+' '+word:word,size)<=maxWidth){row=row?row+' '+word:word;continue;}
   if(row){rows.push(row);row='';}
   let part='';for(const ch of word){if(font.widthOfTextAtSize(part+ch,size)>maxWidth&&part){rows.push(part);part='';}part+=ch;}row=part;
  }
  if(row)rows.push(row);return rows.length?rows:[''];
 }
 function newPage(next,continued=false){
  context=next;page=doc.addPage([width,height]);page.drawRectangle({x:0,y:height-7,width,height:7,color:beige});y=height-43;
  const studio=wrap(model.studio,serifBold,18,usable-178);studio.forEach((row,i)=>draw(row,margin,y-i*22,18,serifBold));
  const identity=wrap('PIANO '+model.planId,bold,7.5,160);identity.forEach((row,i)=>rightText(row,y-i*10,7.5,bold,muted));rightText('Elaborato il '+formattedDate,y-identity.length*10-5,8,regular,muted);
  y-=Math.max(studio.length*22,identity.length*10+23);
  const references=[model.professional,model.contacts].filter(Boolean).join(' · ');
  if(references){for(const row of wrap(references,regular,9)){draw(row,margin,y,9,regular,muted);y-=12;}}
  y-=4;line(y);y-=30;
  const heading=next.day===undefined?next.title:model.days[next.day].name;
  draw(continued&&next.indications?'Continua':heading+(continued?' · continua':''),margin,y,25,serif);y-=20;
  if(next.day!==undefined){draw('GIORNATA '+String(next.day+1).padStart(2,'0')+' / 07',margin,y,7.5,bold,muted);y-=20;}
  if(model.client){for(const row of wrap('Preparato per: '+model.client,regular,9.5)){draw(row,margin,y,9.5);y-=13;}y-=5;}
  if(model.incomplete){draw('BOZZA · Pasti o dati nutrizionali incompleti',margin,y,8,bold,muted);y-=18;}
  y-=5;capacity=y-bottom;
 }
 function mealHeading(name,continued=false){draw(name+(continued?' · continua':''),margin,y,13,serifBold);y-=22;}
 function ensure(space,meal){if(y-space>=bottom)return false;newPage(context,true);if(meal)mealHeading(meal,true);return true;}
 function paragraph(text,meal,size=9.5,color=muted){
  for(const p of String(text||'').split(/\r?\n/)){
   for(const row of wrap(p,regular,size)){ensure(size+5,meal);draw(row,margin,y,size,regular,color);y-=size+5;}y-=3;
  }
 }
 function foodHeight(food){return wrap(food.name,regular,10.5,usable-111).length*14+6+(food.note?wrap(food.note,regular,9,usable-20).length*13+3:0);}
 function foodRow(food,meal){
  const rows=wrap(food.name,regular,10.5,usable-111),need=foodHeight(food),quantity=Nutrition.known(food.grams)?NutritionDisplay.grams(food.grams):'Da definire';
  if(need<=capacity-24)ensure(need,meal);
  rows.forEach((row,i)=>{const moved=ensure(16,meal);if(i===0||moved)rightText(quantity,y,10,bold);draw(row,margin,y,10.5);y-=14;});y-=6;
  if(food.note)paragraph(food.note,meal,9);
 }
 function dailySummary(day){
  if(day.ranges){
   const boxHeight=122;ensure(boxHeight+10);page.drawRectangle({x:margin,y:y-boxHeight+12,width:usable,height:boxHeight,color:beige});
   draw('INTERVALLI GIORNALIERI · UNA SCELTA PER SEZIONE',margin+12,y-3,8,bold);
   const columns=[['k','ENERGIA','kcal'],['p','PROTEINE','g'],['c','CARBOIDRATI','g'],['f','GRASSI','g']];
   columns.forEach(([key,label,unit],i)=>{const x=margin+12+i*(usable-24)/4,r=day.ranges[key];draw(label,x,y-25,7,regular,muted);const text=r?NutritionDisplay.number(r.min,key==='k'?0:1)+(Math.abs(r.max-r.min)>1e-8?'–'+NutritionDisplay.number(r.max,key==='k'?0:1):'')+' '+unit:'Non quantificato';for(const [j,row] of wrap(text,bold,8.5,(usable-30)/4).entries())draw(row,x,y-44-j*11,8.5,bold);});
   draw(day.quantified?'Estremi per nutriente: possono derivare da scelte diverse.':'TOTALI NON COMPLETAMENTE QUANTIFICABILI · dati mancanti.',margin+12,y-76,8,regular,muted);
   draw(day.conform?'Tutte le combinazioni entro le tolleranze configurate.':'NON conforme: raggiungimento dei target non dichiarabile per tutte le scelte.',margin+12,y-94,7.5,bold,muted);
   y-=boxHeight+14;return;
  }
  const boxHeight=day.quantified?68:98;ensure(boxHeight+10);
  page.drawRectangle({x:margin,y:y-boxHeight+12,width:usable,height:boxHeight,color:beige});
  draw(day.quantified?'RIEPILOGO GIORNALIERO':'TOTALI NON COMPLETAMENTE QUANTIFICABILI',margin+12,y-3,8,bold);
  let baseline=y-24;
  if(!day.quantified){draw('Nutrienti o grammature sconosciuti: raggiungimento dei target non dichiarabile.',margin+12,baseline,8,regular,muted);baseline-=27;}
  const columns=[['k','ENERGIA','kcal'],['p','PROTEINE','g'],['c','CARBOIDRATI','g'],['f','GRASSI','g']];
  columns.forEach(([key,label,unit],i)=>{const x=margin+12+i*(usable-24)/4;draw(label,x,baseline,7,regular,muted);draw(Nutrition.known(day.totals[key])?NutritionDisplay.number(day.totals[key],key==='k'?0:1)+' '+unit:'Non quantificato',x,baseline-19,day.totals[key]===null?9:13,bold);});
  y-=boxHeight+14;
 }
 for(const group of model.sharedGroups||[]){
  newPage({title:group.name});paragraph('Alternative valide tutti i giorni. Scegliere una sola alternativa al giorno per questa sezione.',undefined,10,ink);y-=10;
  if(!group.alternatives.length)paragraph('Nessuna alternativa definita: documento incompleto.',undefined,10,ink);
  for(const alternative of group.alternatives){
   ensure(70);for(const title of wrap(alternative.title,serifBold,13)){ensure(20);draw(title,margin,y,13,serifBold);y-=19;}
   for(const food of alternative.foods)foodRow(food,alternative.title.slice(0,50));
   if(alternative.note)paragraph(alternative.note,undefined,9.5,ink);
   ensure(40);paragraph('Valori dell’alternativa: '+NutritionDisplay.kcal(alternative.totals.k)+' · '+NutritionDisplay.compact(alternative.totals),undefined,9,ink);y-=15;
  }
 }
 for(let d=0;d<7;d++){
  const day=model.days[d];newPage({day:d});
  for(const meal of day.meals){
   const block=22+(meal.foods.length?meal.foods.reduce((n,f)=>n+foodHeight(f),0):25)+(meal.notes?wrap(meal.notes,regular,9.5).length*15+5:0)+13;
   if(block<=capacity)ensure(block);else ensure(64);
   mealHeading(meal.name);
   if(!meal.foods.length){draw('Pasto non compilato.',margin,y,10,regular,muted);y-=24;}
   for(const food of meal.foods)foodRow(food,meal.name);
   if(meal.notes)paragraph(meal.notes,meal.name);y-=12;
  }
  dailySummary(day);
 }
 if(model.substitutions?.length){newPage({title:'Sostituzioni autorizzate'});paragraph('Alternative indicate e autorizzate dal professionista. Rispettare alimenti, quantità e condizioni riportate.',undefined,10,muted);y-=12;model.substitutions.forEach((text,i)=>{ensure(40);draw(String(i+1).padStart(2,'0'),margin,y,8,bold);y-=17;paragraph(text,undefined,10.5,ink);y-=12;});}
 if(model.notes?.trim()){newPage({title:'Indicazioni generali',indications:true});paragraph(model.notes,undefined,10.5,ink);}
 const pages=doc.getPages();pages.forEach((p,i)=>{page=p;line(61);draw('Quantità edibili · crudo/cotto come indicato · '+formattedDate,margin,44,7.2,regular,muted);rightText(String(i+1).padStart(2,'0')+' / '+String(pages.length).padStart(2,'0'),44,8,bold);draw(clean(model.studio).slice(0,65),margin,30,7,regular,muted);});
 doc.setTitle('Menu settimanale'+(model.client?' - '+clean(model.client):''));doc.setAuthor(clean(model.professional||model.studio));doc.setSubject('Piano '+clean(model.planId)+' · pasti, quantità e riepiloghi nutrizionali');doc.setCreator('Macro Studio · PDF locale');doc.setCreationDate(new Date(model.date+'T12:00:00Z'));
 return doc.save();
}
