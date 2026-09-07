# Five more NFT and agent primitives

These source-reviewed catalog entries broaden the design space without enabling new minting or wallet behavior. Read the [dated findings](../research/2026-09-07-nft-agent-primitives/FINDINGS.md) for precise source commits and material implementation differences.

| Entry | Candidate experiment | Where the relevant checks belong |
| --- | --- | --- |
| CIP-26: off-chain metadata | Import a registry record and inspect property signatures, sequence and trusted signer binding beside an artifact | Client/registry verification, independent of NFT datum or mint metadata |
| CIP-45: cross-device wallet communication | Pair an explicit desktop review with a consenting phone wallet | Matched transport implementations, pairing consent, and the wallet's signing review |
| CIP-69: uniform V3 scripts | Explain the capsule's shared mint/spend identity and inspect purpose dispatch | The V3 context interface plus the exact validator's lifecycle rules |
| CIP-116: domain JSON | Display a typed transaction explanation while preserving original bytes | Pinned era schema plus semantic validation; original CBOR remains the hash/signature source |
| CIP-170: KERI attestations | Explore an issuer-attestation panel separate from an artifact's content/inclusion evidence | Credential/KEL verification, exact digest profile and authority/revocation history |

The first three proposals are marked Active in the pinned registry; CIP-116 and CIP-170 remain Proposed. Those statuses describe the standards process. Each catalog entry stays research-only; dated implementation observations belong in the separate [implementation register](../IMPLEMENTATIONS.md).

The [local CIP-26 scalar inspector](../../docs/REGISTRY_SIGNATURES.md) now implements explicit signature, selected-trust and sequence checks with published attestation fixtures. It does not authenticate native policies or claim full CIP conformance. Its [follow-on source review](../../experiments/cip26-inspector/SOURCE_REVIEW.md) also records logo signing and annex-schema discrepancies. A CIP-69 purpose-dispatch explainer remains another useful experiment. The proposed wallet and KERI integrations require their own observed use paths. Current CIP-45 peer sources use PeerJS rather than the CIP's WebTorrent discovery, and the inspected CIP-170 sources do not establish complete revocation or digest-profile interoperability. These limits are recorded in the [issue register](../review-issues.json).

No third-party implementation was installed or executed for this source review. Cryptographic signatures, schema validation, node evaluation, chain inclusion and human-facing utility remain distinct evidence dimensions under the [admission policy](../ADMISSION.md).
