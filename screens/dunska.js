/* Odbiór transportu i QR działają z lokalnym dekoderem/generatorem. */
let DUNSKA_DOC = null;
let DUNSKA_ROWS = [];
let DUNSKA_VERSION = 0;
let DUNSKA_TAB = 'odbior';
let DUNSKA_LOW_VERSION = 0;
function leaveDunska() {
  barcodeScanner.stop();
  DUNSKA_VERSION++;
  DUNSKA_LOW_VERSION++;
  DUNSKA_DOC = null;
  DUNSKA_ROWS = [];
  $('dunskaCamera').hidden = true;
  $('dunskaLowStockItems').replaceChildren();
  $('dunskaLowStockItems').textContent = '';
  $('dunskaLowStockMeta').textContent = '';
  $('dunskaLowStockWarning').textContent = '';
}
async function openDunska() {
  leaveDunska();
  show('scrDunska');
  $('dunskaForm').hidden = true;
  const canReceive = ROLES.includes('RECEIVE_DUNSKA');
  $('dunskaReceiverTab').hidden = !canReceive;
  $('dunskaPending').hidden = !canReceive || DUNSKA_TAB === 'braki';
  $('dunskaLowStock').hidden = canReceive && DUNSKA_TAB !== 'braki';
  if (!canReceive || DUNSKA_TAB === 'braki') {
    DUNSKA_TAB = 'braki';
    await loadDunskaLowStock();
    return;
  }
  const box = $('dunskaList');
  box.replaceChildren();
  box.textContent = 'Wczytuję…';
  const token = PIN, version = DUNSKA_VERSION;
  try {
    const docs = await api('apiListPendingDunska', token);
    if (token !== PIN || version !== DUNSKA_VERSION) return;
    box.textContent = '';
    for (const doc of docs) {
      const button = document.createElement('button');
      button.className = 'btn sec';
      button.textContent = doc.title + (doc.acceptancePending ? ' · Wznów zapis odbioru' : '');
      button.onclick = () => selectDunska(doc.id);
      box.appendChild(button);
    }
    if (!docs.length) box.textContent = 'Brak dostaw w drodze.';
  } catch (error) {
    if (token === PIN && version === DUNSKA_VERSION) box.textContent = error.message;
  }
}
async function selectDunska(rawId) {
  barcodeScanner.stop();
  $('dunskaCamera').hidden = true;
  const token = PIN, version = ++DUNSKA_VERSION;
  DUNSKA_DOC = null;
  DUNSKA_ROWS = [];
  $('dunskaForm').hidden = true;
  try {
    const doc = await api('apiGetDeliveryForAcceptance', token, rawId);
    if (token !== PIN || version !== DUNSKA_VERSION) return;
    if (doc.status && doc.status !== 'W_DRODZE' && !doc.acceptancePending) return toast('Dokument nie oczekuje na odbiór');
    DUNSKA_DOC = doc;
    $('dunskaTitle').textContent = doc.title;
    const box = $('dunskaItems');
    box.replaceChildren();
    for (const item of doc.items) {
      const row = document.createElement('div');
      row.className = 'item';
      const label = document.createElement('label');
      label.textContent = item.sku + ' · ' + item.name + ' · wysłano: ' + item.qty;
      const received = document.createElement('input');
      received.type = 'number';
      received.min = '0';
      received.step = '1';
      received.inputMode = 'numeric';
      received.value = String(item.qty);
      received.setAttribute('aria-label', 'Przyjęto ' + item.sku);
      const comment = document.createElement('input');
      comment.type = 'text';
      comment.value = '';
      comment.maxLength = 200;
      comment.placeholder = 'Komentarz (opcjonalnie)';
      comment.setAttribute('aria-label', 'Komentarz ' + item.sku);
      row.appendChild(label);
      row.appendChild(received);
      row.appendChild(comment);
      box.appendChild(row);
      DUNSKA_ROWS.push({sku: item.sku, received: received, comment: comment});
    }
    $('dunskaAccept').disabled = false;
    $('dunskaForm').hidden = false;
  } catch (error) {
    if (token === PIN && version === DUNSKA_VERSION) toast(error.message);
  }
}
async function acceptDunska() {
  if (!DUNSKA_DOC || $('dunskaAccept').disabled) return;
  const lines = DUNSKA_ROWS.map(row => ({sku: row.sku, received: Number(row.received.value), comment: row.comment.value}));
  if (DUNSKA_ROWS.some((row, i) => !row.received.value.trim() || !Number.isSafeInteger(lines[i].received) || lines[i].received < 0)) {
    return toast('Wpisz liczbę całkowitą ≥0 dla każdej pozycji');
  }
  if (lines.some(line => line.comment.length > 200)) return toast('Komentarz: maksymalnie 200 znaków');
  const token = PIN, version = DUNSKA_VERSION, docId = DUNSKA_DOC.id;
  $('dunskaAccept').disabled = true;
  try {
    const result = await api('apiAcceptDelivery', token, docId, lines);
    if (token !== PIN || version !== DUNSKA_VERSION) return;
    toast(result.status);
    await openDunska();
  } catch (error) {
    if (token === PIN && version === DUNSKA_VERSION) {
      toast(error.message);
      $('dunskaAccept').disabled = false;
    }
  }
}
async function dunskaScanned(codes) {
  const rawId = codes.find(code => /^DOSTAWA-DUNSKA:D[0-9a-f]{7}$/.test(code));
  if (rawId) await selectDunska(rawId);
  else toast('Pokaż kod QR dostawy na Duńską');
}
async function scanDunska() {
  barcodeScanner.stop();
  $('dunskaCamera').hidden = false;
  const token = PIN, version = DUNSKA_VERSION;
  try {
    await barcodeScanner.start($('dunskaVideo'), codes => {
      if (token === PIN && version === DUNSKA_VERSION) dunskaScanned(codes);
    }, error => {
      if (token === PIN && version === DUNSKA_VERSION) toast(error.message);
    });
  } catch (error) {
    if (token === PIN && version === DUNSKA_VERSION) toast(error.message);
  }
}
async function photoDunska(file) {
  if (!file) return;
  barcodeScanner.stop();
  const token = PIN, version = DUNSKA_VERSION;
  try {
    const codes = await barcodeScanner.photo(file, () => {});
    if (token === PIN && version === DUNSKA_VERSION) await dunskaScanned(codes);
  } catch (error) {
    if (token === PIN && version === DUNSKA_VERSION) toast(error.message);
  }
}
function showDunskaQr(result) {
  const payload = 'DOSTAWA-DUNSKA:' + result.docId;
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  $('dunskaQrTitle').textContent = 'Dostawa na Duńską · ' + result.partner;
  $('dunskaQrText').textContent = payload;
  $('dunskaQrImage').innerHTML = qr.createSvgTag(6, 24);
  show('scrDunskaQr');
}
function printDunskaQr() {
  window.print();
}

