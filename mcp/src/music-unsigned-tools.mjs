import * as z from 'zod/v4';
import { MUSIC_LIMITS, MUSIC_RELEASE_PROFILE } from '@studio/music-release.ts';
import { LIMITS } from './public-unsigned.mjs';
import { hex } from './schemas.mjs';
import { MUSIC_REVIEW_URL } from './music-tools.mjs';

export const musicUnsignedSchema = z.strictObject({
  packetJson: z.string().min(1).max(MUSIC_LIMITS.packageBytes),
  wallet: z.strictObject({ changeHex: hex(256), utxos: z.array(hex(32768)).min(1).max(LIMITS.utxos) }),
});
export const MUSIC_UNSIGNED_CAPABILITIES = Object.freeze({
  schema: 'nft-studio.stateless-unsigned-music.v1',
  profile: MUSIC_RELEASE_PROFILE,
  tool: 'prepare_unsigned_music_transaction',
  limits: LIMITS,
  network: 'mainnet',
  serverState: 'none',
  sharesOrdinaryPreparationConcurrency: true,
  canonicalPackageRequired: true,
  reviewUrl: MUSIC_REVIEW_URL,
  nodeStoredWitnessVerifierCompatible: false,
  signedWitnessVerification: false,
  chainUnspentVerified: false,
  ownershipVerified: false,
  rightsVerified: false,
  signed: false,
  submitted: false,
});
export function registerMusicUnsignedTool(register, prepare) {
  register(
    'prepare_unsigned_music_transaction',
    'Build stateless unsigned mainnet music NFT CBOR from canonical .music-release.json packetJson and an explicitly authorized wallet snapshot. Uses the shared music builder, verifies exact files/credits against actual metadata, conserves supplied assets/ADA and reads only the fixed protocol feed. Maximum 32 ordinary UTxOs, 32 KiB wallet CBOR and 88 KiB total arguments. No packet cache, signing, submission, ownership/unspent verification or rights check. This packet cannot enter Node stored witness verification. Retain packetJson for fresh visible Music Lab wallet review.',
    musicUnsignedSchema,
    prepare,
    { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  );
}
