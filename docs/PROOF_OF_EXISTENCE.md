# Local proof-of-existence records

The proof tool hashes exact local file bytes and creates the **public hashes
profile of proposed CIP-190, version 1**. It also verifies that supplied local
bytes match every digest in that profile. It does not upload files, contact a
wallet, sign a transaction, submit anything or establish chain inclusion.

The exported record can be published through a separately reviewed transaction
path later. A local JSON download or valid CBOR record is not a blockchain receipt.

## What is committed

The [current proposal](https://cips.cardano.org/cip/CIP-0190) specifies integer
metadata label **309**, record version **1**, and raw 32-byte content digests
under algorithm identifiers **`sha2-256`** and **`blake2b-256`**. A single hash is
allowed; this tool defaults to both. BLAKE2b uses its 32-byte output parameter,
not truncation of a 64-byte digest.

The exact record shape produced here is:

```text
{
  "v": 1,
  "items": [
    {"hashes": {"sha2-256": <32 raw bytes>, "blake2b-256": <32 raw bytes>}}
  ]
}
```

Canonical CBOR uses shortest encodings, definite lengths and map keys sorted by
the lexicographic order of their encoded bytes. The complete record body is then
split into raw byte-string chunks of at most 64 bytes. The value stored under
label 309 is an array of those chunks, even if the body is shorter than 64 bytes.
A one-file SHA-only body is 63 bytes; the default dual-hash body is 109 bytes.
The entire signed transaction has additional size and cost.

**No filename, path, MIME type, size, title or timestamp enters this record.**
The tool retains file names, sizes and digest associations only in the local
BEACN sidecar. A different filename does not change the commitment. Input order
is preserved; reordering several files changes the record's item order.

The JSON projection uses hexadecimal strings to make digests readable. That
projection is **not** the ledger encoding: the actual record uses byte strings,
and its label-309 transport also uses byte strings. The underlying exact CBOR is
exported separately.

## Meaning and privacy

A digest match establishes agreement with the exact supplied bytes. It does not
prove authorship, copyright, ownership, truth, a person's possession of the
original or authority to publish it. A commitment cannot recover the file.

A hash is not encryption. Anyone who can guess the file or already has a copy can
compute its hash and compare it with the public record. This is especially easy
for short or predictable content. This profile introduces no salt and makes no
privacy claim; silently salting would stop the named content hash from being a
hash of the promised exact file bytes. Keep sensitive content and its public
fingerprint implications in mind before a future publishing step.

Only independently checked transaction inclusion supplies ledger timing. This
module examines a supplied record body or label value and local content; it does
not bind that record to transaction auxiliary data, verify a transaction hash or
query confirmation depth. A future chain verifier must check those independently
against the original transaction bytes.

Line endings, Unicode normalization, PDF metadata, archive timestamps and even
one extra byte change the commitment. No normalization, conversion or compression
occurs. Retain the originals as well as the sidecar.

## API

```ts
import {
  buildProofOfExistenceFiles,
  buildProofOfExistenceBytes,
  decodeProofOfExistenceBody,
  decodeProofOfExistenceCarriage,
  verifyProofOfExistenceBytes,
  verifyProofOfExistenceFile,
} from '../lib/proof-of-existence';

const artifact = await buildProofOfExistenceFiles(files, {
  algorithms: ['sha2-256', 'blake2b-256'],
  signal: abortController.signal,
  onProgress: ({bytesHashed, totalBytes}) => updateProgress(bytesHashed, totalBytes),
});
const result = await verifyProofOfExistenceFile(artifact.recordCborHex, files[0], 0);
```

The artifact supplies `recordCborHex`, `labelValueCborHex`, `metadataCborHex`,
`chunksHex`, `recordSha256`, a readable `record`, local `files` and limitations.
The record SHA-256 is a local integrity identifier for the canonical body; it is
not a Cardano transaction hash. `specification` includes the exact source and
vector revisions. There is deliberately no local creation timestamp masquerading
as ledger evidence.

`buildProofOfExistenceBytes([{name, bytes}], algorithms?)` is synchronous and
suitable for bounded service inputs and tests. File APIs stream sequential 1 MiB
slices through incremental hashes. The producer supports 1–16 files and at most
256 MiB total. These are Studio resource bounds, not CIP-190 limits.

The reader has separate bounded CBOR resource limits. It verifies only items
containing supported hashes. Signatures, storage URIs, encryption, Merkle roots,
critical extensions and other fields return `UNSUPPORTED_PROFILE`; they are not
silently discarded or labeled invalid by a claim of complete CIP conformance.
Malformed canonical CBOR, wrong hash algorithms and incorrect digest lengths
fail explicitly. A verification result with `matches: true` has only the local
byte-comparison meaning above.

## Future transaction integration

A separately reviewed builder can load the exported metadata using CSL:

```ts
const metadata = C.GeneralTransactionMetadata.from_hex(artifact.metadataCborHex);
```

Alternatively, insert `C.TransactionMetadatum.from_hex(artifact.labelValueCborHex)`
under integer label 309. Never feed the hex projection to `NoConversions`: that
would encode text rather than required raw bytes. Revalidate any imported packet
and bind the actual auxiliary-data bytes to the reviewed transaction body.
The pure module does not supply such a builder or authorization.

## Verification and attribution

```sh
node scripts/verify-proof-of-existence.mjs
```

The suite runs ten groups and 178 pinned or independently generated vectors:
110 upstream hash vectors, 36 independent record/transport/metadata fixtures,
14 carriage cases and 18 canonical decode negatives. It also checks file streaming,
abort behavior, exact-byte mismatches, unsupported features, malformed inputs and
actual CSL metadata round trips. This is not chain or wallet acceptance evidence.

The independent oracle is `scripts/proof-of-existence-oracle.py`, using CPython
`hashlib` plus `cbor2==5.6.5`. It independently checks all 110 upstream hash vectors
and regenerates the 36 canonical fixtures. Run it in a disposable Python environment
with that dependency installed; the Node test suite uses the committed fixtures.

Primary specification author: **Igor Shubovsky**; the CIP declares CC-BY-4.0.
Selected unmodified vectors come from
[CardanoWall's label-309 repository](https://github.com/cardanowall/label-309/tree/98e1f25674baf977ecec5828895d4305147115dd),
which declares Apache-2.0. Their license and immutable URL/hash manifest are kept
in `tests/fixtures/proof-of-existence/`. The BEACN implementation and independent
oracle are original code. No general cryptographic audit or full CIP-190 verifier
conformance is claimed.
