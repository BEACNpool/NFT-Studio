import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const M = require(process.env.MESSAGE_SIGNING_MODULE ?? '@emurgo/cardano-message-signing-nodejs');
const bh = x => Buffer.from(x, 'hex');
const hx = x => Buffer.from(x).toString('hex');
const addr = '61' + '11'.repeat(28);
const canonical = 'a201276761646472657373581d' + addr;
const addressFirst = 'a26761646472657373581d' + addr + '0127';
const duplicateAlg = 'a3012701276761646472657373581d' + addr;
const cborBytes = h => '58' + (h.length / 2).toString(16).padStart(2, '0') + h;
const envelope = (h, unprotected = 'a166686173686564f4') => '84' + cborBytes(h) + unprotected + '4568656c6c6f5840' + '00'.repeat(64);
const cases = [
  ['canonical', envelope(canonical)],
  ['address-first-protected', envelope(addressFirst)],
  ['duplicate-alg-in-map', envelope(duplicateAlg)],
  ['alg-in-both-header-maps', envelope(canonical, 'a2012766686173686564f4')],
  ['trailing-byte', envelope(canonical) + '00'],
];
const results = cases.map(([name, rawHex]) => {
  try {
    const parsed = M.COSESign1.from_bytes(bh(rawHex));
    return { name, accepted: true, roundtripEqual: hx(parsed.to_bytes()) === rawHex, rawHex, rebuiltProtectedBytes: hx(parsed.headers().protected().to_bytes()), rebuiltSigStructure: hx(parsed.signed_data().to_bytes()) };
  } catch (error) { return { name, accepted: false, error: String(error) }; }
});
assert.equal(results[0].roundtripEqual, true);
assert.equal(results[1].roundtripEqual, false);
assert.equal(results[2].accepted, false);
assert.equal(results[3].accepted, true);
assert.equal(results[4].accepted, true);
const receipt = { schema: 'beacn-cose-dependency-probe-v1', checkedAt: new Date().toISOString(), package: '@emurgo/cardano-message-signing-nodejs', version: '1.1.0', integrity: 'sha512-PQRc8K8wZshEdmQenNUzVtiI8oJNF/1uAnBhidee5C4o1l2mDLOW+ur46HWHIFKQ6x8mSJTllcjMscHgzju0gQ==', sourceCommitInspected: 'f76a82442594c8435fb577cb85da3ad594cf1063', signingPerformed: false, validCryptographicSignaturesUsed: false, results, conclusion: 'Parsing is not verification. Preserve original protected bytes; reject duplicate labels across maps and trailing input. A full round-trip guard can fail closed for this limited encoding, but rejects valid alternate COSE encodings and is not a complete verifier.' };
if (process.argv.includes('--write-fixtures')) writeFileSync(new URL('./fixtures/dependency-probe.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
