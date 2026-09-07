/** Browser-safe deterministic CIP-68 capsule codec. No wallet/network/filesystem access. */
import { blake2b } from '@noble/hashes/blake2.js';

export const CAPSULE_SCHEMA = 'beacn.state-capsule.v1';
export const MAX_DATUM_BYTES = 4096;
export const MAX_SEQUENCE = Number.MAX_SAFE_INTEGER; // Conservative JS bound; contract accepts int64.
const utf8 = new TextEncoder();
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const check = (ok, message) => { if (!ok) throw new Error(message); };
export const toHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
export function fromHex(hex) {
  check(typeof hex === 'string' && /^(?:[0-9a-f]{2})*$/.test(hex), 'Expected lowercase, even-length hex.');
  return Uint8Array.from(hex.match(/../g) ?? [], byte => parseInt(byte, 16));
}
function textBytes(value) {
  check(typeof value === 'string' && value.isWellFormed(), 'Expected well-formed Unicode text.');
  return utf8.encode(value);
}
export function utf8Chunks(value, max = 64) {
  check(Number.isSafeInteger(max) && max >= 4 && max <= 64, 'Chunk size must be 4–64 bytes.');
  textBytes(value);
  const chunks = [];
  let chunk = '', size = 0;
  for (const codepoint of value) {
    const bytes = utf8.encode(codepoint).length;
    if (size + bytes > max) { chunks.push(chunk); chunk = ''; size = 0; }
    chunk += codepoint; size += bytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
const byteData = value => ({ bytes: toHex(textBytes(value)) });
const constr = (index, fields = []) => ({ constructor: index, fields });
const integer = value => ({ int: value });
const head = (major, value) => {
  const n = BigInt(value);
  if (n < 24n) return [(major << 5) | Number(n)];
  const length = n <= 255n ? 1 : n <= 65535n ? 2 : n <= 4294967295n ? 4 : 8;
  const out = [(major << 5) | ({ 1: 24, 2: 25, 4: 26, 8: 27 })[length]];
  for (let i = length - 1; i >= 0; i--) out.push(Number((n >> BigInt(i * 8)) & 255n));
  return out;
};
/** Matches Plutus serialiseData: definite maps/bytes, indefinite nonempty lists. */
export function serialiseData(data) {
  let visited = 0;
  function encode(value, depth = 0) {
    check(++visited <= 1024 && depth <= 12 && isObject(value), 'Plutus data exceeds structural bounds.');
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'bytes') {
      const bytes = fromHex(value.bytes);
      check(bytes.length <= 64, 'Capsule codec limits each bytestring to 64 bytes.');
      return [...head(2, bytes.length), ...bytes];
    }
    if (keys.length === 1 && keys[0] === 'int') {
      check(Number.isSafeInteger(value.int), 'Integer exceeds JavaScript safe precision.');
      return value.int >= 0 ? head(0, value.int) : head(1, -1 - value.int);
    }
    if (keys.length === 1 && keys[0] === 'list') {
      check(Array.isArray(value.list), 'Malformed Plutus list.');
      return value.list.length ? [0x9f, ...value.list.flatMap(item => encode(item, depth + 1)), 0xff] : [0x80];
    }
    if (keys.length === 1 && keys[0] === 'map') {
      check(Array.isArray(value.map), 'Malformed Plutus map.');
      return [...head(5, value.map.length), ...value.map.flatMap(pair => {
        check(isObject(pair) && Object.keys(pair).sort().join(',') === 'k,v', 'Malformed Plutus map entry.');
        return [...encode(pair.k, depth + 1), ...encode(pair.v, depth + 1)];
      })];
    }
    check(keys.sort().join(',') === 'constructor,fields' && Number.isInteger(value.constructor) && value.constructor >= 0 && value.constructor <= 6 && Array.isArray(value.fields), 'Unsupported Plutus constructor.');
    return [...head(6, 121 + value.constructor), ...encode({ list: value.fields }, depth + 1)];
  }
  return Uint8Array.from(encode(data));
}

function metadataData(value) {
  let nodes = 0;
  function convert(item, depth) {
    check(++nodes <= 256 && depth <= 4, 'Metadata exceeds 256 nodes or nesting depth 4.');
    if (typeof item === 'string') {
      const chunks = utf8Chunks(item);
      return chunks.length <= 1 ? byteData(item) : { list: chunks.map(byteData) };
    }
    if (typeof item === 'number') { check(Number.isSafeInteger(item), 'Metadata numbers must be safe integers.'); return integer(item); }
    if (Array.isArray(item)) return { list: item.map(child => convert(child, depth + 1)) };
    check(isObject(item), 'Metadata values must be text, integers, arrays or plain objects.');
    const entries = Object.entries(item).map(([key, child]) => {
      check(textBytes(key).length >= 1 && textBytes(key).length <= 64, 'Metadata keys must be 1–64 UTF-8 bytes.');
      return { k: byteData(key), v: convert(child, depth + 1) };
    }).sort((a, b) => a.k.bytes < b.k.bytes ? -1 : a.k.bytes > b.k.bytes ? 1 : 0);
    return { map: entries };
  }
  check(isObject(value), 'Metadata must be a plain object.');
  check(typeof value.name === 'string' && textBytes(value.name).length >= 1 && textBytes(value.name).length <= 64, 'Name must be 1–64 UTF-8 bytes.');
  check(typeof value.image === 'string' && /^(?:https:\/\/|ipfs:\/\/|ar:\/\/|data:image\/[a-zA-Z0-9.+-]+[;,])/.test(value.image), 'Image needs an https, ipfs, ar, or image data URI.');
  const image = utf8Chunks(value.image);
  check(image.length >= 1 && image.length <= 48, 'Image URI exceeds 48 UTF-8 chunks.');
  const data = convert(value, 0);
  data.map.find(pair => pair.k.bytes === toHex(utf8.encode('image'))).v = { list: image.map(byteData) };
  return data;
}

export function assetNames(baseName) {
  const bytes = textBytes(baseName);
  check(bytes.length >= 1 && bytes.length <= 28, 'Base asset name must be 1–28 UTF-8 bytes.');
  const baseNameHex = toHex(bytes);
  return { baseNameHex, referenceAssetNameHex: `000643b0${baseNameHex}`, userAssetNameHex: `000de140${baseNameHex}` };
}

export function buildDatum({ metadata, sequence = 0, frozen = false, previousDatumHash = '' }) {
  check(Number.isSafeInteger(sequence) && sequence >= 0, 'Sequence must be a nonnegative safe integer.');
  check(typeof frozen === 'boolean' && !(sequence === 0 && frozen), 'Genesis cannot be frozen.');
  const previous = fromHex(previousDatumHash);
  check(previous.length === (sequence === 0 ? 0 : 32), 'Genesis has an empty previous hash; later states require 32 bytes.');
  const json = constr(0, [metadataData(metadata), integer(1), constr(0, [integer(1), integer(sequence), constr(frozen ? 1 : 0), { bytes: previousDatumHash }])]);
  const cbor = serialiseData(json);
  check(cbor.length <= MAX_DATUM_BYTES, `Datum is ${cbor.length} bytes; capsule limit is ${MAX_DATUM_BYTES}.`);
  return { schema: CAPSULE_SCHEMA, metadata: structuredClone(metadata), sequence, frozen, previousDatumHash, datum: json, datumCborHex: toHex(cbor), datumHash: toHex(blake2b(cbor, { dkLen: 32 })), datumBytes: cbor.length };
}

/** Validates a complete exported state, including human-readable fields and all commitments. */
export function verifyState(state) {
  check(isObject(state) && state.schema === CAPSULE_SCHEMA, 'Unsupported capsule schema.');
  const expected = buildDatum(state);
  for (const field of ['datumCborHex', 'datumHash', 'datumBytes']) check(expected[field] === state[field], `Capsule ${field} mismatch.`);
  check(toHex(serialiseData(state.datum)) === expected.datumCborHex, 'Capsule datum JSON mismatch.');
  return expected;
}

export function transition(previous, { action = 'evolve', metadata } = {}) {
  const old = verifyState(previous);
  check(!old.frozen, 'Frozen capsules cannot evolve or unfreeze.');
  check(old.sequence < MAX_SEQUENCE, 'Sequence exhausted.');
  check(action === 'evolve' || action === 'freeze', 'Action must be evolve or freeze.');
  if (action === 'freeze' && metadata !== undefined) {
    check(toHex(serialiseData(metadataData(metadata))) === toHex(serialiseData(metadataData(old.metadata))), 'Freeze cannot also change metadata.');
  }
  return buildDatum({ metadata: metadata ?? old.metadata, sequence: old.sequence + 1, frozen: action === 'freeze', previousDatumHash: old.datumHash });
}

export function verifyHistory(states) {
  check(Array.isArray(states) && states.length >= 1 && states.length <= 1024, 'History must contain 1–1024 states.');
  const verified = states.map(verifyState);
  check(verified[0].sequence === 0, 'History must begin at genesis.');
  for (let i = 1; i < verified.length; i++) {
    const expected = transition(verified[i - 1], { action: verified[i].frozen ? 'freeze' : 'evolve', metadata: verified[i].metadata });
    check(expected.datumHash === verified[i].datumHash, `Broken history at state ${i}.`);
  }
  return { valid: true, states: verified.length, tipHash: verified.at(-1).datumHash, frozen: verified.at(-1).frozen, evidence: 'local-data-only' };
}

export const REDEEMERS = Object.freeze({ mint: 'd87980', evolve: 'd87980', freeze: 'd87a80' });
