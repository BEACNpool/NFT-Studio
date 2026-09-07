/** Read-only actual-node evaluation against current PUBLIC UTxOs. No signing/submission.
 * Selects a publicly discoverable holder of the historical BYTTG policy; input details,
 * addresses and unsigned CBOR stay in memory. Only sanitized execution receipts are saved.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { buildDatum, serialiseData, toHex } from '../scripts/capsule-codec.mjs';
import { buildEvaluationMint } from './build-evaluation.mjs';

if (!process.env.BLOCKFROST_PROJECT_ID_FILE) throw new Error('Supply the existing API credential path.');
const projectId = fs.readFileSync(process.env.BLOCKFROST_PROJECT_ID_FILE, 'utf8').trim();
if (!/^mainnet[A-Za-z0-9]+$/.test(projectId)) throw new Error('Expected existing mainnet Blockfrost credential.');
const publicBase = 'https://koios.beacn.workers.dev/api/v1';
const providerBase = 'https://cardano-mainnet.blockfrost.io/api/v0';
const endpoint = providerBase + '/utils/txs/evaluate?version=6';
const discoveryPolicy = '2ef849a4e7742f0705f41c7b2195bb828b934ee48dcfa0c204ae2a8d';
async function get(url, authenticated = false) {
  assert(!authenticated || url.startsWith(providerBase + '/addresses/'));
  const response = await fetch(url, { headers: authenticated ? { project_id: projectId } : {}, signal: AbortSignal.timeout(20_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Public UTxO lookup HTTP ${response.status}.`);
  return response.json();
}
const [tips, epochs, assets] = await Promise.all([
  get(publicBase + '/tip'),
  get(publicBase + '/epoch_params?limit=1&order=epoch_no.desc'),
  get(publicBase + '/policy_asset_list?_asset_policy=' + discoveryPolicy),
]);
const tip = tips[0], parameters = epochs[0];
assert(tip.epoch_no === parameters.epoch_no && Math.abs(Date.now() / 1000 - tip.block_time) <= 600, 'Fresh matching tip/parameters required.');
const seen = new Set(); let selected;
for (const asset of assets.slice(0, 6)) {
  const holders = await get(`${publicBase}/asset_addresses?_asset_policy=${discoveryPolicy}&_asset_name=${asset.asset_name}`);
  const address = holders[0]?.payment_address;
  if (!address || seen.has(address)) continue;
  seen.add(address);
  const parsed = CSL.Address.from_bech32(address);
  if (!parsed.payment_cred()?.to_keyhash()) continue;
  const utxos = await get(`${providerBase}/addresses/${address}/utxos?count=100`, true);
  const ordinary = utxos.filter(u => !u.data_hash && !u.inline_datum && !u.reference_script_hash);
  const lovelace = u => Number(u.amount.find(a => a.unit === 'lovelace')?.quantity ?? 0);
  const collateral = ordinary.find(u => u.amount.length === 1 && lovelace(u) >= 5_000_000);
  const seed = ordinary.find(u => u !== collateral && lovelace(u) >= 10_000_000);
  if (collateral && seed) { selected = { address, parsed, seed, collateral, funding: ordinary.filter(u => u !== seed && u !== collateral).slice(0, 6) }; break; }
}
assert(selected, 'No suitable public seed/collateral pair in the bounded discovery set.');
const bn = value => CSL.BigNum.from_str(String(value));
function toUtxo(u) {
  const value = CSL.Value.new(bn(u.amount.find(a => a.unit === 'lovelace').quantity)), multi = CSL.MultiAsset.new();
  for (const token of u.amount.filter(a => a.unit !== 'lovelace')) {
    const policy = CSL.ScriptHash.from_hex(token.unit.slice(0, 56)), name = CSL.AssetName.new(Buffer.from(token.unit.slice(56), 'hex'));
    const tokens = multi.get(policy) ?? CSL.Assets.new(); tokens.insert(name, bn(token.quantity)); multi.insert(policy, tokens);
  }
  if (multi.len()) value.set_multiasset(multi);
  return CSL.TransactionUnspentOutput.new(CSL.TransactionInput.new(CSL.TransactionHash.from_hex(u.tx_hash), u.output_index), CSL.TransactionOutput.new(selected.parsed, value));
}
const seed = toUtxo(selected.seed), collateral = toUtxo(selected.collateral);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-node-eval-'));
try {
const baseName = 'CapsuleEval20260907';
const blueprintSource = new URL('../plutus.json', import.meta.url);
const seedCbor = toHex(serialiseData({ constructor: 0, fields: [{ bytes: seed.input().transaction_id().to_hex() }, { int: seed.input().index() }] }));
const nameCbor = toHex(serialiseData({ bytes: Buffer.from(baseName).toString('hex') }));
function apply(input, output, parameter) {
  const result = spawnSync(process.env.AIKEN_BIN ?? 'aiken', ['blueprint', 'apply', '-i', input, '-o', output, parameter], { encoding: 'utf8', timeout: 30_000 });
  if (result.status !== 0) throw new Error('Local Aiken parameter application failed.');
}
apply(blueprintSource.pathname, path.join(temp, 'seed.json'), seedCbor);
apply(path.join(temp, 'seed.json'), path.join(temp, 'applied.json'), nameCbor);
const appliedBlueprint = JSON.parse(fs.readFileSync(path.join(temp, 'applied.json')));
const state = buildDatum({ metadata: { name: 'BEACN Capsule Evaluation', image: 'data:image/svg+xml,<svg/>' } });
const prepared = buildEvaluationMint({ appliedBlueprint, baseName, seed, collateral, funding: selected.funding.map(toUtxo), state, parameters, validityStart: tip.abs_slot - 60, ttl: tip.abs_slot + 600 });
const valid = CSL.Transaction.from_hex(prepared.unsignedCborHex);
assert(!valid.witness_set().vkeys(), 'There must be no key witnesses.');
function mutation(mutator) {
  const body = CSL.TransactionBody.from_hex(valid.body().to_hex()); mutator(body);
  return CSL.Transaction.new(body, valid.witness_set(), valid.auxiliary_data()).to_hex();
}
const cases = [
  { name: 'current-public-seed-pair-mint', expected: 'accept', cbor: prepared.unsignedCborHex },
  { name: 'current-public-seed-missing-required-signer', expected: 'reject', cbor: mutation(body => body.set_required_signers(CSL.Ed25519KeyHashes.new())) },
  { name: 'current-public-seed-reference-only', expected: 'reject', cbor: '' },
];
// The reference-only mutation needs to replace the full transaction body explicitly.
{
  const body = CSL.TransactionBody.from_hex(valid.body().to_hex()), refs = CSL.TransactionInputs.new(); refs.add(seed.input()); body.set_reference_inputs(refs);
  const json = JSON.parse(body.to_json()); json.inputs = json.inputs.filter(input => input.transaction_id !== seed.input().transaction_id().to_hex() || input.index !== seed.input().index());
  cases[2].cbor = CSL.Transaction.new(CSL.TransactionBody.from_json(JSON.stringify(json)), valid.witness_set(), valid.auxiliary_data()).to_hex();
}
const results = [];
for (const test of cases) {
  const response = await fetch(endpoint, { method: 'POST', headers: { project_id: projectId, 'Content-Type': 'application/cbor' }, body: test.cbor, signal: AbortSignal.timeout(30_000), redirect: 'error' });
  const raw = (await response.text()).replaceAll(projectId, '[redacted]');
  let body; try { body = JSON.parse(raw); } catch { body = { unexpectedNonJson: raw.slice(0, 1000) }; }
  const budget = Array.isArray(body.result) ? body.result.find(r => r.validator?.purpose === 'mint' && r.validator.index === 0)?.budget : null;
  const accepted = response.ok && budget && Number.isFinite(budget.memory) && Number.isFinite(budget.cpu);
  const scriptFailures = body.error?.code === 3010 && Array.isArray(body.error.data) && body.error.data.some(item => item.error?.code === 3012);
  const status = test.expected === 'accept' ? accepted ? 'pass' : 'inconclusive' : scriptFailures ? 'pass' : accepted ? 'FAIL' : 'inconclusive';
  const result = { name: test.name, expected: test.expected, status, unsignedBytes: test.cbor.length / 2, unsignedSha256: createHash('sha256').update(Buffer.from(test.cbor, 'hex')).digest('hex'), httpStatus: response.status, response: body };
  results.push(result); console.log(JSON.stringify(result, null, 2));
  if (!response.ok || (test.expected === 'accept' && !accepted)) break;
}
const report = { schema: 'beacn.state-capsule.independent-node-evaluation.v1', evaluatedAt: new Date().toISOString(), endpoint, scope: 'unsigned-transaction-with-current-public-chain-utxos', parameterEpoch: parameters.epoch_no, tipSlot: tip.abs_slot, inputCount: prepared.inputCount, preservedExistingAssetPolicies: prepared.preservedExistingAssetPolicies, feeLovelace: prepared.feeLovelace, scriptPolicyId: prepared.policyId, appliedScriptBytes: appliedBlueprint.validators[0].compiledCode.length / 2, datumBytes: state.datumBytes, estimatedSignedBytes: prepared.estimatedSignedBytes, results, noSubmission: true, noSigningKeyMaterial: true, includesRealCurrentUtxos: true, includesSyntheticAdditionalUtxos: false, limitations: ['No key signatures were created or supplied.', 'Evaluation does not perform all ledger phase-1 checks or guarantee submission acceptance.', 'No capsule exists on-chain because this transaction was never submitted.', 'Only issuance can use real current UTxOs before a capsule is minted; evolution/freeze remain locally executed fixtures.', 'Public holder addresses, balances, exact UTxOs and unsigned CBOR are deliberately omitted from this shareable receipt.'] };
fs.writeFileSync(new URL('public-utxo-node-evaluation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
assert(results.length === cases.length && results.every(r => r.status === 'pass'), 'Independent evaluation has unresolved failures; inspect sanitized receipt.');

} finally {
  for (const name of ['seed.json', 'applied.json']) if (fs.existsSync(path.join(temp, name))) fs.unlinkSync(path.join(temp, name));
  fs.rmdirSync(temp);
}
