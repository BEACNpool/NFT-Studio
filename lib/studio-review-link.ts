/** Content-only links: the fragment never authorizes a wallet action. */
import {
  MAX_MINT_INTENT_BYTES,
  parseMintIntent,
  verifyMintIntent,
  type MintIntent,
} from './studio-intent';

const PREFIX = '#mint=v1.';
export const MAX_MINT_REVIEW_FRAGMENT_CHARS = 106700;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export function isMintReviewFragment(hash: string): boolean {
  return hash.startsWith('#mint=');
}

export async function createMintReviewUrl(
  value: unknown,
  reviewBaseUrl: string,
): Promise<string> {
  const url = new URL(reviewBaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new Error('Use the configured HTTPS Studio review address.');
  const intent = await verifyMintIntent(value);
  const bytes = encoder.encode(JSON.stringify(intent));
  if (bytes.length > MAX_MINT_INTENT_BYTES)
    throw new Error('The agent request exceeds the review-link limit.');
  url.search = '?view=labs&lab=agents';
  url.hash = PREFIX.slice(1) + base64url(bytes);
  if (url.hash.length > MAX_MINT_REVIEW_FRAGMENT_CHARS)
    throw new Error('The agent request exceeds the review-link limit.');
  return url.href;
}

export async function parseMintReviewFragment(
  hash: string,
): Promise<MintIntent | null> {
  if (!isMintReviewFragment(hash)) return null;
  if (!hash.startsWith(PREFIX) || hash.length > MAX_MINT_REVIEW_FRAGMENT_CHARS)
    throw new Error(
      'This mint review link is unsupported or too large. Ask your agent for a new link.',
    );
  const encoded = hash.slice(PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1)
    throw new Error(
      'This mint review link is incomplete. Ask your agent for a new link.',
    );
  const binary = atob(
    encoded.replaceAll('-', '+').replaceAll('_', '/') +
      '='.repeat((4 - (encoded.length % 4)) % 4),
  );
  if (binary.length > MAX_MINT_INTENT_BYTES)
    throw new Error('The agent request exceeds the review-link limit.');
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (base64url(bytes) !== encoded)
    throw new Error('This mint review link is not encoded correctly.');
  let source: string;
  try {
    source = decoder.decode(bytes);
  } catch {
    throw new Error('This mint review link does not contain valid text.');
  }
  const intent = await parseMintIntent(source);
  if (JSON.stringify(intent) !== source)
    throw new Error(
      'This mint review link is not canonical. Ask your agent to export it again.',
    );
  return intent;
}
