/** Experimental unsigned CIP-68 mint builder. No network, signing, or submission.
 * Inputs are real CSL objects supplied by the caller. Apply seed + base-name to the
 * blueprint first; the on-chain one-shot policy is the final binding of those values.
 */
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { assetNames, fromHex, verifyState } from './capsule-codec.mjs';

const check = (ok, message) => { if (!ok) throw new Error(message); };
const bn = value => CSL.BigNum.from_str(String(value));
const int = value => value < 0 ? CSL.Int.new_negative(bn(-value)) : CSL.Int.new(bn(value));
function fraction(value) {
  const text = String(value);
  check(/^\d+(?:\.\d+)?$/.test(text) && Number(value) > 0, 'Invalid execution price.');
  const [whole, decimal = ''] = text.split('.');
  return CSL.UnitInterval.new(bn(BigInt(whole + decimal)), bn(10n ** BigInt(decimal.length)));
}
function output(address, policy, name, datum, parameters) {
  const multi = CSL.MultiAsset.new(), tokens = CSL.Assets.new();
  tokens.insert(CSL.AssetName.new(fromHex(name)), bn(1)); multi.insert(policy, tokens);
  const value = CSL.Value.new(bn(3_000_000)); value.set_multiasset(multi);
  let result = CSL.TransactionOutput.new(address, value);
  if (datum) result.set_plutus_data(CSL.PlutusData.from_hex(datum.datumCborHex));
  const cost = CSL.DataCost.new_coins_per_byte(bn(parameters.coins_per_utxo_size));
  value.set_coin(CSL.min_ada_for_output(result, cost));
  result = CSL.TransactionOutput.new(address, value);
  if (datum) result.set_plutus_data(CSL.PlutusData.from_hex(datum.datumCborHex));
  check(BigInt(value.coin().to_str()) >= BigInt(CSL.min_ada_for_output(result, cost).to_str()), 'Minimum ADA did not stabilize.');
  return result;
}

