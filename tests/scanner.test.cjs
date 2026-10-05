const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Scanner,validCode}=require('../barcode-scanner.js');
const z=require('zxing-wasm/reader');
z.prepareZXingModule({overrides:{wasmBinary:fs.readFileSync('vendor/zxing_reader.wasm')}});
for(const file of ['ean-photo.jpg','ean-rotated.jpg','ean-iphone-size.jpg','ean-exif6.jpg','ean-curved.jpg']) {
 test('rzeczywisty dekoder: '+file,async()=>{
  const r=await z.readBarcodes(fs.readFileSync('tests/'+file),{formats:['EAN13','EAN8','UPCA','UPCE','Code128'],tryHarder:true,tryRotate:true,tryDownscale:true});
  assert.ok(r.some(x=>x.text==='8936020052557'),JSON.stringify(r.map(x=>x.text)));
 });
}
test('brak kodu nie staje się wymyślonym EAN',async()=>{
 assert.equal((await z.readBarcodes(fs.readFileSync('tests/no-code.jpg'),{formats:['EAN13','UPCA']})).length,0);
});
test('kontrola EAN13 i UPC-A oraz odrzucenie uszkodzonej cyfry',()=>{
 assert.equal(validCode('8936020052557','EAN13'),'8936020052557');
 assert.equal(validCode('8936020052558','EAN13'),'');
 assert.equal(validCode('036000291452','UPCA'),'036000291452');
 assert.equal(validCode('89360A0052557','EAN13'),'');
});
test('zgoda na kamerę po przejściu do zdjęcia nie wskrzesza strumienia',async()=>{
 let resolveCamera,stopped=0;
 const context=vm.createContext({module:{exports:{}},setTimeout,clearTimeout,URL,Map,Set,Promise,Error,
 navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveCamera=r)}}});
 vm.runInContext(fs.readFileSync('barcode-scanner.js','utf8'),context);
 const scanner=new context.module.exports.Scanner();
 const pending=scanner.start({},()=>assert.fail('spóźniony wynik'),()=>{});
 scanner.stop();
 resolveCamera({getTracks:()=>[{stop:()=>stopped++}]});await pending;
 assert.equal(stopped,1);assert.equal(scanner.stream,null);
});
test('zatrzymanie zwalnia wszystkie ścieżki aparatu',()=>{
 const scanner=new Scanner();let n=0,p=0;scanner.stream={getTracks:()=>[{stop:()=>n++},{stop:()=>n++}]};
 const video={pause:()=>p++,srcObject:{}};scanner.video=video;scanner.stop();scanner.stop();
 assert.equal(n,2);assert.equal(p,1);assert.equal(video.srcObject,null);
});
test('składnia strony i workera',()=>{
 const html=fs.readFileSync('index.html','utf8');
 for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 new vm.Script(fs.readFileSync('barcode-worker.js','utf8'));
});
function page(storage=new Map()) {
 const els=new Map(); const events={};
 const el=id=>{if(!els.has(id)){const classes=new Set();els.set(id,{id,hidden:false,value:'',textContent:'',innerHTML:'',disabled:false,
 classList:{toggle(k,v){v?classes.add(k):classes.delete(k)},add(k){classes.add(k)},remove(k){classes.delete(k)},contains:k=>classes.has(k)},
 addEventListener(){},focus(){},select(){},pause(){},getContext(){},click(){}})}return els.get(id)};
 const context=vm.createContext({console,WarehouseScanner:{Scanner:class{stop(){} start(){throw Error('nie uruchamiać automatycznie')}}},Map,Set,Promise,Date,JSON,String,Number,Error,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 document:{getElementById:el,querySelectorAll:()=>[],addEventListener:(k,fn)=>events[k]=fn,hidden:false},
 window:{scrollTo(){},addEventListener:(k,fn)=>events[k]=fn},navigator:{},setTimeout(){},clearTimeout(){}});
 const script=[...fs.readFileSync('index.html','utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 vm.runInContext(script.slice(0,script.lastIndexOf('(function init(){')),context);
 vm.runInContext("refreshItems=()=>{};processQueue=()=>{};ME='Tester';",context);
 return {run:s=>vm.runInContext(s,context),el,events,storage,context};
}
test('przeładowanie po aparacie odtwarza produkt, ilość i pola we własnym dokumencie',()=>{
 const a=page();a.run("DOC={id:'D'};cur={ean:'8936020052557',sku:'S',name:'Produkt',isNew:false}");a.el('cQty').value='6';a.el('cLot').value='L123';a.run('saveDraft()');
 const b=page(a.storage);b.run("enterDoc({id:'D',status:'OTWARTA',type:'DOSTAWA',participants:[],myStatus:'LICZY'})");
 assert.equal(b.el('cQty').value,'6');assert.equal(b.el('cLot').value,'L123');assert.equal(b.run('cur.ean'),'8936020052557');
});
test('formularz innego użytkownika nie jest przywracany',()=>{
 const a=page();a.run("DOC={id:'D'};cur={ean:'8936020052557',name:'Produkt'};saveDraft()");
 const b=page(a.storage);b.run("ME='Inna osoba';enterDoc({id:'D',status:'OTWARTA',type:'DOSTAWA',participants:[],myStatus:'LICZY'})");assert.equal(b.run('cur'),null);
});
test('powrót z systemowej kamery nie startuje drugiego skanera',()=>{
 const a=page();a.run('photoPickPending=true');a.events.visibilitychange();assert.equal(a.run('scanning'),false);
});
