/* Biuro: wyłącznie zapisane ceny netto; żadnych operacji magazynowych. */
let OFFICE_REQUEST=0,OFFICE_DETAIL=null,OFFICE_PAGE=0,OFFICE_CURSOR=null,OFFICE_SAVING=false;
function officePriceText(cents){return cents===null||cents===undefined?'—':(cents/100).toFixed(2).replace('.',',');}
function officeText(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function officeAllowed(){if(!ROLES.includes('OFFICE')){toast('Brak uprawnienia do Biura');return false;}return true;}
async function openOffice(){if(!officeAllowed())return;show('scrOffice');await loadOfficeDocs();}
function officeFilterChanged(){OFFICE_CURSOR=null;return loadOfficeDocs();}
async function loadOfficeDocs(){
 if(!officeAllowed())return;const token=PIN,request=++OFFICE_REQUEST;
 $('officeMessage').textContent='Wczytuję dokumenty…';
 const filter={type:$('officeType').value,status:$('officeStatus').value,partner:$('officePartner').value,query:$('officeQuery').value,from:$('officeFrom').value,to:$('officeTo').value,cursor:OFFICE_CURSOR};
 try{const result=await api('apiOfficeList',token,filter);if(PIN!==token||request!==OFFICE_REQUEST)return;
 $('officeList').replaceChildren();for(const d of result.documents){const button=document.createElement('button');button.className='btn sec office-document';button.append(officeText('strong',d.type+' · '+d.partner),officeText('span',d.date+' · '+d.status,'tool-description'));button.addEventListener('click',()=>openOfficeDoc(d.id));$('officeList').appendChild(button);}
 $('officeMessage').textContent=result.documents.length?'Dokumentów w wybranym zakresie: '+result.summary.count:'Brak dokumentów w wybranym zakresie';
 for(const [key,g] of Object.entries(result.summary.groups||{})){$('officeList').append(officeText('p',key+' · '+g.count+' dok. · zakup netto '+officePriceText(g.buyCents)+' zł · sprzedaż netto '+officePriceText(g.sellCents)+' zł · brak cen: '+g.missingPrices+(g.unavailable?' · nieodczytane migawki: '+g.unavailable:'')+' (sumy zapisanych cen)','hint'));}
 $('officeMore').hidden=!result.nextCursor;$('officeMore').onclick=()=>{OFFICE_CURSOR=result.nextCursor;loadOfficeDocs();};
 }catch(e){if(PIN===token&&request===OFFICE_REQUEST)$('officeMessage').textContent=e.message;}
}
async function openOfficeDoc(docId){
 if(!officeAllowed())return;const token=PIN,request=++OFFICE_REQUEST;show('scrOfficeDoc');OFFICE_DETAIL=null;$('officeDocMessage').textContent='Wczytuję dokument…';
 try{const detail=await api('apiOfficeDoc',token,docId);if(PIN!==token||request!==OFFICE_REQUEST)return;OFFICE_DETAIL=detail;OFFICE_PAGE=0;renderOfficeDoc();}catch(e){if(PIN===token&&request===OFFICE_REQUEST)$('officeDocMessage').textContent=e.message;}
}
function renderOfficeDoc(){
 const d=OFFICE_DETAIL;if(!d)return;$('officeDocTitle').textContent=d.document.type+' · '+d.document.partner;
 $('officeDocMeta').textContent=d.document.date+' · '+d.document.status+' · '+d.document.id;
 $('officeDocMessage').textContent=d.totals.incomplete?'Uzupełnij brakujące ceny. Zysk i procenty pojawią się po ich zapisaniu.':'Wszystkie ceny zapisane.';
 const t=d.totals,percent=x=>x===null?'—':x.toFixed(2).replace('.',',')+'%';
 $('officeTotals').textContent=(t.incomplete?'Częściowe sumy — ':'')+'Zakup netto: '+officePriceText(t.buyCents)+' zł · Sprzedaż netto: '+officePriceText(t.sellCents)+' zł · Zysk: '+officePriceText(t.profitCents)+' zł · Marża: '+percent(t.margin)+' · Narzut: '+percent(t.markup);
 $('officeRows').replaceChildren();
 const table=document.createElement('table');table.className='office-table';const head=document.createElement('thead'),hr=document.createElement('tr');
 const labels=['Produkt / SKU / EAN','Ilość','Zakup netto/szt.','Sprzedaż netto/szt.','Zakup razem','Sprzedaż razem','Zysk','Marża','Narzut','Ceny'];for(const label of labels)hr.append(officeText('th',label));head.append(hr);table.append(head);
 const body=document.createElement('tbody');for(const row of d.rows.slice(OFFICE_PAGE*50,(OFFICE_PAGE+1)*50)){
 const line=document.createElement('tr'),complete=row.buyCents!==null&&row.sellCents!==null,profit=complete?(row.sellCents-row.buyCents)*row.qty:null;
 const cells=[row.name+' · SKU '+row.sku+' · EAN '+row.ean,String(row.qty),officePriceText(row.buyCents),officePriceText(row.sellCents),officePriceText(row.buyCents===null?null:row.buyCents*row.qty),officePriceText(row.sellCents===null?null:row.sellCents*row.qty),officePriceText(profit),percent(complete&&row.sellCents?(row.sellCents-row.buyCents)/row.sellCents*100:null),percent(complete&&row.buyCents?(row.sellCents-row.buyCents)/row.buyCents*100:null)];
 for(let i=0;i<cells.length;i++){const cell=officeText('td',cells[i]);cell.setAttribute('data-label',labels[i]);line.append(cell);}
 const actions=document.createElement('td');actions.setAttribute('data-label','Ceny');const button=officeText('button','Uzupełnij ceny','btn sec');button.addEventListener('click',()=>editOfficePrice(row.sku));actions.append(button);
 if(row.proposedBuyCents!==null&&row.proposedBuyCents!==undefined)actions.append(officeText('p','Propozycja zakupu: '+officePriceText(row.proposedBuyCents)+' zł netto · '+row.proposedBuySource.date,'hint'));
 if(row.aiGrossCents!==null&&row.aiGrossCents!==undefined)actions.append(officeText('p','Gemini: '+officePriceText(row.aiGrossCents)+' zł brutto · '+row.aiChecked+' · wymaga sprawdzenia','hint'));
 if(row.updatedAt)actions.append(officeText('p','Zapis: '+row.updatedAt,'hint'));line.append(actions);body.append(line);
 }table.append(body);$('officeRows').append(table);

 $('officePrev').disabled=OFFICE_PAGE===0;$('officeNext').disabled=(OFFICE_PAGE+1)*50>=d.rows.length;
 $('officePage').textContent='Strona '+(OFFICE_PAGE+1)+' z '+Math.max(1,Math.ceil(d.rows.length/50));
}
function editOfficePrice(sku){
 if(!OFFICE_DETAIL||!officeAllowed())return;const row=OFFICE_DETAIL.rows.find(x=>x.sku===sku);if(!row)return;
 const token=PIN,docId=OFFICE_DETAIL.document.id;
 sheet('Ceny netto: '+row.name,'',[{label:'Zapisz ceny',keep:true,fn:()=>saveOfficePrice(sku,token,docId)},{label:'Odśwież dokument',cls:'sec',fn:()=>openOfficeDoc(docId)},{label:'Anuluj',cls:'sec'}],'<div class="field"><label for="officeBuy">Zakup netto za sztukę (zł)</label><input type="text" inputmode="decimal" id="officeBuy"></div><div class="field"><label for="officeSell">Sprzedaż netto za sztukę (zł)</label><input type="text" inputmode="decimal" id="officeSell"></div><p id="officeSaveMessage" role="status"></p>');
 $('officeBuy').value=row.buyCents===null?'':officePriceText(row.buyCents);$('officeSell').value=row.sellCents===null?'':officePriceText(row.sellCents);
}
async function saveOfficePrice(sku,token=PIN,docId=OFFICE_DETAIL&&OFFICE_DETAIL.document.id){
 if(OFFICE_SAVING||!officeAllowed()||PIN!==token||!OFFICE_DETAIL||OFFICE_DETAIL.document.id!==docId)return;
 const row=OFFICE_DETAIL.rows.find(x=>x.sku===sku);if(!row)return;
 const detail=OFFICE_DETAIL,sequence=OFFICE_REQUEST;
 const input={buy:$('officeBuy').value,sell:$('officeSell').value,revision:row.revision,requestId:crypto.randomUUID()};const content=JSON.stringify([input.buy,input.sell]);if(row.pendingRequestId&&row.pendingContent===content)input.requestId=row.pendingRequestId;row.pendingRequestId=input.requestId;row.pendingContent=content;OFFICE_SAVING=true;
 try{const result=await api('apiOfficeSavePrice',token,docId,sku,input);if(PIN!==token||OFFICE_DETAIL!==detail||OFFICE_REQUEST!==sequence)return;Object.assign(row,result.row);delete row.pendingRequestId;delete row.pendingContent;OFFICE_DETAIL.totals=result.totals;hideSheet();renderOfficeDoc();toast('Ceny zapisane');}
 catch(e){if(PIN===token&&OFFICE_DETAIL&&OFFICE_DETAIL.document.id===docId){$('officeSaveMessage').textContent=e.message==='REVISION_CONFLICT'?'Ceny zmieniły się w innej karcie. Odśwież dokument przed ponownym zapisem.':e.message;if(!isNet(e))delete row.pendingRequestId;}}
 finally{OFFICE_SAVING=false;}
}
let OFFICE_EXPORT_REQUEST=0;
async function downloadOfficeDocument(docId,format){
 if(!officeAllowed()||!OFFICE_DETAIL||OFFICE_DETAIL.document.id!==docId)return;
 const token=PIN,request=++OFFICE_EXPORT_REQUEST,detail=OFFICE_DETAIL;
 $('officeDocMessage').textContent='Przygotowuję plik…';
 try{
  const file=await api('apiOfficeExport',token,docId,format);
  if(PIN!==token||request!==OFFICE_EXPORT_REQUEST||OFFICE_DETAIL!==detail)return;
  const expected=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if(file.mime!==expected||typeof file.base64!=='string')throw new Error('Nieprawidłowy format pliku');
  const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:file.mime});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=file.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('officeDocMessage').textContent='Plik gotowy do pobrania.';
 }catch(e){if(PIN===token&&OFFICE_DETAIL===detail&&request===OFFICE_EXPORT_REQUEST)$('officeDocMessage').textContent=e.message;}
}
async function printOfficeDocument(docId){
 if(!officeAllowed()||!OFFICE_DETAIL||OFFICE_DETAIL.document.id!==docId)return;
 const token=PIN,detail=OFFICE_DETAIL,request=++OFFICE_EXPORT_REQUEST;
 try{
  const saved=await api('apiOfficeDoc',token,docId);
  if(PIN!==token||OFFICE_DETAIL!==detail||request!==OFFICE_EXPORT_REQUEST)return;
  const box=$('officePrint');box.replaceChildren();
  box.append(officeText('h1',saved.document.type+' · '+saved.document.partner),officeText('p',saved.document.date+' · '+saved.document.id+' · '+saved.document.status+(saved.document.status==='DO_ZATWIERDZENIA'?' — ROBOCZY':'')));
  const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');
  for(const title of ['SKU / EAN','Produkt','Ilość','Zakup netto / szt.','Sprzedaż netto / szt.','Zysk netto','Marża','Narzut'])tr.append(officeText('th',title));head.append(tr);table.append(head);
  const body=document.createElement('tbody');for(const row of saved.rows){const line=document.createElement('tr'),complete=row.buyCents!==null&&row.sellCents!==null,profit=complete?(row.sellCents-row.buyCents)*row.qty:null,p=x=>x===null?'—':x.toFixed(2).replace('.',',')+'%';
   for(const value of [row.sku+' / '+row.ean,row.name,row.qty,officePriceText(row.buyCents),officePriceText(row.sellCents),officePriceText(profit),p(complete&&row.sellCents?(row.sellCents-row.buyCents)/row.sellCents*100:null),p(complete&&row.buyCents?(row.sellCents-row.buyCents)/row.buyCents*100:null)])line.append(officeText('td',String(value)));body.append(line);
  }table.append(body);box.append(table);const t=saved.totals;box.append(officeText('p',(t.incomplete?'CZĘŚCIOWE CENY · ':'')+'Zakup netto: '+officePriceText(t.buyCents)+' zł · Sprzedaż netto: '+officePriceText(t.sellCents)+' zł · Zysk netto: '+officePriceText(t.profitCents)+' zł'));box.hidden=false;document.body.classList.add('office-print');
  try{window.print();}finally{document.body.classList.remove('office-print');box.hidden=true;box.replaceChildren();}
 }catch(e){if(PIN===token&&OFFICE_DETAIL===detail)$('officeDocMessage').textContent=e.message;}
}
