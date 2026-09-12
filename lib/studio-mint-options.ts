/** Creator choices committed by intent v2. These are not wallet authorization. */
export type MintOptions = Readonly<{
  quantity: number;
  mintWindowHours: number;
  traits: Readonly<Record<string, string>>;
  message: string;
}>;
export const DEFAULT_MINT_OPTIONS: MintOptions = Object.freeze({
  quantity: 1,
  mintWindowHours: 1,
  traits: Object.freeze({}),
  message: '',
});
export const MINT_WINDOWS = [1, 24, 168, 720] as const;
const bytes = (s: string) => new TextEncoder().encode(s).length;
function text(value: unknown, limit: number, label: string): string {
  if (
    typeof value !== 'string' ||
    bytes(value) > limit ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    ) ||
    new TextDecoder().decode(new TextEncoder().encode(value)) !== value
  )
    throw Error(
      `${label} must be ordinary text, at most ${limit} UTF-8 bytes.`,
    );
  return value;
}
export function verifyMintOptions(
  value: unknown = DEFAULT_MINT_OPTIONS,
): MintOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid mint options.');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(',') !==
    'message,mintWindowHours,quantity,traits'
  )
    throw Error('Use quantity, mintWindowHours, traits and message.');
  if (
    !Number.isSafeInteger(v.quantity) ||
    Number(v.quantity) < 1 ||
    Number(v.quantity) > 1000
  )
    throw Error('Choose 1–1,000 copies in this transaction.');
  if (!MINT_WINDOWS.includes(v.mintWindowHours as 1))
    throw Error('Choose a mint window of 1 hour, 24 hours, 7 days or 30 days.');
  if (
    !v.traits ||
    typeof v.traits !== 'object' ||
    Array.isArray(v.traits) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(v.traits))
  )
    throw Error('Traits must be a text map.');
  const entries = Object.entries(v.traits);
  if (entries.length > 12) throw Error('Use at most 12 traits.');
  const traits: Record<string, string> = {};
  for (const [key, val] of entries.sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    text(key, 64, 'Trait name');
    if (!key.trim() || ['__proto__', 'constructor', 'prototype'].includes(key))
      throw Error('Choose a different trait name.');
    traits[key] = text(val, 64, 'Trait value');
  }
  return Object.freeze({
    quantity: Number(v.quantity),
    mintWindowHours: Number(v.mintWindowHours),
    traits: Object.freeze(traits),
    message: text(v.message, 64, 'Public transaction message'),
  });
}
export const UTILITY_CHOICES = [
  {
    id: 'interactive',
    title: 'A playable creation',
    status: 'Available',
    detail:
      'Embed a compact game, instrument, timer or tool. Anyone with the public bytes can use it.',
    route: 'apps',
  },
  {
    id: 'files',
    title: 'Exact files & proof',
    status: 'Available',
    detail:
      'Keep compact files with a cover, or use the proof lab to publish file hashes.',
    route: 'proof',
  },
  {
    id: 'music',
    title: 'Music & credits',
    status: 'Separate creator',
    detail:
      'Add exact audio, cover and credits in Music release. Its CIP-60-aligned profile has documented interoperability limits.',
    route: 'music',
  },
  {
    id: 'capsule',
    title: 'Evolving state · CIP-68',
    status: 'Experimental',
    detail:
      'Explore the State Capsule lab. This ordinary mint does not deploy an updateable NFT.',
    route: 'capsules',
  },
  {
    id: 'gate',
    title: 'Holder access & one-time claims',
    status: 'Requires implementation',
    detail:
      'A real ownership check and service or contract must enforce the benefit. Metadata alone cannot gate access or consume a ticket.',
    route: 'knowledge',
  },
] as const;
