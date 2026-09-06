export type StudioReceipt = {
  schema: 'nft-studio.receipt.v1';
  hash: string;
  kind: string;
  name: string;
  createdAt: number;
  state: string;
  metadata: unknown;
  bytes: number;
  signedHex?: string;
  prepared?: unknown;
  [key: string]: unknown;
};
export const RECEIPT_PREFIX = 'nft-studio:receipt:v1:';
export function saveReceipt(receipt: StudioReceipt) {
  if (!/^[a-f0-9]{64}$/.test(receipt.hash))
    throw new Error('Invalid receipt hash.');
  localStorage.setItem(RECEIPT_PREFIX + receipt.hash, JSON.stringify(receipt));
  if (!localStorage.getItem(RECEIPT_PREFIX + receipt.hash))
    throw new Error('Receipt storage unavailable. Export your receipt.');
}
export function loadReceipts(): StudioReceipt[] {
  const out: StudioReceipt[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(RECEIPT_PREFIX)) continue;
    try {
      const r = JSON.parse(localStorage.getItem(key)!);
      if (r.schema === 'nft-studio.receipt.v1' && /^[a-f0-9]{64}$/.test(r.hash))
        out.push(r);
    } catch {
      /* Ignore unrelated malformed records. */
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
