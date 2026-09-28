// This entry point reuses Studio's verified transaction and submission gates.
import { ada, loadCSL, readWallet, fetchProtocol, assertFreshReview,
  assertWalletUnchanged, mergeAndCheckSignatures, type WalletProvider } from '../lib/cardano';
import { verifyMintIntent } from '../lib/studio-intent';
import { buildStudioTransaction } from '../lib/studio-transaction';
import { submitTransactionOnce } from '../lib/studio-submission';
const EXPECTED_INTENT = '7f9aea098dd15db944f3cd0fec6073e15da72526da8445e912903be5eafccb09';
export async function prepare(provider: WalletProvider) {
  const api = await provider.enable();
  const response = await fetch('./intent.json', {cache: 'no-store'});
  if (!response.ok) throw Error('The NFT could not be loaded. Please try again.');
  const intent = await verifyMintIntent(await response.json());
  if (intent.intentHash !== EXPECTED_INTENT || intent.mode !== 'nft') throw Error('The artwork does not match this mint page.');
  const [C, wallet, protocol] = await Promise.all([loadCSL(), readWallet(api), fetchProtocol()]);
  const tx = await buildStudioTransaction(C, intent.bundle, 'nft', wallet, protocol);
  return {api, tx, intent, details: [
    ['NFT', intent.bundle.name], ['Quantity', '1'], ['Network fee', ada(tx.fee) + ' ADA'],
    ['ADA held with your NFT', ada(tx.minimumAda) + ' ADA'], ['Recipient', tx.address],
    ['Policy ID', tx.policyId!], ['Policy', 'Your wallet signs; minting window: 1 hour.'],
  ]};
}
export async function signAndSubmit(session: Awaited<ReturnType<typeof prepare>>, onAttempt: (hash: string) => void) {
  const {api, tx, intent} = session;
  const [C, live, wallet] = await Promise.all([loadCSL(), fetchProtocol(), readWallet(api)]);
  assertFreshReview(tx, live); assertWalletUnchanged(C, tx, wallet);
  await verifyMintIntent(intent);
  // Check durable coordination before asking for a signature.
  if (!navigator.locks?.request) throw Error('This wallet browser needs Web Locks support. Use a current compatible wallet browser.');
  const probe = 'nft-studio:showcase:storage-probe';
  localStorage.setItem(probe, '1');
  if (localStorage.getItem(probe) !== '1') throw Error('Enable browser storage before minting.');
  localStorage.removeItem(probe);
  const witness = await api.signTx(tx.unsignedHex, true);
  const [after, state] = await Promise.all([fetchProtocol(), readWallet(api)]);
  assertWalletUnchanged(C, tx, state);
  const signed = mergeAndCheckSignatures(C, tx, witness, after);
  onAttempt(signed.hash);
  const result = await submitTransactionOnce({hash: signed.hash, submit: () => api.submitTx(signed.hex)});
  return {hash: signed.hash, state: result.attempt.state};
}
