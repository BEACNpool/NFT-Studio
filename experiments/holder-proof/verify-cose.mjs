import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { decodeCborProfile, encodeSigStructure } from './cbor-profile.mjs';
import { verifyCip30DataSignature } from './cose-verifier.mjs';
import { createHolderProofVerifier } from './holder-verifier.mjs';
import { createChallenge, assertAsset, MemoryChallengeStore } from './primitives.mjs';
import { fixtureFactory, independentEncode as enc, pairs, raw, hx, bh } from './test-fixtures.mjs';

const start = performance.now();
const factory = fixtureFactory();
const { make, publicBytes, enterprise, base, pointer, reward, script } = factory;
const data = fixture => ({ signature: fixture.signature, key: fixture.key });
const check = fixture => verifyCip30DataSignature(data(fixture), fixture.expected);
const passes = [], rejections = [], saved = [];
function yes(name, work) { work(); passes.push(name); }
function no(name, work) { assert.throws(work, undefined, name); rejections.push(name); }
const good = (name, fixture) => yes(name, () => { const result = check(fixture); assert.equal(result.protectedHeaderHex, fixture.protectedHeaderHex); assert.equal(result.sigStructureHex, fixture.sigStructureHex); saved.push({ name, ...fixture }); });
const rejectFixture = (name, options) => no(name, () => check(make(options)));
const kp = [[1, 1], [3, -8], [-1, 6], [-2, publicBytes]];
const pp = [[1, -8], ['address', bh(enterprise)]];
const basic = make();
good('native-generated canonical COSE', basic);
good('address-first protected map, exact original bytes', make({ protectedEntries: [...pp].reverse() }));
good('key map alternate order', make({ keyEntries: [...kp].reverse() }));
good('top-level COSE_Sign1 tag 18', make({ tag18: true }));
good('non-minimal encoded protected integer label is preserved', make({ protectedEntries: [[raw('1801'), -8], pp[1]] }));
good('non-minimal encoded protected algorithm is preserved', make({ protectedEntries: [[1, raw('3807')], pp[1]] }));
good('matching optional kid', make({ protectedEntries: [...pp, [4, bh(enterprise)]], keyEntries: [...kp, [2, bh(enterprise)]] }));
for (const [name, addressHex] of [['base', base], ['pointer', pointer], ['enterprise testnet', '60' + factory.paymentHash]]) good(`${name} address`, make({ addressHex }));
for (const size of [1, 23, 24, 255, 256, 1536]) good(`payload bstr length ${size}`, make({ payload: Buffer.alloc(size, 0x61) }));
no('changed expected address with same payment key', () => verifyCip30DataSignature(data(basic), { ...basic.expected, addressHex: base }));
no('wrong configured network', () => verifyCip30DataSignature(data(basic), { ...basic.expected, networkId: 0 }));
no('reward address is not payment control', () => check(make({ addressHex: reward })));
no('script payment address unsupported', () => check(make({ addressHex: script })));
no('public key does not bind address', () => check(make({ addressHex: '61' + '23'.repeat(28) })));
no('unknown signature-object property', () => verifyCip30DataSignature({ ...data(basic), utxos: [] }, basic.expected));

