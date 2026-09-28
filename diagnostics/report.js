"use strict";
const list=document.querySelector('#receipts'), report=document.querySelector('#report'), status=document.querySelector('#status');
let records=[];
document.querySelector('#load').onclick=()=>{
 try{
  records=[];list.replaceChildren(new Option('Choose a saved transaction',''));report.value='';
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   if(!key?.startsWith('nft-studio:receipt:v1:'))continue;
   try{const value=JSON.parse(localStorage.getItem(key));if(value.schema==='nft-studio.receipt.v1'&&/^[a-f0-9]{64}$/.test(value.hash))records.push(value);}catch{}
  }
  records.sort((a,b)=>b.createdAt-a.createdAt);
  records.forEach((r,i)=>list.add(new Option(`${r.name||'NFT'} · ${r.state} · ${r.hash.slice(0,12)}…`,String(i))));
  status.textContent=records.length?`${records.length} saved receipt(s). Choose the transaction to inspect.`:'No receipts found here. Use the same wallet browser and origin as the original mint; do not clear its site data.';
 }catch{status.textContent='Browser storage is unavailable. Keep the original transaction ID.';}
};
list.onchange=()=>{
 if(list.value===''){report.value='';return;}
 const r=records[Number(list.value)]; let attempt;
 try{attempt=JSON.parse(localStorage.getItem('nft-studio:submission:v1:'+r.hash));}catch{}
 report.value=JSON.stringify({schema:'nft-studio.recovery-report.v1',hash:r.hash,name:r.name,state:r.state,createdAt:r.createdAt,bytes:r.bytes,signedHex:r.signedHex,prepared:r.prepared,submission:attempt||r.submission||null},null,2);
 status.textContent='Report ready. No wallet request or submission was made.';
};
document.querySelector('#select').onclick=()=>{report.focus();report.select();};
document.querySelector('#copy').onclick=async()=>{
 if(!report.value){status.textContent='Choose a saved transaction first.';return;}
 try{await navigator.clipboard.writeText(report.value);status.textContent='Report copied. Paste it into your support conversation.';}
 catch{report.focus();report.select();status.textContent='Clipboard unavailable. The report is selected; use your phone’s Copy action.';}
};
