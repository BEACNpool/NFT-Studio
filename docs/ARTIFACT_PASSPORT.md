# Artifact Passport: portable local evidence

An Artifact Passport combines an NFT-Studio exact-file receipt, recovered content and optional source/build declarations in one small, independently inspectable export. It is a BEACN application format, not a new Cardano standard, registry, signature or certificate.

The first profile is `nft-studio-exact-payload-v1`, inside schema `beacn.artifact-passport.v1`. It supports the existing **NFT and data file lanes**, using their actual `nft-studio.payload.v1` / `nft-studio.data.v1` metadata and 12,000-byte content bound. The adapter reuses [the existing payload codec](../lib/studio-payload.ts) and CSL; it does not fork the Recovery panel or create another asset database. Legacy art/game metadata, larger recovered catalog programs, Scroll, Book, CIP-68 state and proof-of-existence records need separately specified adapters.

## What travels in the passport

- Exact mainnet identity: either policy ID plus original asset-name hex, or the Studio data label.
- Transaction ID, exact auxiliary-data CBOR and its ledger hash.
- The recovered payload bundle: original embedded file URIs, names, declared media types, byte counts and SHA-256 digests.
- Receipt state/time/block-depth fields, explicitly tagged **`receipt-reported`**.
- Optional source repository/commit, source/input/output file commitments and a build recipe, explicitly tagged **`declaration`**.
- SHA-256 of the canonical passport core, excluding its own `passportHash` field.

The export omits the receipt's prepared wallet snapshot, addresses, input references, required key hashes, signatures and transaction CBOR. The adapter projects only the receipt fields it needs; it never traverses `prepared` or copies receipt display metadata over the data recovered from actual auxiliary bytes. Files and metadata can themselves contain personal content, so this is a sanitized evidence format, not an automatic privacy or rights determination.

Transaction CBOR can be supplied separately to the verifier for a local comparison. It is never inserted into the passport by that operation. A remote service using this module would receive any bytes supplied to it; keeping verification in the browser keeps those bytes local.

## Each claim has its own evidence

| Check | What a match means | What remains unverified |
| --- | --- | --- |
| `passport-content` | Canonical checksum, file digests and recovery from supplied auxiliary metadata agree. | Exporter identity, whether the checksum came from a trusted source, authorship or rights. Anyone can create a different passport and compute its checksum. |
| `transaction-binding` | If transaction bytes are separately supplied: their body hash, raw auxiliary bytes, committed auxiliary hash, output network and exact selected quantity-one mint/data identity agree. | Signatures, mint policy execution, output conservation/destination, input availability, fees, full ledger validation, inclusion, lifetime supply or ownership. |
| `receipt-observation` | Nothing is promoted: saved state, time and zero-or-greater block depth are retained as a receipt report. | Actual inclusion, confirmation depth, rollback state, observation source and trustworthy time. A reported `confirmed` state stays unverified here. |
| `source-and-build` | Source/build declarations are structurally bounded. | Repository existence, commit tree membership, authors, dependencies, recipe execution, safe execution and reproducibility. |
| `provenance-file:<path>` | Optional exact local bytes match a declared source/input/output file's SHA-256 and size. | Membership in the claimed repository or production by the claimed build. Missing local files remain `not-checked`. |
| `build-output-content:<path>` | A declared output digest and size identify embedded content bytes. | Whether that build occurred or produced those bytes. |

The overall success status is **`verified-local-content`**. It is deliberately limited to the content checks and whichever optional local checks were actually supplied. Read each check's `status` and `evidence`; absence of transaction bytes leaves transaction binding `not-checked`. The result always sets `chainInclusionVerified`, `authorshipVerified`, `ownershipVerified`, `buildReproduced` and `signaturesVerified` to false. A failed optional check prevents overall success.

The ordinary NFT profile requires the exact selected asset to be the transaction's sole quantity-one mint. That is a claim about supplied transaction bytes, not a lifetime one-shot policy. Its native policy and the transaction still require separate execution and ledger validation. A transaction can have a correct body hash and invalid or absent witnesses; the tests deliberately demonstrate that distinction.

## Adapter and verifier

Pass the application's already loaded CSL module. No wallet connection or network lookup occurs:

```ts
import {
  createArtifactPassport,
  verifyArtifactPassport,
  artifactPassportBytes,
  parseArtifactPassport,
} from '../lib/artifact-passport';

// Existing local StudioReceipt from the exact-file NFT/data flow.
const passport = await createArtifactPassport(C, receipt);
const exportBytes = artifactPassportBytes(passport);

// Import exact exported bytes; do not execute the files or recipe.
const imported = parseArtifactPassport(exportBytes);
const result = await verifyArtifactPassport(C, imported, {
  transactionCborHex: receipt.signedHex, // optional, kept outside the export
});
```

