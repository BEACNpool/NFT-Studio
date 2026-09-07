/** Portable evidence adapter. No storage, fetch, program execution or wallet calls. */
import type { CSL } from '@/lib/cardano';
import {
  DATA_LABEL,
  MAX_PAYLOAD_BYTES,
  MAX_PAYLOAD_FILES,
  PAYLOAD_TYPES,
  payloadHash,
  payloadMetadata,
  recoverPayloadMetadata,
  verifyPayloadBundle,
  type PayloadBundle,
} from '@/lib/studio-payload';

export const ARTIFACT_PASSPORT_PROFILE = 'nft-studio-exact-payload-v1' as const;
export const ARTIFACT_PASSPORT_LIMITS = Object.freeze({
  passportBytes: 240_000,
  receiptBytes: 512_000,
  transactionBytes: 16_384,
  auxiliaryBytes: 16_384,
  contentBytes: MAX_PAYLOAD_BYTES,
  contentFiles: MAX_PAYLOAD_FILES,
  provenanceFiles: 32,
  provenanceBytes: 1_048_576,
  depth: 24,
  nodes: 20_000,
  cborDepth: 16,
  cborNodes: 4096,
});
type FileCommitment = {
  path: string;
  role: 'source' | 'build-input' | 'build-output';
  bytes: number;
  sha256: string;
};
export type PassportProvenance = {
  evidence: 'declaration';
  source?: { repository: string; commit: string };
  files: FileCommitment[];
  build?: {
    tool: string;
    version: string;
    recipe: string;
    outputPaths: string[];
  };
};
type Identity =
  | { network: 'cardano-mainnet'; kind: 'data'; label: typeof DATA_LABEL }
  | {
      network: 'cardano-mainnet';
      kind: 'nft';
      policyId: string;
      assetNameHex: string;
    };
