# BEACN Koios mirror restoration — 2026-09-27

The public mirror at `https://koios.beacn.workers.dev/api/v1` was restored for NFT-Studio promotional NFT mint reviews. This does not restart other retired BEACN services or restore the encrypted phone-handoff relay.

The permanent payload QR on `/showcase/make-your-own/` embeds the compact artwork and does not use that relay. Visitors review and mint independent copies with their own wallets and policies.

## Observed verification

- Mainnet `/tip`: HTTP 200, epoch 658, tip 44 seconds old at the recorded check.
- `/epoch_params?order=epoch_no.desc&limit=1`: HTTP 200, matching epoch, max transaction size 16,384 bytes, fee coefficient 44, fee constant 155,381, minimum output coefficient 4,310 lovelace/byte.
- POST `/tx_info` with an empty hash list: HTTP 200 and `[]`; no transaction submitted.
- OPTIONS for JSON POST: HTTP 204 and the requested GitHub Pages origin/header allowed.
- Local proxy checks: preflight without upstream calls; fixed mainnet/preview routing; POST body preservation; cookies/authorization not forwarded; unsupported methods rejected; upstream failures retain CORS.
- The landing page performs fresh, read-only browser fetches and reports availability only for a recent tip and matching protocol epoch.

The Cloudflare runtime rejects `redirect: "error"`; the deployed implementation uses `manual`. Public upstream errors become CORS-readable failures. The request never chooses an arbitrary upstream host.

No real wallet was connected, no signature requested, and no transaction broadcast. Availability checks do not prove a completed wallet mint. The client retains full transaction-size, fee, wallet and signed-content checks.

## Source and rollback

Deployed code: `public/tools/ledger/tools/cors-mirror/worker.js`. Previous code remains in Git history. Cloudflare retains Worker versions; redeploy a verified version if required. The old unavailable state must never be described as a working mint service. The static share page is additive; rollback its commits independently from the main Studio app.
