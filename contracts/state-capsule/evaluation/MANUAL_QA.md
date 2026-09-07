# State-capsule manual correctness review

Reviewed 2026-09-07 UTC against the compiled source, the 81 Aiken tests, CSL
serialization fixtures, compiled-wrapper tests and independent issuance evaluation.
This is the implementer's correctness review, **not an independent security audit**.

| Question | Concrete outcome |
| --- | --- |
| Can a pair be issued twice? | Both exact names have quantity one, the parameterized seed is spent, and this policy may not already appear in an issuance input. Ledger UTxO single-spend provides lifetime uniqueness. A different seed/name gives a different script/policy. |
| Is the reference actually under the same policy as the user token? | Mint and spend entries have identical compiled code/hash, asserted by rebuild and verification tooling. Mint requires its reference output at the same hash's script address. Spend derives policy identity from its own input payment script credential. The ledger binds that input to the executing script. |
| Can someone use a stranger's token by referencing it? | The transition scans `self.inputs`, not `reference_inputs`, requires exactly one matching quantity-one user input, restricts it to a payment key and requires that key in `extra_signatories`. Source and complete-wrapper negative tests reject reference-only holder proofs. Independent node tests separately reject reference-only issuance seed. |
| Can issuer or old holder retain control after a transfer? | There is no stored issuer key. New-holder source tests pass; former-holder signer tests fail. User token transfer occurs outside the state transition. |
| Can a holder lose the NFT during an update through an altered return output? | Exactly one output carries the user token, quantity one, at the full input holder address including its stake credential. Missing, duplicate, wrong-quantity, wrong-payment and changed-stake return tests fail. |
| Can someone divert or drain reference state? | The same script address must receive exactly one reference token, no other native assets and at least the old ADA. Output datum is inline, bounded and typed; reference scripts are excluded. Missing/duplicate/wrong-address/token/ADA cases fail. |
| Can a state be replayed, skipped or forked? | Every successor increments sequence exactly once and hashes the old semantic datum serialization. Source tests reject repeated, skipped and wrong-hash states. Competing authentic transitions consume the same UTxO; the ledger resolves that conflict. A local history alone does not establish the accepted branch. |
| Can freeze change the picture, unfreeze, burn or release locked ADA? | Freeze requires byte-semantic metadata equality; frozen inputs have no passing branch. Both mint and spend handlers reject policy burns. Freeze is permanent; its ADA stays locked. Source negative tests cover these choices. |
| Is `previousDatumHash` independent of CBOR encoder conventions? | Aiken's serialized golden bytes and hash match the custom codec and CSL DetailedSchema. 256 independently serialized fixture states agree. Arbitrary original datum CBOR need not equal the semantic encoding; readers must reconstruct the specified serialization. |
| Does a missing wallet witness fail these tests? | Local full signed fixtures verify a generated in-memory signature and preserve Plutus witnesses. The independent evaluator deliberately accepts unsigned transactions for budget evaluation. Required-signer body fields are checked by the contract, but actual signatures still require phase-1 and wallet integration. |
| Does the chain certify the image URI or truth of metadata? | No. The contract checks `name`/`image` shape and byte limits; extra values are opaque bounded Data. The codec is stricter on UTF-8, schemes and nesting. A malicious holder may deliberately publish malformed or false content. |

## Open implementation boundaries

1. The reusable unsigned builder accepts a supplied fully applied blueprint. It
   checks handler identity and the declared script hash, but does not prove
   arbitrary caller-supplied code was compiled from this source and the declared
   seed/name. A production integration must supply a pinned trusted template and
   apply parameters itself, then independently evaluate. Do not expose arbitrary
   uploaded blueprints as equivalent capsule contracts.
2. A datum/version cap is not a full transaction-size or execution-budget promise.
   The actual current-wallet node-evaluated transaction is larger than the minimal
   synthetic fixture because it preserves existing assets. Min-ADA change can
   require additional inputs even when a nominal seed balance looks sufficient.
3. No authorization revocation, lost-key recovery, administrator override or
   post-freeze ADA withdrawal exists. Sending the user token into another script
   can suspend update authority until that script returns it to a key address.
4. A higher future minimum-UTxO requirement may require extra ADA during evolution;
   the monotonic ADA rule permits additions but no withdrawal. Frozen metadata is
   permanently locked and cannot be adjusted to a future application schema.
5. Ledger confirmation, history-origin verification, node tests for actual spending
   state, real-wallet acceptance and independent audit remain separate work.

No direct authorization, conservation, mint-replay or freeze bypass was found in
this bounded review. That outcome is limited to this implementation and evidence;
it is not a proof of security for all transaction contexts or later extensions.
