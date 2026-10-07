let PRODUCT_CURRENT=null;
let PRODUCT_ORIGINAL='';
function productsCanEdit() {
  return ROLES.includes('PRODUCTS_EDIT');
}
async function openProducts() {
  show('scrProducts');
  $('productAdd').hidden=!productsCanEdit();
  const box=$('productList');
  box.textContent='Wczytuję…';
  try {
    const rows=await api('apiListProducts',PIN,$('productQuery').value,$('productFilter').value || 'all');
    box.textContent='';
    for(const p of rows) {
      const button=document.createElement('button');
      button.className='btn sec';
      button.textContent=p.sku+' · '+p.name+' · stan '+p.qty+(p.toCount?' · Do policzenia':'');
      button.onclick=()=>openProduct(p.sku);
      box.appendChild(button);
    }
    if(!rows.length)box.textContent='Brak produktów.';
    if(rows.length===300) {
      const note=document.createElement('p');
      note.textContent='Pokazano 300 produktów. Zawęź wyszukiwanie.';
      box.appendChild(note);
    }
  }catch(e) {box.textContent=e.message;}
}
function productTextRow(box,text) {
  const row=document.createElement('p');
  row.textContent=text;
  box.appendChild(row);
}
async function openProduct(sku) {
  try {
    const data=await api('apiProduct',PIN,sku);
    PRODUCT_CURRENT=data.product;
    show('scrProduct');
    const p=data.product;
    $('productTitle').textContent=p.sku+' · '+p.name;
    $('productSummary').textContent='Stan: '+p.qty+' · EAN: '+[p.ean].concat(p.eans || []).filter(Boolean).join(', ')+' · Lokalizacja: '+(p.location || '—')+' · '+(p.active?'Aktywny':'Wycofany')+(p.toCount?' · Do policzenia':'');
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
    data.moves.forEach(m=>productTextRow($('productMoves'),[m.date,m.type,m.qty,m.docTitle,m.actorId].filter(v=>v!==undefined && v!=='').join(' · ')));
    if(!data.moves.length)$('productMoves').textContent='Brak ruchów.';
    $('productHistory').textContent='';
    data.history.forEach(h=>productTextRow($('productHistory'),[h.date,h.actorId,h.field,JSON.stringify(h.before)+' → '+JSON.stringify(h.after)].filter(Boolean).join(' · ')));
    if(!data.history.length)$('productHistory').textContent='Brak zmian.';
  }catch(e) {toast(e.message);}
}
function editProduct(isNew=false) {
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
async function saveProduct() {
  if(!productsCanEdit())return;
  try {
    const p={sku:$('productSku').value.trim(),originalSku:PRODUCT_ORIGINAL,name:$('productName').value.trim(),ean:$('productEan').value.trim(),eans:$('productEans').value.split(/[\n,;]/).map(x=>x.trim()).filter(Boolean),location:$('productLocation').value.trim()};
    await api('apiSaveProduct',PIN,p);
    await openProduct(p.sku);
  }catch(e) {toast(e.message);}
}
async function replaceProductSku() {
  if(!productsCanEdit() || !PRODUCT_CURRENT)return;
  try {
    const result=await api('apiReplaceSku',PIN,PRODUCT_CURRENT.sku);
    await openProduct(result.newSku);
  }catch(e) {toast(e.message);}
}
async function setProductActive() {
  if(!productsCanEdit() || !PRODUCT_CURRENT)return;
  try {
    const sku=PRODUCT_CURRENT.sku;
    await api('apiSetActive',PIN,sku,!PRODUCT_CURRENT.active);
    await openProduct(sku);
  }catch(e) {toast(e.message);}
}
