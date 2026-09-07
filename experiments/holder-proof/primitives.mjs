// BEACN Labs holder-proof research primitives. No wallet, signing, network or service.
// These are NOT a COSE parser or complete authentication middleware.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';

const fail = (message) => { throw new Error(message); };
const need = (ok, message) => { if (!ok) fail(message); };
const plain = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const int = (x) => Number.isSafeInteger(x) && x >= 0;
const canonicalHex = (x, min, max) => typeof x === 'string' && x.length % 2 === 0 && /^[0-9a-f]*$/.test(x) && x.length >= min * 2 && x.length <= max * 2;
const ascii = (x, max) => typeof x === 'string' && x.length > 0 && x.length <= max && /^[\x20-\x7e]+$/.test(x);
const equalHex = (a, b) => canonicalHex(a, 0, 4096) && canonicalHex(b, 0, 4096) && a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const digest = (x) => createHash('sha256').update(x).digest('hex');

export function assertAsset(asset) {
  need(plain(asset) && canonicalHex(asset.policyId, 28, 28) && canonicalHex(asset.assetNameHex, 0, 32), 'invalid exact asset identifier');
  need(asset.minimumQuantity === '1', 'v1 permits minimum quantity 1 only');
  return `${asset.policyId}${asset.assetNameHex}`;
}

export function paymentAddress(CSL, addressHex, expectedNetworkId) {
  need(canonicalHex(addressHex, 29, 128), 'invalid raw address');
  need(expectedNetworkId === 0 || expectedNetworkId === 1, 'unsupported network id');
  const allocated = [];
  const own = object => { if (object) allocated.push(object); return object; };
  try {
    const address = own(CSL.Address.from_bytes(Buffer.from(addressHex, 'hex')));
    need(Buffer.from(address.to_bytes()).toString('hex') === addressHex, 'noncanonical address');
    need(address.network_id() === expectedNetworkId, 'address network mismatch');
    const shape = own(CSL.BaseAddress.from_address(address) ?? CSL.EnterpriseAddress.from_address(address) ?? CSL.PointerAddress.from_address(address));
    need(shape, 'payment address required; reward and Byron addresses unsupported');
    const credential = own(own(shape.payment_cred()).to_keyhash());
    need(credential, 'script payment credential unsupported');
    return { addressHex, addressBech32: address.to_bech32(), paymentKeyHash: credential.to_hex(), networkId: expectedNetworkId };
  } finally { for (const object of allocated.reverse()) object.free(); }
}

export function bindPaymentKey(CSL, publicKeyHex, addressHex, expectedNetworkId) {
  need(canonicalHex(publicKeyHex, 32, 32), 'public key must be 32 bytes');
  const bound = paymentAddress(CSL, addressHex, expectedNetworkId);
  const publicKey = CSL.PublicKey.from_bytes(Buffer.from(publicKeyHex, 'hex'));
  let hash;
  try {
    hash = publicKey.hash();
    need(equalHex(hash.to_hex(), bound.paymentKeyHash), 'public key does not control payment credential');
  } finally { hash?.free(); publicKey.free(); }
  return bound;
}

// The caller must supply the exact COSE Sig_structure bytes from a separately
// reviewed, bounded parser. Do not pass the payload itself to this function.
export function verifyEd25519(CSL, publicKeyHex, signatureHex, signedBytes) {
  need(canonicalHex(publicKeyHex, 32, 32), 'public key must be 32 bytes');
  need(canonicalHex(signatureHex, 64, 64), 'signature must be 64 bytes');
  need(signedBytes instanceof Uint8Array && signedBytes.length <= 4096, 'invalid signature input bytes');
  // Authentication requires strict key control. CSL 17 alone accepts the public
  // identity-point/zero-scalar construction; noble strict mode rejects it.
  need(ed25519.verify(Buffer.from(signatureHex, 'hex'), signedBytes, Buffer.from(publicKeyHex, 'hex'), { zip215: false }), 'invalid strict Ed25519 signature');
  const key = CSL.PublicKey.from_bytes(Buffer.from(publicKeyHex, 'hex'));
  let signature;
  try {
    signature = CSL.Ed25519Signature.from_bytes(Buffer.from(signatureHex, 'hex'));
    need(key.verify(signedBytes, signature), 'invalid Ed25519 signature');
  } finally { signature?.free(); key.free(); }
  return true;
}

