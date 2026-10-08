'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function page(roles=[]) {
  const elements=new Map(),calls=[];
  const element=()=>({value:'',hidden:false,children:[],textContent:'',appendChild(c){this.children.push(c);}});
  const ctx=vm.createContext({ROLES:roles,PIN:'token',document:{createElement:element},$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},show(){},toast(){},api:async(...args)=>{calls.push(args);return args[0]==='apiProduct'?{product:{sku:'S1',name:'Produkt',ean:'123',eans:['456'],qty:-2,active:true,replacedBy:'S2',location:'A'},moves:[{qty:-2,actorId:'Anna',type:'WYDANIE',date:'dziś'}],history:[{field:'name',before:'Stary',after:'Produkt',actorId:'Anna'}]}:[{sku:'S1',name:'Produkt',qty:-2,toCount:true,ean:'123',active:true}];}});
  vm.runInContext(fs.readFileSync('screens/produkty.js','utf8'),ctx);
  return {run:s=>vm.runInContext(s,ctx),elements,calls};
}
test('Filip widzi listę i kartę bez przycisków edycji',async()=>{
  const p=page();await p.run('openProducts()');
  assert.equal(p.elements.get('productAdd').hidden,true);
  assert.match(p.elements.get('productList').children[0].textContent,/S1.*Produkt.*-2/);
  await p.elements.get('productList').children[0].onclick();
  assert.equal(p.elements.get('productEdit').hidden,true);
  assert.equal(p.elements.get('productReplace').hidden,true);
  assert.equal(p.elements.get('productActive').hidden,true);
  assert.match(p.elements.get('productMoves').children[0].textContent,/Anna/);
  assert.equal(p.elements.get('productLinks').children[0].textContent,'Zastąpiony przez S2');
});
test('wyszukiwarka i filtr trafiają do API, rola widzi formularz ze stałym SKU',async()=>{
  const p=page(['PRODUCTS_EDIT']);p.run("$('productQuery').value='123';$('productFilter').value='negative'");
  await p.run('openProducts()');assert.deepEqual(p.calls[0],['apiListProducts','token','123','negative']);
  assert.equal(p.elements.get('productAdd').hidden,false);
  await p.run("openProduct('S1')");p.run('editProduct()');
  assert.equal(p.elements.get('productSku').disabled,true);
  p.run("$('productName').value='Nowa';$('productEans').value='456,789'");
  await p.run('saveProduct()');
  const saved=p.calls.find(c=>c[0]==='apiSaveProduct')[2];
  assert.equal(p.calls.find(c=>c[0]==='apiSaveProduct')[3],'EDIT');assert.equal(saved.originalSku,'S1');assert.equal(saved.name,'Nowa');assert.deepEqual(Array.from(saved.eans),['456','789']);
});
test('stan null jest wyświetlany jako — z informacją o inwentaryzacji',async()=>{const p=page();p.run("api=async(fn)=>fn==='apiProduct'?{product:{sku:'X',name:'X',qty:null,notes:'trwa inwentaryzacja'},moves:[],history:[]}:[{sku:'X',name:'X',qty:null,notes:'trwa inwentaryzacja'}]");await p.run('openProducts()');assert.match(p.elements.get('productList').children[0].textContent,/stan —.*trwa inwentaryzacja/);await p.run("openProduct('X')");assert.match(p.elements.get('productSummary').textContent,/Stan: —.*trwa inwentaryzacja/);});

test('dodawanie przekazuje tryb ADD',async()=>{const p=page(['PRODUCTS_EDIT']);p.run("editProduct(true);$('productSku').value='NEW';$('productName').value='Nowy'");await p.run('saveProduct()');assert.equal(p.calls.find(c=>c[0]==='apiSaveProduct')[3],'ADD');});
