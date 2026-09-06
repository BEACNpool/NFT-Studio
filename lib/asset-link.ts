import { blake2b } from '@noble/hashes/blake2.js';
import { bech32 } from '@scure/base';

// CIP-14 asset name bytes are UTF-8 in this studio's mint builder.
export function poolAssetUrl(policyId: string, assetName: string) {
  if (!/^[a-f0-9]{56}$/i.test(policyId)) throw new Error('Invalid policy ID');
  const bytes = new TextEncoder().encode(assetName);
  if (bytes.length > 32) throw new Error('Invalid asset name');
  const policy = Uint8Array.from(policyId.match(/../g)!, (pair) =>
    parseInt(pair, 16),
  );
  const digest = blake2b(new Uint8Array([...policy, ...bytes]), { dkLen: 20 });
  const fingerprint = bech32.encode('asset', bech32.toWords(digest));
  return `https://pool.pm/${fingerprint}`;
}
