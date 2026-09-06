import type { CSL, PreparedMint } from './cardano';

export const MINT_RECEIPT_PREFIX = 'nft-studio:receipt:v1:';
export const ACTIVE_MINT_RECEIPT = 'nft-studio:mint-active:v1';
export type MintReceipt = {
  schema: 'nft-studio.receipt.v1'; hash: string; kind: 'art' | 'game' | 'app';
  name: string; createdAt: number; state: 'submitted' | 'unknown' | 'confirmed';
  metadata: PreparedMint['metadata']; prepared: PreparedMint; signedHex: string; bytes: number;
  checkedAt?: number; blocksAfterInclusion?: number; restored?: boolean; broadcastAttempted?: boolean;
};
type ReceiptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const checkHash = (hash: string) => {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid saved transaction hash.');
};
/** A detailed local packet, saved before submission. Never posts any receipt bytes. */
export function persistMintReceipt(receipt: MintReceipt, activate = false, storage: ReceiptStorage = localStorage) {
  checkHash(receipt.hash);
  const raw = JSON.stringify(receipt);
  if (raw.length > 512000) throw new Error('This receipt is too large for the local recovery store. Save it before continuing.');
  storage.setItem(MINT_RECEIPT_PREFIX + receipt.hash, raw);
  if (storage.getItem(MINT_RECEIPT_PREFIX + receipt.hash) !== raw)
    throw new Error('This browser could not retain the complete receipt. Submission is paused.');
  if (activate) {
    storage.setItem(ACTIVE_MINT_RECEIPT, receipt.hash);
    if (storage.getItem(ACTIVE_MINT_RECEIPT) !== receipt.hash)
      throw new Error('This browser could not retain its active transaction. Submission is paused.');
  }
}
export function activeMintReceiptHash(storage: ReceiptStorage = localStorage) {
  const hash = storage.getItem(ACTIVE_MINT_RECEIPT);
  if (hash !== null) checkHash(hash);
  return hash;
}
export function dismissMintReceipt(hash: string, storage: ReceiptStorage = localStorage) {
  checkHash(hash);
  if (storage.getItem(ACTIVE_MINT_RECEIPT) === hash) storage.removeItem(ACTIVE_MINT_RECEIPT);
  // The full packet remains under MINT_RECEIPT_PREFIX for the Recovery panel.
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
/** Restore display/recovery only. This function has no signing/submission route. */
export function restoreMintReceipt(C: CSL, hash: string, storage: ReceiptStorage = localStorage): MintReceipt {
  checkHash(hash);
  const raw = storage.getItem(MINT_RECEIPT_PREFIX + hash);
  if (!raw || raw.length > 512000) throw new Error('The saved mint receipt is missing or oversized. Use its transaction hash in Recovery.');
  const r = JSON.parse(raw) as MintReceipt;
  if (r.schema !== 'nft-studio.receipt.v1' || r.hash !== hash || !['art','game','app'].includes(r.kind) ||
      !['submitted','unknown','confirmed'].includes(r.state) || !Number.isSafeInteger(r.createdAt) ||
      typeof r.signedHex !== 'string' || r.signedHex.length > 131072 || !/^(?:[0-9a-f]{2})+$/i.test(r.signedHex) ||
      !r.prepared || r.prepared.hash !== hash || !r.prepared.image ||
      typeof r.prepared.image.uri !== 'string' || !/^data:image\/(?:webp|avif|svg\+xml);base64,/.test(r.prepared.image.uri) ||
      r.prepared.image.uri.length > 50000)
    throw new Error('The saved mint receipt is invalid. Use its transaction hash in Recovery.');
  const fixed = C.FixedTransaction.from_hex(r.signedHex), original = C.FixedTransaction.from_hex(r.prepared.unsignedHex);
  const aux = fixed.auxiliary_data(), committed = fixed.body().auxiliary_data_hash();
  if (fixed.transaction_hash().to_hex() !== hash || fixed.to_bytes().length !== r.bytes ||
      fixed.body().to_hex() !== original.body().to_hex() || !aux || !committed ||
      C.hash_auxiliary_data(aux).to_hex() !== committed.to_hex() ||
      fixed.body().fee().to_str() !== r.prepared.fee)
    throw new Error('The saved transaction or committed metadata changed. Use the chain recovery path.');
  const meta = aux.metadata();
  if (!meta) throw new Error('The saved transaction contains no metadata.');
  const decoded: Record<string, unknown> = {};
  for (let i = 0; i < meta.keys().len(); i++) {
    const label = meta.keys().get(i);
    decoded[label.to_str()] = JSON.parse(C.decode_metadatum_to_json_str(meta.get(label)!, C.MetadataJsonSchema.NoConversions));
  }
  if (stable(decoded) !== stable(r.metadata) || stable(decoded) !== stable(r.prepared.metadata))
    throw new Error('The saved metadata differs from the signed transaction.');
  const policy = (decoded['721'] as Record<string, Record<string, {image: string | string[]}>>)?.[r.prepared.policyId];
  const image = policy?.[r.prepared.assetName]?.image;
  if ((Array.isArray(image) ? image.join('') : image) !== r.prepared.image.uri)
    throw new Error('The saved preview differs from the signed transaction.');
  const signatures = fixed.witness_set().vkeys();
  if (!signatures?.len()) throw new Error('The saved receipt contains no wallet signatures.');
  for (let i = 0; i < signatures.len(); i++) {
    const w = signatures.get(i);
    if (!w.vkey().public_key().verify(fixed.transaction_hash().to_bytes(), w.signature()))
      throw new Error('A saved wallet signature does not match this transaction.');
  }
  const outputs = fixed.body().outputs();
  if (!outputs.len()) throw new Error('The saved mint has no destination output.');
  for (let i = 0; i < outputs.len(); i++)
    if (outputs.get(i).address().to_bech32() !== r.prepared.address)
      throw new Error('The saved destination differs from its signed transaction.');
  return { ...r, restored: true };
}
