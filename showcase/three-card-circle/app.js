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
$('#create-open').addEventListener('click',()=>openDialog($('#create-dialog')));
$('#copy-prompt').addEventListener('click',async()=>{
  const prompt=$('#creator-prompt');
  try{await navigator.clipboard.writeText(prompt.value);$('#create-status').textContent='Copied. Paste it into your coding agent.';}
  catch{prompt.focus();prompt.select();$('#create-status').textContent='Select and copy the prompt above.';}
});
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
let transferModule=null,transferSession=null,prepared=null,transferBusy=false;
const transferForm=$('#transfer-form'),review=$('#transfer-review');
const walletMobile=$('#wallet-mobile');walletMobile.href='web+cardano://browse/v1?uri='+encodeURIComponent(location.href);
function transferError(e){$('#wallet-status').textContent=errorText(e);if(e.transactionId)showReceipt(e.transactionId);}
function showReceipt(id){const a=$('#transfer-receipt');a.href='https://cardanoscan.io/transaction/'+id;a.textContent='Check transaction '+id+' ↗';a.hidden=false;}
function showCards(){
  const {snapshot,identity}=transferSession,list=$('#transfer-cards');list.replaceChildren();
  snapshot.cards.forEach((card,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=String(i);input.name='card';input.disabled=!identity.keys.includes(card.owner);input.checked=!input.disabled;label.append(input,document.createTextNode(['01 · The Spark','02 · The Connection','03 · The Invitation'][i]+(input.disabled?' · another owner':'')));list.append(label);});
  transferForm.hidden=false;review.hidden=true;$('#transfer-prepare').disabled=!snapshot.owners.some(k=>identity.keys.includes(k));
  $('#wallet-status').textContent=$('#transfer-prepare').disabled?'Connected. This wallet does not control a card.':'Connected. Choose cards and a recipient, then review the transfer.';
}
$('#connect').addEventListener('click',()=>{
  if(transferBusy){openDialog($('#wallet-dialog'));return;}
  prepared=null;transferSession=null;transferForm.hidden=true;review.hidden=true;$('#transfer-receipt').hidden=true;
  const list=$('#wallet-list');list.replaceChildren();
  const wallets=Object.entries(window.cardano||{}).filter(([,w])=>typeof w?.enable==='function');
  $('#wallet-status').textContent=wallets.length?'Connect to check which cards you control.':'Open this page in VESPR’s dApp browser to connect.';
  openDialog($('#wallet-dialog'));
  for(const [id,wallet] of wallets){const button=document.createElement('button');button.type='button';button.textContent=wallet.name||id;
    button.addEventListener('click',async()=>{button.disabled=true;try{
      const api=await wallet.enable();if(await api.getNetworkId()!==1)throw Error('Switch your wallet to Cardano mainnet.');
      await refresh();list.replaceChildren();
      if(activationState!=='active'||!snapshot?.active){$('#wallet-status').textContent=`${wallet.name||id} connected. ${activationState==='inactive'?'Mainnet activation pending.':'Verified ownership is unavailable.'}`;return;}
      $('#wallet-status').textContent='Checking ownership and loading the transfer tools…';
      transferModule??=await import('./wallet/transfer.js');transferSession=await transferModule.connectTransfer(api,reader.config);showCards();
    }catch(e){transferError(e);}finally{button.disabled=false;}});list.append(button);
  }
});
transferForm.addEventListener('submit',async event=>{
  event.preventDefault();if(transferBusy||!transferSession)return;transferBusy=true;$('#transfer-prepare').disabled=true;
  try{
    $('#wallet-status').textContent='Preparing and checking the transfer. No signature requested.';
    const indices=[...document.querySelectorAll('#transfer-cards input:checked')].map(i=>Number(i.value));
    prepared=await transferModule.prepareTransfer(transferSession,{indices,destination:$('#transfer-destination').value});
    const p=prepared.packet;$('#review-cards').textContent=p.indices.map(i=>['The Spark','The Connection','The Invitation'][i]).join(', ');
    $('#review-recipient').textContent=$('#transfer-destination').value.trim();$('#review-destination').textContent=p.destination;$('#review-fee').textContent=(Number(p.feeLovelace)/1e6).toFixed(6)+' ADA';$('#review-expiry').textContent=new Date(p.expiresAt).toLocaleTimeString();
    transferForm.hidden=true;review.hidden=false;$('#transfer-sign').disabled=false;$('#transfer-back').disabled=false;
    $('#wallet-status').textContent='Review the full destination and costs. Your wallet will request approval.';
  }catch(e){prepared=null;transferError(e);}finally{transferBusy=false;$('#transfer-prepare').disabled=false;}
});
$('#transfer-back').addEventListener('click',()=>{if(!transferBusy){prepared=null;review.hidden=true;transferForm.hidden=false;}});
$('#transfer-sign').addEventListener('click',async()=>{
  if(transferBusy||!prepared)return;transferBusy=true;$('#transfer-sign').disabled=true;$('#transfer-back').disabled=true;
  try{
    $('#wallet-status').textContent='Check and approve the transaction in your wallet.';
    const result=await transferModule.signAndSubmit(transferSession,prepared);showReceipt(result.id);prepared=null;
    $('#wallet-status').textContent='Submitted. Ownership updates here after three confirmations. Do not send again.';
  }catch(e){transferError(e);prepared=null;$('#transfer-back').disabled=Boolean(e.transactionId);}
  finally{transferBusy=false;}
});
refresh();
setInterval(()=>{if(!document.hidden && !document.querySelector('dialog[open]'))refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
