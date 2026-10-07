'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function page() {
  const elements = new Map();
  const element = () => ({
    value: '', hidden: false, textContent: '', innerHTML: '', children: [],
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, focus() {}, select() {},
    appendChild(child) { this.children.push(child); }
  });
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const context = vm.createContext({
    console, Map, Set, Promise, Date, JSON, String, Number, Error,
    WarehouseScanner: { Scanner: class { stop() {} } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: { getElementById: get, createElement: element, querySelectorAll: () => [], hidden: false, addEventListener() {} },
    window: { scrollTo() {}, addEventListener() {} }, navigator: {}, setTimeout() {}, clearTimeout() {}
  });
  const script = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  vm.runInContext(script.slice(0, script.lastIndexOf('(function init(){')), context);
  vm.runInContext(fs.readFileSync('screens/inwentaryzacja.js', 'utf8'), context);
  vm.runInContext("refreshItems=()=>{};processQueue=()=>{};var queued=[];var messages=[];enqueue=async item=>queued.push(item);toast=m=>messages.push(m);USER_ID='EMP-Test0001';ME='Tester';", context);
  return { run: s => vm.runInContext(s, context), get };
}

test('inwentaryzacja wysyła jawne zero, a dostawa i wydanie go odrzucają', async () => {
  for (const type of ['INWENTARYZACJA', 'DOSTAWA', 'EXPORT']) {
    const p = page();
    p.run(`DOC={id:'D',type:'${type}',myStatus:'LICZY'};cur={sku:'S1',ean:'12345678',name:'Towar',isNew:false}`);
    p.get('cQty').value = '0';
    await p.run('addItem()');
    assert.equal(p.run('queued.length'), type === 'INWENTARYZACJA' ? 1 : 0);
    if (type === 'INWENTARYZACJA') assert.equal(p.run('queued[0].qty'), 0);
  }
});

test('liczenie odrzuca pustą, ujemną i ułamkową ilość bez obcinania', async () => {
  for (const value of ['', '-1', '0.5', '1.5']) {
    const p = page();
    p.run("DOC={id:'D',type:'INWENTARYZACJA',myStatus:'LICZY'};cur={sku:'S1',ean:'12345678',name:'Towar',isNew:false}");
    p.get('cQty').value = value;
    await p.run('addItem()');
    assert.equal(p.run('queued.length'), 0, value);
  }
});

test('krok ilości pozwala zejść do zera tylko podczas inwentaryzacji', () => {
  const p = page();
  p.run("DOC={type:'INWENTARYZACJA'}");
  p.get('cQty').value = '1';
  p.run('step(-1)');
  assert.equal(Number(p.get('cQty').value), 0);
  p.run("DOC={type:'EXPORT'};step(-1)");
  assert.equal(Number(p.get('cQty').value), 1);
});

test('wycofany SKU z zakresu ma formularz liczenia bez nowego SKU i bez stanu', () => {
  const p = page();
  p.run("enterDoc({id:'I1',status:'OTWARTA',type:'INWENTARYZACJA',myStatus:'LICZY',participants:[],inventorySkus:['OLD'],inventoryProducts:[{sku:'OLD',name:'Wycofany towar',ean:'12345678',active:false}]})");
  assert.equal(p.get('inventoryCountPicker').hidden, false);
  assert.equal(p.get('cQty').min, '0');
  assert.ok(p.get('inventoryCountSku').children.some(c => c.value === 'OLD' && /Wycofany towar/.test(c.textContent)));
  p.run("chooseInventoryCountProduct('OLD')");
  assert.equal(p.run('cur.sku'), 'OLD');
  assert.equal(p.run('cur.name'), 'Wycofany towar');
  assert.equal(p.run('cur.isNew'), false);
  assert.equal(p.get('newProd').hidden, true);
  assert.equal(p.get('cName').textContent, 'Wycofany towar');
  assert.doesNotMatch(p.get('inventoryCountSku').children.map(c => c.textContent).join(' '), /Stan|qty|stock/);
  p.run("chooseInventoryCountProduct('OUTSIDE')");
  assert.equal(p.run('cur.sku'), 'OLD');
  assert.match(p.run('messages.at(-1)'), /zakresem/);
  p.run("enterDoc({id:'D2',status:'OTWARTA',type:'DOSTAWA',myStatus:'LICZY',participants:[]})");
  assert.equal(p.get('inventoryCountPicker').hidden, true);
  assert.equal(p.get('cQty').min, '1');
});