export type ArtifactPassport = {
  schema: 'beacn.artifact-passport.v1';
  profile: typeof ARTIFACT_PASSPORT_PROFILE;
  identity: Identity;
  transaction: {
    hash: string;
    auxiliaryDataHex: string;
    auxiliaryDataHash: string;
  };
  bundle: PayloadBundle;
  receiptObservation: {
    evidence: 'receipt-reported';
    state: 'signed' | 'submitted' | 'unknown' | 'confirmed';
    createdAt: number;
    checkedAt?: number;
    blocksAfterInclusion?: number;
  };
  provenance?: PassportProvenance;
  passportHash: string;
};
export type PassportEvidenceCheck = {
  id: string;
  status: 'match' | 'mismatch' | 'not-checked' | 'unverified';
  evidence:
    | 'local-byte-check'
    | 'local-transaction-check'
    | 'declaration'
    | 'receipt-reported'
    | 'none';
  message: string;
};
export type PassportVerification = {
  profile: typeof ARTIFACT_PASSPORT_PROFILE;
  status:
    | 'verified-local-content'
    | 'mismatch'
    | 'invalid-passport'
    | 'unsupported-profile';
  passportHash?: string;
  checks: PassportEvidenceCheck[];
  chainInclusionVerified: false;
  authorshipVerified: false;
  ownershipVerified: false;
  buildReproduced: false;
  signaturesVerified: false;
  error?: string;
};
export class ArtifactPassportError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ArtifactPassportError';
  }
}
function fail(message: string, code = 'INVALID_PASSPORT'): never {
  throw new ArtifactPassportError(code, message);
}
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const hashPattern = /^[a-f0-9]{64}$/;
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
/* oxlint-disable typescript/unbound-method -- Capture native intrinsics deliberately; byteSnapshot binds each real receiver with .call. */
const byteLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'byteLength',
)!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'buffer',
)!.get!;
const byteOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'byteOffset',
)!.get!;
const setBytes = Uint8Array.prototype.set;
/* oxlint-enable typescript/unbound-method */
/** Read internal typed-array slots, never caller properties or iterators. */
function byteSnapshot(value: unknown, maximum: number): Uint8Array {
  if (!(value instanceof Uint8Array)) fail('Use an ordinary byte array.');
  const length: number = byteLengthGetter.call(value);
  const buffer: ArrayBufferLike = bufferGetter.call(value);
  const offset: number = byteOffsetGetter.call(value);
  if (
    length > maximum ||
    (typeof SharedArrayBuffer !== 'undefined' &&
      buffer instanceof SharedArrayBuffer)
  )
    fail('Byte input exceeds its limit or uses shared mutable bytes.');
  const view = new Uint8Array(buffer, offset, length);
  const copy = new Uint8Array(length);
  setBytes.call(copy, view);
  return copy;
}
function sourceSnapshots(
  value: unknown,
): { path: string; bytes: Uint8Array }[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Object.getOwnPropertySymbols(value).length
  )
    fail('Provenance inputs require an inert array.');
  const length = Object.getOwnPropertyDescriptor(value, 'length')!.value;
  if (length > ARTIFACT_PASSPORT_LIMITS.provenanceFiles)
    fail('Too many provenance inputs.');
  const descriptors: Record<string, PropertyDescriptor> =
    Object.getOwnPropertyDescriptors(value);
  if (
    length > ARTIFACT_PASSPORT_LIMITS.provenanceFiles ||
    Object.keys(descriptors).length !== length + 1
  )
    fail('Too many or extended provenance inputs.');
  const result: { path: string; bytes: Uint8Array }[] = [];
  let total = 0;
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor?.enumerable || !('value' in descriptor))
      fail('Provenance inputs require inert array elements.');
    const item = descriptor.value;
    keys(item, ['path', 'bytes']);
    pathName(item.path);
    const bytes = byteSnapshot(
      item.bytes,
      ARTIFACT_PASSPORT_LIMITS.provenanceBytes - total,
    );
    total += bytes.byteLength;
    result.push({ path: item.path, bytes });
  }
  return result;
}
function ordinary(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail(`${label} must be an ordinary object.`);
}
function keys(
  value: unknown,
  allowed: string[],
  required = allowed,
): asserts value is Record<string, unknown> {
  ordinary(value, 'Record');
  if (
    Object.getOwnPropertySymbols(value).length ||
    Object.values(Object.getOwnPropertyDescriptors(value)).some(
      (d) => 'get' in d || 'set' in d,
    )
  )
    fail('Only inert JSON records are supported.');
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    fail('Missing or unsupported record field.');
}
function text(
  value: unknown,
  max: number,
  label: string,
  empty = false,
  multiline = false,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    (!empty && !value.trim()) ||
    enc.encode(value).length > max ||
    Array.from(value).some(
      (c) =>
        (c.charCodeAt(0) < 32 &&
          !(multiline && [9, 10, 13].includes(c.charCodeAt(0)))) ||
        c.charCodeAt(0) === 127,
    ) ||
    dec.decode(enc.encode(value)) !== value
  )
    fail(`${label} must be bounded, well-formed text without controls.`);
}
function integer(
  value: unknown,
  max: number,
  label: string,
  min = 0,
): asserts value is number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  )
    fail(`Invalid ${label}.`);
}
function digest(value: unknown) {
  if (typeof value !== 'string' || !hashPattern.test(value))
    fail('Invalid SHA-256 or transaction digest.');
}
function checkedHex(
  value: unknown,
  maxBytes: number,
  label: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length < 2 ||
    value.length > maxBytes * 2 ||
    !/^(?:[a-f0-9]{2})+$/.test(value)
  )
    fail(`Invalid ${label} hex.`);
}
function pathName(value: unknown): asserts value is string {
  text(value, 200, 'Provenance path');
  if (
    !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(value) ||
    value.split('/').some((part) => part === '.' || part === '..')
  )
    fail('Use a relative provenance path without traversal.');
}
/** Stable JSON profile: UTF-16 lexical object-key ordering, exact strings, ordered arrays.
 * No getters, inherited fields, cycles, unsafe numbers or arbitrary JSON serialization. */
