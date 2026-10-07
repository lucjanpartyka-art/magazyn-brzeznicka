let INVENTORY_SCANNING=false;
function renderInventoryCountProducts(doc) {
  const picker = $('inventoryCountPicker'), select = $('inventoryCountSku');
  picker.hidden = doc.type !== 'INWENTARYZACJA';
  select.textContent = '';
  if (picker.hidden) return;
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = 'Wybierz produkt…';
  select.appendChild(empty);
  for (const product of doc.inventoryProducts || []) {
    const option = document.createElement('option');
    option.value = product.sku;
    option.textContent = product.sku + ' · ' + product.name + (product.active === false ? ' (wycofany)' : '');
    select.appendChild(option);
  }
}
function chooseInventoryCountProduct(sku) {
  if (!DOC || DOC.type !== 'INWENTARYZACJA' || !sku) return;
  const product = (DOC.inventoryProducts || []).find(candidate => candidate.sku === sku);
  if (!product) return toast('SKU poza zakresem inwentaryzacji');
  chosen(product.sku, product.ean || '');
}
async function openInventories() {
  INVENTORY_SCANNING=false;
  show('scrInventory');
  $('inventoryStart').hidden=!ROLES.includes('INVENTORY');
  const box=$('inventoryList');
  box.textContent='Wczytuję…';
  try {
    const docs=await api('apiListInventories',PIN);
    box.textContent='';
    for(const d of docs) {
      const card=document.createElement('div');
      card.className='card';
      const p=document.createElement('p');
      p.textContent=d.title+' · '+d.status;
      card.appendChild(p);
      const b=document.createElement('button');
      b.className='btn sec';
      b.textContent=d.status==='OTWARTA'?'Dołącz do liczenia':'Pokaż różnice';
      b.onclick=()=>d.status==='OTWARTA'?joinDoc(d.id):showInventoryComparison(d.id,d);
      b.hidden=d.status!=='OTWARTA' && !ROLES.includes('INVENTORY');
      card.appendChild(b);
      box.appendChild(card);
    }if(!docs.length)box.textContent='Brak inwentaryzacji w toku.';
  }catch(e) {
    box.textContent=e.message;
  }
}
function inventoryScope() {
  const kind=$('inventoryScope').value;
  if(kind==='all')return {
    all:true
  };
  const list=$('inventoryValues').value.split(/[\n,;]/).map(s=>s.trim()).filter(Boolean);
  if(!list.length)throw Error('Wpisz zakres');
  return kind==='locations'? {
    locations:list
  }: {
    skus:list
  };
}
async function startInventory() {
  try {
    const scope=inventoryScope();
    enterDoc(await api('apiStartInventory',PIN,scope));
  }catch(e) {
    toast(e.message);
  }
}
function scanInventoryScope() {
  INVENTORY_SCANNING=true;
  DOC=null;
  MODE='count';
  show('scrCount');
  $('pAdd').hidden=false;
  $('docHead').hidden=true;
  $('tabsBar').hidden=true;
  $('modeBar').hidden=true;
  $('btnBackPrice').hidden=false;
  resetScan();
}
function inventoryScanned(sku) {
  if(!sku) {
    toast('Brak SKU w katalogu — wybierz znany produkt');
    return;
  }const field=$('inventoryValues'),list=field.value.split(/[\n,;]/).map(s=>s.trim()).filter(Boolean);
  if(!list.includes(sku))list.push(sku);
  field.value=list.join('\n');
  $('inventoryScope').value='skus';
  stopScanner();
  openInventories();
  toast('Dodano do zakresu: '+sku);
}
async function closeInventory() {
  try {
    const id=DOC.id,r=await api('apiCloseInventory',PIN,id);
    leaveDoc();
    showInventoryComparison(id,r);
  }catch(e) {
    toast(e.message);
  }
}
function showInventoryComparison(id,r) {
  if(!ROLES.includes('INVENTORY'))return;
  show('scrInventoryCompare');
  $('inventoryDifferences').innerHTML='<table><thead><tr><th>SKU / produkt</th><th>Stan</th><th>Policzono</th><th>Różnica</th></tr></thead><tbody>'+r.rows.map(x=>`<tr><td>${esc(x.sku)} · ${esc(x.name)}</td><td>${esc(x.stock)}</td><td>${x.counted===null?'niepoliczone':esc(x.counted)}</td><td>${esc(x.diff)}</td></tr>`).join('')+'</tbody></table>';
  $('inventoryZeroList').textContent=r.uncountedNonZero.map(x=>x.sku+' · '+x.name+' (stan '+x.stock+')').join('; ');
  $('inventoryZeroLabel').hidden=!r.uncountedNonZero.length;
  $('inventoryZero').checked=false;
  $('inventoryApprove').onclick=async()=> {
    const zero=$('inventoryZero').checked;
    if(r.uncountedNonZero.length && !zero)return toast('Potwierdź zerowanie wymienionych SKU');
    try {
      await api('apiApproveInventory',PIN,id,zero);
      toast('Inwentaryzacja zatwierdzona');
      openInventories();
    }catch(e) {
      toast(e.message);
    }
  };
}
