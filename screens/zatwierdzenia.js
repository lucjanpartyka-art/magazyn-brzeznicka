let APPROVAL_REQUEST=0;
async function refreshApprovalCount(){
  if(!ROLES.includes('APPROVE_IN'))return;
  const token=PIN;
  try { const r=await api('apiListApprovals',token); if(token!==PIN)return; $('approvalCount').textContent=r.docs.length+r.counts.length; }
  catch(e){if(token===PIN)$('approvalCount').textContent='—';}
}
async function openApprovals(){
  const token=PIN,request=++APPROVAL_REQUEST;
  show('scrApprovals');const box=$('approvalList');box.textContent='Wczytuję…';
  try {
    const r=await api('apiListApprovals',token);if(token!==PIN || request!==APPROVAL_REQUEST)return;$('approvalCount').textContent=r.docs.length+r.counts.length;box.textContent='';
    for(const d of r.docs){
      const card=document.createElement('div');card.className='item';
      card.innerHTML=`<div><b>${esc(d.title)}</b><p>${esc(d.closedBy)} · ${esc(d.closedAt)}</p>${d.items.map(i=>`<p>${esc(i.sku)} · ${esc(i.name)}: ${esc(i.qty)} szt. <small>${esc(Object.entries(i.by).map(([n,q])=>n+': '+q).join(', '))}</small></p>`).join('')}</div>`;
      for(const [label,decision] of [['Zatwierdź','ZATWIERDŹ'],['Odrzuć','ODRZUĆ']]){const b=document.createElement('button');b.className='btn sec';b.textContent=label;b.onclick=()=>decision==='ODRZUĆ'?rejectApproval(d.id):decideApproval(d.id,decision);card.appendChild(b);}box.appendChild(card);
    }
    for(const c of r.counts){
      const card=document.createElement('div');card.className='item';const p=document.createElement('p');p.textContent=`Liczenie ${c.sku} · ${c.name || ''}: ${c.counted} (stan ${c.stockAtCount}) · ${c.by}`;card.appendChild(p);
      for(const [label,decision] of [['Zatwierdź','ZATWIERDŹ'],['Odrzuć','ODRZUĆ']]){const b=document.createElement('button');b.className='btn sec';b.textContent=label;b.onclick=()=>decideCount(c.id,decision);card.appendChild(b);}box.appendChild(card);
    }
    if(!r.docs.length && !r.counts.length) box.textContent='Brak oczekujących zatwierdzeń.';
  } catch(e){if(token===PIN && request===APPROVAL_REQUEST)box.textContent=e.message;}
}
function rejectApproval(id){
  sheet('Odrzuć dokument','Powód odrzucenia (10–500 znaków)',[{label:'Odrzuć',cls:'danger',keep:true,fn:()=>{const reason=$('approvalReason').value;if(reason.trim().length<10 || reason.length>500)return toast('Podaj powód (10–500 znaków)');hideSheet();decideApproval(id,'ODRZUĆ',reason);}},{label:'Anuluj',cls:'sec'}]);
  const input=document.createElement('textarea');input.id='approvalReason';input.maxLength=500;input.setAttribute('aria-label','Powód odrzucenia');$('shExtra').appendChild(input);input.focus();
}
const DECISIONS_PENDING=new Set();
async function submitDecision(fn,id,decision,reason){
  const key=fn+':'+id;
  if(DECISIONS_PENDING.has(key))return;
  const token=PIN;DECISIONS_PENDING.add(key);
  const box=$('approvalList');const buttons=box.querySelectorAll ? box.querySelectorAll('button') : [];
  buttons.forEach(b=>b.disabled=true);
  try{
    await api(fn,token,id,decision,reason);
    if(PIN!==token)return;
    toast(fn==='apiDecideCount' ? (decision==='ODRZUĆ'?'Liczenie odrzucone':'Liczenie zatwierdzone') : (decision==='ODRZUĆ'?'Dokument wrócił do liczenia':'Zatwierdzono'));await openApprovals();
  }catch(e){if(PIN===token)toast(e.message);}
  finally{DECISIONS_PENDING.delete(key);buttons.forEach(b=>b.disabled=false);}
}
async function decideApproval(id,decision,reason){return submitDecision('apiDecideDoc',id,decision,reason);}
async function decideCount(id,decision){return submitDecision('apiDecideCount',id,decision);}
let TO_COUNT_REQUEST=0;
async function openToCount(items){
  const token=PIN,requestId=++TO_COUNT_REQUEST;
  const current=()=>token===PIN && requestId===TO_COUNT_REQUEST;
  show('scrToCount');const box=$('toCountList');box.textContent='Wczytuję…';
  try {
    const rows=items || await api('apiListToCount',token);if(!current())return;box.textContent='';
    for(const row of rows){
      const card=document.createElement('div');card.className='item';const label=document.createElement('label');label.textContent=row.sku+' · '+row.name;
      const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.inputMode='numeric';input.setAttribute('aria-label','Policzono '+row.sku);label.appendChild(input);card.appendChild(label);
      const button=document.createElement('button');button.className='btn sec';button.textContent='Zapisz liczenie';
      let request=null;
      button.onclick=async()=>{
        if(!current() || button.disabled)return;
        const n=Number(input.value);if(input.value.trim()==='' || !Number.isSafeInteger(n) || n<0) return toast('Wpisz liczbę całkowitą ≥0');
        if(!request || request.counted!==n) request={counted:n,clientId:'count-'+newId()};
        button.disabled=true;
        try {await api('apiSubmitCount',token,row.sku,n,request.clientId);if(!current())return;card.textContent=row.sku+' · Liczenie czeka na zatwierdzenie';refreshApprovalCount();}
        catch(e){if(current()){toast(e.message);button.disabled=false;}}
      };card.appendChild(button);box.appendChild(card);
    }
    if(!rows.length) box.textContent='Brak produktów do policzenia.';
  }catch(e){if(current())box.textContent=e.message;}
}