export function validateConfig(config) {
  need(plain(config), 'missing server config');
  need(ascii(config.origin, 256) && ascii(config.uri, 256), 'invalid origin or endpoint length');
  const origin = new URL(config.origin);
  need(origin.protocol === 'https:' && origin.origin === config.origin, 'origin must be an exact HTTPS origin');
  need(!origin.username && !origin.password, 'origin credentials forbidden');
  const endpoint = new URL(config.uri);
  need(endpoint.origin === config.origin && !endpoint.search && !endpoint.hash && !endpoint.username && !endpoint.password, 'verification URI must be same-origin without query or fragment');
  need(endpoint.href === config.uri, 'URI must be canonical');
  need(ascii(config.audience, 96) && ascii(config.resource, 128), 'invalid service audience or resource');
  need(config.action === 'Verify NFT holding for demo access', 'unsupported action');
  need(plain(config.network) && ['mainnet', 'preprod', 'preview'].includes(config.network.name), 'unsupported backend network');
  const expected = { mainnet: [1, 764824073], preprod: [0, 1], preview: [0, 2] }[config.network.name];
  need(config.network.id === expected[0] && config.network.magic === expected[1], 'network config mismatch');
  assertAsset(config.asset);
  need(int(config.ttlSeconds) && config.ttlSeconds >= 30 && config.ttlSeconds <= 300, 'challenge TTL must be 30..300 seconds');
  return config;
}

export function createChallenge(CSL, config, addressHex, sessionId, nowSeconds) {
  validateConfig(config);
  need(int(nowSeconds), 'invalid server time');
  need(int(nowSeconds + config.ttlSeconds), 'expiry exceeds safe integer range');
  need(ascii(sessionId, 256) && sessionId.length >= 32, 'server session identifier required');
  const bound = paymentAddress(CSL, addressHex, config.network.id);
  const challenge = {
    protocol: 'beacn-holder-proof-v1',
    uri: config.uri,
    action: config.action,
    timestamp: nowSeconds,
    expiresAt: nowSeconds + config.ttlSeconds,
    origin: config.origin,
    audience: config.audience,
    resource: config.resource,
    network: { name: config.network.name, id: config.network.id, magic: config.network.magic },
    address: bound.addressBech32,
    asset: { policyId: config.asset.policyId, assetNameHex: config.asset.assetNameHex, minimumQuantity: '1' },
    nonce: randomBytes(32).toString('hex'),
  };
  const payload = JSON.stringify(challenge, null, 2) + '\n';
  need(/^[\x0a\x20-\x7e]+$/.test(payload) && Buffer.byteLength(payload) <= 1536, 'challenge exceeds display profile');
  const payloadHex = Buffer.from(payload, 'utf8').toString('hex');
  const record = { challenge, addressHex, payloadHex, payloadSha256: digest(Buffer.from(payloadHex, 'hex')), sessionBinding: digest(`beacn-holder-session-v1\0${sessionId}`), consumedAt: null };
  // Make a value snapshot so a mutable config or response cannot change stored scope.
  return JSON.parse(JSON.stringify(record));
}

export function assertChallengeContext(record, config, request, nowSeconds) {
  validateConfig(config);
  need(plain(record) && plain(request) && int(nowSeconds), 'invalid challenge context');
  const c = record.challenge;
  need(record.consumedAt === null, 'challenge already consumed');
  need(c.protocol === 'beacn-holder-proof-v1' && canonicalHex(c.nonce, 32, 32), 'unknown challenge profile');
  need(int(c.timestamp) && int(c.expiresAt) && nowSeconds >= c.timestamp && nowSeconds < c.expiresAt && c.expiresAt - c.timestamp <= 300, 'challenge expired or not yet valid');
  need(c.origin === config.origin && c.uri === config.uri && c.audience === config.audience && c.action === config.action && c.resource === config.resource, 'challenge scope mismatch');
  need(c.network.name === config.network.name && c.network.id === config.network.id && c.network.magic === config.network.magic, 'challenge network mismatch');
  need(assertAsset(c.asset) === assertAsset(config.asset), 'challenge asset mismatch');
  need(request.origin === config.origin && request.uri === config.uri && request.method === 'POST', 'request origin, endpoint or method mismatch');
  need(ascii(request.sessionId, 256) && request.sessionId.length >= 32, 'missing server session');
  need(equalHex(record.sessionBinding, digest(`beacn-holder-session-v1\0${request.sessionId}`)), 'challenge belongs to another session');
  need(record.payloadHex === Buffer.from(JSON.stringify(c, null, 2) + '\n', 'utf8').toString('hex'), 'stored scope differs from issued payload');
  need(equalHex(record.payloadSha256, digest(Buffer.from(record.payloadHex, 'hex'))), 'corrupt stored challenge');
  need(equalHex(request.payloadHex, record.payloadHex), 'signed payload differs from exact issued bytes');
  return true;
}

