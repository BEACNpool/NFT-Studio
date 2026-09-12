/** Public, self-contained small-payload transport. No upload, expiry or authority. */
import { deflateSync, inflateSync } from 'fflate';
import {
  parseMintIntent,
  verifyMintIntent,
  MAX_MINT_INTENT_BYTES,
} from './studio-intent';
import { encode64, decode64, STUDIO_URL } from './studio-handoff';
export const PAYLOAD_QR_MAX_URL_BYTES = 2331;
export const PAYLOAD_QR_PREFIX = '#payload=v1.';
const enc = new TextEncoder();
export function isPayloadQrFragment(hash: string) {
  return hash.startsWith('#payload=');
}
export async function createPayloadQr(value: unknown) {
  const intent = await verifyMintIntent(value);
  const compressed = deflateSync(enc.encode(JSON.stringify(intent)), {
    level: 9,
  });
  const url =
    STUDIO_URL +
    '?view=labs&lab=agents' +
    PAYLOAD_QR_PREFIX +
    encode64(compressed);
  const encodedBytes = enc.encode(url).length;
  if (encodedBytes > PAYLOAD_QR_MAX_URL_BYTES)
    throw Error(
      `This creation needs ${encodedBytes.toLocaleString()} QR bytes; a printable payload QR holds ${PAYLOAD_QR_MAX_URL_BYTES.toLocaleString()}. Use fewer or smaller files, or Continue on phone for a temporary transfer. Your original files are unchanged.`,
    );
  return {
    schema: 'nft-studio.payload-qr.v1',
    url,
    intentHash: intent.intentHash,
    bundleHash: intent.bundle.sha256,
    name: intent.bundle.name,
    rawBytes: intent.bundle.bytes,
    encodedBytes,
    maxUrlBytes: PAYLOAD_QR_MAX_URL_BYTES,
    expiresAt: null,
    encrypted: false,
    uploads: false,
    walletConnected: false,
    signed: false,
    submitted: false,
  };
}
export async function parsePayloadQrFragment(hash: string) {
  if (
    !hash.startsWith(PAYLOAD_QR_PREFIX) ||
    enc.encode(STUDIO_URL + '?view=labs&lab=agents' + hash).length >
      PAYLOAD_QR_MAX_URL_BYTES
  )
    throw Error('Invalid or oversized payload QR.');
  const packed = hash.slice(PAYLOAD_QR_PREFIX.length);
  const compressed = decode64(packed);
  const bytes = inflateSync(compressed, {
    out: new Uint8Array(MAX_MINT_INTENT_BYTES + 1),
  });
  if (!bytes.length || bytes.length > MAX_MINT_INTENT_BYTES)
    throw Error('The decoded payload QR exceeds the request limit.');
  if (encode64(deflateSync(bytes, { level: 9 })) !== packed)
    throw Error('The payload QR is not in its canonical format.');
  const source = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  const intent = await parseMintIntent(source);
  if (JSON.stringify(intent) !== source)
    throw Error('The payload QR content is not canonical.');
  return intent;
}
