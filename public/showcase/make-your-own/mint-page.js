const art = document.querySelector('#art');
const message = document.querySelector('#browser-message');
const dialog = document.querySelector('#mint-dialog');
const status = document.querySelector('#status');
const choices = document.querySelector('#wallets');
const review = document.querySelector('#review');
const approve = document.querySelector('#approve');
const transaction = document.querySelector('#transaction');
let busy = false, session, engine, attempted = false;
const receiptKey = 'nft-studio:showcase:make-your-own:last-attempt';
function wallets() {
  return Object.values(window.cardano || {}).filter(p => p &&
    typeof p.enable === 'function' && typeof p.name === 'string' && typeof p.apiVersion === 'string');
}
function detect() { message.hidden = wallets().length > 0; }
detect();
// Wallet browsers can inject their bridge after the document has loaded.
setInterval(detect, 1000);
window.addEventListener('focus', detect);
document.addEventListener('visibilitychange', detect);
document.querySelector('#close').onclick = () => { if (!busy) dialog.close(); };
dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
function fail(error) {
  status.textContent = error?.message || error?.info || 'The wallet could not complete this request. Close and try again.';
}
async function connect(provider) {
  if (busy) return;
  busy = true; choices.replaceChildren(); review.hidden = true; approve.hidden = true;
  status.textContent = 'Connect your wallet to prepare your NFT…';
  try {
    engine ||= await import('./mint-engine.js');
    session = await engine.prepare(provider);
    review.replaceChildren();
    for (const [label, value] of session.details) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; review.append(dt, dd);
    }
    review.hidden = false; approve.hidden = false;
    status.textContent = 'One NFT goes to your wallet. Only the network fee is spent; the minimum ADA stays with your NFT. Review the transaction in your wallet before signing.';
  } catch (error) { fail(error); }
  finally { busy = false; }
}
art.onclick = () => {
  if (busy) return;
  const available = wallets(); detect();
  if (!available.length) return;
  dialog.showModal();
  if (attempted) return;
  try {
    const previous = localStorage.getItem(receiptKey);
    if (previous && /^[a-f0-9]{64}$/.test(previous)) {
      attempted = true;
      transaction.href = 'https://cardanoscan.io/transaction/' + previous;
      transaction.hidden = false;
      status.textContent = 'You already attempted this mint. Check its transaction status before creating another copy.';
      return;
    }
  } catch { /* The engine checks storage before signing. */ }
  session = undefined; review.hidden = true; approve.hidden = true;
  choices.replaceChildren();
  if (available.length === 1) { void connect(available[0]); return; }
  status.textContent = 'Choose your wallet.';
  for (const provider of available) {
    const button = document.createElement('button');
    button.textContent = provider.name; button.onclick = () => connect(provider); choices.append(button);
  }
};
approve.onclick = async () => {
  if (busy || !session || attempted) return;
  busy = true; approve.disabled = true;
  status.textContent = 'Review and approve in your wallet…';
  try {
    const result = await engine.signAndSubmit(session, hash => {
      localStorage.setItem(receiptKey, hash);
      attempted = true;
      transaction.href = 'https://cardanoscan.io/transaction/' + hash;
      transaction.hidden = false;
    });
    approve.hidden = true;
    transaction.href = 'https://cardanoscan.io/transaction/' + result.hash;
    transaction.hidden = false;
    status.textContent = result.state === 'submitted'
      ? 'Transaction submitted. Your NFT will arrive after confirmation.'
      : 'Submission status is uncertain. Check your transaction before trying another mint.';
  } catch (error) { fail(error); if (attempted) approve.hidden = true; }
  finally { busy = false; approve.disabled = false; }
};
