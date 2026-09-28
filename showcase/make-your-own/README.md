# Make Your Own — NFT-Studio

Original promotional artwork made by BEACN. Unminted example; no token, transaction or on-chain provenance is claimed.

Public page: https://beacnpool.github.io/NFT-Studio/showcase/make-your-own/

- `artwork.svg`: self-contained animated artwork, reduced-motion support.
- `preview.png`: static image for X.
- `intent.json`, `review.html`: exact bytes verified by NFT-Studio MCP capabilities/create/verify.
- `request.json`: reproducible local exporter input.
- `post.txt`: suggested X copy.

CIP-25 metadata support is an implemented feature, not a claim of all-CIP compliance. The BEACN chain endpoint was restored September 27, 2026; minting requires wallet approval.

## Permanent QR edition

`qr-edition.svg` preserves the message, palette and watermark in 1,462 bytes. Native `create_payload_qr` exports a 2,039-byte URL, under the 2,331-byte limit; the exporter independently decodes the QR and verifies the exact intent. `qr-intent.json` is this separate compact edition, while `intent.json` retains the original animated edition.

## Minimal wallet mint page

The public page shows only the original artwork. Without an injected CIP-30 wallet it also shows “Open this inside a dApp browser”. Wallet detection supports late injection and desktop wallet extensions. It does not identify browsers by user-agent.

Tap the artwork inside a compatible wallet browser to connect. A transaction review appears only after that interaction, with the exact network fee, minimum ADA, recipient and policy ID. Approval remains explicit in the visitor’s wallet. One NFT is minted into that wallet; there is no seller payment or shared collection policy. The standard wallet-signature policy expires after one hour. This is open participation, not an unrestricted anyone-can-mint shared policy or a lifetime supply cap.

`mint-page.js` owns the small interface; `scripts/showcase-mint-engine.ts` reuses Studio’s intent validation, transaction builder, freshness checks, signature verification and once-only submission coordination. Rebuild its committed browser bundle with `node scripts/build-showcase-mint.mjs` after `npm ci`. Browser storage and Web Locks are required to sign and submit. A saved attempt prevents this page from silently starting another mint after reload; inspect the transaction hash if submission is uncertain.

The native compact QR assets remain available as a separate edition, but are not displayed on the minimal page. Social metadata retains the wide image preview. No real-wallet mint or chain confirmation has been claimed or performed.
