const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createEnv}=require('../../tests/sim/gas-mock.cjs');
test('po wylogowaniu wydanie wymaga ponownego logowania, nowa sesja działa',async()=>{
  const env=createEnv();env.setup({staff:[{id:'EMP-BART-0002',name:'Bartek',pin:'23456789',roles:['POST_STOCK']}],catalog:[]});
  const storage=new Map(),els=new Map();const el=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',addEventListener(){}});return els.get(id)};
  const ctx=vm.createContext({Map,Set,Date,JSON,Number,String,Promise,Error,console,setTimeout(){},clearTimeout(){},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},navigator:{},WarehouseScanner:{Scanner:class{stop(){}}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const script=[...fs.readFileSync('index.html','utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');vm.runInContext(script.slice(0,script.lastIndexOf('(function init(){')),ctx);
  ctx.realApi=async(fn,...args)=>{const r=env.call(fn,...args);if(!r.ok)throw Error(r.error);return r.data};
  vm.runInContext("api=realApi;afterLogin=()=>{};show=()=>{};stopScanner=()=>{}",ctx);el('employeeId').value='EMP-BART-0002';
  await vm.runInContext("login('23456789')",ctx);const old=storage.get('mg_session');assert.ok(old);
  vm.runInContext('logout()',ctx);assert.equal(vm.runInContext('PIN',ctx),null);assert.equal(storage.get('mg_session'),undefined);
  await assert.rejects(()=>vm.runInContext("api('apiStartDoc',PIN,'EXPORT','Klient')",ctx));assert.equal(env.call('apiSession',old).ok,false);
  await vm.runInContext("login('23456789')",ctx);assert.ok(storage.get('mg_session'));const doc=await vm.runInContext("api('apiStartDoc',PIN,'EXPORT','Klient')",ctx);assert.ok(doc.id);
});
