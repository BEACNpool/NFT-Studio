// TEST ONLY. Independent encoder and native Node Ed25519 signing.
// Keys are generated as in-memory KeyObjects, never exported or written.
// This module never imports the production parser or Sig_structure encoder.
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { blake2b } from '@noble/hashes/blake2.js';

export const raw = value => ({ rawCbor: Buffer.from(value, typeof value === 'string' ? 'hex' : undefined) });
export const pairs = entries => ({ mapPairs: entries });
const prefix = (major, n) => {
  if (n <= 23) return Buffer.from([major * 32 + n]);
  const size = n <= 255 ? 1 : n <= 65535 ? 2 : 4;
  const result = Buffer.alloc(size + 1);
  result[0] = major * 32 + ({ 1: 24, 2: 25, 4: 26 })[size];
  result.writeUIntBE(n, 1, size); return result;
};
export function independentEncode(value) {
  if (value?.rawCbor) return Buffer.from(value.rawCbor);
  if (value === null) return Buffer.from([0xf6]);
  if (value === true || value === false) return Buffer.from([value ? 0xf5 : 0xf4]);
  if (typeof value === 'number') return prefix(value < 0 ? 1 : 0, value < 0 ? -value - 1 : value);
  if (typeof value === 'string') { const bytes = Buffer.from(value); return Buffer.concat([prefix(3, bytes.length), bytes]); }
  if (value instanceof Uint8Array) return Buffer.concat([prefix(2, value.length), value]);
  if (Array.isArray(value)) return Buffer.concat([prefix(4, value.length), ...value.map(independentEncode)]);
  const entries = value?.mapPairs ?? (value instanceof Map ? [...value] : null);
  if (entries) return Buffer.concat([prefix(5, entries.length), ...entries.flatMap(([k, v]) => [independentEncode(k), independentEncode(v)])]);
  throw new Error('Unsupported fixture value');
}
export const hx = value => Buffer.from(value).toString('hex');
export const bh = value => Buffer.from(value, 'hex');

export function fixtureFactory() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicBytes = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  const paymentHash = hx(blake2b(publicBytes, { dkLen: 28 }));
  const enterprise = '61' + paymentHash;
  const base = '01' + paymentHash + '14'.repeat(28);
  const pointer = '41' + paymentHash + '010203';
  const reward = 'e1' + paymentHash;
  const script = '71' + paymentHash;
  function make(options = {}) {
    const addressHex = options.addressHex ?? enterprise;
    const payload = Object.hasOwn(options, 'payload') ? options.payload : Buffer.from('BEACN synthetic holder proof');
    const protectedEntries = options.protectedEntries ?? [[1, -8], ['address', bh(addressHex)]];
    const protectedBytes = options.protectedBytes ?? independentEncode(pairs(protectedEntries));
    const unprotectedEntries = options.unprotectedEntries ?? [['hashed', false]];
    const keyEntries = options.keyEntries ?? [[1, 1], [3, -8], [-1, 6], [-2, publicBytes]];
    const sigStructure = independentEncode([options.context ?? 'Signature1', options.signedProtectedBytes ?? protectedBytes, options.externalAad ?? Buffer.alloc(0), options.signedPayload ?? (payload ?? Buffer.alloc(0))]);
    const signature = options.signature ?? sign(null, sigStructure, privateKey);
    if (!options.signature && !verify(null, sigStructure, publicKey, signature)) throw new Error('Native signature verification failed');
    const envelope = independentEncode([protectedBytes, pairs(unprotectedEntries), payload, signature]);
    const signatureBytes = options.tag18 ? Buffer.concat([Buffer.from([0xd2]), envelope]) : envelope;
    return {
      signature: hx(signatureBytes), key: hx(independentEncode(pairs(keyEntries))),
      expected: { addressHex, payloadHex: hx(options.expectedPayload ?? payload ?? Buffer.alloc(0)), networkId: addressHex.startsWith('60') ? 0 : 1 },
      publicKeyHex: hx(publicBytes), protectedHeaderHex: hx(protectedBytes), sigStructureHex: hx(sigStructure), signatureHex: hx(signature),
    };
  }
  return { make, publicBytes, paymentHash, enterprise, base, pointer, reward, script };
}