for (const [name, options] of [
  ['algorithm missing', { protectedEntries: [pp[1]] }],
  ['wrong algorithm', { protectedEntries: [[1, -7], pp[1]] }],
  ['algorithm in unprotected map', { protectedEntries: [pp[1]], unprotectedEntries: [['hashed', false], [1, -8]] }],
  ['address absent', { protectedEntries: [pp[0]] }],
  ['address in unprotected map', { protectedEntries: [pp[0]], unprotectedEntries: [['hashed', false], pp[1]] }],
  ['address wrapped as CBOR bytes', { protectedEntries: [pp[0], ['address', enc(bh(enterprise))]] }],
  ['address as text', { protectedEntries: [pp[0], ['address', enterprise]] }],
  ['duplicate protected alg', { protectedEntries: [...pp, [1, -8]] }],
  ['duplicate protected address', { protectedEntries: [...pp, pp[1]] }],
  ['duplicate semantic integer label using non-minimal encoding', { protectedEntries: [...pp, [raw('1801'), -8]] }],
  ['cross-map alg duplicate', { unprotectedEntries: [['hashed', false], [1, -8]] }],
  ['cross-map address duplicate', { unprotectedEntries: [['hashed', false], pp[1]] }],
  ['cross-map kid duplicate', { protectedEntries: [...pp, [4, bh(enterprise)]], unprotectedEntries: [['hashed', false], [4, bh(enterprise)]], keyEntries: [...kp, [2, bh(enterprise)]] }],
  ['unknown critical extension', { protectedEntries: [...pp, [2, [99]]] }],
  ['unknown protected label', { protectedEntries: [...pp, ['extension', true]] }],
  ['unknown unprotected label', { unprotectedEntries: [['hashed', false], ['addressHint', 'irrelevant']] }],
  ['hashed true', { unprotectedEntries: [['hashed', true]] }],
  ['hashed absent', { unprotectedEntries: [] }],
  ['hashed wrong type', { unprotectedEntries: [['hashed', 0]] }],
  ['hashed duplicated', { unprotectedEntries: [['hashed', false], ['hashed', false]] }],
  ['hashed in protected map', { protectedEntries: [...pp, ['hashed', false]], unprotectedEntries: [] }],
  ['detached payload', { payload: null, signedPayload: Buffer.from('detached'), expectedPayload: Buffer.from('detached') }],
  ['empty payload outside challenge profile', { payload: Buffer.alloc(0) }],
  ['nonempty external AAD signed', { externalAad: Buffer.from('not allowed') }],
  ['wrong signature context', { context: 'Signature' }],
  ['normalized protected map substituted when signing', { protectedEntries: [...pp].reverse(), signedProtectedBytes: enc(pairs(pp)) }],
  ['wrong key type', { keyEntries: kp.map(([k, v]) => [k, k === 1 ? 2 : v]) }],
  ['wrong key algorithm', { keyEntries: kp.map(([k, v]) => [k, k === 3 ? -7 : v]) }],
  ['wrong key curve', { keyEntries: kp.map(([k, v]) => [k, k === -1 ? 7 : v]) }],
  ['key algorithm absent', { keyEntries: kp.filter(([k]) => k !== 3) }],
  ['public key wrong length', { keyEntries: kp.map(([k, v]) => [k, k === -2 ? publicBytes.subarray(1) : v]) }],
  ['key map duplicate', { keyEntries: [...kp, [1, 1]] }],
  ['private key field forbidden', { keyEntries: [...kp, [-4, Buffer.alloc(32)]] }],
  ['key operations outside profile', { keyEntries: [...kp, [4, [2]]] }],
  ['header kid only', { protectedEntries: [...pp, [4, bh(enterprise)]] }],
  ['key kid only', { keyEntries: [...kp, [2, bh(enterprise)]] }],
  ['kid mismatch', { protectedEntries: [...pp, [4, bh(enterprise)]], keyEntries: [...kp, [2, Buffer.from('wrong')]] }],
  ['empty kid', { protectedEntries: [...pp, [4, Buffer.alloc(0)]], keyEntries: [...kp, [2, Buffer.alloc(0)]] }],
  ['payload too large', { payload: Buffer.alloc(1537) }],
  ['protected map too large', { protectedBytes: Buffer.alloc(513) }],
  ['short signature', { signature: Buffer.alloc(63) }],
  ['long signature', { signature: Buffer.alloc(65) }],
  ['zero signature', { signature: Buffer.alloc(64) }],
  ['protected map trailing item', { protectedBytes: Buffer.concat([enc(pairs(pp)), Buffer.from([0x00])]) }],
  ['protected map indefinite encoding', { protectedBytes: Buffer.concat([Buffer.from([0xbf]), enc(pairs(pp)).subarray(1), Buffer.from([0xff])]) }],
  ['UTF8 invalid header label', { protectedEntries: [...pp, [raw('61ff'), false]] }],
  ['text label over bound', { protectedEntries: [...pp, ['z'.repeat(65), false]] }],
]) rejectFixture(name, options);

