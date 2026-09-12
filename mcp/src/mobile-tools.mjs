import * as z from 'zod/v4';
import QRCode from 'qrcode/lib/core/qrcode.js';
import SvgRenderer from 'qrcode/lib/renderer/svg-tag.js';
import { verifyMintIntent } from '@studio/studio-intent.ts';
import {
  createPhoneTransfer, receivePhoneTransfer, revokePhoneTransfer,
  parsePhoneTransferFragment, HANDOFF_API, HANDOFF_TTL_SECONDS,
} from '@studio/studio-handoff.ts';

export { receivePhoneTransfer, parsePhoneTransferFragment };

export const MOBILE_HANDOFF_CAPABILITIES = Object.freeze({
  createTool: 'create_mobile_handoff',
  revokeTool: 'revoke_mobile_handoff',
  browserControl: 'Continue on phone → Create QR code',
  transport: 'The same encrypted HTTPS transfer used by NFT-Studio',
  relay: HANDOFF_API,
  expiresAfterSeconds: HANDOFF_TTL_SECONDS,
  input: 'Verified ordinary nft-studio.intent.v1 NFT/data intent',
  limits: { rawPayloadBytes: 12000, files: 8, intentJsonBytes: 80000 },
  qr: 'Self-contained SVG for the exact short phone URL; local-file helper also saves PNG',
  privacy: 'Uploads AES-GCM ciphertext for 15 minutes. The content decryption key stays in the phone-link fragment. Anyone with the complete link can view the creation until expiry.',
  unsupported: 'Oversized previews, dedicated music-release packets, Scrolls, Books and larger catalogue creators are not ordinary transfer intents. Preserve those files and explain their own supported browser route; do not substitute a LAN server or unrelated QR.',
  walletConnected: false, signed: false, submitted: false,
});

const createSchema = z.strictObject({ intent: z.unknown() });
const revokeSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  revokeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
const createAnnotations = {
  readOnlyHint: false, destructiveHint: false,
  idempotentHint: false, openWorldHint: true,
};
let active = 0;

export async function createMobileHandoff({ intent: supplied }) {
  // Fail locally before any upload if this is a preview rather than a valid package.
  const intent = await verifyMintIntent(supplied);
  if (active >= 2) throw Error('Two phone transfers are being prepared. Try again when one finishes.');
  active++;
  let transfer;
  try {
    transfer = await createPhoneTransfer(intent);
    const received = await receivePhoneTransfer(new URL(transfer.url).hash);
    if (JSON.stringify(received.intent) !== JSON.stringify(intent) ||
        received.transfer.expiresAt !== transfer.expiresAt)
      throw Error('The received phone creation does not match the verified request.');
    const svg = SvgRenderer.render(QRCode.create(transfer.url, {
      errorCorrectionLevel: 'M',
    }), { margin: 4, width: 528, color: { dark: '#11111b', light: '#ffffff' } });
    return {
      schema: 'nft-studio.mobile-handoff.v1',
      status: 'verified-phone-review-only',
      intentHash: intent.intentHash, bundleHash: intent.bundle.sha256,
      name: intent.bundle.name, rawBytes: intent.bundle.bytes,
      url: transfer.url, expiresAt: transfer.expiresAt,
      expiresAtIso: new Date(transfer.expiresAt).toISOString(),
      qr: { mediaType: 'image/svg+xml', filename: 'mobile-qr.svg', svg },
      endTransfer: { tool: 'revoke_mobile_handoff', arguments: {
        id: transfer.id, revokeToken: transfer.revokeToken,
      } },
      checks: { exactIntentReadBack: true, walletConnected: false, signed: false, submitted: false },
      next: 'Display the QR as an image, the complete phone link and its expiry. Scan with a phone camera. Studio opens the exact creation; choose Open in wallet browser only when ready for wallet review. Retain endTransfer privately. Do not replace this link with a local-network URL or create another transfer unless requested.',
      privacy: MOBILE_HANDOFF_CAPABILITIES.privacy,
    };
  } catch (error) {
    // Clean up a transfer created by this call when verification or QR generation fails.
    if (transfer) await revokePhoneTransfer(transfer).catch(() => {});
    throw error;
  } finally {
    active--;
  }
}

export function registerMobileTools(register) {
  register('create_mobile_handoff',
    'Send a verified ordinary NFT/data intent to a phone through NFT-Studio’s built-in encrypted 15-minute relay. Use when the user requests a mobile QR, phone transfer or mobile wallet handoff. Returns a verified short HTTPS link, displayable QR SVG and expiry. Uploads ciphertext; does not connect a wallet, sign, submit or promise oversized files will fit. Preserve the exact intent and never substitute a LAN preview server.',
    createSchema, createMobileHandoff, createAnnotations);
  register('revoke_mobile_handoff',
    'End a phone transfer created by create_mobile_handoff when the user asks to end it. Use its exact endTransfer.arguments; do not put the creator revocation token in public links. Does not affect the local files, wallet or blockchain.',
    revokeSchema, async ({ id, revokeToken }) => {
      await revokePhoneTransfer({ id, revokeToken });
      return { id, status: 'ended-or-already-unavailable', walletConnected: false, signed: false, submitted: false };
    }, { ...createAnnotations, destructiveHint: true, idempotentHint: true });
}
