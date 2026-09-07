import { sha256 } from '@noble/hashes/sha2.js';
import { blake2b } from '@noble/hashes/blake2.js';

/** A bounded producer/reader profile of Proposed CIP-190, not a general verifier. */
export const POE_PROFILE = 'cip190-v1-public-hashes' as const;
export const POE_LABEL = 309;
export const POE_MAX_FILES = 16;
export const POE_MAX_FILE_BYTES = 256 * 1024 * 1024;
export const POE_MAX_TOTAL_BYTES = 256 * 1024 * 1024;
export const POE_HASH_CHUNK_BYTES = 1024 * 1024;
export const POE_MAX_RECORD_BYTES = 64 * 1024;
export const POE_SPECIFICATION = Object.freeze({
  cip: 190,
  status: 'Proposed',
  version: 1,
  url: 'https://cips.cardano.org/cip/CIP-0190',
  sourceCommit: '05ee6bb05982289dbe00c4187b9d54cf90e2e276',
  vectorCommit: '98e1f25674baf977ecec5828895d4305147115dd',
  checkedAt: '2026-09-07',
});
export const POE_LIMITATIONS = Object.freeze([
  'Only content digests and algorithm identifiers are published; file bytes, names, sizes and media types stay in the local sidecar.',
  'A matching digest checks exact bytes. It does not prove authorship, rights, truth, ownership or a person’s possession of the original.',
  'A digest is not encryption: guessed or publicly known files can be matched against this public commitment.',
  'This tool creates no timestamp. Observed transaction inclusion supplies ledger timing; an imported record alone proves no inclusion.',
  'A hash cannot recover the file. Keep the original bytes and exported sidecar.',
  'This is the public hash-only profile of Proposed CIP-190, not support for signatures, encrypted records, storage retrieval, Merkle commitments or critical extensions.',
]);
export type ProofHashAlgorithm = 'sha2-256' | 'blake2b-256';
export type ProofHashes = Partial<Record<ProofHashAlgorithm, string>>;
export type ProofRecord = { v: 1; items: Array<{ hashes: ProofHashes }> };
export type ProofFile = { name: string; bytes: number; hashes: ProofHashes };
export type ProofArtifact = {
  schema: 'beacn.poe-artifact.v1';
  profile: typeof POE_PROFILE;
  specification: typeof POE_SPECIFICATION;
  record: ProofRecord;
  recordCborHex: string;
  recordSha256: string;
  chunksHex: string[];
  labelValueCborHex: string;
  metadataCborHex: string;
  files: ProofFile[];
  limitations: string[];
};
export type ProofProgress = {
  fileIndex: number;
  fileCount: number;
  bytesHashed: number;
  totalBytes: number;
};
export type ProofHashOptions = {
  algorithms?: readonly ProofHashAlgorithm[];
  signal?: AbortSignal;
  onProgress?: (progress: ProofProgress) => void;
};
export class ProofOfExistenceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProofOfExistenceError';
    this.code = code;
  }
}
function error(code: string, message: string): never {
  throw new ProofOfExistenceError(code, message);
}
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const DEFAULT_ALGORITHMS: readonly ProofHashAlgorithm[] = [
  'sha2-256',
  'blake2b-256',
];
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}
function unhex(input: string, maxBytes = POE_MAX_RECORD_BYTES * 3): Uint8Array {
  if (
    typeof input !== 'string' ||
    input.length > maxBytes * 2 ||
    input.length % 2 ||
    !/^[a-fA-F0-9]*$/.test(input)
  )
    error('MALFORMED_CBOR', 'Expected bounded hexadecimal CBOR bytes.');
  const bytes = new Uint8Array(input.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(input.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
function bytesInput(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array))
    error('INVALID_INPUT', 'File content must be Uint8Array bytes.');
  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    bytes.buffer instanceof SharedArrayBuffer
  )
    error('INVALID_INPUT', 'Shared mutable buffers are unsupported.');
  if (bytes.byteLength > POE_MAX_FILE_BYTES)
    error(
      'RESOURCE_LIMIT',
      'The local file exceeds the 256 MiB hashing limit.',
    );
}
function checkedAlgorithms(
  algorithms: readonly ProofHashAlgorithm[] = DEFAULT_ALGORITHMS,
): ProofHashAlgorithm[] {
  if (
    !Array.isArray(algorithms) ||
    algorithms.length < 1 ||
    algorithms.length > 2 ||
    new Set(algorithms).size !== algorithms.length ||
    algorithms.some((a) => !DEFAULT_ALGORITHMS.includes(a))
  )
    error('UNSUPPORTED_HASH_ALG', 'Choose SHA-256, BLAKE2b-256 or both.');
  return DEFAULT_ALGORITHMS.filter((a) => algorithms.includes(a));
}
function fileName(name: string): string {
  if (
    typeof name !== 'string' ||
    !name ||
    name.length > 256 ||
    Array.from(name).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    error(
      'INVALID_INPUT',
      'Use a local file name of 1–256 characters without controls.',
    );
  return name;
}
function checkCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > POE_MAX_FILES)
    error(
      'RESOURCE_LIMIT',
      `This producer supports 1–${POE_MAX_FILES} files per record.`,
    );
}
function checkTotal(total: number): void {
  if (!Number.isSafeInteger(total) || total > POE_MAX_TOTAL_BYTES)
    error(
      'RESOURCE_LIMIT',
      'The selected files exceed the 256 MiB total hashing limit.',
    );
}
function abort(signal?: AbortSignal): void {
  if (signal?.aborted) error('ABORTED', 'Local file hashing was cancelled.');
}
/** Hashes exact bytes without normalization, compression, salt or network access. */
export function hashProofBytes(
  bytes: Uint8Array,
  algorithms: readonly ProofHashAlgorithm[] = DEFAULT_ALGORITHMS,
): ProofHashes {
  bytesInput(bytes);
  const result: ProofHashes = {};
  for (const algorithm of checkedAlgorithms(algorithms))
    result[algorithm] = hex(
      algorithm === 'sha2-256' ? sha256(bytes) : blake2b(bytes, { dkLen: 32 }),
    );
  return result;
}

