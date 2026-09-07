import type { CSL } from './cardano';
import { canonicalPassportJson } from './artifact-passport';
import { payloadHash } from './studio-payload';
import {
  MUSIC_RELEASE_PROFILE,
  recoverMusicRelease,
  verifyMusicRelease,
  type MusicReleasePackage,
} from './music-release';

export const MUSIC_RECEIPT_LIMITS = Object.freeze({
  jsonBytes: 512000,
  transactionBytes: 16384,
  cborDepth: 16,
  cborNodes: 4096,
  jsonDepth: 24,
  jsonNodes: 20000,
});
export type MusicReceiptErrorCode =
  | 'INVALID_MUSIC_RECEIPT'
  | 'MISMATCH'
  | 'UNSUPPORTED_PROFILE'
  | 'NOT_MUSIC_TRANSACTION';
export class MusicReceiptError extends Error {
  constructor(
    public readonly code: MusicReceiptErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MusicReceiptError';
  }
}
export type MusicReceiptState =
  | 'signed'
  | 'submitting'
  | 'submitted'
  | 'unknown'
  | 'confirmed';
export type MusicReceiptClaims = Readonly<{
  metadataProfile?: typeof MUSIC_RELEASE_PROFILE;
  musicPackageHash?: string;
  policyId?: string;
  assetName?: string;
  metadata?: unknown;
  musicRelease?: unknown;
  bundle?: unknown;
}>;
/** Minimum supported packet fields. Runtime input remains unknown and is checked. */
export type MusicReceiptPacket = MusicReceiptClaims &
  Readonly<{
    schema: 'nft-studio.receipt.v1';
    kind: 'nft';
    hash: string;
    signedHex: string;
    bytes: number;
    state: MusicReceiptState;
    createdAt: number;
    checkedAt?: number;
    blocksAfterInclusion?: number;
    prepared?: unknown;
  }>;
export type MusicReviewPacket = MusicReceiptClaims &
  Readonly<{
    schema: 'nft-studio.review.v1';
    mode: 'nft';
    hash: string;
    unsignedHex: string;
    createdAt: number;
  }>;
function fail(
  message: string,
  code: MusicReceiptErrorCode = 'INVALID_MUSIC_RECEIPT',
): never {
  throw new MusicReceiptError(code, message);
}
const enc = new TextEncoder(),
  dec = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const hex = (v: Uint8Array) =>
  Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('');
const digest = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function canonical(v: unknown) {
  return canonicalPassportJson(v, MUSIC_RECEIPT_LIMITS.jsonBytes);
}

export type MusicReceiptRecovery = Readonly<{
  schema: 'beacn.music-recovery.v1';
  status: 'verified-local-content';
  musicRelease: MusicReleasePackage;
  identity: Readonly<{
    network: 'cardano-mainnet';
    policyId: string;
    assetName: string;
    assetNameHex: string;
  }>;
  transaction: Readonly<{
    hash: string;
    bytes: number;
    packetKind: 'signed-receipt' | 'unsigned-review';
    auxiliaryDataHash: string;
    metadataBytes: number;
    paymentWitnessCount: number;
  }>;
  receiptObservation: Readonly<{
    evidence: 'receipt-reported';
    state: string;
    createdAt: number;
    checkedAt?: number;
    blocksAfterInclusion?: number;
  }>;
  checks: Readonly<{
    bodyHash: 'matched';
    auxiliaryCommitment: 'matched';
    mintIdentity: 'matched';
    exactFilesAndCredits: 'matched';
    suppliedSidecars: 'matched-when-present';
    nativeProducerShape: 'matched';
    paymentSignatures: 'not-checked';
    transactionValidity: 'not-checked';
    chainInclusion: 'not-checked';
    ownership: 'not-checked';
    rights: 'not-checked';
  }>;
}>;

/** Reject duplicate JSON keys and excessive structure before native JSON parsing.
 * JSON formatting may be pretty or compact; exported ordinary receipts are pretty.
 */
