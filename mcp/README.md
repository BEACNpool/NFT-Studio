# NFT Studio MCP

MCP **0.5.0** adds `studio_workbench`, `get_utility_recipe`, `plan_nft_utility` and `inspect_mint_readiness`: 28 Node / 26 Worker tools, 62 resources. Run `npm run tui` here for the terminal workspace. The visual `ui://nft-studio/workbench/v1` resource renders in compatible MCP Apps hosts, with structured text and browser fallback. [Complete workbench guide](../docs/WORKBENCH.md).

An AI-guided Cardano creation studio: interactive questions, minted inspiration,
exact content packages, and a visible wallet review. The connected AI creates the
media; this MCP guides the process and validates and packages exact files.

Start by asking **“Open NFT-Studio and guide me.”** The `studio_guide` tool offers
one question at a time, native forms where supported, and numbered chat menus
elsewhere. Choose an idea, preview, revise, or keep your work without minting.
`studio_inspiration` supplies minted originals, source links and separate-copy
review paths. The `nft-studio` MCP prompt starts the same conversation. Complete
one-prompt requests remain supported. [Interactive guide contract](../docs/CREATIVE_GUIDE.md).

Install and build from the repository root:

```sh
npm --prefix mcp ci
npm --prefix mcp test
```

Only the nested MCP install is required; the root Studio's `node_modules` is not
needed. The build resolves shared TypeScript imports against MCP's pinned packages.
For release verification, `npm --prefix mcp run test:clean` copies only source
inputs into a fresh temporary fixture, runs a nested clean install, builds both
transports, and runs the real SDK integration tests without root dependencies.
It retains the fixture and a JSON receipt for inspection.

Connect a local MCP client to `node /absolute/path/NFT-Studio/mcp/dist/cli.mjs`.
The Node server exposes 28 tools over local stdio or authenticated Streamable HTTP.
The separately deployable Worker exposes 26 tools, including stateless unsigned
NFT/data/music preparation. Both expose 62 resources; verify deployed capabilities
through discovery. The Worker requires its adjacent compiled
CSL WASM module. Its public unsigned result has no Node packet ID or witness-verifier state. Read [the complete setup, tool and signing contract](../docs/MCP.md).

No tool signs, submits, reads private keys or accepts media-fetch paths/URLs or caller-selected provider endpoints. Declared music credit links are inert data and are never fetched.

Read [the music package tool contract](MUSIC_PACKAGES.md). Bots supply exact cover/audio bytes and credits, then receive canonical `.music-release.json` content and a fixed Music Lab link for explicit human wallet review. Music packages are rejected by the ordinary mint-intent and unsigned-preparation tools. The dedicated `prepare_unsigned_music_transaction` accepts canonical music packetJson plus an authorized wallet snapshot; read [its stateless contract](MUSIC_UNSIGNED.md). It shares preparation concurrency with ordinary transactions and cannot enter Node stored witness verification.

Read [the bounded State Capsule parameter tool contract](CAPSULE_PARAMETERS.md). It applies only the pinned program and does not build or evaluate a Capsule transaction.

## Send to mobile with a QR code

After the preview, choose **Send to mobile (QR)** or ask “Send this to my phone.”
The agent calls `create_mobile_handoff` with the exact verified ordinary intent
and displays its QR, complete HTTPS phone link and expiry. This uses the same
15-minute encrypted transfer as **Continue on phone → Create QR code** in Studio.
MCP 0.4.1 includes scannable Unicode text in `qr.terminalText` and a separate
human-readable text block. In terminal clients, the agent must show it verbatim
in a fenced code block in its answer; an image path alone is insufficient.
The local-file helper's `--mobile` prints the QR to stderr, preserves JSON stdout,
and saves TXT/PNG/SVG QR files and a phone review page. Opening the link grants no
wallet permission.

See [the native mobile workflow](../docs/MOBILE_HANDOFF.md) for agent steps, saved files,
privacy, expiry and supported package limits.
