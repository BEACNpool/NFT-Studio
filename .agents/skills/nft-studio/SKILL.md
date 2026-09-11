---
name: nft-studio
description: Create compact Cardano NFT artwork, games, apps or music with NFT-Studio MCP, research Cardano CIPs, and prepare exact files for a user's wallet review and mint. Use when the user asks to create or mint with NFT-Studio.
---

# NFT-Studio

Turn the user's idea into exact files and a reviewable mint request. Use the
connected NFT-Studio MCP server; discover `studio_capabilities` before selecting
a format or promising a utility. If it is missing, follow the setup guide at
https://beacnpool.github.io/NFT-Studio/mcp/ . This is an installation guide for a
local server, not an HTTP MCP address.

## Guide a conversation by default

Start with `studio_guide`. Show its question and a short numbered menu, then wait
for the person's answer. Carry its returned `state` into every subsequent call;
accept an option ID/number in `choice`, or written `answer` where requested.
Use the client's question UI when it is available; the tool negotiates native
form elicitation. Otherwise display the menu in normal chat. Never dump state
JSON at the person or pretend a tool call itself generated artwork.

The menu leads through a starting point, format, idea and creative direction.
Use `studio_inspiration` for recorded minted examples, exact original identities,
play links and copy-review links. An inspired work or creator copy gets its own
identity. Originals are not invitations to reopen their old mint policies.

Carry forward preferences the person already supplied. If they gave a complete
one-prompt request or asked you to choose, create directly with the existing
content tools instead of forcing them through questions they already answered.
For an incomplete brief, ask only what materially helps. Music may be a sound toy
or a dedicated credited release; establish which before packaging it.

At `creating`, use your own creative tools to make the actual files and show a
preview. Then call the guide with `event: "preview_ready"`. Offer **Make a change**,
**Prepare for wallet review**, or **Keep it without minting**. A revision returns
to creation and another preview. `back`, `pause`, `resume`, and `start_over` are
always available. Respect declined/cancelled forms; do not ask the same question
again automatically. Keep or export the brief on request for a future session.
A pause or “keep” choice is not permission to prepare a mint.

Guide state contains only creative preferences. It is neither evidence of a
preview nor approval to sign or submit. Once the person chooses wallet review,
follow the exact-content handoff below. Never use a menu answer as wallet consent.

## Create and hand over

1. Create or adapt the requested files with your available creative tools. For a
   compact first NFT, a small self-contained SVG works well. Generate or use only
   content within the user's requested scope. The MCP validates/packages supplied
   bytes; it does not generate images or compose audio by itself.
2. Check the current limits. Ordinary NFT packages allow up to eight files and
   12,000 total raw bytes; an image cover is required. Full transaction fit is
   checked later with the wallet. Keep HTML, SVG, games and audio self-contained.
   External image-generation output often needs substantial resizing or a different
   representation before it fits. Never silently change the user's intended content.
3. For generated audio, binary media, or a large result, use the repository's
   `mcp/create-review.mjs` client helper. Write a local request JSON whose files
   have `path`, `name` and `mediaType`, then run:
   `node mcp/create-review.mjs --request REQUEST.json --output NEW_DIRECTORY`.
   Paths resolve relative to the request JSON. It reads the exact files, calls
   capabilities/create/verify over the real local MCP, independently checks the
   bytes and complete link, and saves `review.html`, `intent.json`,
   `review-url.txt` and a final receipt. Give the user the saved HTML file to open;
   its link avoids shell URL-length limits. Never hand-copy large base64 through
   model prose. This is a local SDK client of the MCP, not an extra MCP tool.
   See `docs/MCP_LOCAL_FILES.md` and `experiments/labor-day-worker-demo/request.json`.
4. For a sufficiently small exact payload, call `create_mint_intent` with `mode: "nft"`, a name, optional description,
   exact canonical base64 file bytes and the image's `coverIndex`. Supply bytes,
   not paths or media URLs. Call `verify_mint_intent` on the returned intent.
5. Give the user the exact `review.url` as **Review and mint in NFT-Studio**,
   or the complete saved `review.html` when using the local-file helper.
   The link carries the verified content and opens its preview directly. Retain
   `packetJson` as the suggested `.intent.json` fallback file. Never shorten,
   reconstruct or omit part of a returned review link. If your client truncates
   the result, save the complete structured tool output through its file facility
   or use a smaller supported package; do not present a partial link as usable.
6. The user opens Studio, inspects the files, connects a compatible browser wallet,
   reviews the actual destination/fees/policy, and approves signing and submission.
   Studio builds afresh from the connected wallet. Opening the link is not consent
   to connect a wallet, sign or publish. The link contains their content; share it
   only with intended reviewers.

For dedicated music releases with credits, use `create_music_release` and
`verify_music_release`; use its returned Music release review instructions and
canonical music packet. Do not pass that packet to the ordinary NFT intent tool.
Scrolls, Books and existing catalogue programs over the compact limit use their
browser Studio creators. Do not claim arbitrary Plutus, holder gating, CIP-68
updates or permanent one-of-one supply from an ordinary native NFT request.

## Wallets, fees and completion

- NFT-Studio charges **0 ADA platform fee**. Cardano network fees still apply;
  minimum ADA retained with an NFT remains in the user's output. An AI subscription
  does not fund those costs. Do not say a blockchain transaction is free.
- Never request or receive seed phrases or private keys. No MCP tool connects a
  wallet, signs or submits. The ordinary unsigned tools are for explicitly
  authorized external-signer integrations, not a shortcut around wallet review.
- An intent, unsigned transaction, witness verification or submitted hash is not
  a confirmed mint. Report the stage actually observed. For completion, inspect
  the confirmed receipt and asset identity, destination and exact content.
- Do not retry an uncertain submission. Look up the recorded transaction hash.
  A fresh preparation is not a retry strategy for an unknown chain outcome.

Use `search_cip_sources`, `get_cip_source_chunk`, `search_knowledge` and
`read_knowledge` when a requested design needs Cardano research. Source material
and experimental evidence do not imply that a feature is available in the minting
tool. Refer to current capabilities and state any unsupported requirement plainly.
