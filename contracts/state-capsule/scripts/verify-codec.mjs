import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { assetNames, buildDatum, fromHex, serialiseData, toHex, transition, utf8Chunks, verifyHistory, verifyState } from './capsule-codec.mjs';

const metadata = { name: 'BEACN State Capsule', image: 'data:image/svg+xml,<svg/>' };
const genesis = buildDatum({ metadata });
assert.equal(genesis.datumCborHex, 'd8799fa245696d6167659f5819646174613a696d6167652f7376672b786d6c2c3c7376672f3eff446e616d6553424541434e2053746174652043617073756c6501d8799f0100d8798040ffff');
assert.equal(genesis.datumHash, 'b8ecd637e8cc8f5bddbf3d288517880a397166aa3e39670520c7beb408fb273a');

let fixtures = 0;
const history = [genesis];
for (let i = 0; i < 256; i++) {
  const state = transition(history.at(-1), { metadata: { name: 'BEACN State Capsule', image: `data:image/svg+xml,<svg><text>${i}</text></svg>`, description: '⚡'.repeat(i % 21), traits: { energy: i, origin: 'BEACN' } } });
  const data = CSL.PlutusData.from_json(JSON.stringify(state.datum), CSL.PlutusDatumSchema.DetailedSchema);
  assert.equal(data.to_hex(), state.datumCborHex);
  assert.equal(CSL.hash_plutus_data(data).to_hex(), state.datumHash);
  assert.equal(CSL.PlutusData.from_hex(state.datumCborHex).to_hex(), state.datumCborHex);
  assert.deepEqual(verifyState(state), state);
  history.push(state); fixtures++;
}
history.push(transition(history.at(-1), { action: 'freeze' }));
assert.deepEqual(verifyHistory(history), { valid: true, states: 258, tipHash: history.at(-1).datumHash, frozen: true, evidence: 'local-data-only' });
assert.equal(buildDatum({ metadata: { image: metadata.image, name: metadata.name } }).datumHash, genesis.datumHash);
assert.equal(assetNames('CAPSULE').referenceAssetNameHex, '000643b043415053554c45');
assert.equal(assetNames('CAPSULE').userAssetNameHex, '000de14043415053554c45');
assert.deepEqual(utf8Chunks('a'.repeat(63) + '⚡' + 'b'), ['a'.repeat(63), '⚡b']);
assert.equal(utf8Chunks('⚡'.repeat(24)).join(''), '⚡'.repeat(24));

const failures = [
  () => assetNames(''), () => assetNames('⚡'.repeat(10)),
  () => buildDatum({ metadata: { ...metadata, name: 'x'.repeat(65) } }),
  () => buildDatum({ metadata: { ...metadata, name: '\ud800' } }),
  () => buildDatum({ metadata: { ...metadata, image: 'javascript:alert(1)' } }),
  () => buildDatum({ metadata: { ...metadata, image: 'data:text/html,<script/>' } }),
  () => buildDatum({ metadata: { ...metadata, image: 'data:image/svg+xml,' + 'x'.repeat(3072) } }),
  () => buildDatum({ metadata, frozen: true }),
  () => buildDatum({ metadata, sequence: -1 }),
  () => buildDatum({ metadata, sequence: 1 }),
  () => buildDatum({ metadata, sequence: Number.MAX_SAFE_INTEGER + 1, previousDatumHash: '00'.repeat(32) }),
  () => buildDatum({ metadata, previousDatumHash: '00'.repeat(32) }),
  () => buildDatum({ metadata, previousDatumHash: 'GG' }),
  () => buildDatum({ metadata: { ...metadata, traits: { nonsense: true } } }),
  () => buildDatum({ metadata: { ...metadata, traits: { number: 1.5 } } }),
  () => buildDatum({ metadata: { ...metadata, traits: new Date() } }),
  () => buildDatum({ metadata: { ...metadata, ['x'.repeat(65)]: 'bad' } }),
  () => buildDatum({ metadata: { ...metadata, pad: 'x'.repeat(5000) } }),
  () => buildDatum({ metadata: { ...metadata, pad: Array(260).fill(1) } }),
  () => buildDatum({ metadata: { ...metadata, pad: { a: { b: { c: { d: { e: 'deep' } } } } } } }),
  () => transition(history.at(-1)),
  () => transition(genesis, { action: 'unfreeze' }),
  () => transition(genesis, { action: 'freeze', metadata: { ...metadata, name: 'changed' } }),
  () => verifyState({ ...genesis, datumHash: '00'.repeat(32) }),
  () => verifyState({ ...genesis, datumCborHex: 'd87980' }),
  () => verifyState({ ...genesis, datumBytes: genesis.datumBytes + 1 }),
  () => verifyState({ ...genesis, metadata: { ...metadata, name: 'spoof' } }),
  () => verifyState({ ...genesis, datum: { constructor: 0, fields: [] } }),
  () => verifyHistory(history.slice(1)),
  () => verifyHistory([genesis, history[2]]),
  () => verifyHistory([genesis, history[1], history[1]]),
  () => fromHex('ab0'), () => serialiseData({ bytes: 'aa'.repeat(65) }),
  () => serialiseData({ constructor: 0, fields: [], extra: true }),
];
for (const test of failures) assert.throws(test);
const frozen = transition(genesis, { action: 'freeze', metadata: { image: metadata.image, name: metadata.name } });
assert.equal(frozen.frozen, true);
const report = { schema: 'beacn.state-capsule.codec-verification.v1', status: 'pass', independentSerializer: 'cardano-serialization-lib 17.0.0', parityFixtures: fixtures, historyStates: history.length, rejectionCases: failures.length, aikenGoldenDatumBytes: genesis.datumBytes, aikenGoldenDatumHash: genesis.datumHash, evidence: 'Synthetic local serialization and history verification. Not chain inclusion or transaction evaluation.' };
if (process.argv.includes('--write')) fs.writeFileSync(fileURLToPath(new URL('../fixtures/codec-verification.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
