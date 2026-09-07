# Local CIP-26 property-attestation inspector

This browser-compatible experiment inspects explicitly supplied metadata JSON. For each supported property it reconstructs the attestation message, verifies signatures, and reports whether a valid signer appears in a separately supplied **exact subject → public key** trust configuration. It compares the property sequence with optional local observations. It has no provider, network, wallet, signing, publication or storage API.

This is a bounded subset of the [Active CIP-26 general trust model](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0026/README.md). It is not a complete CIP-26 validator or a native-policy authenticator. The annex schema itself differs from the documented envelopes/decimals range; this profile and those differences are recorded in [SOURCE_REVIEW.md](SOURCE_REVIEW.md). Nothing is deployed by this package.

## Use

```js
import { createCip26Inspector } from './src/index.mjs';

// Application/user-owned configuration. Do not derive this trust list from a record.
const inspector = createCip26Inspector(JSON.stringify({
  schema: 'beacn.cip26.trust.v1',
  bindings: [],
  observations: [],
}));

// Retain the original file text: parsing/stringifying it first loses duplicate-key evidence.
const result = inspector.inspect(originalMetadataJsonText);
```

With no configured keys, valid signatures are reported as **untrusted**. Add a binding only when the application/user has established that trust separately:

```js
const localConfiguration = {
  schema: 'beacn.cip26.trust.v1',
  bindings: [{ subject: exactSubject, publicKeys: [knownPublicKeyHex] }],
  observations: [{
    subject: exactSubject,
    property: 'name',
    sequenceNumber: previouslyObservedSequence,
    attestationDigestHex: previouslyObservedDigest,
  }],
};
```

Constructing an inspector snapshots this configuration from its JSON text. Inspection cannot add keys or modify observations. The application owns trust decisions and durable sequence storage. An agent-supplied configuration is not independent authority; a future hosted adapter must provide its own trust context and must not accept a record's embedded key list as trusted configuration.

The result contains each supported property's exact scalar value, four CBOR preimages and component hashes, concatenated component hashes, final attestation digest, signature classifications and sequence comparison. Public keys/hex encodings are normalized only for comparison; subject, property and value text retain their exact UTF-8 content, including BOM and normalization differences. No subject-to-asset interpretation is inferred.

For a browser without a package bundler, build and import `dist/cip26-inspector.mjs`. This self-contained ESM artifact has no external imports or Node dependency. Source consumers need the pinned runtime packages in `package.json`. Declarations are in `src/index.d.mts`.

## Read the result correctly

| Field | Meaning |
|---|---|
| `signatureTrust: trusted` | At least one signature verifies under this strict profile and its exact key is explicitly trusted for this exact subject. |
| `untrusted` | A signature verifies, but no verified signer has that subject-specific trust binding. |
| `invalid` | Signatures were supplied, and none verified. Each signature retains its individual result. |
| `unsigned` | No signatures were supplied. |
| `status: unsupported` | This property's value/semantics are outside the profile; no attestation digest or signature verdict is invented. |
| `sequenceStatus: unobserved` | No prior observation was supplied. This does not prove that the record is fresh. |
| `newer` / `older` | The supplied sequence is above/below the local observation. |
| `same-observation` | Sequence and attestation digest both match the local observation. |
| `conflict` | Sequence matches, but the attestation digest differs. |

`eligibleForTrustedDisplay` requires a trusted signature and rejects older/conflicting observations. `eligibleAsUpdate` additionally requires an unobserved or higher sequence. Neither field changes storage or establishes truth. A valid trusted signature may endorse false claims; higher sequence numbers are not independent evidence of recency. Do not advance a stored baseline from an untrusted/invalid property: an attacker can attach a large sequence to a false record.

A mixed signature array is checked in full; one valid trusted attestation establishes the general-case trust classification, and invalid siblings remain visible. Duplicate keys are flagged and confer no extra authority. The result always declares `fullCip26Conformance`, `chainEvidence`, `ownershipEvidence` and `contentTruthEstablished` false.

A top-level `policy` may be carried as bounded opaque text. It is neither decoded nor used to derive trust, and `policy.authentication` always says `not-performed`. Even if explicit local trust permits a supported property to be displayed, this is not validation of the policy-bearing object's native-policy requirements. To establish that separate basis requires another reviewed implementation.

## Exact supported profile and bounds

