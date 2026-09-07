// A bounded CBOR subset for the holder-proof COSE profile, not a general decoder.
// Definite lengths only. Map order and non-minimal integer encodings are retained
// in protected bstr bytes; semantic duplicate labels are rejected after decoding.
const need = (ok, message) => { if (!ok) throw new Error(`CBOR profile: ${message}`); };
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const byteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength').get;
const byteOffset = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset').get;
const arrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer').get;
const setBytes = Uint8Array.prototype.set;

// Native slots, then a bounded copy: caller getters, iterators and species never run.
// Buffer views are supported, including nonzero offsets. Shared/detached memory is not.
function snapshotBytes(input, minimum, maximum, label) {
  need(input instanceof Uint8Array, `${label} requires byte array`);
  const length = byteLength.call(input);
  const offset = byteOffset.call(input);
  const buffer = arrayBuffer.call(input);
  need(length >= minimum && length <= maximum, `${label} size`);
  need(!(typeof SharedArrayBuffer !== 'undefined' && buffer instanceof SharedArrayBuffer), `${label} shared memory unsupported`);
  const view = new Uint8Array(buffer, offset, length); // Throws for detached memory.
  const copy = new Uint8Array(length);
  setBytes.call(copy, view);
  return copy;
}

export function decodeCborProfile(input, { maxBytes = 4096, maxDepth = 6, maxItems = 128, allowTag18 = false } = {}) {
  need(Number.isSafeInteger(maxBytes) && maxBytes >= 1 && maxBytes <= 4096 && Number.isSafeInteger(maxDepth) && maxDepth >= 0 && maxDepth <= 6 && Number.isSafeInteger(maxItems) && maxItems >= 1 && maxItems <= 128, 'decoder bounds cannot exceed profile');
  const bytes = snapshotBytes(input, 1, maxBytes, 'input');
  let offset = 0;
  let items = 0;
  const take = length => {
    need(Number.isSafeInteger(length) && length >= 0 && length <= bytes.length - offset, 'truncated value');
    const value = bytes.slice(offset, offset + length); offset += length; return value;
  };
  const argument = info => {
    if (info < 24) return info;
    need(info >= 24 && info <= 27, 'indefinite or reserved length');
    const count = 2 ** (info - 24);
    let value = 0n;
    for (const byte of take(count)) value = (value << 8n) | BigInt(byte);
    need(value <= BigInt(Number.MAX_SAFE_INTEGER), 'integer or length exceeds safe range');
    return Number(value);
  };
  const read = depth => {
    need(depth <= maxDepth, 'nesting limit');
    need(++items <= maxItems, 'item limit');
    const initial = take(1)[0];
    const major = initial >> 5;
    const info = initial & 31;
    if (major === 7) {
      if (info === 20) return false;
      if (info === 21) return true;
      if (info === 22) return null;
      throw new Error('CBOR profile: floats and unsupported simple values');
    }
    const value = argument(info);
    if (major === 0) return value;
    if (major === 1) { need(value < Number.MAX_SAFE_INTEGER, 'negative integer exceeds safe range'); return -1 - value; }
    if (major === 2) return take(value);
    if (major === 3) { need(value <= 64, 'text label size'); return utf8.decode(take(value)); }
    if (major === 4) {
      need(value <= 16, 'array length');
      return Array.from({ length: value }, () => read(depth + 1));
    }
    if (major === 5) {
      need(value <= 16, 'map length');
      const map = new Map();
      for (let index = 0; index < value; index++) {
        const key = read(depth + 1);
        need(typeof key === 'string' || typeof key === 'number', 'map label must be text or integer');
        need(!map.has(key), 'duplicate map label');
        map.set(key, read(depth + 1));
      }
      return map;
    }
    if (major === 6) {
      need(allowTag18 && depth === 0 && value === 18, 'unsupported tag');
      return { tag: 18, value: read(depth + 1) };
    }
    throw new Error('CBOR profile: unsupported major type');
  };
  const result = read(0);
  need(offset === bytes.length, 'trailing bytes');
  return result;
}

// RFC 9052 Sig_structure requires definite, shortest-form length arguments.
// This encoder's only variable type is a bounded bstr; header bytes stay opaque.
function byteString(bytes) {
  const n = bytes.length;
  if (n < 24) return Buffer.concat([Buffer.from([0x40 | n]), bytes]);
  if (n <= 255) return Buffer.concat([Buffer.from([0x58, n]), bytes]);
  need(n <= 65535, 'Sig_structure bytes too long');
  return Buffer.concat([Buffer.from([0x59, n >> 8, n & 255]), bytes]);
}

export function encodeSigStructure(protectedBytes, payloadBytes) {
  const protectedSnapshot = snapshotBytes(protectedBytes, 0, 512, 'protected header');
  const payloadSnapshot = snapshotBytes(payloadBytes, 0, 1536, 'payload');
  return Buffer.concat([
    Buffer.from('846a5369676e617475726531', 'hex'), // [4], text "Signature1"
    byteString(Buffer.from(protectedSnapshot)),
    Buffer.from([0x40]), // empty external_aad
    byteString(Buffer.from(payloadSnapshot)),
  ]);
}
