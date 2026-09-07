import * as z from 'zod/v4';
import {
  buildProofOfExistenceBytes,
  verifyProofOfExistenceBytes,
  POE_PROFILE,
  POE_LABEL,
  POE_SPECIFICATION,
} from '@studio/proof-of-existence.ts';

// These tighter service limits leave room for JSON-RPC framing under public 96 KiB requests.
export const PROOF_MCP_LIMITS = Object.freeze({
  argumentJsonBytes: 80 * 1024,
  rawFileBytes: 48 * 1024,
  files: 16,
  recordBytes: 16 * 1024,
});
export const PROOF_MCP_CAPABILITIES = Object.freeze({
  profile: POE_PROFILE,
  label: POE_LABEL,
  standardStatus: POE_SPECIFICATION.status,
  specification: POE_SPECIFICATION,
  algorithms: Object.freeze(['sha2-256', 'blake2b-256']),
  limits: PROOF_MCP_LIMITS,
  transactionPreparation: false,
  chainVerification: false,
  remoteServerReceivesSuppliedFileBytes: true,
});
const file = z.strictObject({
  name: z
    .string()
    .min(1)
    .max(256)
    .refine(
      (name) =>
        name.isWellFormed() &&
        name !== '.' &&
        name !== '..' &&
        !/[\\/]/.test(name) &&
        !Array.from(name).some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
      'Use a well-formed display filename without path separators or controls.',
    ),
  // Empty files are valid and have well-defined commitments.
  base64: z.string().max(65536),
});
const algorithms = z
  .array(z.enum(['sha2-256', 'blake2b-256']))
  .min(1)
  .max(2)
  .refine(
    (values) => new Set(values).size === values.length,
    'Hash algorithms must be distinct.',
  );
export const proofCreateSchema = z.strictObject({
  files: z.array(file).min(1).max(PROOF_MCP_LIMITS.files),
  algorithms: algorithms.optional(),
});
export const proofVerifySchema = z.strictObject({
  recordCborHex: z
    .string()
    .min(2)
    .max(PROOF_MCP_LIMITS.recordBytes * 2)
    .regex(/^(?:[a-fA-F0-9]{2})+$/),
  file,
  itemIndex: z.number().int().min(0).max(1023).default(0),
});
function checkArguments(args) {
  if (
    new TextEncoder().encode(JSON.stringify(args)).length >
    PROOF_MCP_LIMITS.argumentJsonBytes
  )
    throw new Error(
      'Proof arguments exceed the 80 KiB JSON bound. Use fewer file bytes or a smaller record.',
    );
}
/** Explicit content only: accepts no file path, URL, MIME instruction or remote retrieval. */
export function decodeProofFiles(files) {
  let total = 0;
  for (const { base64 } of files) {
    if (
      typeof base64 !== 'string' ||
      base64.length > 65536 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        base64,
      )
    )
      throw new Error(
        'Proof files require canonical base64. Paths, URLs and data URIs are not accepted.',
      );
    total +=
      (base64.length / 4) * 3 -
      (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    if (total > PROOF_MCP_LIMITS.rawFileBytes)
      throw new Error(
        'Proof file content exceeds the 48 KiB total raw-byte bound.',
      );
  }
  return files.map(({ name, base64 }) => {
    const binary = atob(base64);
    if (btoa(binary) !== base64)
      throw new Error('Proof file base64 has noncanonical padding bits.');
    return {
      name,
      bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    };
  });
}
export function createProofRecord(input) {
  const args = proofCreateSchema.parse(input);
  checkArguments(args);
  const artifact = buildProofOfExistenceBytes(
    decodeProofFiles(args.files),
    args.algorithms,
  );
  return {
    artifact,
    filename: `beacn-proof-${artifact.recordSha256.slice(0, 12)}.json`,
    status:
      'record-only; no wallet, transaction preparation, signature, submission or chain observation',
    processing: {
      inputBytesReceivedByThisServer: true,
      networkRequestsByTool: false,
      inputBytesPersistedByTool: false,
      publication:
        'None. Only the generated label-309 metadata, if separately published, contains content digests.',
      privacy:
        'Remote MCP receives supplied file bytes. Use the browser-only proof tool when file bytes must stay on the caller device. Hashes are not encryption.',
    },
  };
}
export function verifyProofRecord(input) {
  const args = proofVerifySchema.parse(input);
  checkArguments(args);
  const [{ bytes }] = decodeProofFiles([args.file]);
  return {
    profile: POE_PROFILE,
    specification: POE_SPECIFICATION,
    verification: verifyProofOfExistenceBytes(
      args.recordCborHex,
      bytes,
      args.itemIndex,
    ),
    byteScope:
      'Exact supplied file bytes; every declared supported digest is checked.',
    chainInclusionChecked: false,
    authorshipChecked: false,
    remoteInputNotice:
      'This MCP server received the supplied file bytes. This tool performs no external fetch, persistence or publication.',
  };
}
/** Use from both Node and Worker factories, with their existing guarded register helper. */
export function registerProofTools(register) {
  register(
    'create_proof_record',
    'Create a deterministic public hashes record for Proposed CIP-190 v1 from explicit base64 files. This server receives those bytes; use browser-only hashing to keep content on your device. Returns exact canonical CBOR and a local sidecar; no upload elsewhere, wallet, signing, transaction or chain timestamp. Limits: 16 files, 48 KiB total raw content and 80 KiB argument JSON.',
    proofCreateSchema,
    createProofRecord,
  );
  register(
    'verify_proof_record',
    'Compare explicit base64 file bytes with one item in a supplied canonical CIP-190 public-hashes record. This server receives the bytes. Returns match, mismatch, unsupported-profile or invalid-record; does not verify chain inclusion, authorship, rights or storage availability. Other CIP-190 features are not silently accepted. Limits: 48 KiB raw file, 16 KiB record and 80 KiB argument JSON.',
    proofVerifySchema,
    verifyProofRecord,
  );
}
