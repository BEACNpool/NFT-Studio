# A short tour of BEACN Labs

[Open NFT Studio](https://beacnpool.github.io/NFT-Studio/?view=labs). The examples
below work without connecting a wallet. Each tool names the evidence it checks
and keeps local results separate from claims about the chain.

## Make a collectible evolve

In **State capsule**, change the signal and record a revision. Select earlier
revisions to see the artwork and datum hashes. Freeze the current state, then
export the history and reopen it in the verifier.

This is an actual CIP-68 datum composer backed by an experimental combined Aiken
mint/spend program. Its local history does not establish which branch exists on
chain. Freezing in the contract is irreversible and locks the reference output's
ADA; there is no administrator or recovery path. The repository distinguishes
independent node evaluation of issuance from locally evaluated later transitions.

## Build its contract identity

In **Contract compiler**, choose **Try an example**. The browser applies the
fixed program's seed and name parameters, then shows the policy ID and paired
reference/holder names. Change one name byte and build again. Export the blueprint
to inspect all three identical handlers.

This removes a compiler installation from the parameter-application step. It is
not a general Aiken compiler or a live capsule mint flow. The adapter matched
256 parameter combinations against the pinned Aiken CLI and independent CSL 17
policy hashes. No chain query or wallet call is needed to reproduce those bytes.

## Put the credits beside the recording

In **Music release**, choose **Try Midnight Beacon · 8s**, select its Ogg audio
and press play. The original composition and SVG cover occupy 8,600 raw bytes.
You can also try the one-second WAV example. Inspect the artwork, artists, rights declarations and exact file
hashes. Change a credit and rebuild: the release hash changes. Export a music
package and reopen it to verify the files and credits together.

The browser's music-aware transaction builder commits the complete release. A
wallet review shows the credits, destination, fee and complete signed-size
estimate. The wallet keeps signing authority. Receipt recovery checks the actual
transaction metadata before treating music credits as locally verified.

This is a documented CIP-60-aligned extension for exact embedded files, with
explicit upstream schema conflicts. It does not claim universal player support,
verified copyright, or royalty payments. Compact files are bounded to 12,000 raw
bytes; larger audio belongs in the separate Ledger Scroll workflow.

## Carry a creation independently of this website

In **Artifact passport**, choose **Try an unminted example**. Export the passport
and inspect its separate content, transaction and provenance checks. Download the
example receipt and supply it as transaction evidence to check the exact binding.

The example has never been signed or submitted. A matching transaction hash does
not turn it into a minted object. Ordinary exact-file NFT/data receipts can be
exported from Activity; the current Passport profile does not support music's
richer metadata. Keep the music package and its original receipt instead.

## Commit to files without publishing their contents

In **Proof of existence**, choose local files, produce their hash records, then
verify the originals against the export. A changed byte fails verification.
The browser reads large files incrementally and exports the exact label-309
encoding from the public hash profile of proposed CIP-190.

Exporting records does not timestamp or publish them. The proof does not establish
authorship, ownership or rights. A later transaction and its independent inclusion
evidence would be separate steps.

## Check the signer, then choose your trust rules

In **Registry signatures**, choose **Try signed example** and inspect the two
properties. Their signatures verify, but the empty local rules trust no keys.
Choose **Use example trust rules** separately and inspect again. The example rule
is a fixed, published demonstration key. It is never derived from imported records.

Edit one property value without changing its signature, then inspect again. The
signature fails even if its key matches the selected rules. Supplied prior
sequence observations can separately identify newer, older, identical or
conflicting updates. Export the report to retain both original JSON inputs and
hashes. The inspector reads local JSON; it fetches no record URLs and writes no
registry. Its documented scalar profile does not authenticate native policies.

## Give your agent tools it can inspect

Connect a Streamable HTTP MCP client to:

```text
https://beacn-nft-studio.davidmjensen17.chatgpt.site/api/mcp
```

Start with `studio_capabilities` and tool discovery. Ask for a `create_mint_intent`
packet containing your exact files. Open the returned review link, import the
packet under **Agent minting**, and inspect it before entering wallet review.

For recordings and credits, use `create_music_release`, save its canonical
`packetJson`, and import it under **Music release**. `verify_music_release`
checks the same complete package. These music packets have their own profile;
they are not ordinary mint intents.
`prepare_unsigned_music_transaction` uses that canonical packet plus an explicitly
supplied wallet snapshot to prepare a complete unsigned music NFT. Its output
includes the exact credits, actual metadata, value checks and Music Lab review
link. The browser reviews the package and constructs a fresh wallet transaction.

`prepare_unsigned_transaction` can prepare ordinary NFT/data transactions from
an explicitly supplied wallet snapshot. The service cannot establish ownership
or input availability from that snapshot alone. The fixed capsule parameter tool
returns a blueprint and identity, not a prepared transaction. No public tool
connects to a wallet, signs or submits.

See [the MCP guide](MCP.md) for current deployment observations, connection
examples, transport details and the separate self-hosted signature verifier.

## Follow the evidence

**Knowledge** keeps upstream CIP status separate from BEACN implementation
observations. Open a record, inspect its primary sources and expand the attached
implementation evidence. Immutable source links and hashes make those observations
reviewable after the code changes. **Asset inspector** lets you examine exact
policy/name bytes and CIP-14/67/68 identities without inventing chain ownership.

Select **Original CIPs** to search the separate 148-document snapshot by id, title
or status. Read exact text chunks, inspect the original authorship/licenses and
follow a pinned source citation. Your agent can use `search_cip_sources` and
`get_cip_source_chunk` for the same originals. The archive includes the CIP README
documents; annexes, CPS and linked files remain outside it.

Useful source starting points:

- [State Capsule validator and lifecycle](STATE_CAPSULES.md)
- [Fixed contract parameterizer and Aiken parity receipts](../experiments/capsule-parameterizer/)
- [Music metadata profile, sources and limits](MUSIC_RELEASE.md)
- [Music transaction construction](MUSIC_TRANSACTIONS.md)
- [Registry signatures and local trust](REGISTRY_SIGNATURES.md)
- [Artifact Passport evidence model](ARTIFACT_PASSPORT.md)
- [Proof record encoding and vectors](PROOF_OF_EXISTENCE.md)
- [Knowledge architecture](KNOWLEDGE_BASE.md) and [implementation register](../knowledge/IMPLEMENTATIONS.md)
- [Experimental holder-proof verifier](../experiments/holder-proof/), with strict signature and replay tests; no live authentication service

These are implementations built on existing Cardano standards and tools. Their
published tests establish the particular behaviors they exercise; they are not an
independent audit or a claim that every application of the technology is ready.