async function dunskaTab(tab) {
  DUNSKA_TAB = tab === 'odbior' && ROLES.includes('RECEIVE_DUNSKA') ? 'odbior' : 'braki';
  await openDunska();
}
async function loadDunskaLowStock() {
  const token = PIN, version = DUNSKA_VERSION, request = ++DUNSKA_LOW_VERSION;
  const box = $('dunskaLowStockItems');
  box.replaceChildren();
  box.textContent = 'Wczytuję…';
  try {
    const result = await api('apiGetLowStock', token);
    if (token !== PIN || version !== DUNSKA_VERSION || request !== DUNSKA_LOW_VERSION) return;
    const time = new Date(result.dataTime);
    const age = Number.isFinite(time.getTime()) ? Math.max(0, Math.floor((Date.now() - time.getTime()) / 60000)) : null;
    $('dunskaLowStockMeta').textContent = 'Źródło: ' + (result.source || 'brak danych') +
      (age === null ? '' : ' · ' + time.toLocaleString('pl-PL') + ' · wiek: ' + age + ' min');
    $('dunskaLowStockWarning').textContent = result.stale ? 'Dane nieaktualne — sprawdź czytnik lub wczytaj zapasowy CSV.' : '';
    $('dunskaLowStockWarning').hidden = !result.stale;
    box.textContent = '';
    for (const item of result.items) {
      const row = document.createElement('div');
      row.className = 'item';
      row.textContent = item.sku + ' · ' + item.name + ' · brakuje: ' + item.deficit +
        ' · Duńska: ' + item.stanDunska + ' / min. ' + item.stanMin + ' · Brzeźnicka: ' + item.stanBrzeznicka;
      box.appendChild(row);
    }
    if (!result.items.length) box.textContent = result.dataTime ? 'Brak produktów poniżej minimum.' : 'Brak danych z czytnika lub importu.';
  } catch (error) {
    if (token === PIN && version === DUNSKA_VERSION && request === DUNSKA_LOW_VERSION) box.textContent = error.message;
  }
}
