/** Portable, content-bound handoff between an agent and the visible wallet review.
 * This is a request, never a transaction, signature, or proof of authorship.
 */
import {
  decodePayloadURI,
  payloadHash,
  preparePayloadBundle,
  verifyPayloadBundle,
  MAX_PAYLOAD_FILES,
  type PayloadBundle,
  type PayloadMime,
} from './studio-payload';

export const MINT_INTENT_SCHEMA = 'nft-studio.intent.v1' as const;
export const MAX_MINT_INTENT_BYTES = 80000;
export type MintIntent = Readonly<{
  schema: typeof MINT_INTENT_SCHEMA;
  mode: 'nft' | 'data';
  bundle: PayloadBundle;
  intentHash: string;
}>;
const enc = new TextEncoder();
function object(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error(`Invalid ${label}.`);
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(result, key)) ||
    Object.keys(result).some((key) => !keys.includes(key))
  )
    throw new Error(`Unexpected or missing ${label} fields.`);
  return result;
}
function canonicalBundle(bundle: PayloadBundle): PayloadBundle {
  return Object.freeze({
    schema: bundle.schema,
    name: bundle.name,
    description: bundle.description,
    cover: bundle.cover,
    bytes: bundle.bytes,
    files: Object.freeze(
      bundle.files.map((file) =>
        Object.freeze({
          name: file.name,
          mediaType: file.mediaType,
          bytes: file.bytes,
          sha256: file.sha256,
          uri: file.uri,
        }),
      ),
    ),
    sha256: bundle.sha256,
  });
}
export async function createMintIntent(
  bundle: PayloadBundle,
  mode: 'nft' | 'data',
): Promise<MintIntent> {
  if (mode !== 'nft' && mode !== 'data')
    throw new Error('Choose NFT or data record.');
  await verifyPayloadBundle(bundle);
  if (mode === 'nft' && !bundle.cover)
    throw new Error('An NFT request needs an image cover.');
  const core = {
    schema: MINT_INTENT_SCHEMA,
    mode,
    bundle: canonicalBundle(bundle),
  };
  const intentHash = await payloadHash(enc.encode(JSON.stringify(core)));
  const intent = Object.freeze({ ...core, intentHash });
  if (enc.encode(JSON.stringify(intent)).length > MAX_MINT_INTENT_BYTES)
    throw new Error('The agent request exceeds the import limit.');
  return intent;
}
export async function verifyMintIntent(value: unknown): Promise<MintIntent> {
  const packet = object(
    value,
    ['schema', 'mode', 'bundle', 'intentHash'],
    'agent request',
  );
  if (
    packet.schema !== MINT_INTENT_SCHEMA ||
    (packet.mode !== 'nft' && packet.mode !== 'data')
  )
    throw new Error('Unsupported agent request. Use nft-studio.intent.v1.');
  if (
    typeof packet.intentHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(packet.intentHash)
  )
    throw new Error('Invalid request integrity hash.');
  const bundle = object(
    packet.bundle,
    ['schema', 'name', 'description', 'cover', 'bytes', 'files', 'sha256'],
    'payload',
  );
  if (
    bundle.schema !== 'nft-studio.payload.v1' ||
    typeof bundle.name !== 'string' ||
    typeof bundle.description !== 'string' ||
    typeof bundle.cover !== 'boolean' ||
    !Number.isSafeInteger(bundle.bytes) ||
    typeof bundle.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(bundle.sha256) ||
    !Array.isArray(bundle.files) ||
    bundle.files.length < 1 ||
    bundle.files.length > MAX_PAYLOAD_FILES
  )
    throw new Error('Invalid request payload.');
  const files = bundle.files.map((item) => {
    const file = object(
      item,
      ['name', 'mediaType', 'bytes', 'sha256', 'uri'],
      'file',
    );
    if (
      typeof file.name !== 'string' ||
      typeof file.mediaType !== 'string' ||
      typeof file.uri !== 'string' ||
      !Number.isSafeInteger(file.bytes) ||
      typeof file.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error('Invalid request file.');
    return {
      name: file.name,
      mediaType: file.mediaType as PayloadMime,
      bytes: decodePayloadURI(file.uri, file.mediaType as PayloadMime),
    };
  });
  const rebuilt = await preparePayloadBundle({
    name: bundle.name,
    description: bundle.description,
    files,
    coverIndex: bundle.cover ? 0 : undefined,
  });
  await verifyPayloadBundle(bundle as PayloadBundle);
  const intent = await createMintIntent(rebuilt, packet.mode);
  if (intent.intentHash !== packet.intentHash)
    throw new Error(
      'The request hash does not match its content. Ask your agent to export it again.',
    );
  return intent;
}
export async function parseMintIntent(text: string): Promise<MintIntent> {
  if (
    typeof text !== 'string' ||
    enc.encode(text).length > MAX_MINT_INTENT_BYTES
  )
    throw new Error('Choose an agent request smaller than 80 KB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The agent request is not valid JSON.');
  }
  return verifyMintIntent(parsed);
}
