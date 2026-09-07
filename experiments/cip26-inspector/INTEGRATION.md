# Studio integration

The pure runtime lives in `src/index.mjs` and `src/strict-json.mjs`, with matching declarations in `src/index.d.mts`. It uses pinned noble2.4.0 packages; `dist/cip26-inspector.mjs` is the reproducible standalone browser alternative. Studio imports the runtime lazily from the Registry signatures Lab and supplies original JSON text with a separately edited local trust configuration. No remote MCP adapter or persistent trust store is included.

The source, original upstream evidence, tests, manifests and licenses are published with the experiment. `MANIFEST.json` and `SHA256SUMS` identify the integrated snapshot. Files under `provenance/` retain the earlier frozen candidate handoff and its original clean-build receipt; those historical hashes intentionally differ from the integrated URL-profile correction. `SOURCE_REVIEW.md` explains the change. Test commands regenerate dated receipts and synthetic public browser vectors, without persisting their ephemeral private keys.

Run `npm ci --ignore-scripts`, `npm test`, `npm run build`, and `npm run test:browser` from this directory. The browser harness requires an installed Chromium executable; configure `CIP26_CHROMIUM` as needed. Read `README.md` for the local trust/result contract and `ATTRIBUTION.md` before redistribution.