type Cbor =
  | number
  | boolean
  | null
  | string
  | Uint8Array
  | Cbor[]
  | Map<Cbor, Cbor>;
function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}
function header(major: number, value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff)
    error(
      'RESOURCE_LIMIT',
      'CBOR value exceeds this profile’s bounded integer support.',
    );
  if (value < 24) return Uint8Array.of((major << 5) | value);
  if (value < 256) return Uint8Array.of((major << 5) | 24, value);
  if (value < 65536)
    return Uint8Array.of((major << 5) | 25, value >>> 8, value & 255);
  return Uint8Array.of(
    (major << 5) | 26,
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  );
}
function encode(value: Cbor): Uint8Array {
  if (value === null) return Uint8Array.of(0xf6);
  if (typeof value === 'boolean') return Uint8Array.of(value ? 0xf5 : 0xf4);
  if (typeof value === 'number')
    return header(value < 0 ? 1 : 0, value < 0 ? -1 - value : value);
  if (typeof value === 'string') {
    const b = encoder.encode(value);
    return concat([header(3, b.length), b]);
  }
  if (value instanceof Uint8Array)
    return concat([header(2, value.length), value]);
  if (Array.isArray(value))
    return concat([header(4, value.length), ...value.map(encode)]);
  const pairs = Array.from(value, ([k, v]) => [encode(k), encode(v)]).sort(
    (a, b) => compareBytes(a[0], b[0]),
  );
  return concat([header(5, pairs.length), ...pairs.flat()]);
}
/** Strict deterministic CBOR parser. Bounded independently of attacker-supplied lengths. */
function decode(bytes: Uint8Array): Cbor {
  let offset = 0,
    nodes = 0;
  const need = (n: number) => {
    if (offset + n > bytes.length) error('MALFORMED_CBOR', 'Truncated CBOR.');
  };
  const read = (depth: number): Cbor => {
    if (depth > 12 || ++nodes > 40000)
      error('RESOURCE_LIMIT', 'CBOR exceeds local parsing limits.');
    need(1);
    const initial = bytes[offset++],
      major = initial >>> 5,
      ai = initial & 31;
    if (major === 7) {
      if (initial === 0xf4) return false;
      if (initial === 0xf5) return true;
      if (initial === 0xf6) return null;
      error(
        'MALFORMED_CBOR',
        'Floating-point and unsupported simple CBOR values are forbidden.',
      );
    }
    if (major === 6 || ai >= 28)
      error(
        'MALFORMED_CBOR',
        'Tags, indefinite lengths and reserved CBOR encodings are forbidden.',
      );
    let length = ai;
    if (ai >= 24) {
      const n = 2 ** (ai - 24);
      need(n);
      let value = BigInt(0);
      for (let i = 0; i < n; i++)
        value = (value << BigInt(8)) | BigInt(bytes[offset++]);
      const min = BigInt(
        ai === 24 ? 24 : ai === 25 ? 256 : ai === 26 ? 65536 : 4294967296,
      );
      if (value < min)
        error('MALFORMED_CBOR', 'Non-minimal CBOR integer or length.');
      if (value > BigInt(Number.MAX_SAFE_INTEGER))
        error(
          'RESOURCE_LIMIT',
          'CBOR integer exceeds exact local number support.',
        );
      length = Number(value);
    }
    if (major === 0) return length;
    if (major === 1) return -1 - length;
    if (major === 2 || major === 3) {
      need(length);
      const part = bytes.slice(offset, offset + length);
      offset += length;
      if (major === 2) return part;
      if (
        part.length >= 3 &&
        part[0] === 0xef &&
        part[1] === 0xbb &&
        part[2] === 0xbf
      )
        error('MALFORMED_CBOR', 'UTF-8 byte-order marks are forbidden.');
      try {
        return decoder.decode(part);
      } catch {
        error('MALFORMED_CBOR', 'Invalid UTF-8 text.');
      }
    }
    if (length > bytes.length - offset)
      error('MALFORMED_CBOR', 'Impossible CBOR container length.');
    if (major === 4) {
      const array: Cbor[] = [];
      for (let i = 0; i < length; i++) array.push(read(depth + 1));
      return array;
    }
    if (major === 5) {
      const map = new Map<Cbor, Cbor>();
      let previous: Uint8Array | undefined;
      for (let i = 0; i < length; i++) {
        const start = offset,
          key = read(depth + 1),
          encodedKey = bytes.slice(start, offset);
        if (previous && compareBytes(previous, encodedKey) >= 0)
          error(
            'MALFORMED_CBOR',
            'Map keys are duplicated or not in canonical order.',
          );
        previous = encodedKey;
        map.set(key, read(depth + 1));
      }
      return map;
    }
    error('MALFORMED_CBOR', 'Unsupported CBOR type.');
  };
  const value = read(0);
  if (offset !== bytes.length)
    error('MALFORMED_CBOR', 'Trailing bytes after CBOR value.');
  return value;
}
function asMap(value: Cbor, label: string): Map<Cbor, Cbor> {
  if (!(value instanceof Map))
    error('SCHEMA_INVALID_TYPE', `${label} must be a map.`);
  return value;
}
function hashesMap(hashes: ProofHashes): Map<Cbor, Cbor> {
  return new Map(
    Object.entries(hashes).map(([algorithm, digest]) => [
      algorithm,
      unhex(digest!, 32),
    ]),
  );
}
function encodeRecord(record: ProofRecord): Uint8Array {
  return encode(
    new Map<Cbor, Cbor>([
      ['v', 1],
      [
        'items',
        record.items.map(
          (item) => new Map<Cbor, Cbor>([['hashes', hashesMap(item.hashes)]]),
        ),
      ],
    ]),
  );
}
/** Reads only the public hashes profile. Other CIP-190 features are unsupported, never silently stripped. */
export function decodeProofOfExistenceBody(recordCborHex: string): ProofRecord {
  const bytes = unhex(recordCborHex, POE_MAX_RECORD_BYTES);
  if (!bytes.length) error('MALFORMED_CBOR', 'Empty record body.');
  const root = asMap(decode(bytes), 'Record');
  if (root.get('v') !== 1)
    error(
      'SCHEMA_INVALID_LITERAL',
      'This reader supports record version 1 only.',
    );
  for (const key of root.keys()) {
    if (typeof key !== 'string')
      error('SCHEMA_INVALID_TYPE', 'Record map keys must be text.');
    if (!['v', 'items'].includes(key))
      error(
        'UNSUPPORTED_PROFILE',
        `Record field ${key} is outside the public hashes profile; no full CIP-190 verdict is made.`,
      );
  }
  const items = root.get('items');
  if (!Array.isArray(items) || items.length === 0)
    error(
      'SCHEMA_EMPTY_RECORD',
      'The public hashes profile requires at least one item.',
    );
  if (items.length > 1024)
    error(
      'RESOURCE_LIMIT',
      'The record exceeds the local reader’s item limit.',
    );
  const result: ProofRecord = { v: 1, items: [] };
  for (const value of items) {
    const item = asMap(value, 'Item');
    for (const key of item.keys())
      if (key !== 'hashes')
        error(
          'UNSUPPORTED_PROFILE',
          'Only hashes are supported in an item; URI, encryption or unknown fields are not verified.',
        );
    const hashes = asMap(item.get('hashes') ?? null, 'Hashes');
    if (hashes.size === 0)
      error('SCHEMA_EMPTY_HASHES', 'An item must contain a hash.');
    const projected: ProofHashes = {};
    for (const [algorithm, digest] of hashes) {
      if (
        typeof algorithm !== 'string' ||
        !DEFAULT_ALGORITHMS.includes(algorithm as ProofHashAlgorithm)
      )
        error('UNSUPPORTED_HASH_ALG', 'Unregistered content-hash algorithm.');
      if (!(digest instanceof Uint8Array) || digest.length !== 32)
        error(
          'HASH_DIGEST_LENGTH_MISMATCH',
          'A content digest must be 32 raw bytes.',
        );
      projected[algorithm as ProofHashAlgorithm] = hex(digest);
    }
    result.items.push({ hashes: projected });
  }
  return result;
}
export function decodeProofOfExistenceCarriage(labelValueCborHex: string): {
  record: ProofRecord;
  recordCborHex: string;
  chunksHex: string[];
} {
  const value = decode(unhex(labelValueCborHex));
  if (!Array.isArray(value))
    error(
      'MALFORMED_CBOR',
      'Label 309 must contain a definite array of byte strings.',
    );
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const chunk of value) {
    if (!(chunk instanceof Uint8Array))
      error('MALFORMED_CBOR', 'Every transport chunk must be a byte string.');
    if (chunk.length > 64)
      error('CHUNK_TOO_LARGE', 'A transport chunk exceeds 64 bytes.');
    total += chunk.length;
    if (total > POE_MAX_RECORD_BYTES)
      error(
        'RESOURCE_LIMIT',
        'The record exceeds the local decoder resource limit.',
      );
    chunks.push(chunk);
  }
  const recordCborHex = hex(concat(chunks));
  return {
    record: decodeProofOfExistenceBody(recordCborHex),
    recordCborHex,
    chunksHex: chunks.map(hex),
  };
}
function artifact(files: ProofFile[]): ProofArtifact {
  const record: ProofRecord = {
    v: 1,
    items: files.map((file) => ({ hashes: { ...file.hashes } })),
  };
  const body = encodeRecord(record),
    chunks: Uint8Array[] = [];
  for (let offset = 0; offset < body.length; offset += 64)
    chunks.push(body.slice(offset, offset + 64));
  const recordCborHex = hex(body);
  decodeProofOfExistenceBody(recordCborHex);
  return {
    schema: 'beacn.poe-artifact.v1',
    profile: POE_PROFILE,
    specification: POE_SPECIFICATION,
    record,
    recordCborHex,
    recordSha256: hex(sha256(body)),
    chunksHex: chunks.map(hex),
    labelValueCborHex: hex(encode(chunks)),
    metadataCborHex: hex(encode(new Map<Cbor, Cbor>([[POE_LABEL, chunks]]))),
    files: files.map((file) => ({ ...file, hashes: { ...file.hashes } })),
    limitations: [...POE_LIMITATIONS],
  };
}
export function buildProofOfExistenceBytes(
  inputs: readonly { name: string; bytes: Uint8Array }[],
  algorithms: readonly ProofHashAlgorithm[] = DEFAULT_ALGORITHMS,
): ProofArtifact {
  if (!Array.isArray(inputs))
    error('INVALID_INPUT', 'Choose an array of local files.');
  checkCount(inputs.length);
  const selected = checkedAlgorithms(algorithms);
  let total = 0;
  for (const input of inputs) {
    fileName(input?.name);
    bytesInput(input?.bytes);
    total += input.bytes.byteLength;
  }
  checkTotal(total);
  return artifact(
    inputs.map((input) => ({
      name: input.name,
      bytes: input.bytes.byteLength,
      hashes: hashProofBytes(input.bytes, selected),
    })),
  );
}
/** File reads are sequential 1 MiB slices. No file bytes, names or MIME types enter metadata. */
export async function buildProofOfExistenceFiles(
  files: readonly File[],
  options: ProofHashOptions = {},
): Promise<ProofArtifact> {
  if (!Array.isArray(files))
    error('INVALID_INPUT', 'Choose an array of local files.');
  checkCount(files.length);
  const selected = checkedAlgorithms(options.algorithms);
  let total = 0,
    done = 0;
  const result: ProofFile[] = [];
  const inputs = files.map((file) => {
    if (!(file instanceof Blob))
      error('INVALID_INPUT', 'Choose genuine local File objects.');
    const name = fileName((file as File).name),
      size = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')!.get!.call(
        file,
      ) as number;
    if (!Number.isSafeInteger(size) || size < 0 || size > POE_MAX_FILE_BYTES)
      error('RESOURCE_LIMIT', 'A local file exceeds 256 MiB.');
    total += size;
    return { file, name, size };
  });
  checkTotal(total);
  abort(options.signal);
  for (let i = 0; i < files.length; i++) {
    const { file, name, size } = inputs[i],
      states = selected.map((algorithm) => ({
        algorithm,
        state:
          algorithm === 'sha2-256'
            ? sha256.create()
            : blake2b.create({ dkLen: 32 }),
      }));
    for (let offset = 0; offset < size; offset += POE_HASH_CHUNK_BYTES) {
      abort(options.signal);
      const slice = Blob.prototype.slice.call(
        file,
        offset,
        Math.min(size, offset + POE_HASH_CHUNK_BYTES),
      );
      const chunk = new Uint8Array(
        await Blob.prototype.arrayBuffer.call(slice),
      );
      abort(options.signal);
      for (const { state } of states) state.update(chunk);
      done += chunk.byteLength;
      options.onProgress?.({
        fileIndex: i,
        fileCount: files.length,
        bytesHashed: done,
        totalBytes: total,
      });
    }
    const hashes: ProofHashes = {};
    for (const { algorithm, state } of states)
      hashes[algorithm] = hex(state.digest());
    result.push({ name, bytes: size, hashes });
    abort(options.signal);
  }
  options.onProgress?.({
    fileIndex: files.length - 1,
    fileCount: files.length,
    bytesHashed: done,
    totalBytes: total,
  });
  return artifact(result);
}
export type ProofVerification = {
  status: 'match' | 'mismatch' | 'invalid-record' | 'unsupported-profile';
  matches: boolean;
  itemIndex: number;
  algorithms: ProofHashAlgorithm[];
  code?: string;
  message: string;
};
export function verifyProofOfExistenceBytes(
  recordCborHex: string,
  bytes: Uint8Array,
  itemIndex = 0,
): ProofVerification {
  try {
    bytesInput(bytes);
    const record = decodeProofOfExistenceBody(recordCborHex);
    if (
      !Number.isInteger(itemIndex) ||
      itemIndex < 0 ||
      itemIndex >= record.items.length
    )
      error('INVALID_INPUT', 'Choose an existing item index.');
    const expected = record.items[itemIndex].hashes,
      algorithms = Object.keys(expected) as ProofHashAlgorithm[],
      actual = hashProofBytes(bytes, algorithms);
    const matches = algorithms.every(
      (algorithm) => actual[algorithm] === expected[algorithm],
    );
    return {
      status: matches ? 'match' : 'mismatch',
      matches,
      itemIndex,
      algorithms,
      message: matches
        ? 'Every declared digest matches these exact local bytes. Chain inclusion and authorship are not checked.'
        : 'These local bytes do not match every declared digest.',
    };
  } catch (cause) {
    const e =
      cause instanceof ProofOfExistenceError
        ? cause
        : new ProofOfExistenceError(
            'INVALID_INPUT',
            'Unable to inspect this record.',
          );
    return {
      status:
        e.code === 'UNSUPPORTED_PROFILE' || e.code === 'RESOURCE_LIMIT'
          ? 'unsupported-profile'
          : 'invalid-record',
      matches: false,
      itemIndex,
      algorithms: [],
      code: e.code,
      message: e.message,
    };
  }
}