// snapshot MUST originate from a pinned server chain adapter, never request JSON.
// Its freshness/canonicality statements are trusted provider observations, not
// cryptographic inclusion proofs. This function performs no network I/O.
export function assertCurrentHolder(record, snapshot, limits, nowSeconds) {
  need(plain(snapshot) && plain(limits) && int(nowSeconds), 'missing trusted chain snapshot');
  need(int(limits.maxObservationAgeSeconds) && limits.maxObservationAgeSeconds <= 60 && int(limits.maxTipAgeSeconds) && limits.maxTipAgeSeconds <= 300 && int(limits.minimumConfirmations) && limits.minimumConfirmations >= 1, 'invalid freshness limits');
  need(snapshot.networkName === record.challenge.network.name && snapshot.networkMagic === record.challenge.network.magic, 'chain adapter network mismatch');
  need(snapshot.complete === true && snapshot.canonical === true, 'chain view incomplete or rolled back');
  need(int(snapshot.checkedAt) && snapshot.checkedAt <= nowSeconds && nowSeconds - snapshot.checkedAt <= limits.maxObservationAgeSeconds, 'chain observation stale');
  need(plain(snapshot.point) && canonicalHex(snapshot.point.blockHash, 32, 32) && int(snapshot.point.blockHeight) && int(snapshot.point.slot) && int(snapshot.point.time), 'invalid observed chain point');
  need(snapshot.point.time <= nowSeconds && nowSeconds - snapshot.point.time <= limits.maxTipAgeSeconds, 'chain tip stale');
  need(Array.isArray(snapshot.utxos) && snapshot.utxos.length <= 1000, 'chain query exceeds bounded profile');
  const unit = assertAsset(record.challenge.asset);
  const seen = new Set();
  let qualifying = null;
  for (const row of snapshot.utxos) {
    need(plain(row) && canonicalHex(row.txHash, 32, 32) && int(row.outputIndex) && row.outputIndex <= 65535, 'invalid resolved UTxO');
    const ref = `${row.txHash}#${row.outputIndex}`;
    need(!seen.has(ref), 'duplicate resolved UTxO'); seen.add(ref);
    need(row.unspent === true, 'spent result in current UTxO view');
    need(row.addressHex === record.addressHex, 'resolved UTxO does not match signed full address');
    need(int(row.createdAtHeight) && row.createdAtHeight <= snapshot.point.blockHeight && plain(row.assets), 'invalid UTxO confirmation data');
    const amount = row.assets[unit];
    if (amount !== undefined) {
      need(typeof amount === 'string' && /^[1-9][0-9]{0,19}$/.test(amount) && BigInt(amount) <= 9223372036854775807n, 'invalid chain asset quantity');
      if (snapshot.point.blockHeight - row.createdAtHeight + 1 >= limits.minimumConfirmations) qualifying = ref;
    }
  }
  need(qualifying !== null, 'required asset absent or insufficiently confirmed');
  return { assetUnit: unit, addressHex: record.addressHex, observedAt: snapshot.checkedAt, point: { ...snapshot.point }, qualifyingUtxo: qualifying };
}

// Demonstrates atomic consume after verification in ONE JS process only.
// Production needs transactional compare-and-set in a shared persistent store.
export class MemoryChallengeStore {
  #records = new Map();
  put(record) {
    const nonce = record.challenge.nonce;
    need(!this.#records.has(nonce), 'nonce collision');
    this.#records.set(nonce, structuredClone(record));
  }
  get(nonce) { const found = this.#records.get(nonce); return found ? structuredClone(found) : null; }
  consume(nonce, sessionBinding, nowSeconds) {
    const stored = this.#records.get(nonce);
    need(stored && stored.consumedAt === null, 'unknown or already consumed challenge');
    need(int(nowSeconds) && nowSeconds >= stored.challenge.timestamp && nowSeconds < stored.challenge.expiresAt, 'expired challenge at consume');
    need(equalHex(sessionBinding, stored.sessionBinding), 'session mismatch at consume');
    stored.consumedAt = nowSeconds;
    return structuredClone(stored);
  }
}
