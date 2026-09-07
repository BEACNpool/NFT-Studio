/** Evaluation-only extension: additional ordinary inputs preserve crowded public wallets. */
import assert from 'node:assert/strict';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { assetNames, verifyState } from '../scripts/capsule-codec.mjs';

export function buildEvaluationMint({ appliedBlueprint, baseName, seed, collateral, funding, state, parameters: p, validityStart, ttl }) {
  const datum = verifyState(state), owner = seed.output().address(), key = owner.payment_cred().to_keyhash();
  assert(key && datum.sequence === 0 && !datum.frozen);
  const v = appliedBlueprint.validators[0];
  assert(appliedBlueprint.validators.every(x => x.compiledCode === v.compiledCode && !x.parameters?.length));
  const script = CSL.PlutusScript.new_v3(Buffer.from(v.compiledCode, 'hex')), policy = script.hash();
  assert.equal(policy.to_hex(), v.hash);
  const bn = n => CSL.BigNum.from_str(String(n));
  const int = n => n < 0 ? CSL.Int.new_negative(bn(-n)) : CSL.Int.new(bn(n));
  const ratio = number => {
    const [integer, decimals = ''] = String(number).split('.');
    return CSL.UnitInterval.new(bn(integer + decimals), bn(10n ** BigInt(decimals.length)));
  };
  const cfg = CSL.TransactionBuilderConfigBuilder.new().fee_algo(CSL.LinearFee.new(bn(p.min_fee_a), bn(p.min_fee_b)))
    .pool_deposit(bn(p.pool_deposit)).key_deposit(bn(p.key_deposit)).max_value_size(p.max_val_size).max_tx_size(Math.min(16384, p.max_tx_size))
    .coins_per_utxo_byte(bn(p.coins_per_utxo_size)).ex_unit_prices(CSL.ExUnitPrices.new(ratio(p.price_mem), ratio(p.price_step))).do_not_burn_extra_change(true).build();
  const builder = CSL.TransactionBuilder.new(cfg), spend = [seed, ...funding], outrefs = new Set();
  let inputValue = CSL.Value.zero();
  for (const input of spend) {
    assert.equal(input.output().address().to_hex(), owner.to_hex());
    assert(!input.output().data_hash() && !input.output().plutus_data() && !input.output().script_ref());
    assert(!outrefs.has(input.input().to_hex())); outrefs.add(input.input().to_hex());
    builder.add_regular_input(owner, input.input(), input.output().amount()); inputValue = inputValue.checked_add(input.output().amount());
  }
  assert(!outrefs.has(collateral.input().to_hex()) && !collateral.output().amount().multiasset());
  builder.add_required_signer(key); builder.set_validity_start_interval_bignum(bn(validityStart)); builder.set_ttl_bignum(bn(ttl));
  const names = assetNames(baseName), mint = CSL.MintBuilder.new(), budgets = CSL.ExUnits.new(bn(4_000_000), bn(1_500_000_000));
  const redeemer = CSL.Redeemer.new(CSL.RedeemerTag.new_mint(), bn(0), CSL.PlutusData.new_empty_constr_plutus_data(bn(0)), budgets);
  const witness = CSL.MintWitness.new_plutus_script(CSL.PlutusScriptSource.new(script), redeemer);
  const stateAddress = CSL.EnterpriseAddress.new(1, CSL.Credential.from_scripthash(policy)).to_address();
  let minted = CSL.Value.zero();
  for (const [name, address, inline] of [[names.referenceAssetNameHex, stateAddress, true], [names.userAssetNameHex, owner, false]]) {
    const asset = CSL.AssetName.new(Buffer.from(name, 'hex')); mint.add_asset(witness, asset, int(1));
    const tokens = CSL.Assets.new(), multi = CSL.MultiAsset.new(); tokens.insert(asset, bn(1)); multi.insert(policy, tokens);
    const tokenValue = CSL.Value.new(bn(0)); tokenValue.set_multiasset(multi); minted = minted.checked_add(tokenValue);
    const amount = CSL.Value.new(bn(3_000_000)); amount.set_multiasset(multi);
    let output = CSL.TransactionOutput.new(address, amount);
    if (inline) output.set_plutus_data(CSL.PlutusData.from_hex(datum.datumCborHex));
    amount.set_coin(CSL.min_ada_for_output(output, CSL.DataCost.new_coins_per_byte(bn(p.coins_per_utxo_size))));
    output = CSL.TransactionOutput.new(address, amount); if (inline) output.set_plutus_data(CSL.PlutusData.from_hex(datum.datumCborHex));
    assert(BigInt(output.amount().coin().to_str()) >= BigInt(CSL.min_ada_for_output(output, CSL.DataCost.new_coins_per_byte(bn(p.coins_per_utxo_size))).to_str()));
    builder.add_output(output);
  }
  builder.set_mint_builder(mint);
  const cols = CSL.TxInputsBuilder.new(); cols.add_regular_input(owner, collateral.input(), collateral.output().amount());
  builder.set_collateral(cols); builder.set_total_collateral_and_return(bn(2_000_000), owner);
  const cost = CSL.CostModel.new(), costs = CSL.Costmdls.new(); p.cost_models.PlutusV3.forEach((n, i) => cost.set(i, int(n))); costs.insert(CSL.Language.new_plutus_v3(), cost);
  builder.calc_script_data_hash(costs); builder.add_change_if_needed(owner);
  const tx = builder.build_tx(), body = tx.body();
  let outputValue = CSL.Value.new(body.fee()); for (let i = 0; i < body.outputs().len(); i++) outputValue = outputValue.checked_add(body.outputs().get(i).amount());
  assert.equal(inputValue.checked_add(minted).to_hex(), outputValue.to_hex());
  assert(BigInt(body.fee().to_str()) <= 2_000_000n && BigInt(body.total_collateral().to_str()) * 100n >= BigInt(body.fee().to_str()) * BigInt(p.collateral_percent));
  assert(!tx.witness_set().vkeys());
  return { unsignedCborHex: tx.to_hex(), policyId: policy.to_hex(), estimatedSignedBytes: builder.full_size(), feeLovelace: body.fee().to_str(), inputCount: spend.length, preservedExistingAssetPolicies: inputValue.multiasset()?.len() ?? 0 };
}
