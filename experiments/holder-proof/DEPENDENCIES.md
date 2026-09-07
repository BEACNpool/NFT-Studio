# Dependency decision and observed parser behavior

Inventory observed on 2026-09-07 in NFT-Studio: Node 22.22.2; `@emurgo/cardano-serialization-lib-nodejs` and browser-inlined variant **17.0.0**; `@noble/hashes` **2.4.0**. No installed Cardano message-signing/COSE parser was found. CSL supplies address parsing, public-key hashing and Ed25519 verification; it is not a complete CIP-8 message verifier.

The official [Emurgo message-signing repository](https://github.com/Emurgo/message-signing) links its npm packages and describes its role as COSE/CIP-8 serialization helpers. A candidate package was fetched **only to an external research directory**, with no NFT-Studio package or lockfile changes:

```text
@emurgo/cardano-message-signing-nodejs@1.1.0
https://registry.npmjs.org/@emurgo/cardano-message-signing-nodejs/-/cardano-message-signing-nodejs-1.1.0.tgz
sha512-PQRc8K8wZshEdmQenNUzVtiI8oJNF/1uAnBhidee5C4o1l2mDLOW+ur46HWHIFKQ6x8mSJTllcjMscHgzju0gQ==
```

Source inspected at commit `f76a82442594c8435fb577cb85da3ad594cf1063`. This is a source observation, **not** a reproducible-build proof that the npm WASM matches that commit. The npm metadata's repository link points to cardano-serialization-lib, whereas the official message-signing repository links the actual package. Do not infer package provenance from that metadata field alone.

Measured package behavior in `fixtures/dependency-probe.json`:

| Input | Result |
| --- | --- |
| Common alg-first protected map | Decodes and round-trips unchanged. |
| Same map with address first | Decodes, reorders to alg-first, changes protected bytes and reconstructed Sig_structure. |
| Duplicate alg within protected map | Decoder rejects. |
| Alg in both protected and unprotected maps | Decoder accepts, round-trip guard alone does not catch it. |
| Trailing byte after COSE_Sign1 | Decoder accepts; reserialization drops it. |

The [source deserializer](https://github.com/Emurgo/message-signing/blob/f76a82442594c8435fb577cb85da3ad594cf1063/rust/src/serialization.rs#L11) parses protected bytes into HeaderMap and reconstructs ProtectedHeaderMap. The [constructor](https://github.com/Emurgo/message-signing/blob/f76a82442594c8435fb577cb85da3ad594cf1063/rust/src/lib.rs#L35) serializes the map. This explains the measured normalization. COSE preserves that byte string inside its signature input and forbids duplicate map keys. [RFC 9052](https://www.rfc-editor.org/rfc/rfc9052.html#section-9)

The structural probes use zero-filled dummy signatures; **they do not demonstrate signature forgery or complete authentication bypass**. They demonstrate why decoding plus `.signed_data()` is not sufficient. A strict `from_bytes(...).to_bytes() === original` guard can reject changed encodings, but is intentionally incompatible with valid alternate encodings, and still needs cross-header checks, field/type constraints and crypto verification. Raw protected bytes must either be retained by a reviewed bounded parser or preserved by a reviewed library fix. Do not deploy a handwritten general CBOR decoder as an unreviewed shortcut.

The follow-on candidate replaces the COSE decoder with the bounded `cbor-profile.mjs` implementation. That code is new and needs independent review before service deployment. The Emurgo message-signing package remains a diagnostic-only download and is not a runtime dependency.

## Strict signature verification added during implementation

A synthetic identity-point public key (`01` followed by 31 zero bytes) and identity-R/zero-S signature verifies against arbitrary messages through CSL 17.0.0. The full test constructs the corresponding payment address and COSE key and reproduces this behavior. Such a proof cannot establish exclusive private-key control. This is a deliberately constructed weak-key example, not a demonstrated exploit against an ordinary wallet key or existing deployment.

The candidate therefore also requires `ed25519.verify(signature, message, publicKey, {zip215:false})` from **@noble/curves 2.4.0**, which rejects the weak public key. It retains CSL signature verification as a compatibility cross-check and CSL for Cardano addresses. Noble documents its strict mode separately from default ZIP-215 behavior. [Official noble-curves documentation](https://github.com/paulmillr/noble-curves#consensus-friendliness-vs-e-voting)

The candidate kit pins this package and its exact hashes dependency in `package-lock.json`:

```text
@noble/curves@2.4.0
sha512-P4/62zrgfH33CneE3Dn4WhJVA22YUU0eR51wKIan4NVRvwsA0YnPTwWGpNbpuacSujmSFLvyzpyuR30+fbq2Ew==
@noble/hashes@2.4.0
sha512-X5XaVWZIBCT7HHZGm5I7ZQXDwLG+bGXuSrMQAW+7Zvl87h1kmc1ZB1VSRJcpUfoUrGQp4Fkoxm5kZ+Ms+aW+eA==
@emurgo/cardano-serialization-lib-nodejs@17.0.0
sha512-OXayQwnQXhvgEbKSNKuQCpCTrg9LvFDbr+vHPnO/9tVrRhx/Bts+g+9d6TiI15/vAeJ0NkA3tuuiJpPTS5kD6w==
```

All installation occurred in this external candidate kit; no root project dependencies changed. The package versions/integrities establish reproducibility, not an audit of the application or a claim that these exact dependency releases have been independently audited here.
