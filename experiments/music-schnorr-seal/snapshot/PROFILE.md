# Profile: `bip340-sha256-release-nonzero-rs-v1`

This local application profile uses BIP-340 Schnorr verification over secp256k1 with a 32-byte x-only public key and a 64-byte signature. It is a restricted profile, with `r=0` or `s=0` unsupported. It does not accept DER signatures, ECDSA, compressed/uncompressed SEC public keys, addresses or arbitrary signing messages.

## Exact challenge

1. Parse and verify the complete canonical Music package with the pinned Studio codec. Verify file hashes, the bundle hash and all supported credits/metadata, then the canonical full-package hash.
2. Encode this exact domain as UTF-8, with **three literal NUL bytes** at the shown `\0` positions:

   `BEACN Labs\0music-release-endorsement\0beacn.music-schnorr-seal.v1\0`

3. Append the **raw 32 bytes** decoded from `packageHash`, not its hex text.
4. `message = SHA256(domainBytes || packageHashBytes)`.
5. Verify the imported BIP-340 signature against this exact 32-byte message and imported x-only key. No extra BIP-340 prehash is requested; BIP-340's own tagged challenge hash is internal to its verifier.

The prepared output includes `domain`, `preimageHex`, `messageHex`, `messageBytes:32`, `packageHash`, and `packageJsonSha256`. The packet SHA-256 is a diagnostic hash of the exact input JSON bytes; it is distinct from the package's canonical internal commitment. For the included Midnight Beacon v2 packet, `packageHash` is `3655e44e6c5a1ddd735c3e60b72e8ef76cecb5749f6763250e6ba629ebb96f65` and `messageHex` is `1e5a280d813866263a58dd48624accf498adce488090e826a9a6493336bc65b2`.

## Inputs

Seal JSON has exactly these fields, all strings:

```json
{"schema":"beacn.music-schnorr-seal.v1","profile":"bip340-sha256-release-nonzero-rs-v1","packageHash":"<64 lowercase hex characters>","publicKeyHex":"<64 lowercase hex characters>","signatureHex":"<128 lowercase hex characters>"}
```

Trust JSON has exactly `schema` and `bindings`; each binding has exactly `packageHash` and `publicKeyHex`. Trust is scoped to the declared package plus key, and must come from the caller's explicit selection. No trust is inferred from a signature, filename, artist credit, supplied policy, URI or existing example.

```json
{"schema":"beacn.music-schnorr-trust.v1","bindings":[]}
```

`packetJson` must be a primitive, well-formed string no larger than 80,000 UTF-8 bytes; seal text is capped at 1,024 bytes; trust text at 4,096 bytes and 16 unique bindings. The imported Studio package profile imposes its own content bounds. Noncanonical packet text, duplicate/escaped-alias keys, unknown fields, inappropriate numeric/array/object values, unsupported schema/profile, malformed JSON, invalid lengths, uppercase/non-hex encodings and duplicate trust bindings reject. UTF-16 unpaired surrogates reject. The raw-text API never accesses caller getters or coercion methods. There is no CBOR input or decoder in this application API.

## Result separation

`cryptography` is `absent`, `valid`, `invalid` or `unsupported`. Malformed input rejects with an `Error`; direct boundary checks often use `TypeError`, while the pinned Music codec can return ordinary `Error` instances. Adapters must catch every rejected input promise, not filter only by constructor. Well-shaped cryptographic failures are `invalid`; an excluded zero-r/s signature is `unsupported`.

`packageBinding` is `absent`, `match` or `mismatch`. A signature is verified against its **declared** package hash; a valid signature for a different package stays cryptographically valid while clearly reporting mismatch.

`trust` is `matched` or `unmatched`. It reports whether caller configuration selected this declared package/key, independently of cryptographic validity. An invalid signature can therefore have `trust:matched`, while `trustedExactRelease:false`. `trustScopePackageHash` makes the scope explicit. Trust does not assert that a key belongs to the named artist or any real person.

`trustedExactRelease` is true only when all three checks succeed. `verdict` is one of `no-seal`, `unsupported-signature`, `invalid-signature`, `different-release`, `valid-untrusted`, `trusted-exact-release`. The more detailed fields must stay visible in adapters rather than being collapsed into an ambiguous green checkmark.

Every report also exposes exact packet/seal/trust text SHA-256s and false flags for signing, network requests, identity, rights, wallet authority and chain evidence. These record this module's behavior and inference limits; they do not attest to unrelated behavior by a surrounding application.

## Cardano evidence boundary

[CIP-49](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0049/README.md) is **Active** in the pinned registry and defines the Plutus Schnorr verification primitive. This candidate only compiles and evaluates a local Aiken helper using that builtin. The helper validates lengths, domain hashing and the narrow signature profile. It does not parse the Music package, authenticate a trusted key, inspect a transaction context, or enforce ownership/redemption. It accepts a package hash supplied by its test harness. Therefore its success is not a mint policy, full on-chain package verifier, or proof of current chain state.

A future policy would need explicit trusted-key authority, package commitment binding, transaction context rules and actual ledger evaluation, each reviewed separately. This experiment supplies evidence for the cryptographic bridge only. It offers no automatic utility for an existing NFT.
