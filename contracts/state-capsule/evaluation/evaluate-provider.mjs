/** Read-only Blockfrost/Ogmios evaluation of a fully synthetic unsigned capsule.
 * No keys, signing, real UTxOs, submissions, services or production hosts.
 * BLOCKFROST_PROJECT_ID_FILE names an existing API credential file; contents never logged.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { buildDatum } from '../scripts/capsule-codec.mjs';
import { prepareUnsignedCapsuleMint } from '../scripts/unsigned-mint.mjs';

const base = new URL('./', import.meta.url);
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const write = (name, value) => fs.writeFileSync(new URL(name, base), JSON.stringify(value, null, 2) + '\n');
const get = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Public data HTTP ${response.status}.`);
  return response.json();
};
const [tips, epochs] = await Promise.all([
  get('https://koios.beacn.workers.dev/api/v1/tip'),
  get('https://koios.beacn.workers.dev/api/v1/epoch_params?limit=1&order=epoch_no.desc'),
]);
const tip = tips[0], parameters = epochs[0];
if (tip.epoch_no !== parameters.epoch_no || Math.abs(Date.now() / 1000 - tip.block_time) > 600) throw new Error('Stale or inconsistent public chain parameters.');
const bn = n => CSL.BigNum.from_str(String(n));
// Public synthetic credential. No corresponding private key is used or needed.
const address = CSL.EnterpriseAddress.new(1, CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex('bb'.repeat(28)))).to_address();
function utxo(transactionId, lovelace) {
  return CSL.TransactionUnspentOutput.new(CSL.TransactionInput.new(CSL.TransactionHash.from_hex(transactionId), 0), CSL.TransactionOutput.new(address, CSL.Value.new(bn(lovelace))));
}
const seed = utxo('11'.repeat(32), 50_000_000), collateral = utxo('22'.repeat(32), 10_000_000);
const state = buildDatum({ metadata: { name: 'BEACN State Capsule', image: 'data:image/svg+xml,<svg/>' } });
const prepared = prepareUnsignedCapsuleMint({ appliedBlueprint: read('../fixtures/applied-demo.json'), baseName: 'CAPSULE', seed, collateral, state, parameters, validityStart: tip.abs_slot - 60, ttl: tip.abs_slot + 600, executionUnits: { memory: 4_000_000, cpu: 1_500_000_000 } });
const valid = CSL.Transaction.from_hex(prepared.unsignedCborHex);
if (valid.witness_set().vkeys()) throw new Error('Evaluation must remain unsigned.');
const invalidBody = CSL.TransactionBody.from_hex(valid.body().to_hex());
invalidBody.set_required_signers(CSL.Ed25519KeyHashes.new());
const noSigner = CSL.Transaction.new(invalidBody, valid.witness_set(), valid.auxiliary_data());
const additionalUtxoSet = [seed, collateral].map(u => [
  { txId: u.input().transaction_id().to_hex(), index: u.input().index() },
  { address: u.output().address().to_bech32(), value: { coins: Number(u.output().amount().coin().to_str()), assets: {} } },
]);
const cases = [{ name: 'synthetic-pair-mint', expected: 'accept', cbor: prepared.unsignedCborHex }, { name: 'synthetic-pair-mint-missing-signer', expected: 'reject', cbor: noSigner.to_hex() }];
write('prepared-evaluation.json', { schema: 'beacn.state-capsule.node-evaluation-preparation.v1', preparedAt: new Date().toISOString(), network: 'mainnet-parameters-with-synthetic-utxos', tip: { epoch: tip.epoch_no, slot: tip.abs_slot, blockTime: tip.block_time, hash: tip.hash }, scriptPolicyId: prepared.policyId, parameters, cases: cases.map(test => ({ ...test, bytes: test.cbor.length / 2, sha256: createHash('sha256').update(Buffer.from(test.cbor, 'hex')).digest('hex') })), additionalUtxoSet, warning: 'Unsigned synthetic inputs do not exist on Cardano. Evaluation only, never submit.' });
if (!process.argv.includes('--evaluate')) {
  console.log(JSON.stringify({ prepared: true, cases: cases.length, unsigned: true, synthetic: true }, null, 2));
  process.exit(0);
}
if (!process.env.BLOCKFROST_PROJECT_ID_FILE) throw new Error('Supply an existing Blockfrost API credential by path.');
const projectId = fs.readFileSync(process.env.BLOCKFROST_PROJECT_ID_FILE, 'utf8').trim();
if (!/^mainnet[A-Za-z0-9]+$/.test(projectId)) throw new Error('Expected existing mainnet Blockfrost credential.');
const results = [];
for (const test of cases) {
  const response = await fetch('https://cardano-mainnet.blockfrost.io/api/v0/utils/txs/evaluate/utxos?version=6', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', project_id: projectId },
    body: JSON.stringify({ cbor: test.cbor, additionalUtxoSet }),
  });
  const raw = (await response.text()).replaceAll(projectId, '[redacted]');
  let body; try { body = JSON.parse(raw); } catch { body = { nonJson: raw.slice(0, 2000) }; }
  const result = { name: test.name, expected: test.expected, httpStatus: response.status, response: body };
  results.push(result);
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) break; // A transport/schema/account rejection is not script evidence.
}
write('provider-response.json', { schema: 'beacn.state-capsule.provider-evaluation.v1', evaluatedAt: new Date().toISOString(), endpoint: 'https://cardano-mainnet.blockfrost.io/api/v0/utils/txs/evaluate/utxos?version=6', mode: 'unsigned-synthetic-additional-utxo-set', results, noSubmission: true, noSigningKeys: true });
