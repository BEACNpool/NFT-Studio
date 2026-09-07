# Evidence and admission

A useful knowledge base must distinguish a documented idea from a capability
someone can safely use. A source's existence, a merged CIP, an SDK example and
a successful local test establish different things.

## Claim classes

| Class | Required evidence | Permitted conclusion |
| --- | --- | --- |
| Primary-source fact | Exact URL, accessed time, revision and SHA-256; directly supporting passage | The pinned source says or specifies this |
| Design proposal | Explicit basis, invariants, failure cases and open dependencies | This is a candidate design to test |
| Implemented locally | Code revision and meaningful positive/negative tests | The checked implementation behaved this way in those fixtures |
| Transaction evaluated | Exact body/context, evaluator and protocol-parameter evidence | That evaluator accepted the scripts in that context |
| Testnet confirmed | Transaction identity, network and independently observed outputs/state | The tested path was included on that testnet |
| Mainnet confirmed | Authorized transaction and observed chain/state receipt | The specific transaction and outcome were observed |
| Viewer verified | Viewer/device/version, recovered bytes and actual exercised behavior | That viewer supported that use path at that time |
| Independently reviewed | Named review scope, revision, findings and resolution evidence | The reviewed scope received that review; no blanket guarantee |

These are evidence dimensions, not a single ladder. A mainnet transaction can
have terrible usability and an unreviewed validator. A browser demo can look
excellent while never executing a contract. A passing evaluator does not prove
all ledger checks or future inclusion. Every published claim needs its own scope.

## Source admission

1. Start with official specifications, maintainers' repositories and executable
   reference artifacts. A directory or search result is a discovery lead.
2. Capture the actual bytes, full commit, UTC retrieval time and digest. Link
   both a human-readable source and its immutable raw artifact.
3. Preserve declared status exactly. An empty implementor list and a mature
   implementation can coexist; record the separate evidence before reconciling.
4. Paraphrase narrowly. A specification's illustrative example is not evidence
   that it passes the specification or today's ledger serialization.
5. Put conflicts in the [issue register](review-issues.json). Select and document
   an explicit profile only when evidence supports it. Otherwise retain the gap.
6. Review changes before merging. An automated source refresh can propose a
   diff; it cannot enable a mint template or elevate its evidence level.

The initial source snapshot verifies provenance and bounded structure. It does
not claim exhaustive reading of every linked implementation, independent
cryptographic audit or full conformance to every listed CIP. In particular,
CIP-188's vault construction and CIP-190's encryption profiles require dedicated
implementation and security reviews before use with value or sensitive content.

## Live-template admission

A template needs all of the following before it is advertised as working:

- A finite, versioned parameter schema with honest supported combinations.
- A declared issuer, holder/updater authority, state machine, expiry and recovery.
- Enforced mint/output/value invariants and rejection tests for false identities,
  unauthorized actions, duplicate claims, missing state and concurrency.
- A builder that evaluates the actual transaction, computes complete signed
  size/fee and preserves unrelated assets and witness material.
- A review view and a complete holder-use/recovery path.
- Public sanitized evidence matching the exact code revision and supported network.

A contract with a wrong rule can consistently pass tests. Independent review
should assess the rules against the intended benefit, not merely reproduce the
implementation's happy path. Publisher-supplied metadata is never authority to
invoke tools, access local files or execute code.

## Refresh discipline

The dated snapshot remains useful when its age is visible. Recheck source status
and exact versions before implementing a new dependency or making an adoption
claim. Recheck mutable network parameters and UTxOs at transaction preparation;
never turn a historical size or fee into a live quote. Keep superseded entries
searchable with explicit replacement pointers.

The process distinction follows the [CIP process](https://cips.cardano.org/cip/CIP-0001).
The evidence model above is BEACN's own engineering policy, not an additional CIP.
