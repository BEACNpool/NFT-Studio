/** Full CSL transactions with ephemeral synthetic wallets. Never submits or calls a network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { blake2b } from '@noble/hashes/blake2.js';
import { assetNames, buildDatum, fromHex, toHex, transition } from './capsule-codec.mjs';
import { transactionContext, uplcData } from './compiled-context.mjs';
import { prepareUnsignedCapsuleMint } from './unsigned-mint.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../${name}`, import.meta.url)));
const blueprint = read('fixtures/applied-demo.json');
const protocol = read('fixtures/protocol-parameters.json').parameters;
const scriptHex = blueprint.validators[0].compiledCode;
for (const validator of blueprint.validators) {
  assert.equal(validator.compiledCode, scriptHex, 'Mint/spend code identity is load-bearing.');
  assert.equal(validator.parameters, undefined, 'All script parameters must be applied.');
}
const script = CSL.PlutusScript.new_v3(fromHex(scriptHex));
const policy = script.hash();
assert.equal(policy.to_hex(), blueprint.validators[0].hash);
assert.equal(toHex(blake2b(Uint8Array.from([3, ...fromHex(scriptHex)]), { dkLen: 28 })), policy.to_hex());
const names = assetNames('CAPSULE');
const bn = value => CSL.BigNum.from_str(String(value));
const int = value => value < 0 ? CSL.Int.new_negative(bn(-value)) : CSL.Int.new(bn(value));
const fraction = value => {
  const [whole, fraction = ''] = String(value).split('.');
  assert(!String(value).includes('e'));
  return CSL.UnitInterval.new(bn(BigInt(whole + fraction)), bn(10n ** BigInt(fraction.length)));
};
const costs = CSL.Costmdls.new(), model = CSL.CostModel.new();
protocol.cost_models.PlutusV3.forEach((value, i) => model.set(i, int(value)));
costs.insert(CSL.Language.new_plutus_v3(), model);
assert(protocol.cost_models.PlutusV3.some(value => value < 0));
assert.equal(JSON.parse(model.to_json()).filter(value => value < 0).length, protocol.cost_models.PlutusV3.filter(value => value < 0).length);

// Generated in memory. No secret file is read, logged, exported or retained.
const key = CSL.PrivateKey.generate_ed25519(), publicKey = key.to_public(), keyHash = publicKey.hash();
const owner = CSL.EnterpriseAddress.new(0, CSL.Credential.from_keyhash(keyHash)).to_address();
const stateAddress = CSL.EnterpriseAddress.new(0, CSL.Credential.from_scripthash(policy)).to_address();
const seedRef = CSL.TransactionInput.new(CSL.TransactionHash.from_hex('11'.repeat(32)), 0);
const collateralRef = CSL.TransactionInput.new(CSL.TransactionHash.from_hex('22'.repeat(32)), 0);
const budget = { memory: 4_000_000, cpu: 1_500_000_000 };
const minimum = output => CSL.min_ada_for_output(output, CSL.DataCost.new_coins_per_byte(bn(protocol.coins_per_utxo_size)));
const assetValue = (name, ada = 3_000_000) => {
  const multi = CSL.MultiAsset.new(), assets = CSL.Assets.new();
  assets.insert(CSL.AssetName.new(fromHex(name)), bn(1)); multi.insert(policy, assets);
  const value = CSL.Value.new(bn(ada)); value.set_multiasset(multi); return value;
};
function tokenOutput(name, address, state, atLeast = 0) {
  let output = CSL.TransactionOutput.new(address, assetValue(name));
  if (state) output.set_plutus_data(CSL.PlutusData.from_hex(state.datumCborHex));
  const amount = Math.max(Number(minimum(output).to_str()), atLeast);
  output = CSL.TransactionOutput.new(address, assetValue(name, amount));
  if (state) output.set_plutus_data(CSL.PlutusData.from_hex(state.datumCborHex));
  assert(BigInt(output.amount().coin().to_str()) >= BigInt(minimum(output).to_str()));
  return output;
}
function builder() {
  const config = CSL.TransactionBuilderConfigBuilder.new()
    .fee_algo(CSL.LinearFee.new(bn(protocol.min_fee_a), bn(protocol.min_fee_b)))
    .pool_deposit(bn(protocol.pool_deposit)).key_deposit(bn(protocol.key_deposit))
    .max_value_size(protocol.max_val_size).max_tx_size(protocol.max_tx_size)
    .coins_per_utxo_byte(bn(protocol.coins_per_utxo_size))
    .ex_unit_prices(CSL.ExUnitPrices.new(fraction(protocol.price_mem), fraction(protocol.price_step)))
    .do_not_burn_extra_change(true).build();
  const tx = CSL.TransactionBuilder.new(config);
  tx.add_required_signer(keyHash);
  tx.set_validity_start_interval_bignum(bn(1000)); tx.set_ttl_bignum(bn(2000));
  const collateral = CSL.TxInputsBuilder.new();
  collateral.add_regular_input(owner, collateralRef, CSL.Value.new(bn(10_000_000)));
  tx.set_collateral(collateral);
  tx.set_total_collateral_and_return(bn(2_000_000), owner);
  return tx;
}
function redeemer(tag, index, action = 0) {
  return CSL.Redeemer.new(tag, bn(index), CSL.PlutusData.new_empty_constr_plutus_data(bn(action)), CSL.ExUnits.new(bn(budget.memory), bn(budget.cpu)));
}
function finish(builder, inputs, minted, resolvedInputs) {
  builder.calc_script_data_hash(costs); builder.add_change_if_needed(owner);
  const unsigned = builder.build_tx();
  const transaction = CSL.FixedTransaction.from_hex(unsigned.to_hex());
  transaction.add_vkey_witness(CSL.make_vkey_witness(transaction.transaction_hash(), key));
  const parsed = CSL.Transaction.from_hex(transaction.to_hex());
  const body = parsed.body(), witnesses = parsed.witness_set();
  assert.equal(witnesses.vkeys().len(), 1);
  assert(publicKey.verify(transaction.transaction_hash().to_bytes(), witnesses.vkeys().get(0).signature()));
  assert.equal(witnesses.plutus_scripts().len(), 1, 'Wallet witness merge must retain script.');
  assert.equal(witnesses.redeemers().len(), 1);
  assert.equal(body.required_signers().get(0).to_hex(), keyHash.to_hex());
  assert.equal(body.script_data_hash().to_hex(), CSL.hash_script_data(witnesses.redeemers(), costs, witnesses.plutus_data()).to_hex());
  let totalIn = CSL.Value.zero(); for (const value of inputs) totalIn = totalIn.checked_add(value);
  let totalOut = CSL.Value.new(body.fee()); for (let i = 0; i < body.outputs().len(); i++) totalOut = totalOut.checked_add(body.outputs().get(i).amount());
  if (minted) totalIn = totalIn.checked_add(minted);
  assert.equal(totalIn.to_hex(), totalOut.to_hex(), 'Complete ADA/native asset conservation.');
  const signedBytes = transaction.to_bytes().length;
  assert(signedBytes <= Math.min(protocol.max_tx_size, 16_384));
  const minFee = CSL.min_fee(parsed, CSL.LinearFee.new(bn(protocol.min_fee_a), bn(protocol.min_fee_b))).checked_add(CSL.min_script_fee(parsed, CSL.ExUnitPrices.new(fraction(protocol.price_mem), fraction(protocol.price_step))));
  assert(BigInt(body.fee().to_str()) >= BigInt(minFee.to_str()), 'Actual complete signed fee is sufficient.');
  assert(BigInt(body.total_collateral().to_str()) * 100n >= BigInt(body.fee().to_str()) * BigInt(protocol.collateral_percent));
  return { parsed, transaction, resolvedInputs, summary: { signedBytes, feeLovelace: body.fee().to_str(), declaredExecutionBudget: budget, outputCount: body.outputs().len(), scriptWitnesses: witnesses.plutus_scripts().len(), keyWitnesses: witnesses.vkeys().len(), collateralLovelace: body.total_collateral().to_str(), collateralReturnedLovelace: body.collateral_return().amount().coin().to_str() } };
}
function mint(state) {
  const tx = builder(), seedValue = CSL.Value.new(bn(50_000_000));
  tx.add_regular_input(owner, seedRef, seedValue);
  const mints = CSL.MintBuilder.new(), witness = CSL.MintWitness.new_plutus_script(CSL.PlutusScriptSource.new(script), redeemer(CSL.RedeemerTag.new_mint(), 0));
  for (const name of [names.referenceAssetNameHex, names.userAssetNameHex]) mints.add_asset(witness, CSL.AssetName.new(fromHex(name)), int(1));
  tx.set_mint_builder(mints);
  tx.add_output(tokenOutput(names.referenceAssetNameHex, stateAddress, state));
  tx.add_output(tokenOutput(names.userAssetNameHex, owner));
  const minted = assetValue(names.referenceAssetNameHex, 0).checked_add(assetValue(names.userAssetNameHex, 0));
  return finish(tx, [seedValue], minted, [{ input: seedRef, output: CSL.TransactionOutput.new(owner, seedValue) }]);
}
function spend(previous, state, action) {
  const tx = builder(), sourceBody = previous.parsed.body(), sourceId = previous.transaction.transaction_hash();
  const stateInput = CSL.TransactionInput.new(sourceId, 0), holderInput = CSL.TransactionInput.new(sourceId, 1);
  const stateOutput = sourceBody.outputs().get(0), holderOutput = sourceBody.outputs().get(1);
  const fundingInput = CSL.TransactionInput.new(CSL.TransactionHash.from_hex('33'.repeat(32)), 0), fundingValue = CSL.Value.new(bn(50_000_000));
  const witness = CSL.PlutusWitness.new_without_datum(script, redeemer(CSL.RedeemerTag.new_spend(), 0, action));
  tx.add_plutus_script_input(witness, stateInput, stateOutput.amount());
  tx.add_regular_input(owner, holderInput, holderOutput.amount());
  tx.add_regular_input(owner, fundingInput, fundingValue);
  tx.add_output(tokenOutput(names.referenceAssetNameHex, stateAddress, state, Number(stateOutput.amount().coin().to_str())));
  tx.add_output(tokenOutput(names.userAssetNameHex, owner));
  const result = finish(tx, [stateOutput.amount(), holderOutput.amount(), fundingValue], undefined, [{ input: stateInput, output: stateOutput }, { input: holderInput, output: holderOutput }, { input: fundingInput, output: CSL.TransactionOutput.new(owner, fundingValue) }]);
  const inputs = result.parsed.body().inputs(); let stateIndex = -1;
  for (let i = 0; i < inputs.len(); i++) if (inputs.get(i).to_hex() === stateInput.to_hex()) stateIndex = i;
  assert.equal(Number(result.parsed.witness_set().redeemers().get(0).index().to_str()), stateIndex, 'CSL must reindex spend redeemer to sorted input position.');
  return result;
}
const small = buildDatum({ metadata: { name: 'BEACN State Capsule', image: 'data:image/svg+xml,<svg/>' } });
const changed = transition(small, { metadata: { name: 'BEACN State Capsule', image: 'data:image/svg+xml,<svg><text>EVOLVED</text></svg>' } });
const frozen = transition(changed, { action: 'freeze' });
const issued = mint(small), evolved = spend(issued, changed, 0), sealed = spend(evolved, frozen, 1);
const mintArguments = { appliedBlueprint: blueprint, baseName: 'CAPSULE', seed: CSL.TransactionUnspentOutput.new(seedRef, CSL.TransactionOutput.new(owner, CSL.Value.new(bn(50_000_000)))), collateral: CSL.TransactionUnspentOutput.new(collateralRef, CSL.TransactionOutput.new(owner, CSL.Value.new(bn(10_000_000)))), state: small, parameters: protocol, validityStart: 1000, ttl: 2000, executionUnits: budget };
const prepared = prepareUnsignedCapsuleMint(mintArguments);
assert.equal(prepared.transactionId, issued.transaction.transaction_hash().to_hex(), 'Reusable unsigned builder matches independently assembled full transaction body.');
assert.equal(prepared.estimatedSignedBytes, issued.summary.signedBytes);
assert.equal(CSL.Transaction.from_hex(prepared.unsignedCborHex).witness_set().vkeys(), undefined, 'Reusable builder must never sign.');
const builderRejections = [
  () => prepareUnsignedCapsuleMint({ ...mintArguments, collateral: mintArguments.seed }),
  () => prepareUnsignedCapsuleMint({ ...mintArguments, ttl: 1000 }),
  () => prepareUnsignedCapsuleMint({ ...mintArguments, executionUnits: { memory: 0, cpu: 1 } }),
  () => prepareUnsignedCapsuleMint({ ...mintArguments, executionUnits: { memory: 999999999, cpu: 1 } }),
  () => prepareUnsignedCapsuleMint({ ...mintArguments, state: frozen }),
  () => prepareUnsignedCapsuleMint({ ...mintArguments, appliedBlueprint: read('plutus.json') }),
  () => prepareUnsignedCapsuleMint({ ...mintArguments, collateralLovelace: 1 }),
  () => prepareUnsignedCapsuleMint({ ...mintArguments, parameters: { ...protocol, cost_models: {} } }),
];
for (const reject of builderRejections) assert.throws(reject);
const large = buildDatum({ metadata: { name: 'BEACN State Capsule', image: 'data:image/svg+xml,' + 'x'.repeat(3000), description: 'x'.repeat(500) } });
const largeIssue = mint(large), largeEvolve = spend(largeIssue, transition(large), 0);
const report = { schema: 'beacn.state-capsule.transaction-verification.v1', status: 'pass', network: 'synthetic-testnet', parameterEpoch: protocol.epoch_no, policyId: policy.to_hex(), scriptBytes: scriptHex.length / 2, smallDatumBytes: small.datumBytes, largeDatumBytes: large.datumBytes, transactions: { mint: issued.summary, evolve: evolved.summary, freeze: sealed.summary, largeMint: largeIssue.summary, largeEvolve: largeEvolve.summary }, checks: ['Plutus V3 hash parity', 'mint/spend script identity', 'all parameters applied', 'negative cost-model values preserved', 'CIP-68 inline datum', 'one reference and one user token', 'wallet signature verification', 'script witness retained after wallet merge', 'script-data hash', 'complete input/mint/output/fee conservation', 'min ADA per output', 'full signed transaction size', 'full signed fee including Plutus budget', 'distinct collateral and return', 'required signer', 'spend redeemer reindexing'], limitation: 'Synthetic signed serialization only. No ledger phase-1 check, node execution, real wallet, submission or chain confirmation. Fixed fixture slot interval is intentionally expired; ephemeral key discarded.' };
report.unsignedBuilder = { exactBodyParity: true, noSignatures: true, rejectionCases: builderRejections.length };
if (process.argv.includes('--uplc')) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-uplc-'));
  const scriptFile = path.join(temp, 'script.cbor'); fs.writeFileSync(scriptFile, scriptHex);
  const results = [];
  function evaluate(title, context, mustPass) {
    const result = spawnSync(process.env.AIKEN_BIN ?? 'aiken', ['uplc', 'eval', '-c', scriptFile, `(con data (${uplcData(context)}))`], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
    const output = result.stdout + result.stderr;
    const passed = result.status === 0 && /\(con unit \(\)\)/.test(output);
    assert.equal(passed, mustPass, `${title}: unexpected compiled wrapper result\n${output}`);
    const cpu = Number(output.match(/"?cpu"?:\s*(\d+)/)?.[1]), memory = Number(output.match(/"?(?:memory|mem)"?:\s*(\d+)/)?.[1]);
    assert(Number.isSafeInteger(cpu) && Number.isSafeInteger(memory), `${title}: evaluator costs missing\n${output}`);
    results.push({ title, expected: mustPass ? 'accept' : 'reject', status: 'pass', cpu, memory });
  }
  for (const [title, fixture] of Object.entries({ mint: issued, evolve: evolved, freeze: sealed, largeMint: largeIssue, largeEvolve })) evaluate(title, transactionContext(fixture, policy.to_hex()), true);
  const missingSigner = transactionContext(evolved, policy.to_hex()); missingSigner.fields[0].fields[8] = { list: [] };
  evaluate('missing holder signer', missingSigner, false);
  const referenceOnly = transactionContext(evolved, policy.to_hex());
  const spent = referenceOnly.fields[0].fields[0].list;
  const heldIndex = spent.findIndex(input => JSON.stringify(input).includes(names.userAssetNameHex));
  referenceOnly.fields[0].fields[1].list.push(...spent.splice(heldIndex, 1));
  evaluate('reference-only holder', referenceOnly, false);
  const wrongAction = transactionContext(evolved, policy.to_hex()); wrongAction.fields[1] = { constructor: 9, fields: [] };
  evaluate('unknown redeemer constructor', wrongAction, false);
  const wrongPurpose = transactionContext(issued, policy.to_hex()); wrongPurpose.fields[2] = { constructor: 2, fields: [{ constructor: 0, fields: [{ bytes: keyHash.to_hex() }] }] };
  evaluate('unsupported withdrawal purpose', wrongPurpose, false);
  const wrongPolicy = transactionContext(issued, policy.to_hex()); wrongPolicy.fields[2].fields[0] = { bytes: '44'.repeat(28) };
  evaluate('wrong minting policy identity', wrongPolicy, false);
  const omittedField = transactionContext(issued, policy.to_hex()); omittedField.fields.pop();
  evaluate('malformed script context', omittedField, false);
  report.compiledWrapper = { evaluator: 'aiken uplc eval (offline CEK evaluator; local cost model)', results, passed: results.length, limitation: 'The supported CSL fixtures supply every resolved input/output. Synthetic POSIX interval replaces network slot mapping; no ledger phase-1 validation or independent node evaluation.' };
  fs.unlinkSync(scriptFile); fs.rmdirSync(temp);
}
if (process.argv.includes('--write')) fs.writeFileSync(fileURLToPath(new URL('../fixtures/transaction-verification.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
key.free();
console.log(JSON.stringify(report, null, 2));