export function canonicalPassportJson(
  value: unknown,
  maxBytes: number = ARTIFACT_PASSPORT_LIMITS.passportBytes,
): string {
  if (
    !Number.isInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > ARTIFACT_PASSPORT_LIMITS.receiptBytes
  )
    fail('Invalid JSON byte bound.');
  let nodes = 0;
  let outputBytes = 0;
  function reserve(fragment: string): string {
    outputBytes += enc.encode(fragment).length;
    if (outputBytes > maxBytes) fail('JSON exceeds its byte limit.');
    return fragment;
  }
  const active = new Set<object>();
  function visit(v: unknown, depth: number): string {
    if (
      ++nodes > ARTIFACT_PASSPORT_LIMITS.nodes ||
      depth > ARTIFACT_PASSPORT_LIMITS.depth
    )
      fail('The JSON structure exceeds its limit.');
    if (v === null || typeof v === 'boolean') return reserve(String(v));
    if (typeof v === 'number') {
      if (!Number.isSafeInteger(v) || Object.is(v, -0))
        fail('JSON numbers must be safe integers.');
      return reserve(String(v));
    }
    if (typeof v === 'string') {
      if (v.length > maxBytes || dec.decode(enc.encode(v)) !== v)
        fail('Invalid or oversized JSON text.');
      return reserve(JSON.stringify(v));
    }
    if (typeof v !== 'object' || !v) fail('Unsupported JSON value.');
    if (active.has(v)) fail('Cyclic JSON is unsupported.');
    active.add(v);
    if (
      Array.isArray(v) &&
      Object.getOwnPropertyDescriptor(v, 'length')!.value >
        ARTIFACT_PASSPORT_LIMITS.nodes
    )
      fail('Array exceeds its node limit.');
    const descriptors = Object.getOwnPropertyDescriptors(v);
    if (
      Object.getOwnPropertySymbols(v).length ||
      Object.values(descriptors).some((d) => 'get' in d || 'set' in d)
    )
      fail('Only inert JSON records are supported.');
    let result: string;
    if (Array.isArray(v)) {
      const length = descriptors.length?.value;
      if (
        Object.getPrototypeOf(v) !== Array.prototype ||
        !Number.isSafeInteger(length) ||
        length < 0 ||
        Object.keys(descriptors).length !== length + 1 ||
        length > ARTIFACT_PASSPORT_LIMITS.nodes
      )
        fail('Sparse or extended arrays are unsupported.');
      reserve('[]');
      const parts: string[] = [];
      for (let i = 0; i < length; i++) {
        const descriptor = descriptors[String(i)];
        if (!descriptor || !descriptor.enumerable)
          fail('Sparse or extended arrays are unsupported.');
        if (i) reserve(',');
        parts.push(visit(descriptor.value, depth + 1));
      }
      result = '[' + parts.join(',') + ']';
    } else {
      ordinary(v, 'JSON');
      const names = Object.keys(descriptors).sort();
      if (names.length > ARTIFACT_PASSPORT_LIMITS.nodes)
        fail('Object exceeds its node limit.');
      if (
        names.some(
          (name) =>
            name.length > maxBytes ||
            !descriptors[name].enumerable ||
            ['__proto__', 'constructor', 'prototype'].includes(name),
        )
      )
        fail('Unsupported JSON object key.');
      reserve('{}');
      result =
        '{' +
        names
          .map(
            (name, index) =>
              reserve((index ? ',' : '') + JSON.stringify(name) + ':') +
              visit(descriptors[name].value, depth + 1),
          )
          .join('') +
        '}';
    }
    active.delete(v);
    if (result.length > maxBytes) fail('JSON exceeds its byte limit.');
    return result;
  }
  const json = visit(value, 0);
  if (enc.encode(json).length > maxBytes) fail('JSON exceeds its byte limit.');
  return json;
}
function cloneJson(
  value: unknown,
  max: number = ARTIFACT_PASSPORT_LIMITS.passportBytes,
) {
  return JSON.parse(canonicalPassportJson(value, max));
}
function provenance(value: unknown): asserts value is PassportProvenance {
  keys(value, ['evidence', 'source', 'files', 'build'], ['evidence', 'files']);
  if (
    value.evidence !== 'declaration' ||
    !Array.isArray(value.files) ||
    value.files.length > ARTIFACT_PASSPORT_LIMITS.provenanceFiles
  )
    fail('Invalid provenance declaration.');
  const paths = new Set<string>();
  let total = 0;
  for (const file of value.files) {
    keys(file, ['path', 'role', 'bytes', 'sha256']);
    pathName(file.path);
    if (
      paths.has(file.path.toLowerCase()) ||
      !['source', 'build-input', 'build-output'].includes(file.role as string)
    )
      fail('Duplicate provenance path or unknown file role.');
    paths.add(file.path.toLowerCase());
    integer(
      file.bytes,
      ARTIFACT_PASSPORT_LIMITS.provenanceBytes,
      'provenance file size',
    );
    digest(file.sha256);
    total += file.bytes;
  }
  if (total > ARTIFACT_PASSPORT_LIMITS.provenanceBytes)
    fail('Provenance bytes exceed the profile limit.');
  if (value.source !== undefined) {
    keys(value.source, ['repository', 'commit']);
    if (
      typeof value.source.repository !== 'string' ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}$/.test(
        value.source.repository,
      ) ||
      !/^[a-f0-9]{40}$/.test(value.source.commit as string)
    )
      fail('Use a plain public GitHub repository URL and a full commit.');
  }
  if (value.build !== undefined) {
    keys(value.build, ['tool', 'version', 'recipe', 'outputPaths']);
    text(value.build.tool, 80, 'Build tool');
    text(value.build.version, 80, 'Build version');
    text(value.build.recipe, 1200, 'Build recipe');
    if (
      !Array.isArray(value.build.outputPaths) ||
      value.build.outputPaths.length < 1 ||
      value.build.outputPaths.length > ARTIFACT_PASSPORT_LIMITS.provenanceFiles
    )
      fail('Invalid build outputs.');
    const outputs = new Set();
    for (const path of value.build.outputPaths) {
      pathName(path);
      if (
        outputs.has(path) ||
        !value.files.some(
          (file) => file.path === path && file.role === 'build-output',
        )
      )
        fail('Build output must resolve to one declared output file.');
      outputs.add(path);
    }
  }
}
function shape(value: unknown): asserts value is ArtifactPassport {
  keys(
    value,
    [
      'schema',
      'profile',
      'identity',
      'transaction',
      'bundle',
      'receiptObservation',
      'provenance',
      'passportHash',
    ],
    [
      'schema',
      'profile',
      'identity',
      'transaction',
      'bundle',
      'receiptObservation',
      'passportHash',
    ],
  );
  if (
    value.schema !== 'beacn.artifact-passport.v1' ||
    value.profile !== ARTIFACT_PASSPORT_PROFILE
  )
    fail('Unsupported artifact passport profile.', 'UNSUPPORTED_PROFILE');
  ordinary(value.identity, 'Identity');
  if (value.identity.network !== 'cardano-mainnet')
    fail('This Studio receipt profile is mainnet only.', 'UNSUPPORTED_PROFILE');
  if (value.identity.kind === 'nft') {
    keys(value.identity, ['network', 'kind', 'policyId', 'assetNameHex']);
    if (!/^[a-f0-9]{56}$/.test(value.identity.policyId as string))
      fail('Invalid exact policy ID.');
    checkedHex(value.identity.assetNameHex, 32, 'asset name');
  } else {
    keys(value.identity, ['network', 'kind', 'label']);
    if (value.identity.kind !== 'data' || value.identity.label !== DATA_LABEL)
      fail('Unsupported Studio record identity.', 'UNSUPPORTED_PROFILE');
  }
  keys(value.transaction, ['hash', 'auxiliaryDataHex', 'auxiliaryDataHash']);
  digest(value.transaction.hash);
  digest(value.transaction.auxiliaryDataHash);
  checkedHex(
    value.transaction.auxiliaryDataHex,
    ARTIFACT_PASSPORT_LIMITS.auxiliaryBytes,
    'auxiliary data',
  );
  keys(value.bundle, [
    'schema',
    'name',
    'description',
    'files',
    'cover',
    'sha256',
    'bytes',
  ]);
  if (
    value.bundle.schema !== 'nft-studio.payload.v1' ||
    typeof value.bundle.cover !== 'boolean' ||
    !Array.isArray(value.bundle.files) ||
    value.bundle.files.length < 1 ||
    value.bundle.files.length > MAX_PAYLOAD_FILES
  )
    fail('Invalid exact-file bundle.');
  text(value.bundle.name, 64, 'Bundle name', false, true);
  text(value.bundle.description, 1024, 'Bundle description', true, true);
  digest(value.bundle.sha256);
  integer(value.bundle.bytes, MAX_PAYLOAD_BYTES, 'bundle size', 1);
  for (const file of value.bundle.files) {
    keys(file, ['name', 'mediaType', 'bytes', 'sha256', 'uri']);
    text(file.name, 64, 'File name');
    if (!(PAYLOAD_TYPES as readonly unknown[]).includes(file.mediaType))
      fail('Unsupported payload media type.');
    text(file.uri, MAX_PAYLOAD_BYTES * 4 + 100, 'Embedded file URI');
    digest(file.sha256);
    integer(file.bytes, MAX_PAYLOAD_BYTES, 'file size', 1);
  }
  keys(
    value.receiptObservation,
    ['evidence', 'state', 'createdAt', 'checkedAt', 'blocksAfterInclusion'],
    ['evidence', 'state', 'createdAt'],
  );
  if (
    value.receiptObservation.evidence !== 'receipt-reported' ||
    !['signed', 'submitted', 'unknown', 'confirmed'].includes(
      value.receiptObservation.state as string,
    )
  )
    fail('Invalid receipt observation.');
  integer(
    value.receiptObservation.createdAt,
    Number.MAX_SAFE_INTEGER,
    'receipt creation time',
  );
  if (value.receiptObservation.checkedAt !== undefined)
    integer(
      value.receiptObservation.checkedAt,
      Number.MAX_SAFE_INTEGER,
      'receipt observation time',
    );
  if (value.receiptObservation.blocksAfterInclusion !== undefined)
    integer(
      value.receiptObservation.blocksAfterInclusion,
      Number.MAX_SAFE_INTEGER,
      'reported block depth',
    );
  if (value.provenance !== undefined) provenance(value.provenance);
  digest(value.passportHash);
}
function core(value: ArtifactPassport) {
  const { passportHash: _hash, ...rest } = value;
  return rest;
}
function assetText(
  identity: Identity,
): { policyId: string; assetName: string } | undefined {
  if (identity.kind !== 'nft') return;
  let assetName: string;
  try {
    assetName = dec.decode(
      Uint8Array.from(identity.assetNameHex.match(/../g)!, (h) =>
        parseInt(h, 16),
      ),
    );
  } catch {
    return fail(
      'This payload profile needs its original UTF-8 CIP-25 v1 asset key.',
      'UNSUPPORTED_PROFILE',
    );
  }
  if (hex(enc.encode(assetName)) !== identity.assetNameHex)
    fail('Asset name bytes changed.');
  return { policyId: identity.policyId, assetName };
}
/** Bound hostile CBOR before entering WASM. Adapted from the Studio MCP preparer. */
function preflightCbor(value: string) {
  const bytes = Uint8Array.from(value.match(/../g)!, (pair) =>
    parseInt(pair, 16),
  );
  let offset = 0,
    nodes = 0;
  function walk(depth: number, allowBreak = false): boolean {
    if (
      ++nodes > ARTIFACT_PASSPORT_LIMITS.cborNodes ||
      depth > ARTIFACT_PASSPORT_LIMITS.cborDepth ||
      offset >= bytes.length
    )
      fail('CBOR structure exceeds its resource bound.');
    const first = bytes[offset++],
      major = first >>> 5,
      additional = first & 31;
    if (first === 255) {
      if (allowBreak) return false;
      fail('Unexpected CBOR break.');
    }
    let length: bigint | undefined;
    if (additional < 24) length = BigInt(additional);
    else if (additional <= 27) {
      const count = 2 ** (additional - 24);
      if (offset + count > bytes.length) fail('Truncated CBOR argument.');
      length = BigInt(0);
      for (let i = 0; i < count; i++)
        length = (length << BigInt(8)) | BigInt(bytes[offset++]);
    } else if (additional !== 31) fail('Invalid CBOR additional information.');
    if (major <= 1) {
      if (length === undefined) fail('Invalid CBOR integer.');
      return true;
    }
    if (major === 2 || major === 3) {
      if (length === undefined)
        fail(
          'Indefinite CBOR strings need another profile.',
          'UNSUPPORTED_PROFILE',
        );
      if (length > BigInt(bytes.length - offset))
        fail('Truncated CBOR string.');
      offset += Number(length);
      return true;
    }
    if (major === 4 || major === 5) {
      if (length === undefined) {
        let count = 0;
        while (walk(depth + 1, true)) count++;
        if (major === 5 && count % 2) fail('Incomplete CBOR map pair.');
      } else {
        const count = length * BigInt(major === 5 ? 2 : 1);
        if (
          count > BigInt(ARTIFACT_PASSPORT_LIMITS.cborNodes - nodes) ||
          count > BigInt(bytes.length - offset)
        )
          fail('CBOR declared collection exceeds its resource bound.');
        for (let i = 0; i < Number(count); i++) walk(depth + 1);
      }
      return true;
    }
    if (major === 6) {
      if (length === undefined) fail('Invalid CBOR tag.');
      walk(depth + 1);
      return true;
    }
    if (major === 7 && length !== undefined) return true;
    return fail('Unsupported CBOR structure.');
  }
  walk(0);
  if (offset !== bytes.length) fail('Trailing bytes in CBOR.');
}
function decodeAuxiliary(C: CSL, value: string) {
  preflightCbor(value);
  const aux = C.AuxiliaryData.from_hex(value);
  if (aux.to_hex() !== value)
    fail(
      'Auxiliary bytes must exactly match the current producer encoding.',
      'UNSUPPORTED_PROFILE',
    );
  const metadata = aux.metadata();
  if (!metadata) fail('The auxiliary data contains no metadata.');
  const decoded: Record<string, unknown> = {};
  for (let i = 0; i < metadata.keys().len(); i++) {
    const label = metadata.keys().get(i);
    decoded[label.to_str()] = JSON.parse(
      C.decode_metadatum_to_json_str(
        metadata.get(label)!,
        C.MetadataJsonSchema.NoConversions,
      ),
    );
  }
  // Do not carry unrelated auxiliary scripts or hidden metadata labels in this profile.
  const onlyMetadata = C.AuxiliaryData.new();
  onlyMetadata.set_metadata(metadata);
  if (onlyMetadata.to_hex() !== aux.to_hex())
    fail(
      'Auxiliary scripts or a different auxiliary encoding need another profile.',
      'UNSUPPORTED_PROFILE',
    );
  return { aux, decoded };
}
async function content(C: CSL, value: ArtifactPassport) {
  await verifyPayloadBundle(value.bundle);
  const { aux, decoded } = decodeAuxiliary(
    C,
    value.transaction.auxiliaryDataHex,
  );
  if (
    C.hash_auxiliary_data(aux).to_hex() !== value.transaction.auxiliaryDataHash
  )
    fail('Auxiliary-data hash mismatch.', 'MISMATCH');
  const recovered = await recoverPayloadMetadata(
    decoded,
    assetText(value.identity),
  );
  if (
    canonicalPassportJson(recovered.bundle) !==
    canonicalPassportJson(value.bundle)
  )
    fail('Recovered content differs from the passport bundle.', 'MISMATCH');
  if (
    canonicalPassportJson(decoded) !==
    canonicalPassportJson(
      payloadMetadata(recovered.bundle, assetText(value.identity)),
    )
  )
    fail(
      'Metadata contains fields outside the Studio producer profile.',
      'UNSUPPORTED_PROFILE',
    );
}
function transactionBinding(
  C: CSL,
  value: ArtifactPassport,
  transactionCborHex: string,
) {
  checkedHex(
    transactionCborHex,
    ARTIFACT_PASSPORT_LIMITS.transactionBytes,
    'transaction',
  );
  preflightCbor(transactionCborHex);
  const tx = C.FixedTransaction.from_hex(transactionCborHex);
  if (tx.to_hex() !== transactionCborHex)
    fail(
      'Transaction bytes must exactly match the current producer encoding.',
      'UNSUPPORTED_PROFILE',
    );
  if (
    tx.transaction_hash().to_hex() !== value.transaction.hash ||
    !tx.is_valid()
  )
    fail(
      'Transaction body hash or declared script-valid flag differs.',
      'MISMATCH',
    );
  const committed = tx.body().auxiliary_data_hash(),
    raw = tx.raw_auxiliary_data();
  if (
    !committed ||
    committed.to_hex() !== value.transaction.auxiliaryDataHash ||
    !raw ||
    hex(raw) !== value.transaction.auxiliaryDataHex
  )
    fail('Transaction auxiliary-data commitment differs.', 'MISMATCH');
  const outputs = tx.body().outputs();
  if (!outputs.len()) fail('The transaction has no outputs.', 'MISMATCH');
  for (let i = 0; i < outputs.len(); i++)
    if (outputs.get(i).address().network_id() !== 1)
      fail('The transaction output network differs.', 'MISMATCH');
  const network = tx.body().network_id();
  if (network && network.kind() !== 1)
    fail('The transaction body network differs.', 'MISMATCH');
  const mint = tx.body().mint();
  if (value.identity.kind === 'nft') {
    const groups = mint?.get(C.ScriptHash.from_hex(value.identity.policyId));
    const assets = groups?.get(0);
    const name = C.AssetName.new(
      Uint8Array.from(value.identity.assetNameHex.match(/../g)!, (h) =>
        parseInt(h, 16),
      ),
    );
    if (
      !mint ||
      mint.len() !== 1 ||
      groups?.len() !== 1 ||
      !assets ||
      assets.len() !== 1 ||
      assets.get(name)?.to_str() !== '1'
    )
      fail(
        'The exact selected asset is not the sole quantity-one mint.',
        'MISMATCH',
      );
  } else if (mint?.len())
    fail(
      'A Studio data receipt must not mint assets in this profile.',
      'MISMATCH',
    );
}

