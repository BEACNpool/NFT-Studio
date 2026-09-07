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
3. Call `create_mint_intent` with `mode: "nft"`, a name, optional description,
   exact canonical base64 file bytes and the image's `coverIndex`. Supply bytes,
   not paths or media URLs. Call `verify_mint_intent` on the returned intent.
4. Give the user the exact `review.url` as **Review and mint in NFT-Studio**.
   The link carries the verified content and opens its preview directly. Retain
   `packetJson` as the suggested `.intent.json` fallback file. Never shorten,
   reconstruct or omit part of a returned review link. If your client truncates
   the result, save the complete structured tool output through its file facility
   or use a smaller supported package; do not present a partial link as usable.
5. The user opens Studio, inspects the files, connects a compatible browser wallet,
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
