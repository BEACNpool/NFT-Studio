import * as z from 'zod/v4';
import QRCode from 'qrcode/lib/core/qrcode.js';
import SvgRenderer from 'qrcode/lib/renderer/svg-tag.js';
import {
  createPayloadQr,
  parsePayloadQrFragment,
} from '@studio/studio-payload-qr.ts';
import { createMintIntent, verifyMintIntent } from '@studio/studio-intent.ts';
import { createMintReviewUrl } from '@studio/studio-review-link.ts';
import {
  verifyMintOptions,
  DEFAULT_MINT_OPTIONS,
  UTILITY_CHOICES,
} from '@studio/studio-mint-options.ts';
export const CREATION_OPTIONS_CAPABILITIES = {
  name: 'BEACN Payload QR',
  payloadTool: 'create_payload_qr',
  optionsTool: 'configure_mint_options',
  utilityTool: 'studio_utilities',
  publicPayloadQr: {
    maxEncodedUrlBytes: 2331,
    expiry: null,
    encrypted: false,
    upload: false,
  },
  mintOptions: {
    quantity:
      '1–1000 interchangeable copies in one transaction, all to your wallet',
    windowHours: [1, 24, 168, 720],
    traits: 'Up to 12 public text traits in CIP-25 metadata',
    message: 'CIP-20 public transaction message, up to 64 UTF-8 bytes',
    lifetimeSupplyCap: false,
    sharedCollection: false,
  },
};
export function registerCreationOptionsTools(register) {
  register(
    'studio_utilities',
    'Choose an actual capability and understand its enforcement. Available compact interactive programs and exact files; separate music creator; experimental CIP-68; holder gates and redemption need implementation. Does not mint or enable services.',
    z.strictObject({}),
    async () => ({
      choices: UTILITY_CHOICES,
      options: CREATION_OPTIONS_CAPABILITIES.mintOptions,
      workflow: [
        'Create and preview',
        'Choose utility',
        'Set mint options',
        'Share or print',
        'Review in your wallet',
      ],
      warning:
        'A metadata description does not enforce access, royalties, redemption or a lifetime supply cap.',
    }),
  );
  register(
    'configure_mint_options',
    'Commit quantity, native-policy duration, public CIP-25 traits and a CIP-20 message to a new content-bound NFT intent. Returns a new hash and review link; the revised request requires fresh preparation. Duration starts at transaction preparation, not when printing or scanning. No lifetime cap or shared campaign; no wallet action.',
    z.strictObject({
      intent: z.unknown(),
      quantity: z.number().int().min(1).max(1000).optional(),
      mintWindowHours: z
        .union([z.literal(1), z.literal(24), z.literal(168), z.literal(720)])
        .optional(),
      traits: z
        .record(
          z
            .string()
            .refine(
              (k) => !['__proto__', 'constructor', 'prototype'].includes(k),
              'Reserved trait name',
            ),
          z.string(),
        )
        .optional(),
      message: z.string().optional(),
    }),
    async ({ intent: value, ...options }) => {
      const original = await verifyMintIntent(value);
      const intent = await createMintIntent(
        original.bundle,
        original.mode,
        verifyMintOptions({
          ...DEFAULT_MINT_OPTIONS,
          ...original.mintOptions,
          ...options,
        }),
      );
      return {
        intent,
        packetJson: JSON.stringify(intent, null, 2),
        review: {
          url: await createMintReviewUrl(
            intent,
            'https://beacnpool.github.io/NFT-Studio/',
          ),
        },
        semantics: CREATION_OPTIONS_CAPABILITIES.mintOptions,
        signed: false,
        submitted: false,
      };
    },
  );
  register(
    'create_payload_qr',
    'Create BEACN Payload QR: a printable, public, self-contained QR carrying a small exact NFT/data intent with no relay upload or expiry. Anyone with it can read and forward the bytes. Rejects payloads exceeding 2331 encoded URL bytes; use create_mobile_handoff for larger temporary phone transfers. Does not transfer an existing token, connect a wallet, sign or mint.',
    z.strictObject({ intent: z.unknown() }),
    async ({ intent }) => {
      const result = await createPayloadQr(intent);
      await parsePayloadQrFragment(new URL(result.url).hash);
      const code = QRCode.create([{ data: result.url, mode: 'byte' }], {
        errorCorrectionLevel: 'M',
      });
      const svg = SvgRenderer.render(code, {
        margin: 4,
        width: 1110,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return {
        ...result,
        qr: {
          mediaType: 'image/svg+xml',
          filename: 'payload-qr.svg',
          svg,
          version: code.version,
          modules: code.modules.size,
          errorCorrection: 'M',
          quietZoneModules: 4,
        },
        next: 'Display the QR and complete link. Save the SVG for printing, test the actual print with the intended camera, and forward the same link to preserve its content. The reader app needs to load; wallet minting needs internet. This is public content, with no revocation. Each wallet review creates its own policy, not a shared edition.',
      };
    },
  );
}