function parseJson(source: string): unknown {
  if (
    source.length > MUSIC_RECEIPT_LIMITS.jsonBytes ||
    enc.encode(source).length > MUSIC_RECEIPT_LIMITS.jsonBytes ||
    dec.decode(enc.encode(source)) !== source
  )
    fail('Music receipt exceeds 512 KB or is not valid UTF-8.');
  let pos = 0,
    nodes = 0;
  const whitespace = () => {
    while (pos < source.length && /[ \t\r\n]/.test(source[pos])) pos++;
  };
  function string(): string {
    const start = pos++;
    while (pos < source.length) {
      const char = source[pos++];
      if (char === '\\') {
        pos++;
        continue;
      }
      if (char === '"') {
        try {
          return JSON.parse(source.slice(start, pos));
        } catch {
          return fail('Invalid JSON string.');
        }
      }
    }
    return fail('Unterminated JSON string.');
  }
  function visit(depth: number): void {
    if (
      ++nodes > MUSIC_RECEIPT_LIMITS.jsonNodes ||
      depth > MUSIC_RECEIPT_LIMITS.jsonDepth
    )
      fail('Receipt JSON structure exceeds its bound.');
    whitespace();
    const first = source[pos];
    if (first === '"') {
      string();
      return;
    }
    if (first === '{' || first === '[') {
      const map = first === '{',
        end = map ? '}' : ']';
      pos++;
      whitespace();
      if (source[pos] === end) {
        pos++;
        return;
      }
      const names = new Set<string>();
      while (pos < source.length) {
        if (map) {
          if (source[pos] !== '"') fail('Invalid JSON object key.');
          const key = string();
          if (names.has(key)) fail('Duplicate JSON receipt field.');
          names.add(key);
          whitespace();
          if (source[pos++] !== ':') fail('Invalid JSON object separator.');
        }
        visit(depth + 1);
        whitespace();
        const separator = source[pos++];
        if (separator === end) return;
        if (separator !== ',') fail('Invalid JSON collection separator.');
        whitespace();
      }
      fail('Unterminated JSON collection.');
    }
    const start = pos;
    while (pos < source.length && !/[ \t\r\n,}\]]/.test(source[pos])) pos++;
    const token = source.slice(start, pos);
    if (
      !/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)$/.test(
        token,
      )
    )
      fail('Invalid JSON primitive.');
  }
  visit(0);
  whitespace();
  if (pos !== source.length) fail('Trailing JSON content.');
  return JSON.parse(source);
}
function record(value: unknown, label: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail(`${label} must be a plain record.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).length > 128 ||
    Object.getOwnPropertySymbols(value).length ||
    Object.values(descriptors).some(
      (d) => !d.enumerable || !Object.hasOwn(d, 'value'),
    )
  )
    fail(`${label} must contain bounded plain data fields.`);
  return value as Record<string, unknown>;
}
const selectedFields = [
  'hash',
  'mode',
  'metadataProfile',
  'musicPackageHash',
  'policyId',
  'assetName',
  'metadata',
  'musicRelease',
  'bundle',
  'unsignedHex',
] as const;
function projection(value: unknown) {
  const input = record(
    typeof value === 'string' ? parseJson(value) : value,
    'Receipt',
  );
  const projected: Record<string, unknown> = {};
  for (const key of [
    'schema',
    'kind',
    'mode',
    'signedHex',
    'bytes',
    'state',
    'createdAt',
    'checkedAt',
    'blocksAfterInclusion',
    ...selectedFields,
  ])
    if (input[key] !== undefined) projected[key] = input[key];
  if (input.prepared !== undefined) {
    const prepared = record(input.prepared, 'Preparation');
    const selected: Record<string, unknown> = {};
    for (const key of selectedFields)
      if (prepared[key] !== undefined) selected[key] = prepared[key];
    projected.prepared = selected;
  }
  // Deliberately do not traverse or return unrelated prepared wallet data.
  return JSON.parse(canonical(projected)) as Record<string, unknown>;
}
type Node = {
  start: number;
  end: number;
  major: number;
  value?: bigint;
  text?: string;
  children: Node[];
};
function inspectCbor(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length < 2 ||
    value.length > MUSIC_RECEIPT_LIMITS.transactionBytes * 2 ||
    !/^(?:[a-f0-9]{2})+$/.test(value)
  )
    fail('Use bounded lowercase transaction CBOR hex.');
  const bytes = Uint8Array.from(value.match(/../g)!, (pair) =>
    parseInt(pair, 16),
  );
  let offset = 0,
    nodes = 0;
  const walk = (depth: number): Node => {
    if (
      ++nodes > MUSIC_RECEIPT_LIMITS.cborNodes ||
      depth > MUSIC_RECEIPT_LIMITS.cborDepth ||
      offset >= bytes.length
    )
      fail('CBOR structure exceeds its bound.');
    const start = offset,
      first = bytes[offset++],
      major = first >>> 5,
      additional = first & 31;
    if (first === 255 || (additional > 27 && additional !== 31))
      fail('Invalid CBOR item.');
    let n: bigint | undefined;
    if (additional < 24) n = BigInt(additional);
    else if (additional <= 27) {
      const count = 2 ** (additional - 24);
      if (offset + count > bytes.length) fail('Truncated CBOR argument.');
      n = BigInt(0);
      for (let i = 0; i < count; i++)
        n = (n << BigInt(8)) | BigInt(bytes[offset++]);
      const minimum = [
        BigInt(24),
        BigInt(256),
        BigInt(65536),
        BigInt(4294967296),
      ][additional - 24];
      if (n < minimum) fail('Nonminimal CBOR argument.');
    }
    const node: Node = { start, end: offset, major, value: n, children: [] };
    if (major <= 1) {
      if (n === undefined) fail('Invalid CBOR integer.');
    } else if (major === 2 || major === 3) {
      if (n === undefined || n > BigInt(bytes.length - offset))
        fail('Invalid or indefinite CBOR string.');
      const raw = bytes.subarray(offset, offset + Number(n));
      offset += Number(n);
      if (major === 3) {
        try {
          node.text = dec.decode(raw);
        } catch {
          fail('Invalid CBOR UTF-8 text.');
        }
      } else node.text = hex(raw);
    } else if (major === 4 || major === 5) {
      const count =
        n === undefined ? undefined : n * BigInt(major === 5 ? 2 : 1);
      if (
        count !== undefined &&
        (count > BigInt(MUSIC_RECEIPT_LIMITS.cborNodes - nodes) ||
          count > BigInt(bytes.length - offset))
      )
        fail('CBOR declared collection exceeds its bound.');
      if (count === undefined) {
        while (offset < bytes.length && bytes[offset] !== 255)
          node.children.push(walk(depth + 1));
        if (bytes[offset++] !== 255) fail('Unterminated CBOR collection.');
      } else
        for (let i = 0; i < Number(count); i++)
          node.children.push(walk(depth + 1));
      if (major === 5) {
        if (node.children.length % 2) fail('Incomplete CBOR map.');
        const keys = new Set<string>();
        for (let i = 0; i < node.children.length; i += 2) {
          const k = node.children[i];
          if (k.major > 3)
            fail('This transaction profile requires primitive CBOR map keys.');
          const key = `${k.major}:${k.major < 2 ? k.value : k.text}`;
          if (keys.has(key)) fail('Duplicate CBOR map key.');
          keys.add(key);
        }
      }
    } else if (major === 6) {
      if (n === undefined) fail('Invalid CBOR tag.');
      node.children.push(walk(depth + 1));
    } else if (major !== 7 || ![20, 21, 22].includes(additional))
      fail('Unsupported CBOR primitive.');
    node.end = offset;
    return node;
  };
  const tree = walk(0);
  if (offset !== bytes.length) fail('Trailing transaction CBOR.');
  if (
    tree.major !== 4 ||
    tree.children.length !== 4 ||
    tree.children[0].major !== 5 ||
    tree.children[1].major !== 5 ||
    tree.children[2].major !== 7 ||
    tree.children[2].value !== BigInt(21)
  )
    fail(
      'Expected a four-field transaction with a true script-valid declaration.',
    );
  return {
    value,
    tree,
    raw: (node: Node) => value.slice(node.start * 2, node.end * 2),
  };
}
function decodeTransaction(C: CSL, input: unknown) {
  const parsed = inspectCbor(input);
  const fixed = C.FixedTransaction.from_hex(parsed.value);
  if (fixed.to_hex() !== parsed.value || !fixed.is_valid())
    fail(
      'Transaction encoding differs from the supported producer profile.',
      'UNSUPPORTED_PROFILE',
    );
  const raw = fixed.raw_auxiliary_data(),
    committed = fixed.body().auxiliary_data_hash();
  if (!raw || !committed) fail('Transaction has no committed auxiliary data.');
  const aux = C.AuxiliaryData.from_hex(hex(raw));
  if (
    aux.to_hex() !== hex(raw) ||
    C.hash_auxiliary_data(aux).to_hex() !== committed.to_hex()
  )
    fail(
      'Actual auxiliary bytes do not match the body commitment.',
      'MISMATCH',
    );
  const metadata = aux.metadata();
  if (!metadata) fail('Transaction has no metadata.');
  const only = C.AuxiliaryData.new();
  only.set_metadata(metadata);
  if (only.to_hex() !== hex(raw))
    fail(
      'Auxiliary scripts or alternate encodings need a separate profile.',
      'UNSUPPORTED_PROFILE',
    );
  const decoded: Record<string, unknown> = {};
  const labels = metadata.keys();
  for (let i = 0; i < labels.len(); i++) {
    const label = labels.get(i);
    decoded[label.to_str()] = JSON.parse(
      C.decode_metadatum_to_json_str(
        metadata.get(label)!,
        C.MetadataJsonSchema.NoConversions,
      ),
    );
  }
  return {
    parsed,
    fixed,
    metadata,
    decoded,
    auxiliaryHash: committed.to_hex(),
    auxiliaryHex: hex(raw),
    bodyHex: parsed.raw(parsed.tree.children[0]),
  };
}
export type MusicReceiptRoute = 'music' | 'ordinary-nft' | 'other';
/** Route a JSON-parsed envelope by actual bounded transaction metadata.
 * This does not verify credits or sidecars. A music route MUST be followed by
 * recoverMusicReceipt(C, originalJsonText), preserving strict JSON validation.
 * Other receipt types and standalone packages stay with their existing readers.
 */
export function routeMusicReceipt(
  C: CSL,
  parsedInput: unknown,
): MusicReceiptRoute {
  try {
    const input = record(parsedInput, 'Receipt route input');
    const review =
      input.schema === 'nft-studio.review.v1' && input.mode === 'nft';
    const signed =
      input.schema === 'nft-studio.receipt.v1' && input.kind === 'nft';
    if (!review && !signed) return 'other';
    const prepared =
      input.prepared === undefined
        ? undefined
        : record(input.prepared, 'Preparation');
    const declaresMusic = [input, ...(prepared ? [prepared] : [])].some(
      (r) =>
        r.metadataProfile !== undefined ||
        r.musicPackageHash !== undefined ||
        r.musicRelease !== undefined,
    );
    const cbor = review ? input.unsignedHex : input.signedHex;
    if (cbor === undefined) {
      if (declaresMusic)
        fail('A music receipt needs its actual transaction CBOR.', 'MISMATCH');
      return 'other';
    }
    const decoded = decodeTransaction(C, cbor).decoded;
    const label = decoded['721'];
    let actualMusic = false;
    if (label && typeof label === 'object' && !Array.isArray(label)) {
      for (const policy of Object.values(label)) {
        if (!policy || typeof policy !== 'object' || Array.isArray(policy))
          continue;
        for (const row of Object.values(policy)) {
          if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
          if (
            [
              'music_profile',
              'music_metadata_version',
              'music_package_sha256',
            ].some((field) => Object.hasOwn(row, field))
          )
            actualMusic = true;
        }
      }
    }
    if (actualMusic) return 'music';
    if (declaresMusic)
      fail(
        'The receipt declares music but its transaction does not contain that profile.',
        'MISMATCH',
      );
    return 'ordinary-nft';
  } catch (error) {
    if (error instanceof MusicReceiptError) throw error;
    return fail('The receipt route contains malformed transaction data.');
  }
}
function timestamp(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    fail(`Invalid ${label}.`);
  return value as number;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

/** Recover exact music content from actual CBOR, not receipt metadata assertions.
 * Never signs, submits, queries a provider, verifies signatures or exports wallet data.
 */
async function recoverMusicReceiptCore(
  C: CSL,
  receiptInput: unknown,
): Promise<MusicReceiptRecovery> {
  const receipt = projection(receiptInput);
  const review = receipt.schema === 'nft-studio.review.v1';
  if (
    review
      ? receipt.mode !== 'nft'
      : receipt.schema !== 'nft-studio.receipt.v1' || receipt.kind !== 'nft'
  )
    fail(
      'Use a Studio NFT receipt or unsigned NFT review.',
      'UNSUPPORTED_PROFILE',
    );
  if (!digest(receipt.hash)) fail('Receipt needs an exact transaction hash.');
  if (
    (review && receipt.signedHex !== undefined) ||
    (!review && receipt.signedHex === undefined)
  )
    fail('Receipt/review transaction fields are inconsistent.');
  const selectedHex = review ? receipt.unsignedHex : receipt.signedHex;
  const tx = decodeTransaction(C, selectedHex);
  if (tx.fixed.transaction_hash().to_hex() !== receipt.hash)
    fail('Transaction body hash differs from the receipt.', 'MISMATCH');
  if (
    receipt.bytes !== undefined &&
    receipt.bytes !== tx.parsed.value.length / 2
  )
    fail('Receipt transaction byte count differs.', 'MISMATCH');
  if (!review && receipt.bytes === undefined)
    fail('Signed receipt needs its transaction byte count.');
  const mint = tx.fixed.body().mint();
  if (!mint || mint.len() !== 1)
    fail(
      'Music recovery requires one quantity-one asset mint.',
      'UNSUPPORTED_PROFILE',
    );
  const policy = mint.keys().get(0),
    groups = mint.get(policy);
  if (groups?.len() !== 1)
    fail(
      'Music recovery requires exactly one mint group.',
      'UNSUPPORTED_PROFILE',
    );
  const assets = groups.get(0);
  if (!assets || assets.len() !== 1)
    fail(
      'Music recovery requires exactly one minted asset.',
      'UNSUPPORTED_PROFILE',
    );
  const asset = assets.keys().get(0),
    nameBytes = asset.name();
  if (assets.get(asset)?.to_str() !== '1')
    fail('Music asset quantity is not one.', 'MISMATCH');
  let assetName: string;
  try {
    assetName = dec.decode(nameBytes);
  } catch {
    return fail(
      'This profile requires a textual UTF-8 asset name.',
      'UNSUPPORTED_PROFILE',
    );
  }
  if (hex(enc.encode(assetName)) !== hex(nameBytes))
    fail('Asset name bytes changed.', 'MISMATCH');
  const policyId = policy.to_hex();
  const labels = tx.decoded['721'] as Record<string, unknown> | undefined;
  const policyRows = labels?.[policyId] as Record<string, unknown> | undefined;
  const row = policyRows?.[assetName] as Record<string, unknown> | undefined;
  const sidecars = [
    receipt,
    ...(receipt.prepared ? [receipt.prepared as Record<string, unknown>] : []),
  ];
  const declaresMusic = sidecars.some(
    (r) =>
      r.metadataProfile !== undefined ||
      r.musicPackageHash !== undefined ||
      r.musicRelease !== undefined,
  );
  if (
    !row ||
    (row.music_profile === undefined &&
      row.music_metadata_version === undefined &&
      row.music_package_sha256 === undefined)
  ) {
    if (declaresMusic)
      fail(
        'The receipt declares music but its transaction does not contain that profile.',
        'MISMATCH',
      );
    fail(
      'This transaction does not contain music metadata.',
      'NOT_MUSIC_TRANSACTION',
    );
  }
  if (
    row.music_profile !== MUSIC_RELEASE_PROFILE ||
    row.music_metadata_version !== 3
  )
    fail(
      'Unsupported or mismatched music metadata profile.',
      'UNSUPPORTED_PROFILE',
    );
  const music = await recoverMusicRelease(tx.decoded, { policyId, assetName });
  const body = tx.fixed.body(),
    outputs = body.outputs(),
    inputs = body.inputs();
  if (!outputs.len() || !inputs.len())
    fail('Music transaction needs inputs and outputs.');
  const allowed = new Set([
    BigInt(0),
    BigInt(1),
    BigInt(2),
    BigInt(3),
    BigInt(7),
    BigInt(9),
    BigInt(15),
  ]);
  for (let i = 0; i < tx.parsed.tree.children[0].children.length; i += 2) {
    const key = tx.parsed.tree.children[0].children[i];
    if (key.major !== 0 || !allowed.has(key.value!))
      fail(
        'This music receipt has body fields outside the native producer profile.',
        'UNSUPPORTED_PROFILE',
      );
  }
  for (let i = 0; i < tx.parsed.tree.children[1].children.length; i += 2) {
    const key = tx.parsed.tree.children[1].children[i];
    if (key.major !== 0 || ![BigInt(0), BigInt(1)].includes(key.value!))
      fail('Unsupported native receipt witness fields.', 'UNSUPPORTED_PROFILE');
  }
  const address = outputs.get(0).address(),
    key = address.payment_cred()?.to_keyhash();
  if (
    !key ||
    address.network_id() !== 1 ||
    (body.network_id() && body.network_id()!.kind() !== 1)
  )
    fail(
      'Music producer outputs must use one mainnet payment-key address.',
      'MISMATCH',
    );
  let quantity = BigInt(0);
  for (let i = 0; i < outputs.len(); i++) {
    const out = outputs.get(i);
    if (
      out.address().to_hex() !== address.to_hex() ||
      out.has_data_hash() ||
      out.has_plutus_data() ||
      out.has_script_ref()
    )
      fail('Music producer output shape differs.', 'UNSUPPORTED_PROFILE');
    quantity += BigInt(
      out.amount().multiasset()?.get(policy)?.get(asset)?.to_str() || '0',
    );
  }
  if (quantity !== BigInt(1))
    fail(
      'The exact minted music asset is not retained once in outputs.',
      'MISMATCH',
    );
  const native = tx.fixed.witness_set().native_scripts();
  if (native?.len() !== 1 || native.get(0).hash().to_hex() !== policyId)
    fail('Mint policy does not match its sole native script.', 'MISMATCH');
  const clauses = native.get(0).as_script_all()?.native_scripts();
  if (clauses?.len() !== 2)
    fail('Native policy needs the two Studio clauses.', 'UNSUPPORTED_PROFILE');
  const ttl = body.ttl_bignum(),
    expiry = clauses.get(1).as_timelock_expiry()?.slot_bignum();
  if (
    clauses.get(0).as_script_pubkey()?.addr_keyhash().to_hex() !==
      key.to_hex() ||
    !ttl ||
    !expiry ||
    BigInt(expiry.to_str()) <= BigInt(ttl.to_str())
  )
    fail(
      'Native policy differs from the Studio signer/expiry profile.',
      'UNSUPPORTED_PROFILE',
    );
  if (BigInt(body.fee().to_str()) > BigInt(2000000))
    fail('Receipt exceeds the native Studio fee cap.', 'UNSUPPORTED_PROFILE');
  let seedMatches = false;
  for (let i = 0; i < inputs.len(); i++) {
    const input = inputs.get(i),
      ref = input.transaction_id().to_hex() + '#' + input.index();
    const seed = await payloadHash(enc.encode(ref + '|' + music.packageHash));
    if ('NFTS' + seed.slice(0, 28) === assetName) seedMatches = true;
  }
  if (!seedMatches)
    fail(
      'Music asset name is not bound to its package and a consumed input.',
      'MISMATCH',
    );
  const expectedUnsignedWitnesses = C.TransactionWitnessSet.new();
  expectedUnsignedWitnesses.set_native_scripts(native);
  for (const sidecar of sidecars) {
    if (sidecar.mode !== undefined && sidecar.mode !== 'nft')
      fail('Music receipts must declare NFT mode.', 'MISMATCH');
    if (
      (sidecar.hash !== undefined && sidecar.hash !== receipt.hash) ||
      (sidecar.metadataProfile !== undefined &&
        sidecar.metadataProfile !== MUSIC_RELEASE_PROFILE) ||
      (sidecar.musicPackageHash !== undefined &&
        sidecar.musicPackageHash !== music.packageHash) ||
      (sidecar.policyId !== undefined && sidecar.policyId !== policyId) ||
      (sidecar.assetName !== undefined && sidecar.assetName !== assetName)
    )
      fail(
        'Receipt identity/profile/hash assertions differ from actual transaction metadata.',
        'MISMATCH',
      );
    if (
      sidecar.metadata !== undefined &&
      canonical(sidecar.metadata) !== canonical(tx.decoded)
    )
      fail(
        'Receipt metadata differs from actual committed metadata.',
        'MISMATCH',
      );
    if (
      sidecar.bundle !== undefined &&
      canonical(sidecar.bundle) !== canonical(music.bundle)
    )
      fail('Receipt bundle differs from recovered music files.', 'MISMATCH');
    if (
      sidecar.musicRelease !== undefined &&
      (await verifyMusicRelease(sidecar.musicRelease)).packageHash !==
        music.packageHash
    )
      fail('Receipt music package differs.', 'MISMATCH');
    if (sidecar.unsignedHex !== undefined) {
      const unsigned = decodeTransaction(C, sidecar.unsignedHex);
      if (
        unsigned.bodyHex !== tx.bodyHex ||
        unsigned.auxiliaryHex !== tx.auxiliaryHex ||
        unsigned.fixed.witness_set().to_hex() !==
          expectedUnsignedWitnesses.to_hex()
      )
        fail(
          'Unsigned review differs from the signed body, metadata or native witnesses.',
          'MISMATCH',
        );
    }
  }
  const witnessCount = tx.fixed.witness_set().vkeys()?.len() || 0;
  if (review ? witnessCount !== 0 : witnessCount < 1)
    fail(
      'Payment-witness presence differs from the receipt/review lane.',
      'MISMATCH',
    );
  const state = review ? 'review' : receipt.state;
  if (
    !(
      review
        ? ['review']
        : ['signed', 'submitting', 'submitted', 'unknown', 'confirmed']
    ).includes(state as string) ||
    (review && receipt.state !== undefined && receipt.state !== 'review')
  )
    fail('Invalid receipt state declaration.');
  const observation = {
    evidence: 'receipt-reported' as const,
    state: state as string,
    createdAt: timestamp(receipt.createdAt, 'receipt creation time'),
    ...(receipt.checkedAt !== undefined
      ? { checkedAt: timestamp(receipt.checkedAt, 'receipt observation time') }
      : {}),
    ...(receipt.blocksAfterInclusion !== undefined
      ? {
          blocksAfterInclusion: timestamp(
            receipt.blocksAfterInclusion,
            'reported block count',
          ),
        }
      : {}),
  };
  return freeze({
    schema: 'beacn.music-recovery.v1',
    status: 'verified-local-content',
    musicRelease: music,
    identity: {
      network: 'cardano-mainnet',
      policyId,
      assetName,
      assetNameHex: hex(nameBytes),
    },
    transaction: {
      hash: receipt.hash,
      bytes: tx.parsed.value.length / 2,
      packetKind: review ? 'unsigned-review' : 'signed-receipt',
      auxiliaryDataHash: tx.auxiliaryHash,
      metadataBytes: tx.metadata.to_bytes().length,
      paymentWitnessCount: witnessCount,
    },
    receiptObservation: observation,
    checks: {
      bodyHash: 'matched',
      auxiliaryCommitment: 'matched',
      mintIdentity: 'matched',
      exactFilesAndCredits: 'matched',
      suppliedSidecars: 'matched-when-present',
      nativeProducerShape: 'matched',
      paymentSignatures: 'not-checked',
      transactionValidity: 'not-checked',
      chainInclusion: 'not-checked',
      ownership: 'not-checked',
      rights: 'not-checked',
    },
  });
}

export async function recoverMusicReceipt(
  C: CSL,
  receiptInput: unknown,
): Promise<MusicReceiptRecovery> {
  try {
    return await recoverMusicReceiptCore(C, receiptInput);
  } catch (error) {
    if (error instanceof MusicReceiptError) throw error;
    return fail('The receipt contains malformed transaction or music data.');
  }
}
