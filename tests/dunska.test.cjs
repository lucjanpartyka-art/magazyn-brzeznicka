'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function page() {
  const elements = new Map(), calls = [], messages = [];
  function element() {
    return {
      value: '', hidden: false, children: [], textContent: '', dataset: {},
      appendChild(child) { this.children.push(child); },
      setAttribute(key, value) { this[key] = value; },
      replaceChildren(...children) { this.children = children; }
    };
  }
  const doc = {id: 'D123abcd', title: 'Wydanie', items: [{sku: 'S1', name: 'Towar', qty: 3}, {sku: 'S2', name: 'Drugi', qty: 2}]};
  const ctx = vm.createContext({
    PIN: 'token', ROLES: ['RECEIVE_DUNSKA'], USER_ID: 'EMP-EWAA-0005', document: {createElement: element},
    $: id => {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    show() {}, toast: message => messages.push(message),
    barcodeScanner: {stop() {}, start: async () => {}},
    qrcode: () => ({
      addData(payload) { calls.push(['qr', payload]); },
      make() {}, createSvgTag() { return '<svg></svg>'; }
    }),
    window: {print() { calls.push(['print']); }},
    api: async (...args) => {
      calls.push(args);
      if (args[0] === 'apiListPendingDunska') return [doc];
      if (args[0] === 'apiGetDeliveryForAcceptance') return doc;
      return {status: 'PRZYJĘTO_Z_RÓŻNICAMI', diffs: [{sku: 'S1', diff: -1}]};
    }
  });
  vm.runInContext(fs.readFileSync('screens/dunska.js', 'utf8'), ctx);
  return {run: script => vm.runInContext(script, ctx), elements, calls, messages, ctx};
}
test('Ewa wybiera dostawę, przyjęto domyślnie wysłano, odbiera z różnicą', async () => {
  const p = page();
  await p.run('openDunska()');
  assert.equal(p.elements.get('dunskaList').children[0].textContent, 'Wydanie');
  await p.run("selectDunska('D123abcd')");
  const rows = p.elements.get('dunskaItems').children;
  assert.equal(rows[0].children[1].value, '3');
  rows[0].children[1].value = '2';
  rows[0].children[2].value = 'Jednej brak';
  await p.run('acceptDunska()');
  const call = p.calls.find(call => call[0] === 'apiAcceptDelivery');
  assert.deepEqual(JSON.parse(JSON.stringify(call[3])), [
    {sku: 'S1', received: 2, comment: 'Jednej brak'}, {sku: 'S2', received: 2, comment: ''}
  ]);
  assert.ok(p.messages.includes('PRZYJĘTO_Z_RÓŻNICAMI'));
});
test('QR lokalnie i wydruk', () => {
  const p = page();
  p.run("showDunskaQr({docId:'D123abcd',qrPayload:'DOSTAWA-DUNSKA:D123abcd',partner:'Duńska'})");
  assert.deepEqual(p.calls[0], ['qr', 'DOSTAWA-DUNSKA:D123abcd']);
  assert.equal(p.elements.get('dunskaQrImage').innerHTML, '<svg></svg>');
  p.run('printDunskaQr()');
  assert.deepEqual(p.calls[1], ['print']);
});
test('puste i niecałkowite ilości nie wywołują odbioru', async () => {
  const p = page();
  await p.run("selectDunska('D123abcd')");
  for (const value of ['', '1.5', '-1']) {
    p.elements.get('dunskaItems').children[0].children[1].value = value;
    await p.run('acceptDunska()');
  }
  assert.equal(p.calls.filter(call => call[0] === 'apiAcceptDelivery').length, 0);
});
test('skan QR wybiera dostawę', async () => {
  const p = page();
  await p.run("dunskaScanned(['DOSTAWA-DUNSKA:D123abcd'])");
  assert.ok(p.calls.some(call => call[0] === 'apiGetDeliveryForAcceptance' && call[2] === 'DOSTAWA-DUNSKA:D123abcd'));
});
test('spóźniony wybór po zmianie sesji nie pokazuje danych poprzedniej osoby', async () => {
  const p = page();
  let resolve;
  p.ctx.api = () => new Promise(done => { resolve = done; });
  const pending = p.run("selectDunska('D123abcd')");
  p.run("PIN = 'inna-sesja'; leaveDunska()");
  resolve({id: 'D123abcd', title: 'Poprzednia dostawa', status: 'W_DRODZE', items: []});
  await pending;
  assert.equal(p.elements.get('dunskaForm').hidden, true);
});
test('skan umożliwia naprawę niedokończonego zapisu po zmianie statusu', async () => {
  const p = page();
  p.ctx.api = async () => ({id: 'D123abcd', title: 'Wydanie', status: 'PRZYJĘTO_Z_RÓŻNICAMI', acceptancePending: true, items: [{sku: 'S1', qty: 3}]});
  await p.run("selectDunska('D123abcd')");
  assert.equal(p.elements.get('dunskaForm').hidden, false);
});

test('lista oznacza niedokończony odbiór jako wznowienie zapisu', async () => {
  const p = page();
  p.ctx.api = async () => [{id: 'D123abcd', title: 'Wydanie', acceptancePending: true}];
  await p.run('openDunska()');
  assert.match(p.elements.get('dunskaList').children[0].textContent, /Wznów zapis odbioru/);
});

test('Braki są widoczne bez RECEIVE_DUNSKA, bez wywołania odbiorów', async () => {
  const p = page();
  p.ctx.ROLES = [];
  p.ctx.api = async (...args) => {
    p.calls.push(args);
    return {items: [{sku: 'S1', name: 'Towar', stanDunska: 1, stanMin: 5, deficit: 4, stanBrzeznicka: 3}], source: 'IMPORT', dataTime: '2026-10-07T09:00:00Z', stale: true};
  };
  await p.run('openDunska()');
  await p.run("dunskaTab('braki')");
  assert.equal(p.elements.get('dunskaPending').hidden, true);
  assert.equal(p.elements.get('dunskaLowStock').hidden, false);
  assert.match(p.elements.get('dunskaLowStockMeta').textContent, /IMPORT/);
  assert.match(p.elements.get('dunskaLowStockWarning').textContent, /nieaktualne/);
  assert.match(p.elements.get('dunskaLowStockItems').children[0].textContent, /S1.*4/);
  assert.equal(p.calls.some(call => call[0] === 'apiListPendingDunska'), false);
});
test('spóźnione braki po wylogowaniu nie ujawniają danych', async () => {
  const p = page();
  let resolve;
  p.ctx.api = () => new Promise(done => { resolve = done; });
  const pending = p.run('loadDunskaLowStock()');
  p.run("PIN='';leaveDunska()");
  resolve({items: [{sku: 'SECRET'}], source: 'CZYTNIK', dataTime: '', stale: true});
  await pending;
  assert.doesNotMatch(p.elements.get('dunskaLowStockItems').textContent, /SECRET/);
});
