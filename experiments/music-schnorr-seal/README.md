# Exact release seals in BEACN Labs

**Release seal** checks an imported Schnorr endorsement of an entire canonical Music release: recording, cover and credits. A changed credit produces a different package commitment. The original signature can still be valid while clearly identifying that different release.

The Studio panel imports local package, seal and trust JSON; exports an exact signing challenge or inspection report; and keeps signature validity, package matching and selected trust separate. **Try signed example** uses Midnight Beacon and a synthetic signature with empty trust. **Use example trust rules** is a separate action. It never establishes a real artist's identity.

This is an experimental application of existing BIP-340/secp256k1 cryptography and Cardano's CIP-49 verification primitive. It is a portable sidecar endorsement. The seal does not modify the original Music package, attach itself to a minted NFT, configure payments or authorize a wallet. The public MCP remains its existing 15-tool service; this browser experiment adds no hosted signing or verification endpoint.

## Profile and retained evidence

The [frozen snapshot](snapshot/) contains the exact 52 files reviewed before UI integration, including its original candidate README, declaration files, code, fixtures, licenses and dated receipts. That README describes the snapshot's capture before admission; this document describes the Studio adapter. Its manifest SHA-256 is `0a6441fd446f1d8a0298bf1e8c27b3b2a5f19db64cdab75ffcb7dbbdf97a7e32`. The 104,653-byte browser module remains `9227cd6811f14f3d0092b7bccbfb084e6db6cae72111c292592b5329cad354f1`.

Read the [exact profile](snapshot/PROFILE.md), [attribution](snapshot/ATTRIBUTION.md), [core evidence](snapshot/evidence/) and [scoped independent review](evidence/independent-review.json). The core passed 9 Node groups, 255 Chromium assertions and 219 local Aiken checks. The separate agent added 237 Python assertions, 60 API boundary checks and 15 additional Aiken cases. Its only finding concerned documentation of error constructors, corrected before freeze. This is same-session independent review, not an external security audit.

The profile always signs the SHA-256 of a fixed domain plus the raw full-package hash. It excludes zero-r or zero-s signatures. The pinned Aiken native evaluator accepts only 32-byte messages; four otherwise valid official BIP-340 vectors with other lengths expose that toolchain limit. The profile's digest is always exactly 32 bytes. The Aiken helper validates this primitive over a supplied package hash; it does not parse complete Music packages, select trusted keys or enforce a transaction policy.

The bundled Music parser is an immutable compatibility profile pinned to source `96a8697c20b3d2fbe218e17bb238dd664fb5c00d`. Future codecs or cryptographic profiles require a new reviewed bundle and identity. Static endorsements intentionally replay for the same release; they are unsuitable for login, access authorization or one-time redemption. No Bitcoin address derivation, wallet signing compatibility, rights certification or ledger execution is established.

The [independent UI receipt](evidence/browser-ui-review.json) records 109 checks on
its private built fixture at desktop and phone widths, including stale-result
cancellation and exact mismatch exports. The final root build separately passed
40 browser checks. The [actual public-release receipt](../../docs/verification/release-seal-public-browser-20260907.json)
then records 97 checks on each public site at 1440/390, including exact examples,
separate trust, changed-release hashes, challenge/report exports and input rejection.
Both public builds served the same verified module bytes. No wallet or transaction
operation occurred; normal Sites hosting-challenge traffic is recorded separately.

## Reproduction

From the repository root:

```sh
npm run verify:seals
```

This verifies the complete frozen manifest before importing the module, checks all public fixture bytes and checks the diagnostic separation used by the adapter. For the full core suite, make a disposable copy of `snapshot/` and follow its README. Build and Aiken/browser verification commands refresh receipts; preserve the frozen evidence. Generating new synthetic signatures is a separate, explicit operation and is unnecessary for reproduction.

The maintained UI is `components/music-seal-lab.tsx`; fixed examples are under `public/labs/music-seal/`. Original input text stays inert, trust defaults to empty, edits invalidate previous results and leaving the panel cancels pending results. The UI's local file checks do not establish anything about external signers or chain state.
