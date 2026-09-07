# Association with the tested Codex source

`source-association.json` compares the frozen real-Codex acceptance inputs with
the pending checkout reviewed afterward. Its `currentCheckoutHead` is the base
commit that was checked out at the time; the explicit file hashes describe the
pending source. The original acceptance receipt is not rewritten or rebound.

Seven of nine pending files match byte-for-byte: the direct-link codec, three MCP
test files, repository skill, installer, and installer tests. The Node and Worker
server sources differ by exactly two static capabilities fields: `reviewHandoff`
and `fees`. Removing only the exact recorded insertion reproduces their original
tested hashes. Six supporting files also match. The four rebuilt entry artifacts
that differ are explicitly identified and are not claimed as the original
real-agent binaries. No additional model invocation was necessary for those two
metadata additions.

To check the published source using only this public receipt and script:

```sh
python3 verify-published-source.py "$NFT_STUDIO_CHECKOUT"
```

The checker pins this receipt's SHA256, checks every listed current-source hash,
and validates the precise capability insertion against the tested hashes. It
reads files only and needs no credential, network, private archive or installed
Node dependencies. Changes to any bound source correctly fail this historical
check; later releases need their own observations rather than edits to this one.

The separate StrictMode regression fixture records the subsequent browser-effect
fix. Its patched component and tests are a separate observation; the original
CLI acceptance did not exercise that browser component. No source association,
intent or local browser test establishes signing, submission or chain inclusion.