/** Streaming local file verification; metadata never acts as a file path or fetch URL. */
export async function verifyProofOfExistenceFile(
  recordCborHex: string,
  file: File,
  itemIndex = 0,
  options: Omit<ProofHashOptions, 'algorithms'> = {},
): Promise<ProofVerification> {
  try {
    const record = decodeProofOfExistenceBody(recordCborHex);
    if (
      !Number.isInteger(itemIndex) ||
      itemIndex < 0 ||
      itemIndex >= record.items.length
    )
      error('INVALID_INPUT', 'Choose an existing item index.');
    const expected = record.items[itemIndex].hashes,
      algorithms = Object.keys(expected) as ProofHashAlgorithm[];
    const actual = (
      await buildProofOfExistenceFiles([file], { ...options, algorithms })
    ).files[0].hashes;
    const matches = algorithms.every(
      (algorithm) => actual[algorithm] === expected[algorithm],
    );
    return {
      status: matches ? 'match' : 'mismatch',
      matches,
      itemIndex,
      algorithms,
      message: matches
        ? 'Every declared digest matches these exact local file bytes. Chain inclusion and authorship are not checked.'
        : 'This local file does not match every declared digest.',
    };
  } catch (cause) {
    const e =
      cause instanceof ProofOfExistenceError
        ? cause
        : new ProofOfExistenceError(
            'INVALID_INPUT',
            'Unable to inspect this record or local file.',
          );
    return {
      status:
        e.code === 'UNSUPPORTED_PROFILE' || e.code === 'RESOURCE_LIMIT'
          ? 'unsupported-profile'
          : 'invalid-record',
      matches: false,
      itemIndex,
      algorithms: [],
      code: e.code,
      message: e.message,
    };
  }
}
