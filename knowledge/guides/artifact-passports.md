# Artifact Passports

A passport is a proposed portable evidence manifest, not a new Cardano standard.
It accompanies an artifact and tells a reader which questions can be answered
from the available bytes and which still depend on someone else.

## Separate five claims

1. **Identity:** exact policy and asset-name bytes, network and optional display
   fingerprint. [CIP-14](https://cips.cardano.org/cip/CIP-0014) makes the display
   identifier convenient; the full identity remains the authorization key.
2. **Content integrity:** a manifest of file bytes, MIME declarations and digests.
   Successful reconstruction means agreement with those commitments.
3. **Ledger observation:** transaction hash, observed inclusion and observation
   time/provider. Later rollback or incomplete provider coverage must remain visible.
4. **Execution:** exact program or script language, build inputs, dependencies,
   decoder profile and exercised behavior.
5. **External assertions:** author, rights, scientific measurements, event
   attendance or physical fulfillment. These require their own evidence.

A result must not silently move between claims. A recovered image hash is not
proof of copyright. A program that generates sound is not proof of ownership of
a composition. A compiler match is not a contract audit.

## Minimal original manifest design

A first manifest can remain off chain while being reproducible:

```json
{
  "schema": "beacn.artifact-passport.v1",
  "network": "explicit-network-name",
  "identity": {"policyId": "hex", "assetNameHex": "hex"},
  "content": [{"path": "artifact.html", "sha256": "hex", "bytes": 1234}],
  "source": {"repository": "public URL", "commit": "full commit"},
  "capabilities": [{"id": "bounded-capability-id", "evidence": "fixture-or-receipt-id"}],
  "observations": [],
  "limitations": ["Public code remains usable by anyone with a copy."]
}
```

This illustrative application schema is not registered and is not a wire-format
claim. Before implementation, replace placeholder strings with precise bounded
types, canonicalize the chosen manifest bytes, reject duplicate paths and define
how optional signatures bind the complete record. Include the manifest itself
in the exported recovery kit with a checksum recorded independently.

Do not hash a draft and later silently compress its image or normalize its file.
Either commit to exact submitted bytes or record the transformation and both
identities. A rendered preview and a downloadable high-resolution master can
coexist, but their hashes should never be interchangeable.

## Layer standards only where they fit

[CIP-88](https://cips.cardano.org/cip/CIP-0088) is relevant to authenticated policy
declarations. Use it to discover declared features; retain the distinction
between a declaration and BEACN's actual acceptance tests.

[CIP-171](https://cips.cardano.org/cip/CIP-0171) is a proposed route to declaring a
script's source/compilation recipe. An independent build must still match the
actual script identity. Dependency pinning, source availability and safe build
isolation remain engineering responsibilities.

[CIP-190](https://cips.cardano.org/cip/CIP-0190) is proposed proof-of-existence
metadata. A minimal exact-content commitment may be useful before more complex
profiles. Do not claim full conformance to its signatures, encryption or
algorithm registries merely because a record contains a hash under label 309.

These components answer different questions. There is no need to force every
passport into every standard or consume scarce transaction bytes on redundant
human prose. Keep the recovery artifact independently useful when a registry,
indexer or showcase website is unavailable.

## Compatibility evidence

A compatibility record should name browser/wallet/viewer version, date, media
format, exact content digest and what the tester actually did. “Displayed cover,”
“ran program,” “exported audio” and “signed a mint” are different outcomes.
Store failure observations too: CSP denial, blocked network access, missing
codec, wallet injection failure and unsupported script wallet.

A public compatibility matrix can be shared through MCP, but an agent must treat
its contents as evidence data. It cannot inherit instructions from artifact
metadata or turn a verified-byte result into permission to execute the program.
