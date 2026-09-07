import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { assertAsset, paymentAddress, bindPaymentKey, verifyEd25519, createChallenge, assertChallengeContext, assertCurrentHolder, MemoryChallengeStore } from './primitives.mjs';
const require = createRequire(import.meta.url);
const cslModule = process.env.CSL_MODULE ?? '@emurgo/cardano-serialization-lib-nodejs';
const CSL = require(cslModule);
const cslVersion = require(`${cslModule}/package.json`).version;
assert.equal(cslVersion, '17.0.0', 'these receipts target pinned CSL 17.0.0');
const pk = '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c';
const signature = '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00';
// RFC 8032 section 7.1 TEST 2: public verification vector only. No private key.
const keyHash = CSL.PublicKey.from_bytes(Buffer.from(pk, 'hex')).hash();
const credential = CSL.Credential.from_keyhash(keyHash);
const enterprise = CSL.EnterpriseAddress.new(1, credential).to_address().to_hex();
const base = CSL.BaseAddress.new(1, credential, CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex('12'.repeat(28)))).to_address().to_hex();
const script = CSL.EnterpriseAddress.new(1, CSL.Credential.from_scripthash(CSL.ScriptHash.from_hex('12'.repeat(28)))).to_address().to_hex();
const reward = CSL.RewardAddress.new(1, credential).to_address().to_hex();
const pointer = CSL.PointerAddress.new(1, credential, CSL.Pointer.new_pointer(CSL.BigNum.from_str('1'), CSL.BigNum.from_str('2'), CSL.BigNum.from_str('3'))).to_address().to_hex();
let checks = 0;
const yes = (label, work) => { work(); checks++; };
const no = (label, work) => { assert.throws(work, undefined, label); checks++; };
yes('known Ed25519 verification vector', () => verifyEd25519(CSL, pk, signature, Buffer.from('72', 'hex')));
no('changed message', () => verifyEd25519(CSL, pk, signature, Buffer.from('73', 'hex')));
no('changed signature', () => verifyEd25519(CSL, pk, '00' + signature.slice(2), Buffer.from('72', 'hex')));
no('short signature', () => verifyEd25519(CSL, pk, signature.slice(2), Buffer.from('72', 'hex')));
no('wrong key', () => verifyEd25519(CSL, '13'.repeat(32), signature, Buffer.from('72', 'hex')));
for (const address of [enterprise, base, pointer]) yes('supported payment type', () => assert.equal(bindPaymentKey(CSL, pk, address, 1).paymentKeyHash, keyHash.to_hex()));
no('reward key is not asset control', () => bindPaymentKey(CSL, pk, reward, 1));
no('script custody unsupported', () => bindPaymentKey(CSL, pk, script, 1));
no('wrong network', () => bindPaymentKey(CSL, pk, enterprise, 0));
no('wrong payment key', () => bindPaymentKey(CSL, '13'.repeat(32), enterprise, 1));
no('trailing address garbage', () => paymentAddress(CSL, enterprise + '00', 1));
no('short policy', () => assertAsset({ policyId: 'ab', assetNameHex: '', minimumQuantity: '1' }));
no('oversize name', () => assertAsset({ policyId: 'ab'.repeat(28), assetNameHex: 'cc'.repeat(33), minimumQuantity: '1' }));

const now = 1788750000;
const config = { origin: 'https://labs.example', uri: 'https://labs.example/api/holder/verify', audience: 'beacn-labs-demo', action: 'Verify NFT holding for demo access', resource: 'demo:holder-preview', network: { name: 'mainnet', id: 1, magic: 764824073 }, asset: { policyId: 'ab'.repeat(28), assetNameHex: '43415053554c45', minimumQuantity: '1' }, ttlSeconds: 180 };
const sessionId = 'synthetic-test-session-not-a-live-cookie-0001';
const record = createChallenge(CSL, config, enterprise, sessionId, now);
const request = { origin: config.origin, uri: config.uri, method: 'POST', sessionId, payloadHex: record.payloadHex };
yes('exact stored challenge', () => assertChallengeContext(record, config, request, now + 1));
yes('unpredictable nonce distinct', () => assert.notEqual(record.challenge.nonce, createChallenge(CSL, config, enterprise, sessionId, now).challenge.nonce));
no('non-HTTPS origin', () => createChallenge(CSL, { ...config, origin: 'http://labs.example' }, enterprise, sessionId, now));
no('URI credentials', () => createChallenge(CSL, { ...config, uri: 'https://user@labs.example/api/holder/verify' }, enterprise, sessionId, now));
no('preprod-preview confusion', () => createChallenge(CSL, { ...config, network: { name: 'preview', id: 0, magic: 1 } }, enterprise, sessionId, now));
no('long TTL', () => createChallenge(CSL, { ...config, ttlSeconds: 301 }, enterprise, sessionId, now));
no('expiry boundary', () => assertChallengeContext(record, config, request, now + 180));
no('future challenge', () => assertChallengeContext(record, config, request, now - 1));
no('cross-origin', () => assertChallengeContext(record, config, { ...request, origin: 'https://evil.example' }, now));
no('wrong endpoint', () => assertChallengeContext(record, config, { ...request, uri: 'https://labs.example/api/other' }, now));
no('wrong method', () => assertChallengeContext(record, config, { ...request, method: 'GET' }, now));
no('session relay', () => assertChallengeContext(record, config, { ...request, sessionId: 'different-synthetic-session-00000000000001' }, now));
no('byte-different JSON', () => assertChallengeContext(record, config, { ...request, payloadHex: Buffer.from(JSON.stringify(record.challenge)).toString('hex') }, now));
no('wrong configured audience', () => assertChallengeContext(record, { ...config, audience: 'another-service' }, request, now));
no('wrong configured asset', () => assertChallengeContext(record, { ...config, asset: { ...config.asset, assetNameHex: '' } }, request, now));
no('stored scope mutation', () => { const changed = structuredClone(record); changed.challenge.nonce = '11'.repeat(32); assertChallengeContext(changed, config, request, now); });