for (const [name, signature] of [
  ['outer trailing data', basic.signature + '00'],
  ['wrong outer tag', 'd1' + basic.signature],
  ['nested tag', 'd2d2' + basic.signature],
  ['oversize envelope', '00'.repeat(4097)],
  ['odd hex', basic.signature + '0'],
  ['nonhex', basic.signature + 'zz'],
  ['array missing field', hx(enc([bh(basic.protectedHeaderHex), pairs([['hashed', false]]), bh(basic.expected.payloadHex)]))],
  ['array extra field', hx(enc([bh(basic.protectedHeaderHex), pairs([['hashed', false]]), bh(basic.expected.payloadHex), bh(basic.signatureHex), null]))],
  ['indefinite outer array', '9f' + basic.signature.slice(2) + 'ff'],
]) no(name, () => verifyCip30DataSignature({ signature, key: basic.key }, basic.expected));
no('key trailing data', () => verifyCip30DataSignature({ ...data(basic), key: basic.key + '00' }, basic.expected));
no('oversize key', () => verifyCip30DataSignature({ ...data(basic), key: '00'.repeat(513) }, basic.expected));
no('changed expected payload', () => verifyCip30DataSignature(data(basic), { ...basic.expected, payloadHex: '61' }));
yes('uppercase transport hex accepted without changing signed bytes', () => verifyCip30DataSignature({ signature: basic.signature.toUpperCase(), key: basic.key.toUpperCase() }, basic.expected));

for (const [name, hex] of [
  ['unsafe uint', '1bffffffffffffffff'], ['unsafe negative integer', '3bffffffffffffffff'],
  ['huge declared bstr', '5b0000000100000000'], ['reserved length', '5c'],
  ['indefinite bstr', '5fff'], ['indefinite map', 'bfff'], ['float', 'fa00000000'], ['undefined', 'f7'],
  ['simple follows byte', 'f814'], ['break', 'ff'], ['huge declared map', 'b1'], ['huge declared array', '91'],
  ['deep nesting', '81'.repeat(8) + '00'], ['non-label map key', 'a18000'], ['invalid UTF8', '61ff'],
]) no(name, () => decodeCborProfile(bh(hex)));
no('item count limit', () => decodeCborProfile(enc([Array(16).fill(0), Array(16).fill(0)]), { maxItems: 10 }));
no('decoder caps cannot be disabled', () => decodeCborProfile(bh('00'), { maxDepth: Infinity }));
let truncationRejects = 0;
for (let length = 0; length < basic.signature.length / 2; length++) {
  assert.throws(() => verifyCip30DataSignature({ ...data(basic), signature: basic.signature.slice(0, length * 2) }, basic.expected)); truncationRejects++;
}
for (let length = 0; length < basic.key.length / 2; length++) {
  assert.throws(() => verifyCip30DataSignature({ ...data(basic), key: basic.key.slice(0, length * 2) }, basic.expected)); truncationRejects++;
}

const identityPublicKey = bh('01' + '00'.repeat(31));
const identitySignature = bh('01' + '00'.repeat(63));
const weakAddress = '61' + hx(blake2b(identityPublicKey, { dkLen: 28 }));
const weak = make({ addressHex: weakAddress, keyEntries: [[1, 1], [3, -8], [-1, 6], [-2, identityPublicKey]], signature: identitySignature });
const cslWeakKey = CSL.PublicKey.from_bytes(identityPublicKey), cslWeakSignature = CSL.Ed25519Signature.from_bytes(identitySignature);
const cslAcceptsWeak = cslWeakKey.verify(bh(weak.sigStructureHex), cslWeakSignature);
cslWeakKey.free(); cslWeakSignature.free();
yes('CSL 17 weak-key behavior reproduced', () => assert.equal(cslAcceptsWeak, true));
yes('noble strict mode rejects weak key', () => assert.equal(ed25519.verify(identitySignature, bh(weak.sigStructureHex), identityPublicKey, { zip215: false }), false));
no('identity-point full COSE proof rejected', () => check(weak));
const order = 2n ** 252n + 27742317777372353535851937790883648493n;
let scalar = BigInt('0x' + hx(bh(basic.signatureHex).subarray(32).reverse())) + order;
const highScalar = Buffer.alloc(32); for (let i = 0; i < 32; i++) { highScalar[i] = Number(scalar & 255n); scalar >>= 8n; }
rejectFixture('noncanonical signature scalar S+l', { signature: Buffer.concat([bh(basic.signatureHex).subarray(0, 32), highScalar]) });