/** Build from actual local NFT/data receipts; prepared wallet data is never exported. */
export async function createArtifactPassport(
  C: CSL,
  receipt: unknown,
  options: { provenance?: PassportProvenance } = {},
): Promise<ArtifactPassport> {
  ordinary(receipt, 'Receipt');
  if (
    Object.values(Object.getOwnPropertyDescriptors(receipt)).some(
      (d) => 'get' in d || 'set' in d,
    )
  )
    fail('Receipt fields must be inert data.');
  // Project only the fields needed by this adapter. Do not traverse or serialize
  // prepared wallet snapshots; live receipts may contain undefined optional fields.
  const r = cloneJson(
    {
      schema: receipt.schema,
      hash: receipt.hash,
      kind: receipt.kind,
      signedHex: receipt.signedHex,
      bytes: receipt.bytes,
      state: receipt.state,
      createdAt: receipt.createdAt,
      ...(receipt.checkedAt === undefined
        ? {}
        : { checkedAt: receipt.checkedAt }),
      ...(receipt.blocksAfterInclusion === undefined
        ? {}
        : { blocksAfterInclusion: receipt.blocksAfterInclusion }),
    },
    ARTIFACT_PASSPORT_LIMITS.receiptBytes,
  );
  keys(options, ['provenance'], []);
  if (
    !r ||
    r.schema !== 'nft-studio.receipt.v1' ||
    !['nft', 'data'].includes(r.kind)
  )
    fail(
      'Only the exact-file NFT/data receipt lane is supported.',
      'UNSUPPORTED_PROFILE',
    );
  digest(r.hash);
  checkedHex(
    r.signedHex,
    ARTIFACT_PASSPORT_LIMITS.transactionBytes,
    'receipt transaction',
  );
  integer(
    r.bytes,
    ARTIFACT_PASSPORT_LIMITS.transactionBytes,
    'receipt transaction size',
    1,
  );
  if (r.signedHex.length / 2 !== r.bytes)
    fail('Receipt transaction byte count differs.', 'MISMATCH');
  preflightCbor(r.signedHex);
  const tx = C.FixedTransaction.from_hex(r.signedHex),
    raw = tx.raw_auxiliary_data(),
    committed = tx.body().auxiliary_data_hash();
  if (!raw || !committed) fail('Receipt has no committed auxiliary data.');
  const auxiliaryDataHex = hex(raw),
    { decoded } = decodeAuxiliary(C, auxiliaryDataHex);
  let identity: Identity = {
    network: 'cardano-mainnet',
    kind: 'data',
    label: DATA_LABEL,
  };
  if (r.kind === 'nft') {
    const mint = tx.body().mint();
    if (mint?.len() !== 1)
      fail('The receipt must identify one native mint.', 'UNSUPPORTED_PROFILE');
    const policy = mint.keys().get(0),
      groups = mint.get(policy);
    const assets = groups?.get(0);
    if (groups?.len() !== 1 || !assets || assets.len() !== 1)
      fail('The receipt must identify one exact asset.', 'UNSUPPORTED_PROFILE');
    identity = {
      network: 'cardano-mainnet',
      kind: 'nft',
      policyId: policy.to_hex(),
      assetNameHex: hex(assets.keys().get(0).name()),
    };
  }
  const recovered = await recoverPayloadMetadata(decoded, assetText(identity));
  const value: ArtifactPassport = {
    schema: 'beacn.artifact-passport.v1',
    profile: ARTIFACT_PASSPORT_PROFILE,
    identity,
    transaction: {
      hash: r.hash,
      auxiliaryDataHex,
      auxiliaryDataHash: committed.to_hex(),
    },
    bundle: recovered.bundle,
    receiptObservation: {
      evidence: 'receipt-reported',
      state: r.state,
      createdAt: r.createdAt,
      ...(r.checkedAt === undefined ? {} : { checkedAt: r.checkedAt }),
      ...(r.blocksAfterInclusion === undefined
        ? {}
        : { blocksAfterInclusion: r.blocksAfterInclusion }),
    },
    ...(options.provenance === undefined
      ? {}
      : { provenance: cloneJson(options.provenance) }),
    passportHash: '0'.repeat(64),
  };
  shape(value);
  await content(C, value);
  transactionBinding(C, value, r.signedHex);
  value.passportHash = await payloadHash(
    enc.encode(canonicalPassportJson(core(value))),
  );
  return cloneJson(value);
}

