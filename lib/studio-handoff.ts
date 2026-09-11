import {
  MAX_MINT_INTENT_BYTES,
  parseMintIntent,
  verifyMintIntent,
  type MintIntent,
} from './studio-intent';

export const HANDOFF_API = 'https://handoff.beacnpool.org/api/handoffs';
export const STUDIO_URL = 'https://beacnpool.github.io/NFT-Studio/';
export const HANDOFF_TTL_SECONDS = 15 * 60;
export const MAX_CIPHERTEXT_BYTES = MAX_MINT_INTENT_BYTES + 16;
const AAD = new TextEncoder().encode('nft-studio.transfer.v1');
export type SealedIntent = { v: 1; iv: string; ciphertext: string };
export type PhoneTransfer = {
  id: string;
  key: string;
  url: string;
  expiresAt: number;
  revokeToken?: string;
};

export function encode64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
export function decode64(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value))
    throw Error('Invalid transfer encoding.');
  const bytes = Uint8Array.from(
    atob(value.replaceAll('-', '+').replaceAll('_', '/')),
    (c) => c.charCodeAt(0),
  );
  if (encode64(bytes) !== value) throw Error('Invalid transfer encoding.');
  return bytes;
}
export function verifySealedIntent(value: unknown): SealedIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid transfer.');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(',') !== 'ciphertext,iv,v' ||
    v.v !== 1 ||
    typeof v.iv !== 'string' ||
    typeof v.ciphertext !== 'string' ||
    v.iv.length !== 16 ||
    v.ciphertext.length > Math.ceil((MAX_CIPHERTEXT_BYTES * 4) / 3)
  )
    throw Error('Invalid transfer.');
  if (decode64(v.iv).length !== 12) throw Error('Invalid transfer nonce.');
  const size = decode64(v.ciphertext).length;
  if (size < 17 || size > MAX_CIPHERTEXT_BYTES)
    throw Error('Transfer is too large or empty.');
  return { v: 1, iv: v.iv, ciphertext: v.ciphertext };
}
export async function sealIntent(
  value: MintIntent,
): Promise<{ sealed: SealedIntent; key: string }> {
  const intent = await verifyMintIntent(value);
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, [
    'encrypt',
  ]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    key,
    new TextEncoder().encode(JSON.stringify(intent)),
  );
  return {
    sealed: {
      v: 1,
      iv: encode64(iv),
      ciphertext: encode64(new Uint8Array(ciphertext)),
    },
    key: encode64(rawKey),
  };
}
export async function unsealIntent(
  value: unknown,
  keyText: string,
): Promise<MintIntent> {
  const sealed = verifySealedIntent(value);
  const rawKey = decode64(keyText);
  if (rawKey.length !== 32) throw Error('Invalid transfer key.');
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, [
    'decrypt',
  ]);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode64(sealed.iv), additionalData: AAD },
      key,
      decode64(sealed.ciphertext),
    );
  } catch {
    throw Error(
      'This transfer could not be verified. Scan a fresh QR code from Studio.',
    );
  }
  return parseMintIntent(
    new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      plaintext,
    ),
  );
}
export function isPhoneTransferFragment(hash: string): boolean {
  return hash.startsWith('#transfer=');
}
export function parsePhoneTransferFragment(
  hash: string,
): Pick<PhoneTransfer, 'id' | 'key'> {
  const match = /^#transfer=v1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(
    hash,
  );
  if (
    !match ||
    decode64(match[1]).length !== 16 ||
    decode64(match[2]).length !== 32
  )
    throw Error('This phone link is incomplete. Scan the QR code again.');
  return { id: match[1], key: match[2] };
}
export function phoneTransferUrl(
  id: string,
  key: string,
  base = STUDIO_URL,
): string {
  parsePhoneTransferFragment(`#transfer=v1.${id}.${key}`);
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw Error('Phone transfers need an HTTPS Studio URL.');
  url.searchParams.set('view', 'labs');
  url.searchParams.set('lab', 'agents');
  url.hash = `transfer=v1.${id}.${key}`;
  return url.href;
}
async function readResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  if (!response.ok) {
    if (response.status === 404 || response.status === 410)
      throw Error(
        'This transfer expired or was ended. Create a fresh QR code on your computer.',
      );
    if (response.status === 429)
      throw Error(
        'Too many transfers right now. Wait a few minutes, or use Save request.',
      );
    throw Error(
      'The phone transfer service is unavailable. Try again, or use Save request.',
    );
  }
  if (Number(response.headers.get('content-length')) > 108000)
    throw Error('Invalid transfer response.');
  const reader = response.body?.getReader();
  if (!reader) throw Error('Empty transfer response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 108000) throw Error('Invalid transfer response.');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
const requestOptions = {
  credentials: 'omit',
  cache: 'no-store',
  referrerPolicy: 'no-referrer',
} as const;
export async function createPhoneTransfer(
  intent: MintIntent,
): Promise<PhoneTransfer> {
  const { sealed, key } = await sealIntent(intent);
  const result = await readResponse(
    await fetch(HANDOFF_API, {
      ...requestOptions,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sealed),
      signal: AbortSignal.timeout(20000),
    }),
  );
  if (
    typeof result.id !== 'string' ||
    typeof result.expiresAt !== 'number' ||
    result.expiresAt <= Date.now() ||
    result.expiresAt > Date.now() + (HANDOFF_TTL_SECONDS + 30) * 1000 ||
    typeof result.revokeToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(result.revokeToken)
  )
    throw Error('Invalid transfer response.');
  return {
    id: result.id,
    key,
    url: phoneTransferUrl(result.id, key),
    expiresAt: result.expiresAt,
    revokeToken: result.revokeToken,
  };
}
export async function receivePhoneTransfer(
  hash: string,
): Promise<{ intent: MintIntent; transfer: PhoneTransfer }> {
  const { id, key } = parsePhoneTransferFragment(hash);
  const result = await readResponse(
    await fetch(`${HANDOFF_API}/${id}`, {
      ...requestOptions,
      signal: AbortSignal.timeout(20000),
    }),
  );
  if (typeof result.expiresAt !== 'number' || result.expiresAt <= Date.now())
    throw Error(
      'This transfer has expired. Create a fresh QR code on your computer.',
    );
  const intent = await unsealIntent(result.sealed, key);
  return {
    intent,
    transfer: {
      id,
      key,
      url: phoneTransferUrl(id, key),
      expiresAt: result.expiresAt,
    },
  };
}
export async function revokePhoneTransfer(
  transfer: PhoneTransfer,
): Promise<void> {
  if (!transfer.revokeToken) return;
  const response = await fetch(`${HANDOFF_API}/${transfer.id}`, {
    ...requestOptions,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${transfer.revokeToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok && response.status !== 404)
    throw Error(
      'Could not end the transfer. It will still expire automatically.',
    );
}