`createArtifactPassport(C, receipt, {provenance?})` adapts a local receipt and verifies the available transaction binding before constructing its export. It recovers content from the actual transaction auxiliary data, rather than trusting a receipt's duplicate `metadata`, `name`, `bundle` or `prepared` fields. This function does not authenticate signatures, even though the receipt field is historically named `signedHex`.

Provenance is optional. A declaration has `evidence: 'declaration'`, `files: [{path, role, bytes, sha256}]`, optional `source: {repository, commit}` and optional `build: {tool, version, recipe, outputPaths}`. Roles are `source`, `build-input` or `build-output`. Build output paths must reference declared output records. Repository URLs are plain GitHub repository URLs without queries or credentials; a full commit is required. No URL or recipe is fetched or executed.

`verifyArtifactPassport(C, passport, {transactionCborHex?, sourceFiles?})` can additionally receive `sourceFiles: [{path, bytes: Uint8Array}]`. These are supplied content bytes, not filesystem paths to read. Relative paths are identifiers only. The result distinguishes `verified-local-content`, `mismatch`, `invalid-passport` and `unsupported-profile`, and reports the scope of every successful check. Unknown profile features fail closed.

## Deterministic bytes and limits

Canonical JSON orders object keys by JavaScript's lexical UTF-16 order, keeps array order and exact strings, and uses JSON string escaping, no whitespace and safe integer numbers. No normalization, compression, line-ending conversion, timestamp insertion or locale-dependent sorting occurs. All profile field names are ASCII. File bytes are recovered by the existing codec, including UTF-8 BOM and CRLF bytes.

`passportHash` is SHA-256 over UTF-8 canonical JSON of the core without `passportHash`; it is not a signature or Cardano transaction ID. `artifactPassportBytes` serializes the entire record. `parseArtifactPassport` requires that exact canonical representation, which rejects duplicate object keys and reformatted JSON. The object-based verifier rebuilds canonical bytes, so object property insertion order does not matter.

Bounds are application limits: 240,000 UTF-8 passport bytes, 16,384 transaction bytes, 16,384 auxiliary-data bytes, eight content files and 12,000 total content bytes. Provenance permits at most 32 commitments and 1 MiB of declared/supplied file bytes. JSON traversal is bounded by depth 24 and 20,000 nodes, with a cumulative UTF-8 budget enforced before accumulating child results. Getters, cycles, sparse or extended arrays, unsafe numbers, malformed Unicode, unknown fields and unsupported metadata are rejected. Array elements are read from data descriptors without dispatching caller methods. Supplied byte arrays use intrinsic typed-array lengths and are copied before asynchronous work; overridden length/buffer properties cannot change the size claim, and shared buffers are rejected. The caller should bound an imported receipt file before JSON parsing; this adapter only projects the fields it needs from an existing receipt object. These APIs accept ordinary data records, not executable Proxy objects.

Every untrusted transaction and auxiliary CBOR input receives a structural preflight before CSL/WASM decoding: depth 16, 4,096 items, declared collection sizes bounded by the remaining bytes/items, no trailing bytes and no indefinite byte/text strings. This bounds parser work; it does not validate Cardano transaction rules. The auxiliary and complete transaction must also round-trip to the exact supplied bytes. Alternate encodings, duplicate auxiliary map keys and extra trailing bytes cannot silently become a claim about normalized bytes. Other valid Cardano encodings may need another profile.

This is a strict current-producer profile: extra auxiliary scripts/metadata labels, binary/non-UTF-8 CIP-25 v1 keys and alternate protocols are not silently treated as the same export. All imported HTML, SVG and build recipe strings remain inert here. Display or execution requires the application's separate preview and trust controls.

## Reproduce

With the repository's npm dependencies installed:

```sh
node scripts/verify-artifact-passport.mjs
python3 scripts/artifact-passport-oracle.py
```

Eight test groups cover NFT/data adaptation, sanitized exports, optional transaction binding, exact BOM/CRLF recovery, deterministic canonical checksums, metadata/identity/receipt/provenance tamper, strict limits and parser rejection, source/build evidence separation, and both modes of the **actual shared Studio transaction builder** with network access blocked. Hostile array/typed-array overrides, aggregate JSON size, trailing/non-minimal CBOR, excessive nesting and enormous declared collections have regression cases. A trap CSL object confirms malformed opaque CBOR is rejected before any WASM parser entry. Two checked-in fixtures use original synthetic content, public dummy payment-key hashes and intentionally unsigned transactions. No signing keys are generated or stored.

The independent CPython oracle uses only the standard library: it recomputes canonical passport SHA-256, transaction-body BLAKE2b-256 and auxiliary-data BLAKE2b-256 for both fixtures. These checks are byte evidence, not full Cardano or build verification. The code and fixtures are original BEACN material under the repository license.

The design follows the existing [artifact-passport research guide](../knowledge/guides/artifact-passports.md) and [admission policy](../knowledge/ADMISSION.md). It does not claim CIP-88 authentication, CIP-171 build conformance or CIP-190 publication. Those require additional protocols and evidence.
