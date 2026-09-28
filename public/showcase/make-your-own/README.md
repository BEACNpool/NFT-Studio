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

The public page checks tip freshness and protocol availability through the restored mirror before showing live availability. No real-wallet mint has been claimed or performed.

## Artwork-first layout

The main artwork appears first and the primary mint action carries the exact original animated edition. A CIP-158 wallet-browser link wraps that same verified request for mobile use. The compact QR edition is explicitly separate in an expandable section. Costs are quoted by wallet review, not a fabricated fixed ADA price or payment address. Free open-source clone and setup links follow the mint section.
