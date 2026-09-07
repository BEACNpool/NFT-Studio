import { blake2b } from '@noble/hashes/blake2.js';
import { bech32 } from '@scure/base';

/** CIP-67 bitwise CRC-8 (poly 0x07, initial 0) over a two-byte label. */
export function assetLabelPrefix(label: number): string {
  if (!Number.isInteger(label) || label < 0 || label > 65535)
    throw new Error('An asset label must be an integer from 0 to 65535.');
  let crc = 0;
  for (const byte of [label >>> 8, label & 255]) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = ((crc << 1) ^ (crc & 128 ? 7 : 0)) & 255;
  }
  return (
    '0' +
    label.toString(16).padStart(4, '0') +
    crc.toString(16).padStart(2, '0') +
    '0'
  );
}
export function inspectAssetIdentity(policyInput: string, nameInput: string) {
  const policyId = policyInput.trim().toLowerCase();
  const assetNameHex = nameInput.trim().toLowerCase();
  if (!/^[a-f0-9]{56}$/.test(policyId))
    throw new Error('Use the full 56-character policy ID.');
  if (!/^(?:[a-f0-9]{2}){0,32}$/.test(assetNameHex))
    throw new Error(
      'Use exact asset-name hex: zero to 32 bytes, with two hex characters per byte.',
    );
  const hexBytes = (hex: string) =>
    Uint8Array.from(hex.match(/../g) || [], (pair) => parseInt(pair, 16));
  const nameBytes = hexBytes(assetNameHex);
  const digest = blake2b(hexBytes(policyId + assetNameHex), { dkLen: 20 });
  const fingerprint = bech32.encode('asset', bech32.toWords(digest));
  const prefix = assetNameHex.slice(0, 8);
  const labelCandidate =
    assetNameHex.length >= 8 && prefix[0] === '0' && prefix[7] === '0';
  const number = labelCandidate ? parseInt(prefix.slice(1, 5), 16) : null;
  const label =
    number !== null && assetLabelPrefix(number) === prefix ? number : null;
  const names: Record<number, string> = {
    100: 'Reference token',
    222: 'NFT user token',
    333: 'Fungible user token',
    444: 'Rich fungible user token',
  };
  const contentHex = label === null ? assetNameHex : assetNameHex.slice(8);
  let utf8: string | null = null;
  try {
    utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      hexBytes(contentHex),
    );
  } catch {
    /* Names are bytes, not necessarily text. */
  }
  const counterpart =
    label !== null && [100, 222, 333, 444].includes(label)
      ? {
          policyId,
          referenceAssetNameHex: assetLabelPrefix(100) + contentHex,
          nftAssetNameHex: assetLabelPrefix(222) + contentHex,
        }
      : null;
  return {
    policyId,
    assetNameHex,
    bytes: nameBytes.length,
    fingerprint,
    poolPmUrl: `https://pool.pm/${fingerprint}`,
    label,
    labelClass:
      label === null
        ? null
        : names[label] || 'Other registered or private label',
    invalidLabelChecksum: labelCandidate && label === null,
    contentHex,
    utf8,
    counterpart,
  };
}