let mutationRejects = 0;
for (let bit = 0; bit < 512; bit++) {
  const signature = bh(basic.signatureHex); signature[bit >> 3] ^= 1 << (bit & 7);
  const fixture = make({ signature }); assert.throws(() => check(fixture)); mutationRejects++;
}
let seed = 0xbaaec001, fuzzRejects = 0;
const randomByte = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed & 255; };
for (let i = 0; i < 1000; i++) {
  const bytes = Buffer.from(Array.from({ length: 1 + randomByte() }, randomByte));
  assert.throws(() => verifyCip30DataSignature({ signature: hx(bytes), key: basic.key }, basic.expected)); fuzzRejects++;
}

const now = 1788750000;
const config = { origin: 'https://labs.example', uri: 'https://labs.example/api/holder/verify', audience: 'beacn-labs-demo', action: 'Verify NFT holding for demo access', resource: 'demo:holder-preview', network: { name: 'mainnet', id: 1, magic: 764824073 }, asset: { policyId: 'ab'.repeat(28), assetNameHex: '43415053554c45', minimumQuantity: '1' }, ttlSeconds: 180 };
const limits = { maxObservationAgeSeconds: 10, maxTipAgeSeconds: 120, minimumConfirmations: 6 };
const sessionId = 'synthetic-holder-session-never-a-live-cookie-0001';
const request = { origin: config.origin, uri: config.uri, method: 'POST', sessionId };
const record = createChallenge(CSL, config, enterprise, sessionId, now);
const proof = make({ payload: bh(record.payloadHex), protectedEntries: [...pp].reverse() });
const body = { nonce: record.challenge.nonce, ...data(proof) };
const snapshot = { networkName: 'mainnet', networkMagic: 764824073, checkedAt: now + 1, complete: true, canonical: true, point: { blockHash: 'ba'.repeat(32), blockHeight: 1000, slot: 7000000, time: now }, utxos: [{ txHash: 'ca'.repeat(32), outputIndex: 0, addressHex: enterprise, unspent: true, createdAtHeight: 995, assets: { [assertAsset(config.asset)]: '1' } }] };
let engineChecks = 0;
const setup = (opts = {}) => { const store = opts.store ?? new MemoryChallengeStore(); store.put(record); let calls = 0; return { store, calls: () => calls, verify: createHolderProofVerifier({ config, limits, store, readSnapshot: async args => { calls++; assert.equal(args.addressHex, enterprise); return opts.readSnapshot ? opts.readSnapshot(args) : structuredClone(snapshot); }, clock: opts.clock ?? (() => now + 1) }) }; };
const engine = setup();
const decision = await engine.verify(body, request); assert.equal(decision.decision, 'verified_at_observed_point'); engineChecks++;
await assert.rejects(() => engine.verify(body, request)); engineChecks++;
assert.equal(engine.calls(), 1); engineChecks++;
const invalidEngine = setup();
await assert.rejects(() => invalidEngine.verify({ ...body, signature: basic.signature }, request)); engineChecks++;
assert.equal(invalidEngine.calls(), 0); engineChecks++;
for (const [name, mutation] of [
  ['transfer', s => { s.utxos = []; }], ['rollback', s => { s.canonical = false; }], ['stale view', s => { s.checkedAt = now - 100; }], ['wrong network', s => { s.networkMagic = 2; }],
]) {
  const subject = setup({ readSnapshot: () => { const changed = structuredClone(snapshot); mutation(changed); return changed; } });
  await assert.rejects(() => subject.verify(body, request), undefined, name); engineChecks++;
  assert.equal(subject.store.get(record.challenge.nonce).consumedAt, null); engineChecks++;
}
const badOrigin = setup(); await assert.rejects(() => badOrigin.verify(body, { ...request, origin: 'https://evil.example' })); engineChecks++;
assert.equal(badOrigin.calls(), 0); engineChecks++;
const otherSession = setup(); await assert.rejects(() => otherSession.verify(body, { ...request, sessionId: sessionId + 'other' })); engineChecks++;
const untrustedBody = setup(); await assert.rejects(() => untrustedBody.verify({ ...body, snapshot }, request)); engineChecks++;
let currentTime = now + 1;
const expiresDuringLookup = setup({ clock: () => currentTime, readSnapshot: () => { currentTime = now + 180; return structuredClone(snapshot); } });
await assert.rejects(() => expiresDuringLookup.verify(body, request)); engineChecks++;
assert.equal(expiresDuringLookup.store.get(record.challenge.nonce).consumedAt, null); engineChecks++;
const racing = setup();
const outcomes = await Promise.allSettled([racing.verify(body, request), racing.verify(body, request)]);
assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1); engineChecks++;
assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1); engineChecks++;
let clockDuringStore = now + 1;
const delayedStoreInner = new MemoryChallengeStore();
let lookupCount = 0;
const delayedStore = { put: x => delayedStoreInner.put(x), consume: (...args) => delayedStoreInner.consume(...args), get: async nonce => { lookupCount++; if (lookupCount === 2) clockDuringStore = now + 180; return delayedStoreInner.get(nonce); } };
const expiresDuringStore = setup({ store: delayedStore, clock: () => clockDuringStore });
await assert.rejects(() => expiresDuringStore.verify(body, request)); engineChecks++;
assert.equal(delayedStoreInner.get(record.challenge.nonce).consumedAt, null); engineChecks++;

