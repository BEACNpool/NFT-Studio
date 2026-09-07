# Scoped source review

No consequential production acceptance defect was reproduced in the final bounded production-build review. Root corrected development StrictMode effect replay separately before this final run. Source identity is the actual file hash list in `public-verification.json`; the reviewed tree contained uncommitted handoff changes, so this kit does not claim an earlier Git commit reproduces them.

## Zero Studio fee

`lib/studio-transaction.ts:211` puts the minted token’s min-ADA output at the connected change address. Line 272 returns change to that same address. Line 248 disables burning extra small change as a fee, and line 285 enforces the additional 2 ADA network-fee cap. There is no platform address/output or percentage-fee argument in this native path. `components/file-mint-dialog.tsx:411` now labels the Studio fee as 0 ADA. The oracle checks actual CBOR outputs and complete value sums, not that UI label. This conclusion covers the shared ordinary native path tested here; it does not describe unrelated browser-only contracts or imply that Cardano fees or retained minimum ADA are zero.

## Integrity and consent

`lib/studio-review-link.ts:45` bounds and decodes the content fragment, rejects malformed/noncanonical UTF-8/JSON/base64url, and delegates full identity checks to the ordinary intent codec. `AgentMintPanel`’s `openLink` effect removes recognized fragment content from the current history entry before parsing. Source content hashes identify bytes; they do not identify the author or confer trust. Initial link import never calls the wallet.

`components/file-mint-dialog.tsx:193` rechecks review freshness and wallet state before requesting a witness, then repeats state checks after signing and merges only verified required-key witnesses. Lines 244–245 construct and persist the signed receipt before the submission call. Creator unmount checks prevented a pending fixture witness from triggering submission after Clear. Rejection leaves submission untouched.

`lib/studio-submission.ts:78` uses Web Locks and the stored attempt marker for local submit-once behavior. Its guarantee is confined to retained browser storage/locking, not every device or clearing browser data. `lib/studio-submission.ts:167` explicitly calls confirmation observed inclusion; its status query is a fixed-provider observation. The harness verified a mocked inclusion/receipt transition, not a node or the real chain.

## Claims still limited

The signature-plus-expiry policy mints one token in this transaction but permits additional minting while open. No permanent supply-one guarantee is established. Input availability is supplied by the wallet and is not independently queried before signing by this flow; ledger validation can reject a race. Protocol parameters come from a fixed bounded public reader. Real wallet compatibility, actual Codex subscription setup and a real confirmed mint require their own receipts. Dedicated Music packets still use their existing Music import/review flow in this milestone; do not describe every MCP tool as using this ordinary direct link.

Primary behavior reference read locally: archived CIP-0030 from cardano-foundation/CIPs commit `05ee6bb05982289dbe00c4187b9d54cf90e2e276`, `CIP-0030/README.md`, especially `enable`, `signTx` and `submitTx`. The fixture uses the consent and partial-witness interface described there; a standards document does not establish a named wallet’s current compatibility.
