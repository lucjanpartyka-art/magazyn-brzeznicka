let PRODUCT_REQUEST=0;
let PRODUCT_CURRENT=null;
let PRODUCT_ORIGINAL='';
function productsCanEdit() {
  return ROLES.includes('PRODUCTS_EDIT');
}
async function openProducts() {
  const token=PIN,request=++PRODUCT_REQUEST;
  show('scrProducts');
  $('productAdd').hidden=!productsCanEdit();
  const box=$('productList');
  box.textContent='Wczytuję…';
  try {
    const rows=await api('apiListProducts',token,$('productQuery').value,$('productFilter').value || 'all');
    if(token!==PIN || request!==PRODUCT_REQUEST)return;
    box.textContent='';
    for(const p of rows) {
      const button=document.createElement('button');
      button.className='btn sec';
      button.textContent=p.sku+' · '+p.name+' · stan '+(p.qty===null?'—':p.qty)+(p.notes?' · '+p.notes:'')+(p.toCount?' · Do policzenia':'');
      button.onclick=()=>openProduct(p.sku);
      box.appendChild(button);
    }
    if(!rows.length)box.textContent='Brak produktów.';
    if(rows.length===300) {
      const note=document.createElement('p');
      note.textContent='Pokazano 300 produktów. Zawęź wyszukiwanie.';
      box.appendChild(note);
    }
  }catch(e) {if(token===PIN && request===PRODUCT_REQUEST)box.textContent=e.message;}
}
function productTextRow(box,text) {
  const row=document.createElement('p');
  row.textContent=text;
  box.appendChild(row);
}
async function openProduct(sku) {
  const token=PIN,request=++PRODUCT_REQUEST;
  try {
    const data=await api('apiProduct',token,sku);
    if(token!==PIN || request!==PRODUCT_REQUEST)return;
    PRODUCT_CURRENT=data.product;
    show('scrProduct');
    const p=data.product;
    $('productTitle').textContent=p.sku+' · '+p.name;
    $('productSummary').textContent='Stan: '+(p.qty===null?'—':p.qty)+(p.notes?' · '+p.notes:'')+' · EAN: '+[p.ean].concat(p.eans || []).filter(Boolean).join(', ')+' · Lokalizacja: '+(p.location || '—')+' · '+(p.active?'Aktywny':'Wycofany')+(p.toCount?' · Do policzenia':'');
    $('productEdit').hidden=!productsCanEdit();
    $('productReplace').hidden=!productsCanEdit() || !p.active;
    $('productActive').hidden=!productsCanEdit() || !!p.replacedBy;
    $('productActive').textContent=p.active?'Wycofaj produkt':'Przywróć produkt';
    $('productLinks').textContent='';
    for(const [field,label] of [['replacedBy','Zastąpiony przez '],['replaces','Zastępuje ']]) {
      if(!p[field])continue;
      const link=document.createElement('button');
      link.className='link';
      link.textContent=label+p[field];
      link.onclick=()=>openProduct(p[field]);
      $('productLinks').appendChild(link);
    }
    $('productMoves').textContent='';
    data.moves.forEach(m=>productTextRow($('productMoves'),[m.date,m.type,m.qty===null?'—':m.qty,m.docTitle,m.actorId].filter(v=>v!==undefined && v!=='').join(' · ')));
    if(!data.moves.length)$('productMoves').textContent='Brak ruchów.';
    $('productHistory').textContent='';
    data.history.forEach(h=>productTextRow($('productHistory'),[h.date,h.actorId,h.field,JSON.stringify(h.before)+' → '+JSON.stringify(h.after)].filter(Boolean).join(' · ')));
    if(!data.history.length)$('productHistory').textContent='Brak zmian.';
  }catch(e) {if(token===PIN && request===PRODUCT_REQUEST)toast(e.message);}
}
function editProduct(isNew=false) {
  PRODUCT_REQUEST++;
  if(!productsCanEdit())return;
  const p=isNew?{}:PRODUCT_CURRENT;
  PRODUCT_ORIGINAL=p.sku || '';
  $('productSku').value=p.sku || '';
  $('productSku').disabled=!isNew;
  $('productName').value=p.name || '';
  $('productEan').value=p.ean || '';
  $('productEans').value=(p.eans || []).join(',');
  $('productLocation').value=p.location || '';
  show('scrProductEdit');
}
let PRODUCT_MUTATING=false;
function productMutationBusy(busy){
  PRODUCT_MUTATING=busy;
  for(const id of ['productSave','productReplace','productActive']){const b=$(id);if(b)b.disabled=busy;}
}
async function saveProduct() {
  if(!productsCanEdit() || PRODUCT_MUTATING)return;
  const token=PIN;productMutationBusy(true);
  try {
    const p={sku:$('productSku').value.trim(),originalSku:PRODUCT_ORIGINAL,name:$('productName').value.trim(),ean:$('productEan').value.trim(),eans:$('productEans').value.split(/[\n,;]/).map(x=>x.trim()).filter(Boolean),location:$('productLocation').value.trim()};
    await api('apiSaveProduct',token,p,PRODUCT_ORIGINAL?'EDIT':'ADD');
    if(PIN!==token)return;
    await loadCatalog();if(PIN===token)await openProduct(p.sku);
  }catch(e){if(PIN===token)toast(e.message);}finally{productMutationBusy(false);}
}
async function replaceProductSku() {
  if(!productsCanEdit() || !PRODUCT_CURRENT || PRODUCT_MUTATING)return;
  const token=PIN;productMutationBusy(true);
  try {
    const result=await api('apiReplaceSku',token,PRODUCT_CURRENT.sku);
    if(PIN!==token)return;
    await loadCatalog();if(PIN===token)await openProduct(result.newSku);
  }catch(e){if(PIN===token)toast(e.message);}finally{productMutationBusy(false);}
}
async function setProductActive() {
  if(!productsCanEdit() || !PRODUCT_CURRENT || PRODUCT_MUTATING)return;
  const token=PIN;productMutationBusy(true);
  try {
    const sku=PRODUCT_CURRENT.sku;
    await api('apiSetActive',token,sku,!PRODUCT_CURRENT.active);
    if(PIN!==token)return;
    await loadCatalog();if(PIN===token)await openProduct(sku);
  }catch(e){if(PIN===token)toast(e.message);}finally{productMutationBusy(false);}
}
