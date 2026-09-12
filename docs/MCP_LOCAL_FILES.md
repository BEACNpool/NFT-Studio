# Local exact-file review exporter

The `mcp/create-review.mjs` helper uses the existing pinned MCP SDK client, currently installed by normal `npm --prefix mcp ci`. No new MCP tool, transport, permission or hosted endpoint is introduced.

From a trusted NFT-Studio checkout with Node.js 22.13+:

```sh
npm --prefix mcp ci
npm --prefix mcp run build
node mcp/create-review.mjs --request experiments/labor-day-worker-demo/request.json --output ./labor-day-review
node --test mcp/test/create-review.test.mjs
```

The output directory must not exist. Open the saved `review.html` by an ordinary browser/file-manager action, or import `intent.json` in Studio. The HTML contains one escaped direct HTTPS review anchor and no script; it avoids passing a long URL through a shell or Windows process argument. Nothing opens automatically. The full URL is also saved in `review-url.txt`; concise stdout contains hashes, byte counts and local output paths without the large link or media bytes.

An explicit local request uses the existing payload arguments except each file has a local `path` in place of `base64`:

```json
{
  "mode": "nft",
  "name": "My exact NFT",
  "description": "Review before minting.",
  "coverIndex": 0,
  "files": [
    {"path": "assets/cover.svg", "name": "cover.svg", "mediaType": "image/svg+xml"},
    {"path": "assets/tune.ogg", "name": "tune.ogg", "mediaType": "audio/ogg"}
  ]
}
```

Paths resolve relative to the request JSON, or may be explicit absolute local paths. URLs, UNC/network-share prefixes, final-component symlinks, nonregular files and oversized files are rejected. The local helper reads these files; the MCP receives exact base64, never a caller path. Input limits: 16 KiB request JSON, eight files and 12,000 total raw bytes, further bounded by the local server's advertised capabilities. Each completed SDK response is checked against a 512 KiB JSON size ceiling and its text/structured copies must agree. This is a post-SDK parsed response check against the trusted local server, not an arbitrary remote streaming transport limit. Whole operation timeout: 30 seconds.

Calls are `studio_capabilities`, `create_mint_intent`, then `verify_mint_intent`. The client additionally reconstructs every file, file SHA-256, canonical bundle hash, complete intent hash and exact pinned Studio fragment URL independently. Changed content, destination or response representations reject. A fresh directory holds exclusive-created files; `receipt.json` is written last. If an I/O failure leaves a partial directory, inspect it and choose a different fresh destination. No existing output is overwritten.

The exported link and JSON contain the original files. Keep them private unless sharing that content is intended. A hash is a byte commitment, not authorship, rights, identity or chain evidence. This exporter does not read wallet data, prepare transactions, sign, submit, confirm inclusion, or guarantee that a complete wallet transaction will fit. Cardano network fees and minimum output ADA still apply; Studio adds zero ADA fee.

The dedicated music-package tools retain their existing file-import handoff. This helper is for ordinary NFT/data payload intents only. Cross-platform paths and a shell-free Node child-process invocation are used. Focused helper/installer tests passed on Linux and Windows. A separate unattended Windows Codex attempt was [blocked by execution policy before the helper ran](../experiments/agent-acceptance/windows-helper/README.md); successful helper tests do not establish that agent-execution stage.

## Save a native mobile QR

When the user asks to send the supported creation to their phone, append `--mobile`:

```sh
node mcp/create-review.mjs --request REQUEST.json --output NEW_DIRECTORY --mobile
```

The flag explicitly authorizes sending encrypted content to NFT-Studio's existing
15-minute relay. It invokes `create_mobile_handoff` through the local MCP, which
reads back and verifies the exact intent before returning a QR. The exporter
checks the response, regenerates the QR from its verified Studio phone URL, and
adds `mobile-qr.png`, `mobile-qr.svg`, `mobile-url.txt` and a self-contained
`mobile.html`. Display the PNG in chat and provide the full link and expiry.
Desktop review and `intent.json` remain available.

`mobile-transfer.private.json` holds the creator revocation arguments. Keep it
private. The final receipt hashes every saved file; files are created exclusively
with private permissions. Failed exports attempt to revoke their transfer, and
all transfers expire automatically. Tool calls have bounded timeouts (70 seconds
for mobile creation, covering upload, read-back and failure cleanup).

Without `--mobile`, no phone transfer is created. Existing output directories
are never overwritten. This option does not host arbitrary large files: the same
eight-file / 12,000-raw-byte limits apply. See [Mobile handoff](MOBILE_HANDOFF.md).
