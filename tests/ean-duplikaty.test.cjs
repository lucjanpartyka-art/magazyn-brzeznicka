const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('skan wspólnego EAN pokazuje listę SKU i wybiera wskazany',()=>{
 const html=fs.readFileSync('index.html','utf8');let dialog,selected,stopped=0;
 const c=vm.createContext({CAT:{byEan:new Map([['123',['A','B']]]),bySku:new Map([['A',{name:'Pierwszy'}],['B',{name:'Drugi'}]])},stopScanner:()=>stopped++,sheet:(title,desc,buttons)=>dialog={title,buttons},chosen:(...args)=>selected=args,resetScan(){}});
 vm.runInContext(html.slice(html.indexOf('function onCode(ean)'),html.indexOf('function noCode()')),c);
 c.onCode('123');assert.equal(stopped,1);assert.match(dialog.title,/kilka produktów/);assert.equal(dialog.buttons.length,3);dialog.buttons[1].fn();assert.deepEqual(selected,['B','123']);
});
