import { ChainReader, readKoiosTip } from './chain-reader.js?v=2';
const $ = selector => document.querySelector(selector);
const errorText = e => e?.info || e?.message || 'Request unavailable.';
let reader=null, snapshot=null, busy=false, historyOffset=0, historyAnchor=null, historyBusy=false;
let activationState='unknown';
let previousFocus=null;
const short = s => s.slice(0,8)+'…'+s.slice(-6);
function openDialog(dialog) { previousFocus=document.activeElement; dialog.showModal(); }
for(const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>previousFocus?.focus());
}
function owners(addresses=[],placeholder='Not issued') {
  document.querySelectorAll('[data-copy]').forEach((button,i)=>{
    const address=addresses[i]; button.disabled=!address;
    button.querySelector('.address').textContent=address||placeholder;
    button.title=address?'Copy full owner address':'';
    button.setAttribute('aria-label',address?`Copy owner address for card ${i+1}: ${address}`:`Owner address for card ${i+1}: ${placeholder}`);
  });
}
function feed(label,mode='',tip=null) {
  $('#feed-status').textContent=label;
  $('.feed').className='feed'+(mode?' '+mode:'');
  $('.feed').title=tip?`BEACN Koios · confirmed chain tip ${tip.block_no} · checked ${new Date().toLocaleTimeString()}`:'';
}
async function refresh() {
  if(busy)return;
  busy=true;$('#refresh').disabled=true;
  try {
    const response=await fetch('deployment.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Activation status could not be verified.');
    const config=await response.json();
    if(config.status==='inactive' && config.deployment===null) {
      activationState='inactive';
      reader=null;snapshot=null;owners();$('#chain-status').textContent='Mainnet inactive';$('#chain-status').className='badge';$('#ledger-revision').textContent='';
      try {const tip=await readKoiosTip();feed('BEACN Koios','online',tip);$('#refresh-status').textContent='BEACN Koios connected. The contract is not activated; no NFTs have been issued.';}
      catch(error){feed('Koios unavailable','error');$('#refresh-status').textContent=errorText(error);}
      return;
    }
    if(config.status!=='active')throw Error('Activation configuration is incomplete.');
    reader=new ChainReader(config.deployment);
    const next=await reader.snapshot();snapshot=next;
    activationState='active';
    owners(next.addresses);
    $('#chain-status').textContent=next.active?(next.together?'All 3 together':'Split addresses'):'Not issued';
    $('#chain-status').className=next.active?'badge live':'badge';
    $('#ledger-revision').textContent=`· #${next.revision}`;
    feed('BEACN Koios','online',next.tip);
    $('#refresh-status').textContent=`Confirmed ledger revision ${next.revision}. ${next.active?(next.together?'All three NFTs are at the same address. New addresses are allowed.':'The NFTs are split. Transfers are limited to the addresses of other NFTs.'):'Issuance is not confirmed.'}`;
  } catch(error) {
    activationState='unknown';
    reader=null;snapshot=null;owners([],'Unverified');$('#chain-status').textContent='Data unavailable';$('#chain-status').className='badge';$('#ledger-revision').textContent='';
    feed('Koios unavailable','error');$('#refresh-status').textContent=errorText(error);
  } finally {busy=false;$('#refresh').disabled=false;}
}
$('#refresh').addEventListener('click',refresh);
for(const button of document.querySelectorAll('[data-copy]')) button.addEventListener('click',async()=>{
  const address=snapshot?.addresses[Number(button.dataset.copy)];if(!address)return;
  try {await navigator.clipboard.writeText(address);$('#refresh-status').textContent='Full owner address copied.';const label=button.querySelector('.owner-label');label.firstChild.textContent='COPIED ';setTimeout(()=>{label.firstChild.textContent='OWNER ADDRESS ';},1800);}
  catch {$('#address-text').value=address;$('#address-explorer').href=`https://cardanoscan.io/address/${address}`;openDialog($('#address-dialog'));$('#address-text').select();}
});
async function loadHistory(offset=0) {
  if(historyBusy)return;historyBusy=true;
  $('#history-newer').disabled=true;$('#history-older').disabled=true;
  $('#history-list').replaceChildren();$('#history-page').textContent='';
  if(!reader){$('#history-note').textContent=activationState==='inactive'?'Mainnet inactive. No ledger history yet.':'Ledger data is unavailable. Close and refresh to try again.';$('.pager').hidden=true;historyBusy=false;return;}
  $('.pager').hidden=false;$('#history-note').textContent='Reading the confirmed ledger…';
  try {
    const page=await reader.history(offset,3,historyAnchor);
    historyOffset=offset;historyAnchor=page.anchorBlock;
    $('#history-note').textContent=page.rows.length?'Every transfer updates this on-chain ledger.':'No confirmed ledger entries.';
    for(const row of page.rows){
      const li=document.createElement('li'),time=document.createElement('time'),a=document.createElement('a');
      time.dateTime=new Date(row.block_time*1000).toISOString();time.textContent=new Date(row.block_time*1000).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      a.href=`https://cardanoscan.io/transaction/${row.tx_hash}`;a.textContent=short(row.tx_hash)+' ↗';a.title=row.tx_hash;li.append(time,a);$('#history-list').append(li);
    }
    $('#history-newer').disabled=offset===0;$('#history-older').disabled=!page.more;
    $('#history-page').textContent=page.rows.length?String(1+Math.floor(offset/3)):'';
  }catch(error){$('#history-note').textContent=errorText(error);$('#history-newer').disabled=offset===0;}
  finally{historyBusy=false;}
}
$('#history-open').addEventListener('click',()=>{historyOffset=0;historyAnchor=null;openDialog($('#history-dialog'));loadHistory(0);});
$('#history-newer').addEventListener('click',()=>loadHistory(Math.max(0,historyOffset-3)));
$('#history-older').addEventListener('click',()=>loadHistory(historyOffset+3));
$('#connect').addEventListener('click',()=>{
  const list=$('#wallet-list');list.replaceChildren();
  const wallets=Object.entries(window.cardano||{}).filter(([,w])=>typeof w?.enable==='function');
  $('#wallet-status').textContent=wallets.length?'Connection only. No signing or payment.':'Open this page in VESPR’s dApp browser to connect.';
  openDialog($('#wallet-dialog'));
  for(const [id,wallet] of wallets){const button=document.createElement('button');button.type='button';button.textContent=wallet.name||id;
    button.addEventListener('click',async()=>{button.disabled=true;try{const api=await wallet.enable();if(await api.getNetworkId()!==1)throw Error('Switch your wallet to Cardano mainnet.');$('#wallet-status').textContent=`${wallet.name||id} connected. ${snapshot?.active?'Transfer signing is not enabled yet.':'Mainnet activation pending.'}`;list.replaceChildren();}catch(e){$('#wallet-status').textContent=errorText(e);}finally{button.disabled=false;}});list.append(button);
  }
});
refresh();
setInterval(()=>{if(!document.hidden && !document.querySelector('dialog[open]'))refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
