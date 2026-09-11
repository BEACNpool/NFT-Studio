# AI-guided creation

NFT-Studio is an AI-driven creation process. The website explains setup, helps
visitors shape a brief, and shows previously minted work. The connected AI makes
the media and guides the conversation. The MCP supplies menus, grounded examples,
validation and exact-file packaging. The browser handles visible wallet review.

## Start

Install from [the setup guide](https://beacnpool.github.io/NFT-Studio/mcp/), then
ask: **“Open NFT-Studio and guide me.”** Codex users can invoke the included
`$nft-studio` skill from the repository. Other clients can use the `nft-studio`
MCP prompt or call `studio_guide` with empty arguments.

The two new tools are shared by the Node and Worker implementations:

- `studio_guide`: start → format/previous original → idea → direction → creative
  brief → actual AI preview → revision, wallet review, or keep without minting.
- `studio_inspiration`: a bounded curated catalogue with recorded original mint
  identities, play/source/share links and copy-review routes where supported.

The Node release has 19 tools, the optional Worker build has 17, and both retain
61 resources. Both expose the new `nft-studio` prompt. The public `/mcp/` page is
a setup guide, not a remotely hosted MCP server.

## Conversation contract

Show the current question and a short menu. Wait for the person's answer; do not
run through a questionnaire yourself. Pass the returned `state` into the next
call with an option ID or number in `choice`, or written text in `answer` when
allowed. Global choices are `back`, `pause`, `resume`, and `start_over`. In text
forms, `/back`, `/pause`, and `/start_over` work too; `/suggest` supplies a small
original starting idea at the idea step.

At `creating`, the AI must create or revise actual files using its own tools and
show the preview. Only then send `event: "preview_ready"`. The subsequent menu
offers **Make a change**, **Prepare for wallet review**, and **Keep it without
minting**. A revision leads to another preview. Preserve the brief and exact
files when the person chooses to keep them. No mint is requested by that choice.

People may supply a complete idea in one prompt. The agent should reuse supplied
preferences and skip redundant questions, using the original exact-content tools
directly when appropriate. The guide is assistance, not a mandatory approval gate
for ordinary creative work.

`interaction: "auto"` requests one native form when the client advertises form
elicitation. The implementation uses the pinned SDK's `inputRequired` pattern
and its legacy stdio adapter. Stateless legacy HTTP uses the chat menu. `interaction: "chat"` always returns a readable numbered
menu. Clients without form support also receive that menu. Accept responses are
validated against the question; decline/cancel preserves state and tells the
agent to stop asking. No detached server-to-client requests run in the background.
The supported capability and cancellation rules follow the
[MCP elicitation specification](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation).

## Content and identity

State is bounded, client-held creative preferences. Every MCP call validates it.
It contains no files, wallet addresses, or signing authority, and is not evidence
that a preview happened. A caller can change their preferences; no financial
action is unlocked by a stage name or menu selection. The server retains no
guide session. Saving a prompt or files is an explicit action in the client.

The gallery reuses preserved public artwork and receipts. The first five science
entries come from `public/showcase/science-five/collection.json`; Cardano Drama
comes from its published receipt; the game/instrument records come from
`lib/capability-catalog.json`. `lib/studio-inspiration.json` is the small shared
presentation catalogue, with exact policy and asset-name identities. Original
mint status is recorded evidence, not a fresh chain query. Gallery posters are
labeled separately from compact embedded covers.

Copy review always creates a separate identity under the visitor's wallet
policy. Harmonic Atlas remains inspiration/playback only; its generic copy path
is unavailable. Existing large games use their tested browser creator. Music
with exact credits uses the dedicated music package tools and Music Lab.
Scrolls/Books remain browser-only protocols. Their state and byte limits do not
change in this release.

The home brief builder is a local planner, not an embedded AI chat. It exports a
prompt for a connected AI; it never represents menu interaction as media
generation. Share links contain only an allowlisted public example ID. Personal
brief text is not put into a URL. Final content review uses the existing verified
mint intent or music packet, never guide state.

## Verification

`npm --prefix mcp test` includes real SDK stdio and Workerd checks: full menu
journeys, revisions, cancellation, pause/resume, malformed inputs, both protocol
eras, native forms and chat fallback, bounded inspiration and original identity.
`npm --prefix mcp run test:clean` verifies a standalone nested-only installation.

`scripts/audit-creative-guide.cjs` checks the actual browser flow at desktop and
phone widths, clipboard fallback, example routes, setup commands and navigation.
`scripts/audit-app-navigation.cjs` retains the unsaved-editor Back/Forward check.
The existing mint tests remain separate; no release test signs or submits a real
wallet transaction.
