import { ChainReader } from './chain-reader.js';

const status = document.querySelector('#wallet-status');
const walletList = document.querySelector('#wallet-list');
const errorText = e => e?.info || e?.message || 'The wallet request could not be completed.';
let reader = null, configLoaded = false, historyOffset = 0, busy = false;
const short = s => s.slice(0,8)+'…'+s.slice(-6);
document.querySelector('#connect').addEventListener('click', async () => {
  walletList.replaceChildren();
  const wallets = Object.entries(window.cardano || {}).filter(([, w]) => typeof w?.enable === 'function');
  if (!wallets.length) { status.textContent = 'Open this page in a compatible Cardano dApp browser, or install a CIP-30 browser wallet. Mainnet minting is still inactive.'; return; }
  walletList.hidden = false;
  status.textContent = 'Choose a wallet to check its network. No signature or payment will be requested.';
  for (const [id, wallet] of wallets) {
    const button = document.createElement('button'); button.className = 'button'; button.textContent = wallet.name || id;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const api = await wallet.enable();
        if (await api.getNetworkId() !== 1) throw Error('This collection is planned for Cardano mainnet. Switch your wallet to mainnet and check again.');
        status.textContent = `${wallet.name || id} connected on mainnet. ${reader ? 'Use the confirmed owner record below. Transfer signing is not enabled on this preview.' : 'The collection is not issued; no ownership or transfer is available yet.'}`;
        walletList.hidden = true;
      } catch (e) { status.textContent = errorText(e); } finally { button.disabled = false; }
    }); walletList.append(button);
  }
});
const refreshStatus = document.querySelector('#refresh-status');
function unavailable(message) {
  document.querySelector('#chain-status').textContent='UNVERIFIED';
  document.querySelector('#chain-note').textContent=message;
  document.querySelectorAll('.owner strong').forEach(n=>n.textContent='Unavailable');
  document.querySelector('#transfer-count').textContent='—';
  document.querySelector('#history').textContent='Confirmed history could not be verified.';
  document.querySelector('#more-history').hidden=true;
}
async function history(reset=false) {
  if (reset) historyOffset=0;
  const page=await reader.history(historyOffset);
  const area=document.querySelector('#history');
  if (reset) area.replaceChildren();
  for (const row of page.rows) {
    if (area.querySelector(`[data-tx="${row.tx_hash}"]`)) continue;
    const p=document.createElement('p'),a=document.createElement('a');
    p.dataset.tx=row.tx_hash;
    a.href=`https://cardanoscan.io/transaction/${row.tx_hash}`;
    a.textContent=short(row.tx_hash); a.title=row.tx_hash;
    p.append(new Date(row.block_time*1000).toLocaleString()+' · ',a); area.append(p);
  }
  if (!area.childElementCount) area.textContent='No confirmed record transactions yet.';
  historyOffset=page.next; document.querySelector('#more-history').hidden=!page.more;
}
async function refresh() {
  if (busy) return;
  busy=true; document.querySelector('#refresh').disabled=true;
  try {
    if (!configLoaded) {
      const response=await fetch('deployment.json',{cache:'no-store'});
      if (!response.ok) throw Error('Activation status could not be verified.');
      const config=await response.json();
      if (config.status==='active') reader=new ChainReader(config.deployment);
      else if (config.status!=='inactive' || config.deployment!==null) throw Error('Activation configuration is incomplete.');
      configLoaded=true;
    }
    if (!reader) {
      refreshStatus.textContent='Mainnet remains inactive. No deployed policy is configured, so no chain ownership request was made.';
      return;
    }
    refreshStatus.textContent='Checking the ownership record and all three cards…';
    const snapshot=await reader.snapshot();
    document.querySelector('#chain-status').textContent=snapshot.active?'3 / 3 ISSUED':'NOT ISSUED';
    document.querySelector('#chain-note').textContent=snapshot.active?`${snapshot.holders} confirmed owner${snapshot.holders===1?'':'s'} · record revision ${snapshot.revision} · at least 3 confirmations. Last checked ${new Date().toLocaleTimeString()}.`:'The ownership record exists. Issuance has not been confirmed.';
    document.querySelectorAll('.owner strong').forEach((n,i)=>{
      if (!snapshot.active) {n.textContent='Not issued';return;}
      const a=document.createElement('a');a.href=`https://cardanoscan.io/address/${snapshot.cards[i].address}`;a.textContent=short(snapshot.owners[i]);a.title=snapshot.cards[i].address;n.replaceChildren(a);
    });
    document.querySelector('#transfer-count').textContent=String(snapshot.transfers??0);
    await history(true);
    refreshStatus.textContent='Confirmed chain data loaded. Ownership changes only after a confirmed transaction.';
  } catch(e) { unavailable(errorText(e)); refreshStatus.textContent=errorText(e); }
  finally { busy=false; document.querySelector('#refresh').disabled=false; }
}
document.querySelector('#refresh').addEventListener('click',refresh);
document.querySelector('#more-history').addEventListener('click',async e=>{
  e.target.disabled=true;
  try { await history(); } catch(error) {refreshStatus.textContent=errorText(error);}
  finally {e.target.disabled=false;}
});
refresh();
