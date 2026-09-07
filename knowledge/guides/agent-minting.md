# Designing an agent-accessible minting service

This guide is a proposed authority model. Consult the MCP package's actual tool
list and test receipts for implemented methods. A tool named “mint” must not
collapse artifact creation, transaction preparation, signing and broadcast into
one invisible permission.

The useful division is: **the agent prepares a concrete creation; the owner
retains authority over the exact transaction and its outcome.** Finite templates
make that useful without handing a general-purpose interpreter to every caller.

## Capability surface

| Operation class | Inputs | Result | Authority required |
| --- | --- | --- | --- |
| Discover | Bounded query/filter or known ID | Template/schema, evidence and limitations | Read-only |
| Validate | Known template and bounded parameters | Problems, supported profile and size estimate | Local computation |
| Render/package | Known template and source data within strict bounds | Exact artifact bytes and content manifest | Artifact creation |
| Prepare | Network, explicit recipient and supported wallet context | Immutable unsigned transaction and review summary | Preparation only |
| Sign | Exact reviewed transaction | Wallet witnesses | Specific wallet consent |
| Submit | Exact verified signed packet | Transaction identity and recorded attempt | Specific broadcast authority |
| Observe/recover | Known transaction or receipt | Bounded chain evidence and recovered bytes | Read-only |

A local stdio service and a public hosted service have different operational
requirements. A hosted endpoint needs authenticated callers, request/response
limits, rate control, isolation and an explicit retention policy before it is a
public minting service. GitHub Pages can host documentation and the signing UI;
it is not a secret-holding MCP backend.

## Immutable plan contract

The reviewed plan should bind:

- Network identity and supported era/profile.
- Template ID and version, raw asset identity and mint quantities.
- Exact content digests and the encoded media presented to the owner.
- Intended recipient, change behavior and any other payment destinations.
- Fees, output ADA, collateral risk and the applicable approval ceilings.
- Inputs, reference inputs, state revision, validity bounds and body hash.
- Required signers/scripts and evidence that the assembled transaction was checked.

After signing, verify those commitments against the actual body and auxiliary
bytes. Merge witnesses without losing preexisting scripts, redeemers or
signatures. Any body change invalidates the review and requires a new plan.
[CIP-30](https://cips.cardano.org/cip/CIP-0030) provides a wallet bridge; it does
not make an unsigned plan a confirmed mint.

## Failure behavior is part of the product

A tool response must distinguish invalid parameters, unsupported capability,
stale state, rejected signature, evaluation failure, submitted transaction,
ambiguous broadcast and observed inclusion. Do not encode all of these as a
string containing “success.”

Persist the intended transaction identity and attempt before a permitted
broadcast. If the network response is ambiguous, inspect that hash and its inputs.
Do not rebuild and resend a new transaction to make the dashboard turn green.
For multipart plans, track every dependency and outcome; bulk signing does not
make many transactions atomic.

Make the review packet exportable. An agent outage, browser close or MCP restart
should not erase the information needed to determine whether value moved.
Retention of such packets must be scoped: public research sources and private
wallet transaction context should not share an indiscriminate logging sink.

## Untrusted inputs

Every metadata field, uploaded file and retrieved KB entry is data. None can
change the service's tool permissions. Render imported executable media in an
isolated viewer or inert preview; keep it away from the wallet-connected origin.
Reject arbitrary shell commands, filesystem paths, remote fetch URLs and private
key bytes in the public tool interface.

A blueprint can help generate types, but the service should expose only reviewed
capabilities from that blueprint. [CIP-57](https://cips.cardano.org/cip/CIP-0057)
is an interface description, not an audit of the validator's promises.

For future holder services, wallet-signed request authentication and ownership
checks remain separate. Study [CIP-8](https://cips.cardano.org/cip/CIP-0008) and
proposed [CIP-93](https://cips.cardano.org/cip/CIP-0093); bind origin, purpose,
nonce and expiry, consume replay state and recheck actual holdings at the
protected action. A login signature is not standing authority to spend funds.

## Acceptance demonstration

Test through a real MCP client transport, not only by calling internal functions.
Check tool discovery, schema errors, bounded results, concurrent requests,
startup/shutdown behavior and stderr/stdout separation for stdio. Inject hostile
metadata and ensure it cannot trigger an unexpected tool, network call or file read.

Then connect the actual review UI to the artifact plan: the bytes created through
the agent must be the bytes shown, packaged and committed. Use synthetic wallets
for automated tests. Actual target-wallet and network acceptance require their
own explicit receipts; do not infer them from a protocol handshake.