const snapshot = { networkName: 'mainnet', networkMagic: 764824073, checkedAt: now + 1, complete: true, canonical: true, point: { blockHash: 'ba'.repeat(32), blockHeight: 1000, slot: 7000000, time: now }, utxos: [{ txHash: 'ca'.repeat(32), outputIndex: 0, addressHex: enterprise, unspent: true, createdAtHeight: 995, assets: { [assertAsset(config.asset)]: '1' } }] };
const limits = { maxObservationAgeSeconds: 10, maxTipAgeSeconds: 120, minimumConfirmations: 6 };
yes('fresh current confirmed unit', () => assertCurrentHolder(record, snapshot, limits, now + 1));
const mutate = (work) => { const copy = structuredClone(snapshot); work(copy); return copy; };
for (const [label, work] of [
  ['transferred token', s => { s.utxos = []; }],
  ['spent old output', s => { s.utxos[0].unspent = false; }],
  ['different holder', s => { s.utxos[0].addressHex = base; }],
  ['rolled-back point', s => { s.canonical = false; }],
  ['incomplete pagination', s => { s.complete = false; }],
  ['provider network mismatch', s => { s.networkMagic = 2; }],
  ['stale observation', s => { s.checkedAt = now - 11; }],
  ['stale tip', s => { s.point.time = now - 121; }],
  ['not enough confirmations', s => { s.utxos[0].createdAtHeight = 996; }],
  ['duplicate row', s => { s.utxos.push(structuredClone(s.utxos[0])); }],
  ['zero quantity', s => { s.utxos[0].assets[assertAsset(config.asset)] = '0'; }],
  ['numeric quantity precision risk', s => { s.utxos[0].assets[assertAsset(config.asset)] = 1; }],
  ['metadata-only forged holding', s => { s.utxos[0].assets = {}; s.utxos[0].datum = { owner: enterprise, nft: assertAsset(config.asset) }; }],
]) no(label, () => assertCurrentHolder(record, mutate(work), limits, now + 1));
yes('datum hash cannot veto real asset holding', () => assertCurrentHolder(record, mutate(s => { s.utxos[0].datumHash = 'da'.repeat(32); }), limits, now + 1));

const store = new MemoryChallengeStore(); store.put(record);
yes('stored copy is isolated', () => { const copy = store.get(record.challenge.nonce); copy.challenge.resource = 'evil'; assert.equal(store.get(record.challenge.nonce).challenge.resource, config.resource); });
no('consume wrong session', () => store.consume(record.challenge.nonce, '00'.repeat(32), now + 1));
yes('first consume', () => store.consume(record.challenge.nonce, record.sessionBinding, now + 1));
no('second consume/replay', () => store.consume(record.challenge.nonce, record.sessionBinding, now + 1));
no('post-consume validation', () => assertChallengeContext(store.get(record.challenge.nonce), config, request, now + 1));
const raceStore = new MemoryChallengeStore(); raceStore.put(record);
const race = await Promise.allSettled([0, 1].map(async () => { await Promise.resolve(); return raceStore.consume(record.challenge.nonce, record.sessionBinding, now + 1); }));
yes('concurrent consume exactly once in one process', () => assert.equal(race.filter(r => r.status === 'fulfilled').length, 1));

const receipt = { schema: 'beacn-holder-proof-primitive-checks-v2', checkedAt: new Date().toISOString(), cslVersion, strictEd25519: '@noble/curves@2.4.0 zip215:false plus CSL', checks, signingPerformed: false, walletAccess: false, chainQueries: false, suiteIncludesCoseVerification: false, challengeBytes: record.payloadHex.length / 2, coverage: ['RFC8032 public Ed25519 vector and mutations', 'payment address/key binding', 'scope, origin, session, exact payload, TTL', 'fresh trusted snapshot, transfer, rollback, quantity, metadata confusion', 'single-process atomic nonce consume'], limits: ['This primitive suite is separate from verify-cose.mjs', 'Trusted chain adapter assertions are not inclusion proofs', 'No wallet compatibility testing', 'Memory store is not production persistence'] };
if (process.argv.includes('--write-fixtures')) {
  writeFileSync(new URL('./fixtures/challenge.json', import.meta.url), JSON.stringify({ challenge: record.challenge, payloadHex: record.payloadHex, addressHex: record.addressHex, notice: 'Synthetic public-key example. Nonce expires; not a live authorization.' }, null, 2) + '\n');
  writeFileSync(new URL('./fixtures/primitives-receipt.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt, null, 2));