The four attestation components use RFC 8949 preferred definite scalar encodings and Blake2b-256. Supported values are well-formed UTF-8 strings, safe integers, booleans and null. Arrays, maps, decimal/exponent number tokens, negative-zero tokens and integers outside JavaScript's exact safe range are unsupported. The representation is chosen before hashing; nothing is silently rounded, normalized or serialized as an arbitrary JSON object.

The well-known `name`, `description`, `ticker` and `decimals` fields receive their documented value-shape checks. The application URL profile is narrower: an explicit ASCII HTTPS authority without userinfo or malformed escapes, RFC 3986 path/query/fragment delimiters, and WHATWG host validation. Raw brackets are accepted only for a valid IPv6 authority; encoded brackets/hash and query/fragment slash/question marks remain allowed. The original text is retained for hashing without normalization. Other custom scalar properties can be inspected; their application semantics are not validated. Every value, including a URL, must be rendered as inert data unless another application-specific review permits an action.

Two well-known fields deliberately remain unsupported:

- `logo`: the general JSON-string encoding rule and the pinned registry's decoded-byte signing behavior differ. Choosing the wrong preimage can falsely accuse a valid publisher signature of being invalid. See [SOURCE_REVIEW.md](SOURCE_REVIEW.md).
- `preimage`: algorithm selection and subject-hash verification are outside this profile.

Work is bounded before cryptography: **96 KiB record text, 8 properties, 4 signatures per property**, 255 UTF-8 bytes per subject, 64 per property name and 4 KiB per supported string. Configuration is at most 48 KiB, 32 subject bindings, 8 keys per subject and 128 prior observations. JSON is limited to depth 10 and 2,048 parsed values, rejects duplicate/escaped-alias keys, reserved prototype keys, trailing content and malformed Unicode. Configuration and record APIs accept primitive strings only, invoking no caller getters, coercion or iterators. Unsupported signatures or counts do not trigger hidden truncation.

Strict Ed25519 uses noble's `zip215:false` plus canonical, non-small-order, prime-order public-key and R-point checks. This is a deliberately narrow attestation profile, not a consensus signature rule. It rejects a synthetic identity-point construction. No caller-supplied CBOR or WASM parser is exposed; the only CBOR is newly encoded from bounded supported scalars.

## Reproduce the observed tests

Node 22.13+ and Python 3 are sufficient for source tests and the independent oracle:

```bash
npm ci --ignore-scripts
python3 test/oracle.py
npm test
npm run build
node demo.mjs
node verify-sources.mjs
```

The Python fixture encoder uses `struct` and `hashlib`, independently of the JavaScript implementation. The suite compares 133 component/preimage/digest cases, including the published CIP example. It also verifies **59 original published attestations** from four pinned upstream fixtures using both this inspector and Node's native Ed25519 verifier. One original fixture has nine signatures per property; tests explicitly extract bounded per-signature records rather than asserting the complete over-limit file is accepted. No upstream private keys are needed.

Tests cover all attested component changes, 64 single-byte signature mutations, forged small-order/noncanonical signatures, wrong subject trust, absent/invalid/mixed signatures, sequence conflict/rollback, unsupported values, Unicode exactness, duplicate JSON, truncation, hostile JavaScript objects, null signature arrays and resource bounds. Synthetic signing uses an ephemeral in-memory Node keypair solely in tests; no private key is exported or persisted.

For actual Chromium, set `CIP26_CHROMIUM` to its executable if it is not `/snap/bin/chromium`, then:

```bash
npm run test:browser
```

The pinned Puppeteer dependency launches its own browser. The harness serves only the test page/module on ephemeral loopback HTTP, runs all 133 oracle cases and 59 published attestations in the browser, and disables wallet/network APIs while checking that Node globals are absent. Its receipt records 407 assertions with zero external requests or runtime capability calls. It closes only its own browser and server. `CIP26_PUPPETEER_PATH` can optionally select an already-installed toolkit.

Receipts under `evidence/` record the exact local outcomes and module hash. Performance measurements are for those runs, not service/device guarantees. The parser/profile have not received an independent security audit, and no real wallet, chain state, registry server or metadata publication path was exercised. Live service/UI integration is separate work.

`node verify-sources.mjs --online` explicitly re-fetches the immutable evidence URLs and verifies hashes. Normal tests and runtime inspection make no network requests. Public source snapshots retain their upstream licenses; see [ATTRIBUTION.md](ATTRIBUTION.md).
