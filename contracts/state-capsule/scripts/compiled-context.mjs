/** Synthetic Plutus V3 contexts derived from complete CSL transactions and resolved UTxOs.
 * This intentionally supports only the narrow fixture lane (enterprise addresses, no
 * certificates/withdrawals/votes/reference scripts). It is not a ledger implementation.
 */
import assert from 'node:assert/strict';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';

const c = (constructor, fields = []) => ({ constructor, fields });
const b = bytes => ({ bytes });
const i = int => ({ int });
const l = list => ({ list });
const m = map => ({ map });
const none = () => c(1);
const bytesHex = bytes => Buffer.from(bytes).toString('hex');
function credential(cred) {
  return cred.to_keyhash() ? c(0, [b(cred.to_keyhash().to_hex())]) : c(1, [b(cred.to_scripthash().to_hex())]);
}
function address(addr) {
  const enterprise = CSL.EnterpriseAddress.from_address(addr);
  assert(enterprise, 'Context adapter accepts enterprise fixture addresses only.');
  return c(0, [credential(enterprise.payment_cred()), none()]);
}
function value(amount) {
  const entries = [];
  if (BigInt(amount.coin().to_str()) !== 0n) entries.push({ k: b(''), v: m([{ k: b(''), v: i(Number(amount.coin().to_str())) }]) });
  const multi = amount.multiasset();
  if (multi) for (let p = 0; p < multi.keys().len(); p++) {
    const policy = multi.keys().get(p), assets = multi.get(policy), tokens = [];
    for (let n = 0; n < assets.keys().len(); n++) {
      const name = assets.keys().get(n); tokens.push({ k: b(bytesHex(name.name())), v: i(Number(assets.get(name).to_str())) });
    }
    tokens.sort((a, z) => a.k.bytes < z.k.bytes ? -1 : 1);
    entries.push({ k: b(policy.to_hex()), v: m(tokens) });
  }
  return m(entries.sort((a, z) => a.k.bytes < z.k.bytes ? -1 : 1));
}
export function reference(input) {
  return c(0, [b(input.transaction_id().to_hex()), i(input.index())]);
}
export function output(out) {
  assert(!out.script_ref(), 'Reference scripts are outside this fixture adapter.');
  const datum = out.plutus_data() ? c(2, [JSON.parse(out.plutus_data().to_json(CSL.PlutusDatumSchema.DetailedSchema))]) : out.data_hash() ? c(1, [b(out.data_hash().to_hex())]) : c(0);
  return c(0, [address(out.address()), value(out.amount()), datum, none()]);
}
export function transactionContext({ parsed, transaction, resolvedInputs }, policy) {
  const body = parsed.body(), redeemers = parsed.witness_set().redeemers(), inputs = body.inputs();
  assert.equal(redeemers.len(), 1);
  const resolved = [];
  for (let index = 0; index < inputs.len(); index++) {
    const input = inputs.get(index), known = resolvedInputs.find(item => item.input.to_hex() === input.to_hex());
    assert(known, 'Every fixture input must have its full resolved output.');
    resolved.push(c(0, [reference(input), output(known.output)]));
  }
  const outputs = [];
  for (let index = 0; index < body.outputs().len(); index++) outputs.push(output(body.outputs().get(index)));
  const signers = [];
  for (let index = 0; index < body.required_signers().len(); index++) signers.push(b(body.required_signers().get(index).to_hex()));
  const redeemer = redeemers.get(0), redeemerData = JSON.parse(redeemer.data().to_json(CSL.PlutusDatumSchema.DetailedSchema));
  const isMint = redeemer.tag().kind() === CSL.RedeemerTagKind.Mint;
  let purpose, info;
  if (isMint) { purpose = c(0, [b(policy)]); info = purpose; }
  else {
    assert.equal(redeemer.tag().kind(), CSL.RedeemerTagKind.Spend);
    const ownIndex = Number(redeemer.index().to_str()), input = inputs.get(ownIndex);
    const own = resolvedInputs.find(item => item.input.to_hex() === input.to_hex());
    assert(own.output.plutus_data());
    purpose = c(1, [reference(input)]);
    info = c(1, [reference(input), c(0, [JSON.parse(own.output.plutus_data().to_json(CSL.PlutusDatumSchema.DetailedSchema))])]);
  }
  const mint = [];
  if (body.mint()) {
    const all = body.mint();
    for (let p = 0; p < all.keys().len(); p++) {
      const policy = all.keys().get(p), groups = all.get(policy), tokens = [];
      assert.equal(groups.len(), 1, "Fixture has one mint group per policy.");
      const assets = groups.get(0);
      for (let n = 0; n < assets.keys().len(); n++) { const name = assets.keys().get(n); tokens.push({ k: b(bytesHex(name.name())), v: i(Number(assets.get(name).to_str())) }); }
      tokens.sort((a, z) => a.k.bytes < z.k.bytes ? -1 : 1);
      mint.push({ k: b(policy.to_hex()), v: m(tokens) });
    }
    mint.sort((a, z) => a.k.bytes < z.k.bytes ? -1 : 1);
  }
  // Synthetic POSIX interval. A real builder/evaluator needs network era-history slot mapping.
  // The capsule does not use time in its authorization or transition predicates.
  const interval = c(0, [c(0, [c(1, [i(1000)]), c(1)]), c(0, [c(1, [i(2000)]), c(0)])]);
  const txInfo = c(0, [l(resolved), l([]), l(outputs), i(Number(body.fee().to_str())), m(mint), l([]), m([]), interval, l(signers), m([{ k: purpose, v: redeemerData }]), m([]), b(transaction.transaction_hash().to_hex()), m([]), l([]), none(), none()]);
  return c(0, [txInfo, redeemerData, info]);
}

export function uplcData(data) {
  if ('constructor' in data && Object.hasOwn(data, 'constructor')) return `Constr ${data.constructor} [${data.fields.map(uplcData).join(', ')}]`;
  if ('bytes' in data) return `B #${data.bytes}`;
  if ('int' in data) return `I ${data.int}`;
  if ('list' in data) return `List [${data.list.map(uplcData).join(', ')}]`;
  if ('map' in data) return `Map [${data.map.map(({ k, v }) => `(${uplcData(k)}, ${uplcData(v)})`).join(', ')}]`;
  throw new Error('Unknown Plutus data.');
}
