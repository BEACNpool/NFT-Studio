import CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { timingSafeEqual, createHash } from 'node:crypto';
import { decodeCborProfile, encodeSigStructure } from './cbor-profile.mjs';
import { bindPaymentKey, verifyEd25519 } from './primitives.mjs';

const need = (ok, message) => { if (!ok) throw new Error(`CIP-30 proof: ${message}`); };
const bytes = (value, min, max) => value instanceof Uint8Array && value.length >= min && value.length <= max;
const hex = value => Buffer.from(value).toString('hex');
const equal = (a, b) => a.length === b.length && timingSafeEqual(a, b);
function readHex(value, min, max, label) {
  need(typeof value === 'string' && value.length >= min * 2 && value.length <= max * 2 && value.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(value), `${label} hex/size`);
  return Buffer.from(value, 'hex');
}
function map(value, allowed, label) {
  need(value instanceof Map, `${label} must be a map`);
  for (const key of value.keys()) need(allowed.has(key), `${label} unsupported label`);
  return value;
}

// Pure verification only: no wallet, signing, fetching, nonce consumption or grants.
// expected comes from the server's stored challenge, never from a replacement body.
export function verifyCip30DataSignature(dataSignature, expected) {
  need(dataSignature && typeof dataSignature === 'object', 'signature object required');
  need(Object.keys(dataSignature).length === 2 && Object.hasOwn(dataSignature, 'signature') && Object.hasOwn(dataSignature, 'key'), 'only signature and key accepted');
  const envelopeBytes = readHex(dataSignature.signature, 1, 4096, 'signature');
  const keyBytes = readHex(dataSignature.key, 1, 512, 'key');
  const expectedPayload = readHex(expected?.payloadHex, 1, 1536, 'expected payload');
  const expectedAddress = readHex(expected?.addressHex, 29, 128, 'expected address');
  let envelope = decodeCborProfile(envelopeBytes, { allowTag18: true });
  if (envelope?.tag === 18) envelope = envelope.value;
  need(Array.isArray(envelope) && envelope.length === 4, 'COSE_Sign1 must have four entries');
  const [protectedBytes, unprotectedValue, payload, signature] = envelope;
  need(bytes(protectedBytes, 1, 512), 'protected header byte string required');
  const protectedMap = map(decodeCborProfile(protectedBytes, { maxBytes: 512, maxDepth: 2, maxItems: 32 }), new Set([1, 4, 'address']), 'protected header');
  // Check cross-map duplication before applying the narrower label allowlists.
  need(unprotectedValue instanceof Map, 'unprotected header must be a map');
  for (const label of protectedMap.keys()) need(!unprotectedValue.has(label), 'duplicate protected/unprotected label');
  const unprotected = map(unprotectedValue, new Set(['hashed']), 'unprotected header');
  need(protectedMap.get(1) === -8, 'protected algorithm must be EdDSA');
  need(unprotected.has('hashed') && unprotected.get('hashed') === false, 'unhashed CIP-30 payload required');
  const address = protectedMap.get('address');
  need(bytes(address, 29, 128) && equal(address, expectedAddress), 'protected address differs from challenge');
  need(bytes(payload, 1, 1536) && equal(payload, expectedPayload), 'payload differs from exact challenge or is detached');
  need(bytes(signature, 64, 64), 'Ed25519 signature must be 64 bytes');
  const key = map(decodeCborProfile(keyBytes, { maxBytes: 512, maxDepth: 2, maxItems: 32 }), new Set([1, 2, 3, -1, -2]), 'COSE key');
  need(key.get(1) === 1 && key.get(3) === -8 && key.get(-1) === 6, 'COSE key must be OKP/EdDSA/Ed25519');
  const publicKey = key.get(-2);
  need(bytes(publicKey, 32, 32), 'public key must be 32 bytes');
  if (protectedMap.has(4) || key.has(2)) {
    const headerKid = protectedMap.get(4);
    const keyKid = key.get(2);
    need(bytes(headerKid, 1, 128) && bytes(keyKid, 1, 128) && equal(headerKid, keyKid), 'kid must be present and equal in both structures');
  }
  const identity = bindPaymentKey(CSL, hex(publicKey), hex(address), expected.networkId);
  const signedBytes = encodeSigStructure(protectedBytes, payload);
  verifyEd25519(CSL, hex(publicKey), hex(signature), signedBytes);
  return {
    ...identity,
    publicKeyHex: hex(publicKey),
    payloadHex: hex(payload),
    protectedHeaderHex: hex(protectedBytes),
    sigStructureHex: hex(signedBytes),
    payloadSha256: createHash('sha256').update(payload).digest('hex'),
  };
}