export function prepareUnsignedCapsuleMint({ appliedBlueprint, baseName, seed, collateral, state, parameters, validityStart, ttl, executionUnits, collateralLovelace = 2_000_000 }) {
  const datum = verifyState(state);
  check(datum.sequence === 0 && !datum.frozen, 'Issuance requires an unfrozen genesis datum.');
  check(Number.isSafeInteger(validityStart) && Number.isSafeInteger(ttl) && validityStart >= 0 && ttl > validityStart && ttl - validityStart <= 3600, 'Invalid slot interval; caller must obtain current network slots.');
  check(seed.input().to_hex() !== collateral.input().to_hex(), 'Seed and collateral must be distinct UTxOs.');
  const owner = seed.output().address(), credential = owner.payment_cred(), keyHash = credential?.to_keyhash();
  check(keyHash, 'Seed must be controlled by a payment key.');
  check(collateral.output().address().to_hex() === owner.to_hex(), 'Collateral must use the seed holder address.');
  for (const item of [seed, collateral]) {
    check(!item.output().data_hash() && !item.output().plutus_data() && !item.output().script_ref(), 'Datum/reference-script UTxOs are excluded by this initial builder.');
  }
  check(!collateral.output().amount().multiasset(), 'Collateral must contain ADA only.');
  check(Number.isSafeInteger(collateralLovelace) && collateralLovelace > 0 && BigInt(collateralLovelace) < BigInt(collateral.output().amount().coin().to_str()), 'Collateral amount must leave a valid return.');
  const entries = appliedBlueprint.validators;
  check(Array.isArray(entries) && entries.length >= 2, 'Expected mint/spend blueprint entries.');
  const mint = entries.find(entry => entry.title.endsWith('.mint')), spend = entries.find(entry => entry.title.endsWith('.spend'));
  check(mint && spend && mint.compiledCode === spend.compiledCode && mint.hash === spend.hash, 'Mint/spend script identity mismatch.');
  check(entries.every(entry => !entry.parameters?.length), 'Apply every blueprint parameter first.');
  const script = CSL.PlutusScript.new_v3(fromHex(mint.compiledCode)), policy = script.hash();
  check(policy.to_hex() === mint.hash, 'Plutus V3 policy hash mismatch.');
  check(!seed.output().amount().multiasset()?.get(policy), 'Seed already contains this policy.');
  const names = assetNames(baseName), stateAddress = CSL.EnterpriseAddress.new(owner.network_id(), CSL.Credential.from_scripthash(policy)).to_address();
  for (const field of ['min_fee_a', 'min_fee_b', 'key_deposit', 'pool_deposit', 'max_val_size', 'max_tx_size', 'coins_per_utxo_size', 'max_tx_ex_mem', 'max_tx_ex_steps', 'collateral_percent']) check(Number.isFinite(Number(parameters[field])) && Number(parameters[field]) > 0, `Invalid protocol parameter ${field}.`);
  check(Number.isSafeInteger(executionUnits?.memory) && executionUnits.memory > 0 && executionUnits.memory <= Number(parameters.max_tx_ex_mem), 'Execution memory must be evaluated and within the current limit.');
  check(Number.isSafeInteger(executionUnits?.cpu) && executionUnits.cpu > 0 && executionUnits.cpu <= Number(parameters.max_tx_ex_steps), 'Execution CPU must be evaluated and within the current limit.');
  const config = CSL.TransactionBuilderConfigBuilder.new()
    .fee_algo(CSL.LinearFee.new(bn(parameters.min_fee_a), bn(parameters.min_fee_b)))
    .pool_deposit(bn(parameters.pool_deposit)).key_deposit(bn(parameters.key_deposit))
    .max_value_size(Number(parameters.max_val_size)).max_tx_size(Math.min(16_384, Number(parameters.max_tx_size)))
    .coins_per_utxo_byte(bn(parameters.coins_per_utxo_size))
    .ex_unit_prices(CSL.ExUnitPrices.new(fraction(parameters.price_mem), fraction(parameters.price_step)))
    .do_not_burn_extra_change(true).build();
  const builder = CSL.TransactionBuilder.new(config);
  builder.add_regular_input(owner, seed.input(), seed.output().amount());
  builder.add_required_signer(keyHash);
  builder.set_validity_start_interval_bignum(bn(validityStart)); builder.set_ttl_bignum(bn(ttl));
  const redeemer = CSL.Redeemer.new(CSL.RedeemerTag.new_mint(), bn(0), CSL.PlutusData.new_empty_constr_plutus_data(bn(0)), CSL.ExUnits.new(bn(executionUnits.memory), bn(executionUnits.cpu)));
  const mints = CSL.MintBuilder.new(), witness = CSL.MintWitness.new_plutus_script(CSL.PlutusScriptSource.new(script), redeemer);
  for (const name of [names.referenceAssetNameHex, names.userAssetNameHex]) mints.add_asset(witness, CSL.AssetName.new(fromHex(name)), int(1));
  builder.set_mint_builder(mints);
  const stateOutput = output(stateAddress, policy, names.referenceAssetNameHex, datum, parameters);
  const userOutput = output(owner, policy, names.userAssetNameHex, null, parameters);
  builder.add_output(stateOutput); builder.add_output(userOutput);
  const collateralInputs = CSL.TxInputsBuilder.new();
  collateralInputs.add_regular_input(owner, collateral.input(), collateral.output().amount());
  builder.set_collateral(collateralInputs); builder.set_total_collateral_and_return(bn(collateralLovelace), owner);
  const costModel = CSL.CostModel.new(), costs = CSL.Costmdls.new();
  check(Array.isArray(parameters.cost_models?.PlutusV3) && parameters.cost_models.PlutusV3.length > 0 && parameters.cost_models.PlutusV3.every(Number.isSafeInteger), 'Current Plutus V3 cost model is required.');
  parameters.cost_models.PlutusV3.forEach((value, index) => costModel.set(index, int(value)));
  costs.insert(CSL.Language.new_plutus_v3(), costModel);
  builder.calc_script_data_hash(costs); builder.add_change_if_needed(owner);
  const tx = builder.build_tx(), estimatedSignedBytes = builder.full_size();
  check(estimatedSignedBytes <= Math.min(16_384, Number(parameters.max_tx_size)), 'Estimated signed transaction exceeds the byte limit.');
  const fee = BigInt(tx.body().fee().to_str());
  check(fee <= 2_000_000n, 'Fee exceeds this experimental builder’s 2 ADA cap.');
  check(BigInt(collateralLovelace) * 100n >= fee * BigInt(parameters.collateral_percent), 'Insufficient collateral for the calculated fee.');
  return { unsignedCborHex: tx.to_hex(), transactionId: CSL.FixedTransaction.from_hex(tx.to_hex()).transaction_hash().to_hex(), policyId: policy.to_hex(), ...names, datumHash: datum.datumHash, datumBytes: datum.datumBytes, stateAddress: stateAddress.to_bech32(), recipient: owner.to_bech32(), feeLovelace: fee.toString(), stateLovelace: stateOutput.amount().coin().to_str(), userTokenLovelace: userOutput.amount().coin().to_str(), estimatedSignedBytes, requiredSigner: keyHash.to_hex(), seed: { transactionId: seed.input().transaction_id().to_hex(), outputIndex: seed.input().index() }, readiness: 'experimental-unsigned', requiredNextChecks: ['Verify applied blueprint was derived from this exact seed and base name.', 'Evaluate the complete transaction against fresh node state and protocol parameters.', 'Obtain explicit wallet approval; merge and verify witnesses.', 'Recheck input freshness, exact body, actual signed bytes, fee and collateral before any submission.'] };
}
