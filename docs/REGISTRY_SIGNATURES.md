# Registry signatures and local trust

Open **Labs → Registry signatures** to paste or import an original record. Try
the signed example to see valid signatures with no trusted keys selected. The
separate **Use example trust rules** action loads a fixed demonstration rule;
inspect again to see the distinction. Edits clear previous results, and exported
reports preserve both original JSON inputs and their SHA-256 hashes. The rules
and sequence observations stay local and are not written to a registry.

The [CIP-26 inspector](../experiments/cip26-inspector/) verifies a bounded scalar
metadata profile in Node and the browser. It reports three separate results:

- **Signature validity:** whether the supplied public key verifies the exact
  subject, property, scalar value and sequence number.
- **Selected trust:** whether that valid key appears in a separate, explicitly
  supplied subject-to-key configuration.
- **Sequence comparison:** whether the update is newer, older, identical or
  conflicting relative to explicitly supplied prior observations.

A valid signature does not choose whom to trust. With the default empty trust
configuration, correctly signed records remain untrusted. The inspector never
enrolls keys from a record or advances a sequence store. A caller can choose any
local trust rules; those choices are not independent authentication of ownership,
the current registry, the blockchain or the truth of a label.

## Reuse the pure module

```js
import { createCip26Inspector } from '../experiments/cip26-inspector/src/index.mjs';

const inspector = createCip26Inspector(trustConfigurationJson);
const report = inspector.inspect(originalRecordJson);
```

Both inputs are original JSON text. Duplicate keys, escaped duplicate aliases,
unpaired surrogates, excessive nesting and oversized inputs reject before
cryptographic work. Object inputs are not coerced and their getters are not run.
The record is capped at 96 KiB, the separate trust configuration at 48 KiB, and
each record at eight properties with four signatures per property.

The module performs no fetch, wallet access, signing, storage or chain query.
Imported URLs and values are diagnostic data. Consumers must keep them inert
unless they deliberately add their own separate rendering or retrieval policy.

## Profile boundaries

The implementation constructs preferred definite CBOR for scalar text, safe
integers, booleans and null. It hashes each commitment component with
BLAKE2b-256, then hashes the ordered concatenation of those four digests. It
verifies strict Ed25519 signatures with canonical, non-small-order points in the
prime-order subgroup. Runtime dependencies are pinned to noble 2.4.0.

The profile deliberately rejects or reports unsupported inputs where the pinned
sources do not establish one interoperable interpretation. This includes logo
preimages, arrays/maps, floating-point and exponent number tokens, and native
policy authentication. The source review records a logo text-versus-decoded-byte
signing difference, discrepancies between the annex schema and published
attestation envelopes, and differing decimal lower bounds.

See [the exact source review](../experiments/cip26-inspector/SOURCE_REVIEW.md),
[immutable upstream evidence](../experiments/cip26-inspector/evidence/sources.json)
and [redistribution notices](../experiments/cip26-inspector/ATTRIBUTION.md).
This bounded profile does not claim full CIP-26 conformance or an independent
security audit. It is not a remote authentication service.

## Reproduce checks

```sh
npm --prefix experiments/cip26-inspector ci --ignore-scripts
npm run verify:registry
npm --prefix experiments/cip26-inspector run build
npm --prefix experiments/cip26-inspector run test:browser
```

The checked source includes 133 independent Python CBOR/hash fixtures, 59
published attestations cross-checked with Node crypto, and adversarial encoding,
signature, trust and sequence cases. Thirteen Node test groups and 407 real
Chromium assertions pass. A clean isolated installation reproduces the
94,826-byte standalone module exactly. Browser checks require an installed
Chromium executable; set `CIP26_CHROMIUM` when it is not `/snap/bin/chromium`.

A separate Codex agent in the same development session reviewed the original
component syntax correction against an independently written scanner. Its
[scoped review receipt](../experiments/cip26-inspector/evidence/url-profile-review.json)
records 16 regression cases and 16,731 differential URL cases, with no
consequential mismatch. It shares native host parsing and is not an external
security audit; the recorded source hash identifies exactly what it checked.

Tests create ephemeral signing keys only for synthetic fixtures. They never
export private keys. Node tests refresh the generated browser vectors and dated
test receipt; browser tests refresh their own receipt. The manifest identifies the integrated source snapshot, while `provenance/`
retains the original candidate handoff. Generated evidence files will differ in
a fresh run even when source and bundle bytes are unchanged.
