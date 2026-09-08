# Days Without Cardano Drama

Original BEACN Labs interactive NFT draft, created from a new user prompt on September 8, 2026. A workplace counter reads **3 DAYS**; a worker pulls a drama-reset trigger; the counter changes to **0 DAYS**, accompanied by two original synthesized brass-like slides. Replay starts the joke again. This is satire, not a live incident tracker.

[Play and review the draft](https://beacnpool.github.io/NFT-Studio/showcase/days-without-cardano-drama/).

The artwork, motion and synthesis are self-contained. The SVG cover is 4,652 bytes and gzip-packed HTML program is 6,720 bytes (11,372 total). Audio samples are generated in the browser from the embedded synthesizer; there is no recording or media-service dependency. A click enables sound. Reload/replay resets local animation state.

The real local MCP helper called capabilities, create and verify. The exact intent is `ff937aadd941bac187cce3b42631784bb92fad4875a8bb785b0871daead84365`. Public files and the complete review link live in `public/showcase/days-without-cardano-drama/`.

## Rebuild

From the repository root after normal dependency installation:

```sh
node experiments/days-without-cardano-drama/source/build.mjs /path/to/new-output-directory
node mcp/create-review.mjs --request /path/to/new-output-directory/request.json --output /path/to/new-review-directory
```

Compare rebuilt files to the published cover and program, and compare the generated intent hash. Output directories must be new. The exact encoded content is what gets packaged.

## Verification and limits

- Actual Chromium desktop (1440px) and phone (390px) play: 3 → 0, held zero, replay, mute, generated audio output, reduced-motion mode, no overflow or script/network errors. An opaque `allow-scripts` iframe plays the program without parent access. Technical audio render: 44.1/48kHz, zero clipped samples; this is not a human listening review.
- A synthetic base-address input with existing-token change produced a complete placeholder-witness shape of **15,456 / 16,384 bytes**. Exact ledger media reconstruction, metadata/body hashes and ADA/token conservation passed. The placeholder signature is invalid. These fabricated inputs cannot be spent and this is not a funded-wallet quote.
- Ordinary Studio review sanitizes imported HTML and does not run this animation or sound. Play/download the exact program before connecting a wallet. Other wallet/gallery HTML playback remains unverified.
- **Unminted:** no wallet connected, signing, submission, inclusion or permanent NFT identity. Studio adds 0 ADA; actual network fees, minimum output ADA and complete transaction fit are determined with the user's wallet. The native policy may permit more mints until expiry; this does not guarantee permanent one-of-one supply.

Receipts: `synthetic-sizing.json`, `playback.json`, `audio-verification.json`, and the public exact-file MCP `receipt.json`. Source and public artifacts are covered by the repository license.