/** Imported bytes remain inert. Supplied transaction/provenance bytes are optional local evidence. */
export async function verifyArtifactPassport(
  C: CSL,
  input: unknown,
  options: {
    transactionCborHex?: string;
    sourceFiles?: readonly { path: string; bytes: Uint8Array }[];
  } = {},
): Promise<PassportVerification> {
  const result: PassportVerification = {
    profile: ARTIFACT_PASSPORT_PROFILE,
    status: 'invalid-passport',
    checks: [],
    chainInclusionVerified: false,
    authorshipVerified: false,
    ownershipVerified: false,
    buildReproduced: false,
    signaturesVerified: false,
  };
  const check = (
    id: string,
    status: PassportEvidenceCheck['status'],
    evidence: PassportEvidenceCheck['evidence'],
    message: string,
  ) => result.checks.push({ id, status, evidence, message });
  try {
    const value: unknown = cloneJson(input);
    shape(value);
    keys(options, ['transactionCborHex', 'sourceFiles'], []);
    const sourceFiles = sourceSnapshots(options.sourceFiles);
    const transactionCborHex = options.transactionCborHex;
    result.passportHash = await payloadHash(
      enc.encode(canonicalPassportJson(core(value))),
    );
    if (result.passportHash !== value.passportHash)
      fail('The passport checksum differs.', 'MISMATCH');
    await content(C, value);
    check(
      'passport-content',
      'match',
      'local-byte-check',
      'Canonical passport checksum, exact embedded file digests and recovery from auxiliary metadata agree. A checksum does not authenticate the exporter.',
    );
    check(
      'receipt-observation',
      'unverified',
      'receipt-reported',
      `The supplied receipt reports ${value.receiptObservation.state}; its time and block-depth fields are not chain evidence verified here.`,
    );
    if (transactionCborHex !== undefined) {
      transactionBinding(C, value, transactionCborHex);
      check(
        'transaction-binding',
        'match',
        'local-transaction-check',
        'Supplied transaction body hash, auxiliary-data bytes and selected mint/data identity agree. No signature, phase-1 or chain-inclusion verification occurred.',
      );
    } else
      check(
        'transaction-binding',
        'not-checked',
        'none',
        'Transaction bytes were not supplied; this passport alone cannot establish that its auxiliary metadata belongs to the stated transaction ID.',
      );
    if (value.provenance) {
      check(
        'source-and-build',
        'unverified',
        'declaration',
        'Repository, commit and build recipe are declarations. No repository tree, build execution, publisher identity or reproducibility was verified.',
      );
      for (const file of value.provenance.files.filter(
        (file) => file.role === 'build-output',
      )) {
        const matched = value.bundle.files.some(
          (content) =>
            content.bytes === file.bytes && content.sha256 === file.sha256,
        );
        check(
          `build-output-content:${file.path}`,
          matched ? 'match' : 'unverified',
          matched ? 'local-byte-check' : 'declaration',
          matched
            ? 'This declared output digest and size identify embedded content bytes. The build that allegedly produced them was not reproduced.'
            : 'This declared build output does not identify an embedded content file.',
        );
      }
    }
    if (sourceFiles !== undefined) {
      const supplied = new Set<string>();
      let total = 0;
      for (const item of sourceFiles) {
        keys(item, ['path', 'bytes']);
        pathName(item.path);
        if (
          !(item.bytes instanceof Uint8Array) ||
          (typeof SharedArrayBuffer !== 'undefined' &&
            item.bytes.buffer instanceof SharedArrayBuffer)
        )
          fail('Provenance bytes need an ordinary byte array.');
        total += item.bytes.byteLength;
        if (
          total > ARTIFACT_PASSPORT_LIMITS.provenanceBytes ||
          supplied.has(item.path)
        )
          fail('Duplicate or oversized provenance inputs.');
        supplied.add(item.path);
        const declaration = value.provenance?.files.find(
          (file) => file.path === item.path,
        );
        if (!declaration) fail('Supplied provenance path is not declared.');
        if (
          item.bytes.byteLength !== declaration.bytes ||
          (await payloadHash(new Uint8Array(item.bytes))) !== declaration.sha256
        )
          fail(`Provenance bytes differ for ${item.path}.`, 'MISMATCH');
        check(
          `provenance-file:${item.path}`,
          'match',
          'local-byte-check',
          'Exact supplied bytes match this declared digest; repository membership and build provenance remain unverified.',
        );
      }
      for (const file of value.provenance?.files ?? [])
        if (!supplied.has(file.path))
          check(
            `provenance-file:${file.path}`,
            'not-checked',
            'none',
            'No local bytes were supplied for this declared file.',
          );
    }
    check(
      'external-claims',
      'not-checked',
      'none',
      'No authorship, ownership, rights, truth, chain inclusion, signature validity or build reproduction is established. Imported content and build recipes were not executed.',
    );
    result.status = 'verified-local-content';
  } catch (error) {
    const code =
      error instanceof ArtifactPassportError ? error.code : 'INVALID_PASSPORT';
    result.status =
      code === 'MISMATCH'
        ? 'mismatch'
        : code === 'UNSUPPORTED_PROFILE'
          ? 'unsupported-profile'
          : 'invalid-passport';
    result.error =
      error instanceof ArtifactPassportError
        ? error.message
        : 'The passport or its exact-file/CBOR evidence could not be validated.';
    check('verification-failure', 'mismatch', 'local-byte-check', result.error);
  }
  return result;
}

/** Serialize only a structurally valid record; callers should verify before presenting it. */
export function artifactPassportBytes(input: unknown): Uint8Array {
  const value: unknown = cloneJson(input);
  shape(value);
  return enc.encode(canonicalPassportJson(value));
}
/** Explicit bounded JSON import. Duplicate keys/noncanonical encodings are rejected. */
export function parseArtifactPassport(bytes: Uint8Array): ArtifactPassport {
  const snapshot = byteSnapshot(bytes, ARTIFACT_PASSPORT_LIMITS.passportBytes);
  let value: unknown, json: string;
  try {
    json = dec.decode(snapshot);
    value = JSON.parse(json);
  } catch {
    return fail('Passport is not valid UTF-8 JSON.');
  }
  shape(value);
  if (canonicalPassportJson(value) !== json)
    fail(
      'Use the exact canonical passport JSON export; duplicate keys or reformatted JSON are unsupported.',
    );
  return value;
}
