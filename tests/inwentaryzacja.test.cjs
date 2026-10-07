'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function page(roles=['INVENTORY']) {
  const elements=new Map(),calls=[],messages=[];
  const element=()=>({value:'',checked:false,hidden:false,children:[],textContent:'',appendChild(c){this.children.push(c);}});
  const ctx=vm.createContext({ROLES:roles,PIN:'token',document:{createElement:element},$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},show(){},toast:m=>messages.push(m),esc:String,stopScanner(){},api:async(...args)=>{calls.push(args);return []}});
  vm.runInContext(fs.readFileSync('screens/inwentaryzacja.js','utf8'),ctx);
  return {run:s=>vm.runInContext(s,ctx),elements,calls,messages,ctx};
}
test('wybór całego zakresu, SKU ze skanera i lokalizacji',()=>{
  const p=page();p.run("$('inventoryScope').value='all'");assert.equal(p.run('inventoryScope().all'),true);
  p.run("$('inventoryScope').value='skus';$('inventoryValues').value='S1\\nS2'");assert.deepEqual(Array.from(p.run('inventoryScope().skus')),['S1','S2']);
  p.run("inventoryScanned('S1')");assert.equal(p.elements.get('inventoryValues').value,'S1\nS2');
  p.run("$('inventoryScope').value='locations';$('inventoryValues').value='A;B'");assert.deepEqual(Array.from(p.run('inventoryScope().locations')),['A','B']);
});
test('potwierdzenie zer z listą wymagane zanim API zatwierdzi',async()=>{
  const p=page();p.run("showInventoryComparison('D',{rows:[{sku:'S1',name:'Towar',stock:5,counted:null,diff:-5}],uncountedNonZero:[{sku:'S1',name:'Towar',stock:5}]})");
  assert.match(p.elements.get('inventoryZeroList').textContent,/S1.*5/);
  await p.elements.get('inventoryApprove').onclick();assert.equal(p.calls.length,0);
  p.elements.get('inventoryZero').checked=true;
  await p.elements.get('inventoryApprove').onclick();assert.deepEqual(p.calls[0],['apiApproveInventory','token','D',true]);
});
test('bez INVENTORY brak tworzenia i brak tabeli różnic',async()=>{
  const p=page([]);await p.run('openInventories()');assert.equal(p.elements.get('inventoryStart').hidden,true);
  p.run("showInventoryComparison('D',{rows:[],uncountedNonZero:[]})");assert.equal(p.elements.has('inventoryDifferences'),false);
});
