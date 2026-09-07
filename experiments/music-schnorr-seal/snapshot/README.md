# Exact Music release seal — private candidate

This verification-only experiment checks a separately supplied Schnorr endorsement of an **entire canonical NFT-Studio Music package**, including its embedded file bundle and credits. Signature validity, package matching and caller-selected key trust are reported separately. A valid signature starts as **valid, untrusted**. This is a BEACN Labs application profile of existing cryptography, not a new signature algorithm or an identity, rights or Bitcoin login system.

The kit is an unadmitted local candidate. It adds no live Studio Lab, MCP tool, wallet connection, signing endpoint, transaction or chain enforcement. The Aiken harness establishes local evaluator behavior only. Root owns any later integration and publication.

## Supported profile and API

Import the pinned browser bundle and its adjacent declaration file:

```ts
import { prepareChallenge, inspectSeal, EMPTY_TRUST } from './dist/seal.mjs';
const challenge = await prepareChallenge(canonicalMusicPacketText);
const untrustedReport = await inspectSeal(canonicalMusicPacketText, importedSealText);
const selectedTrustReport = await inspectSeal(canonicalMusicPacketText, importedSealText, explicitTrustText);
```

`prepareChallenge(packetJson)` first uses the immutable Studio codec to verify the complete package and exact canonical JSON. It returns the package hash, exact raw-packet SHA-256, domain, preimage hex and 32-byte message digest. Trailing whitespace is rejected by the existing canonical package profile.

`inspectSeal(packetJson, sealJson = null, trustJson = EMPTY_TRUST)` accepts bounded primitive JSON text only. See [PROFILE.md](PROFILE.md) and [declarations](src/index.d.mts) for exact schemas and output fields. It performs no network requests, URL resolution, wallet calls or signing. Returned data is deeply frozen. It accepts no caller objects, typed-array views, keys for signing, arbitrary domain, curve choice, scripts or provider URL.

The immutable bundle is **104,653 bytes**, SHA-256 **9227cd6811f14f3d0092b7bccbfb084e6db6cae72111c292592b5329cad354f1**. It has no Node runtime requirement. Web Crypto `subtle.digest` is required by the fixed Studio codec, so use a secure browser context such as HTTPS or localhost. The bundle includes internal dependency code; only the declared constants and two verification/challenge functions are exported. No signing operation is exposed.

The supported Music codec closure is pinned to Studio commit `96a8697c20b3d2fbe218e17bb238dd664fb5c00d`, recorded with exact original bytes in [studio/SOURCES.json](studio/SOURCES.json). Its two TypeScript originals have inert `.ts.source.txt` suffixes. The build loads only those exact fixed paths; they cannot enter a parent TypeScript project as ordinary `.ts` sources. This is a fixed compatibility profile, not automatic support for future Music schemas. Updating that codec or the verifier requires new evidence and a new bundle pin.

## Observed evidence

| Check | Result | Scope |
|---|---:|---|
| Node | 9 groups passed | All 19 official vectors; 32 synthetic public-key fixture sets; package, trust and malformed-input negatives |
| Chromium 152 | 255 assertions passed | Same pure browser API and official vectors, no Node globals, zero external or wallet/provider calls |
| Aiken `v1.1.23+8949565` | 219 checks passed | 15 official 32-byte vectors, four documented native message-length gap cases, 200 application checks |
| Immutable source audit | 7 sources passed | Exact bytes/SHA-256 and independent reconstruction of all 19 verification-only CSV projections |
| Types | Passed | Strict TypeScript consumer import, without casts or blanket ignores |

[Evidence receipts](evidence/) retain the tool versions, source and bundle hashes, and exact test outcomes. Tests do not establish a security audit, ledger execution, current wallet interoperability, an endorsed key's identity, or a publicly hosted feature. The browser harness tests the module, not a finished product UI.

Two compatibility limits are intentional and visible:

- Noble 2.4.0 rejects `r = 0` or `s = 0`, stricter than general BIP-340. This profile explicitly excludes those encodings and reports `unsupported`, rather than making a universal BIP-340 equivalence claim.
- The actual pinned Aiken **native** runtime accepts only 32-byte messages. Four otherwise valid official vectors with messages of 0, 1, 17 and 100 bytes reject there. BIP-340 and CIP-49 permit arbitrary message lengths. Our domain-separated message is always SHA-256 output of exactly 32 bytes. Aiken's alternate WASM branch and a ledger node were not evaluated.

## Reproduce without a root checkout or root dependencies

Work in a disposable copy: verification commands refresh evidence. Preserve a frozen kit before running them. Node 22.13+ is required; the recorded run used Node 22.22.2. Commands below neither sign nor submit anything.

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run verify:types
npm run verify:sources
npm run verify:aiken
npm run verify:browser
python3 scripts/verify-online.py --online
```

`verify:aiken` requires exactly Aiken `v1.1.23+8949565` already installed. It compiles and evaluates the fixed public fixture harness with seed `20260907`, no remote project dependencies. `verify:browser` requires a local Chromium executable, defaults to `/snap/bin/chromium`, and allows `CHROMIUM_EXECUTABLE` and `BROWSER_PROFILE_PARENT` overrides. It starts an ephemeral **loopback-only** server and its own temporary browser profile, then closes them. Its profile is retained as local diagnostic state outside the kit. Browser tests forbid fetch/XHR/socket/event-source and Cardano APIs after loading fixed module assets.

`scripts/retrieve.py --online` is a separate original-source reconstruction command. It uses seven hard-coded immutable URLs, refuses redirects and caps each response at 512,000 bytes with a 20-second socket timeout. It refreshes source timestamps. `verify-online.py --online` checks those same identities and the official vector projection without replacing originals. Neither API exposes caller-supplied network locations. Total request time is not a production service guarantee; these are bounded manual research utilities.

`scripts/make-fixtures.mjs --generate-new-public-fixtures` is an **optional test-data generator**, deliberately outside the runtime API. It creates ephemeral synthetic keys in memory and writes only public keys/signatures, then zeroes the local key byte arrays. It neither accepts real private keys nor persists them, but JavaScript cannot promise whole-process memory erasure. Do not run it to reproduce the frozen fixtures: random new signatures change hashes and require all tests and receipts to be regenerated. Official CSV private-key and auxiliary-randomness columns were never persisted; only public verification fields are retained.

## Integration boundary

Keep `dist/seal.mjs` and `dist/seal.d.mts` together. An adapter should preserve the original three input texts, make key trust a separate explicit action defaulting to empty, and invalidate results on any edit/import. Example trust applies only to the exact synthetic example package/key; it is not a public identity directory. Show validity, package matching and trust independently, and render all text inert. Handle rejected inputs without falling back to a different curve, canonicalizer or trust rule. A static endorsement can be replayed for the same release by design; it must not authorize login, one-time redemption, ownership, minting or spending.

Original sources and dependency terms are recorded in [ATTRIBUTION.md](ATTRIBUTION.md). No root repository or frozen earlier kit was modified by this experiment.