const receipt = { schema: 'beacn-holder-cose-candidate-checks-v1', checkedAt: new Date().toISOString(), positiveChecks: passes.length, acceptedCoseCases: saved.length + 1, negativeChecks: rejections.length, truncatedInputRejections: truncationRejects, signatureBitMutationRejections: mutationRejects, deterministicMalformedEnvelopeRejections: fuzzRejects, combinedEngineChecks: engineChecks, elapsedMilliseconds: Math.round(performance.now() - start), cslVersion: '17.0.0', strictEd25519: '@noble/curves@2.4.0 zip215:false plus CSL', fixtureGeneration: 'Independent test CBOR encoder and Node native Ed25519 KeyObjects', realWalletAccess: false, realSigningKeysAccessed: false, ephemeralSyntheticSigningPerformed: true, chainQueries: false, serviceDeployed: false, cslIdentityPointAccepted: cslAcceptsWeak, candidateIdentityPointRejected: true, positiveCases: passes, negativeCases: rejections, limits: ['New parser has not received independent security review', 'Definite CBOR profile; not all valid CIP8 encodings supported', 'Holdings are trusted adapter observations, not chain proofs', 'No real wallet interoperability or deployed authentication service'] };
if (process.argv.includes('--write-fixtures')) {
  writeFileSync(new URL('./fixtures/cose-positive.json', import.meta.url), JSON.stringify({ schema: 'beacn-synthetic-cose-fixtures-v1', notice: 'Public synthetic verification fixtures; no private keys or real holdings.', fixtures: saved }, null, 2) + '\n');
  writeFileSync(new URL('./fixtures/cose-receipt.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(new URL('./fixtures/combined-decision.json', import.meta.url), JSON.stringify({ notice: 'Synthetic snapshot and clock; local verifier decision, not live authentication or chain inclusion.', ...decision }, null, 2) + '\n');
  writeFileSync(new URL('./fixtures/holder-proof.json', import.meta.url), JSON.stringify({ schema: 'beacn-replayable-holder-demo-v1', notice: 'All holdings, clock and session strings are synthetic public fixtures. No private key, real wallet or live grant.', config, limits, record, body, requestContext: request, trustedSnapshot: snapshot, verificationTime: now + 1 }, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
