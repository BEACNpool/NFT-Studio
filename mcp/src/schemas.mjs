import * as z from 'zod/v4';
import { PAYLOAD_TYPES } from '@studio/studio-payload.ts';
export const REQUEST_LIMIT = 524288;
export const empty = z.strictObject({});
export const hex = (max) => z.string().min(2).max(max).regex(/^(?:[0-9a-fA-F]{2})+$/);
export const fileSchema = z.strictObject({
  name: z.string().min(1).max(64),
  mediaType: z.enum(PAYLOAD_TYPES),
  base64: z.string().min(4).max(16000),
});
export const payloadSchema = z.strictObject({
  name: z.string().min(1).max(64),
  description: z.string().max(1024).optional(),
  files: z.array(fileSchema).min(1).max(8),
  coverIndex: z.number().int().min(0).max(7).optional(),
});
export const intentSchema = payloadSchema.extend({mode:z.enum(['nft','data']),mintOptions:z.strictObject({quantity:z.number().int().min(1).max(1000),mintWindowHours:z.union([z.literal(1),z.literal(24),z.literal(168),z.literal(720)]),traits:z.record(z.string().refine(k=>!['__proto__','constructor','prototype'].includes(k),'Reserved trait name'),z.string()),message:z.string()}).optional()});
export const walletSchema = z.strictObject({
  changeHex: hex(256), utxos: z.array(hex(32768)).min(1).max(128),
});
export const prepareSchema = z.strictObject({intent:z.unknown(),wallet:walletSchema});
export const verifySignedSchema = z.strictObject({
  packetId:z.string().uuid(), witnessSetHex:hex(131072), wallet:walletSchema,
});
export function decodeFiles(files) {
  let total = 0;
  return files.map(({name,mediaType,base64}) => {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
      throw new Error('Files require canonical base64; paths and URLs are not accepted.');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    if (btoa(binary) !== base64) throw new Error('Noncanonical base64 input.');
    total += bytes.length;
    if (!bytes.length || total > 12000) throw new Error('Total raw file bytes must be between 1 and 12000.');
    return {name,mediaType,bytes:new Uint8Array(bytes)};
  });
}
export function checkWalletBound(wallet) {
  if (wallet.utxos.reduce((n,x) => n+x.length, 0) > 262144)
    throw new Error('Wallet snapshot exceeds the 128 KiB CBOR bound.');
  if (new Set(wallet.utxos.map(x=>x.toLowerCase())).size !== wallet.utxos.length)
    throw new Error('Duplicate wallet outputs are not accepted.');
}
/** Strict, lossless JSON subset of ledger metadata; validate before CSL encoding. */
export function checkMetadata(metadata) {
  let nodes = 0;
  function walk(value, depth) {
    if (++nodes > 4096 || depth > 16) throw new Error('Metadata nesting or item bound exceeded.');
    if (typeof value === 'string') {
      if (new TextEncoder().encode(value).length > 64 || new TextDecoder('utf-8',{fatal:true}).decode(new TextEncoder().encode(value)) !== value)
        throw new Error('Ledger metadata text must be valid UTF-8 and at most 64 bytes per item.');
    } else if (typeof value === 'number') {
      if (!Number.isSafeInteger(value)) throw new Error('Metadata numbers must be safe integers; floats are unsupported.');
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item, depth+1);
    } else if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      for (const [key,item] of Object.entries(value)) { walk(key,depth+1); walk(item,depth+1); }
    } else throw new Error('Ledger metadata does not support booleans, null, or arbitrary objects.');
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Metadata must be a label map.');
  const rows = Object.entries(metadata);
  if (!rows.length || rows.length > 16) throw new Error('Use between 1 and 16 metadata labels.');
  for (const [label,value] of rows) {
    if (!/^(0|[1-9][0-9]{0,19})$/.test(label) || BigInt(label) > 18446744073709551615n)
      throw new Error('Metadata labels must be canonical uint64 decimal strings.');
    walk(value,0);
  }
  return {items:nodes};
}
