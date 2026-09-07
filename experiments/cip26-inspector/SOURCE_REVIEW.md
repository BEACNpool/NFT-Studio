# Source review and profile decisions

Current CIP-26 bytes were retrieved on 2026-09-07 and matched the research pin `05ee6bb05982289dbe00c4187b9d54cf90e2e276`. `evidence/sources.json` records immutable URLs, retrieved SHA-256 hashes and licensing; `verify-sources.mjs` checks them. The inspector implements a bounded local profile; this source review does not establish a deployed registry authentication service.

The [CIP attestation section](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0026/README.md#attestation-signatures) supplies the four-component Blake2b-256 construction and the public contact example. Its general verification model scopes key trust to the subject. Its policy special case is described as superseded in favor of that general model. Accordingly, this profile accepts explicit local trust separately and does not implement native-policy authentication.

The [pinned Haskell implementation](https://github.com/input-output-hk/offchain-metadata-tools/blob/91eba72d6e5e3b17cd49f625c9546f2c82df5a65/token-metadata-creator/src/Cardano/Metadata/Types.hs#L594) independently shows the component hashing/concatenation. Its published test fixtures provide signatures generated outside this profile. The inspector verifies all 59 non-logo attestations from those four fixtures; a Node native Ed25519 verifier agrees. Tests extract bounded records where a source fixture exceeds the application signature count. No Haskell executable was run and no native-policy validation was inferred from these checks.

## Logo encoding requires an explicit future profile

The [CIP general rule](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0026/README.md#attestation-signatures) maps JSON strings to CBOR text. The logo's JSON value is a base64 string. However, the [registry `Logo` instance](https://github.com/input-output-hk/offchain-metadata-tools/blob/91eba72d6e5e3b17cd49f625c9546f2c82df5a65/token-metadata-creator/src/Cardano/Metadata/Types.hs#L311) first decodes it, then hashes a CBOR byte string. Name, description, ticker and URL use text encoding.

This profile reports `logo` as unsupported rather than silently trying several encodings. It does not label a logo attestation invalid or claim to validate PNG semantics. A future separately named registry-logo profile needs documented byte behavior, bounded base64/PNG validation and independent fixture coverage. Arbitrary arrays/maps/floats similarly remain unsupported because this subset intentionally avoids their encoding choices.

## Annex schema divergence

The [pinned annex schema](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0026/schema.json) places well-known `name`, `description`, `ticker` and `url` schemas directly on top-level values. Attestation envelopes for those named fields, as used by the normative description and published implementation fixtures, therefore conflict with that annex structure. Its decimals minimum is 1, while the main proposal and reference implementation permit 0.

The profile does not quietly repair that schema or claim to validate against it. Its documented profile follows enveloped property records and the demonstrated scalar signing encodings, with decimals 0–19 and a narrower 255-byte subject bound. Missing signatures are inspected as unsigned because the prose permits absent attestations; an explicit null signature array is rejected. These choices and `fullCip26Conformance:false` are part of the public result contract. This is an interoperability finding for upstream/source review, not a claim that a new standard has been established.

## Signature verification basis

The pinned [noble-curves 2.4.0 documentation](https://github.com/paulmillr/noble-curves/blob/656c4364dffa44c64aa0c49914b8000b278b67a9/README.md#consensus-friendliness-vs-e-voting) distinguishes strict verification from ZIP-215. The adapter explicitly uses strict verification and adds prime-order/non-small-order checks to both encoded points. This stricter acceptance profile suits an attestation inspector but must not be presented as a Cardano ledger consensus rule.

Published signatures, an ephemeral Node signer, Python/hashlib preimages and browser execution provide independent checks at different boundaries. They do not establish complete interoperability with every CIP-26 encoding or audit the entire upstream cryptographic dependency. Exact npm tarball integrities and versions are pinned in `package-lock.json`.


## Original URL component syntax

An independent review found that WHATWG `URL` accepts examples such as `https://example.com/a[b]`, `https://example.com/#a#b` and an empty original authority repaired into a host. The integrated profile now checks original authority/path/query/fragment text before host parsing. Path/query/fragment character sets follow [RFC 3986 Appendix A](https://datatracker.ietf.org/doc/html/rfc3986#appendix-A), with the component rules in sections 3.2–3.5. All userinfo is excluded as an explicit application restriction, including empty `@` and `:@` forms. This remains a narrow HTTPS profile, not a claim to accept every RFC URI. Original text, casing and percent escapes are never normalized before hashing.

The original candidate's source and handoff hashes remain under `provenance/`; the integrated manifest and fresh receipts identify the corrected module. The change affects URL shape classification only. It does not render or fetch values, choose trusted keys, authorize registry writes or change the attestation digest construction.
