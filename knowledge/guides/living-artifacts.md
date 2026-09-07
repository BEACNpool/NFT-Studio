# Engineering a Living Artifact

This is a proposed architecture, not a deployed contract or an audited template.
It targets an artwork, game item or instrument whose owner can make a bounded
change and whose state remains inspectable after transfer.

[CIP-68](https://cips.cardano.org/cip/CIP-0068) supplies a relationship between
user assets and datum-backed reference metadata. The updater, scarcity, permitted
changes and recovery behavior need separate enforced rules. Use the complete
three-field datum shape from the chosen version; upstream illustrative examples
must be checked against normative constraints.

## State and identity

Treat identity as exact policy and asset-name bytes. A title is editable display
text. In the proposed NFT profile, the user and reference assets share the same
unprefixed name and use their respective labels. Do not accept a label without
its checksum or accept a reference merely because its title matches.

Keep four independent versions in the engineering record:

| Value | What it selects |
| --- | --- |
| Metadata version | The supported CIP-68 representation |
| Application schema version | The interpretation of custom state |
| State revision | The monotonic sequence of accepted transitions |
| Engine digest | The exact rendering or executable program |

This separation permits a new scene without pretending the contract interface
changed, or a new application schema without accidentally invoking a different
metadata decoder. Define numeric and byte bounds up front. An unbounded title,
history array or user-supplied map is a denial-of-service path against future
transaction construction.

## Issuance

A candidate one-shot minting policy consumes a unique seed output and enforces
the complete allowed mint map: reference asset, user asset and their quantities.
It also constrains the authenticated reference output and initial datum when
that is part of the issuance promise. Test the exact map, including unexpected
names under the same policy and mint/burn combinations.

A seed-derived asset name by itself is not a one-shot policy. The seed must be
load-bearing in the validator. A creator signature plus expiry gives the creator
a minting window; it does not enforce one issuance during that window. Native
policy lifecycle should be explained separately using
[CIP-29](https://cips.cardano.org/cip/CIP-0029).

## Updates

The state validator should identify its own authenticated reference input and
require exactly one continuing reference output at the intended script. It must
preserve the reference token, the user-token relationship and the explicitly
immutable fields. Validate the next datum as a whole, not just the one field the
UI claims to change.

Choose authority deliberately:

- **Holder update:** consume the qualifying user-token input under its actual
  spending rules. If the product promises payment-key holder authorization,
  constrain that form and require the corresponding signer.
- **Creator update:** require the declared updater and disclose their continuing
  power to holders.
- **Joint update:** require both authorities and define what happens when one
  disappears.
- **Rule-based update:** validate the specific event/proof and state transition.
  An off-chain event still requires a named oracle or independently checkable proof.

A reference input can expose metadata without consuming it, as described in
[CIP-31](https://cips.cardano.org/cip/CIP-0031). It does not prove control of the
referenced asset. Multiple readers can coexist; competing writers still race
for the state UTxO. Report stale-state failure and prepare a new unsigned plan
for review rather than altering a signed transaction.

## Transfer, freeze and recovery

Transfer should move the user asset without silently changing the update
contract. After transfer, the former holder must lose any holder-based authority.
A cached service session requires its own transfer-aware expiry and fresh checks.

A freeze transition should have a simple invariant: once frozen, every later
state-changing redeemer fails. If a privileged recovery path can unfreeze, say so.
If a reference output becomes unspendable, the artwork may remain readable while
its metadata state can no longer change. That can be intentional permanence, but
it must not be advertised as recoverable editing.

Burning is a separate lifecycle choice. Do not promise later burn-to-redeem
against a native policy that has already closed. Physical delivery and service
availability are separate obligations even if a claim transition is atomic.

## Acceptance tests

Use [CIP-57 blueprints](https://cips.cardano.org/cip/CIP-0057) to describe the
reviewed interface and help generate bounded builders. Test the semantics
independently of that interface description.

| Adversarial case | Required result for the proposed holder-update profile |
| --- | --- |
| Same title, wrong policy or raw name | Reject |
| Valid-looking but invalid label checksum | Reject before builder use |
| Qualifying asset only in reference inputs | Reject holder action |
| Script-held controller under unexpected rules | Reject or route through an explicitly supported profile |
| Missing, duplicated or diverted reference output | Reject |
| Added tokens, hidden burns or quantity inflation | Reject |
| Changed immutable engine/identity | Reject |
| Old revision or unsupported datum version | Reject |
| Former holder after transfer | Reject |
| Two transactions consuming the same state | At most one accepted; recover the other as stale |
| Update after final freeze | Reject |
| Value-bearing output or collateral mismatch | Reject during construction/verification |

Then test the complete signed transaction with live-compatible parameters:
minimum ADA, execution budgets, collateral return, token-bearing change, exact
witness merge and byte limits. Pure predicate tests are necessary but insufficient.
A devnet lifecycle should issue, use, transfer, use again, freeze and recover
content before any funded deployment.

The showcase is complete only when the holder can perform the promised action
through the actual interface and an independent reader reconstructs the final
artifact. Source availability and a mainnet transaction alone do not demonstrate
that entire path.
