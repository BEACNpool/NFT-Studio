# Release verification

This release combines existing engines with a new shell. Verification distinguishes
synthetic transaction control flow, live read-only recovery and real-wallet acceptance.

## Passed checks

- 12 ordinary native mint groups: live parameter bounds, actual signed bytes/fees,
  metadata recovery, token/ADA conservation, multi-key witnesses and rejection paths.
- 9 design groups and 7 interactive-app groups: pixel changes, project round trips,
  bounded configurations, exact program recovery and complete signed transactions.
- All nine games across two synthetic visitors, with and without existing tokens.
- 9 exact-payload engine groups: NFT/data construction, integrity, change, replay
  protection, ambiguous responses and correct zero-block inclusion parsing.
- Signed receipt restoration rejects altered bodies, metadata, images, signatures
  and destinations. Browser tests cover receipt-before-submit, reload, ambiguity,
  post-sign spent inputs and navigation away while a signature is pending.
- Static subdirectory builds preserve all asset paths and pass the exact-file signing/recovery browser harness.
- Exact file UI tests cover data/NFT workflows, generated cover, existing-token
  preservation, receipt storage failure, confirmation persistence and recovery.
- 37 copied Ledger browser regression groups and 9 integration groups at root and
  GitHub subpath: Standard recovery, interrupted two-page Chain resume/seal, Book
  mint and entry readback, retained File handoff and wrong-source rejection.
- Unified Ledger shell at desktop/mobile: embeds, full-page fallback, exact 18 KB
  retained-file handoff and Book navigation. Wizard changes now focus and reveal
  the next pane on mobile.
- Current read-only chain recovery for nine games, five additional motion/music
  originals, Creation Engine and original Ledger Chess; byte hashes match recorded
  identities. Legacy UTF-8 data-URI parameters and programs above the new-package
  input bound remain recoverable within a separate 16 KB recovery bound. No original engine or policy was rewritten.
- Opaque browser previews for seven presets exercise controls, deterministic
  generation, finite audio buffers and four-bar PCM16 WAV exports. Hostile imported
  HTML/SVG cannot request external resources, access parent/wallet or navigate it.

See the machine-readable media and Ledger evidence alongside this document. Browser
screenshots and local harness output are development evidence, not on-chain receipts.

## Remaining acceptance boundaries

No real wallet was connected and no new mainnet transaction was sent during this
release’s tests. Test fixtures generate ephemeral keys and intercept submissions.
Real CIP-30 wallet/device compatibility and each migrated mainnet flow still need
acceptance before old sites are retired. Book subject extensions remain explicitly
subject to that acceptance. Viewer compatibility for uncommon codecs varies.

The browser trusts the configured public indexer for chain facts; it does not verify
an independent block/header inclusion proof. Books have bounded-history scans.
Benefit blueprints remain plans. The fixed legacy maker uses its own existing
protocol and dependencies; its dated parameter comparison is not a future refresh.

WebMCP is feature-detected, but no supported native WebMCP context was available for
its registration/action contract test. It is not required for the ordinary interface.
Lint excludes copied static tools and supplied UI primitives; React compiler
optimization diagnostics are disabled because this build does not use that compiler.
Lifecycle dependency advisories remain visible and are reviewed alongside signing
and persistence tests.
