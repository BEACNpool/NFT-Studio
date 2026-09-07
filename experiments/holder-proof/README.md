# Holder-proof verification candidate

This experimental package implements an offline BEACN Labs holder-proof verifier: exact COSE bytes, strict Ed25519, payment-key binding, server challenge scope, fresh trusted snapshot checks and single-use nonce consumption. It is **not a deployed authentication service or an independently audited implementation**.

```sh
npm ci --ignore-scripts
npm test
npm run demo
```

`demo` verifies a saved synthetic proof, then rejects its replay. It performs no signing, wallet access, chain query or live authorization. Tests generate ephemeral synthetic signatures with Node's native crypto; no real signing keys are accessed and no private key bytes are exported or saved.

- `DESIGN.md`, `challenge.schema.json`: protocol, concrete challenge, transfer/reorg boundaries and eventual service scope.
- `IMPLEMENTATION.md`: implemented path, exact evidence and review boundaries.
- `cbor-profile.mjs`, `cose-verifier.mjs`: bounded parser preserving protected bytes and complete pure signature verification.
- `holder-verifier.mjs`, `primitives.mjs`: verification composition, scope/expiry, payment-key binding, trusted snapshot predicates and atomic memory-store example.
- `verify-cose.mjs`, `test-fixtures.mjs`: independent native-crypto fixture generation and adversarial tests.
- `DEPENDENCIES.md`, `probe-message-signing.mjs`: measured legacy parser normalization/trailing/duplicate behavior and strict Ed25519 dependency decision.
- `fixtures/`: public synthetic challenges, COSE proofs, expected decision and observed receipts.

Validation includes 52 primitive checks, 17 accepted COSE cases plus two crypto diagnostics, 84 named rejections, 192 truncations, 512 signature-bit mutations, 1,000 malformed envelopes and 23 combined-engine checks. Optional `python3 verify-fixtures.py` independently checks all 16 saved COSE fixtures using Python cryptography; this package is not needed for `npm test`.

Runtime dependencies are pinned CSL 17.0.0 and noble-curves 2.4.0, with noble-hashes 2.4.0 in the lockfile. Strict noble verification uses `zip215:false`; CSL alone accepts a synthetic identity-point construction that cannot establish exclusive key control. The candidate rejects that full COSE proof.

The included memory store is illustrative; it lacks persistence, distributed transactions, quotas and cleanup. The holdings snapshot must come from a **trusted server adapter**, never HTTP request JSON. Provider integration, real wallet compatibility, external security review and protected service delivery remain future work. No service was started or deployed.

Original code is Apache-2.0. The public Ed25519 verification vector is attributed to [RFC 8032 section 7.1, Test 2](https://www.rfc-editor.org/rfc/rfc8032.html#section-7.1); its private test key is not included. Primary-source references are linked in the design/dependency documents. Downloaded diagnostic dependency source and node_modules are excluded from the shareable archive.
