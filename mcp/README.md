# NFT Studio MCP

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
The Node server exposes 19 tools over local stdio or authenticated Streamable HTTP.
The separately deployable Worker exposes 17 tools, including stateless unsigned
NFT/data/music preparation. Both expose 61 resources; verify deployed capabilities
through discovery. The Worker requires its adjacent compiled
CSL WASM module. Its public unsigned result has no Node packet ID or witness-verifier state. Read [the complete setup, tool and signing contract](../docs/MCP.md).

No tool signs, submits, reads private keys or accepts media-fetch paths/URLs or caller-selected provider endpoints. Declared music credit links are inert data and are never fetched.

Read [the music package tool contract](MUSIC_PACKAGES.md). Bots supply exact cover/audio bytes and credits, then receive canonical `.music-release.json` content and a fixed Music Lab link for explicit human wallet review. Music packages are rejected by the ordinary mint-intent and unsigned-preparation tools. The dedicated `prepare_unsigned_music_transaction` accepts canonical music packetJson plus an authorized wallet snapshot; read [its stateless contract](MUSIC_UNSIGNED.md). It shares preparation concurrency with ordinary transactions and cannot enter Node stored witness verification.

Read [the bounded State Capsule parameter tool contract](CAPSULE_PARAMETERS.md). It applies only the pinned program and does not build or evaluate a Capsule transaction.
