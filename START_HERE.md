# Your idea. Your agent. NFT-Studio.

This repository teaches a coding agent how to create and mint on Cardano.
The agent is the interface. No Studio GUI or terminal workbench is required for
creative work. Start in this folder with `codex`, `claude`, or another local agent:

> Read START_HERE.md and set up NFT-Studio. Then help me create and mint an NFT from my idea.

## For the agent: set up, then create

Read [.agents/skills/nft-studio/SKILL.md](.agents/skills/nft-studio/SKILL.md), the
canonical creative/minting skill. Codex discovers it in this checkout; Claude Code
has a small routing skill in `.claude/skills/nft-studio/`. Other agents can read
the same canonical file. Keep the user's existing creative brief; do not force
a menu, TUI or editor on them.

1. Check `node --version`. The pinned tools require Node 22.13 or newer and npm.
   If prerequisites are missing, explain that specific missing prerequisite.
2. Inspect this checkout before running its installation. Install only the MCP
   package, then build and discover the tools:

   ```sh
   npm --prefix mcp ci
   npm --prefix mcp run build
   node mcp/install-codex.mjs --check
   ```

   The check does **not** require Codex or change any client configuration: it
   opens a real local SDK connection, discovers the tools, then closes it.
   Root frontend dependencies are not needed for agent creation.
3. Create the exact requested files with your available creative tools. Use the
   skill's limits and utility checks. Show the actual result, revise as requested,
   and verify content before preparing a mint.
4. You can work **in the current session without an MCP reconnect**. Write a
   request containing local file paths and run:

   ```sh
   node mcp/create-review.mjs --request REQUEST.json --output NEW_DIRECTORY
   ```

   Read [the request contract](docs/MCP_LOCAL_FILES.md). The helper calls the real
   MCP through the SDK, packages and verifies the exact files, and saves a preview,
   intent, complete review URL, and receipt. It does not sign or submit.
5. For native MCP tools in subsequent sessions, use the client setup below.
   A registration is not a wallet permission. Preserve any conflicting existing
   configuration instead of replacing it.

## Native agent connections (optional for the local helper)

### Codex

```sh
node mcp/install-codex.mjs --install
codex
```

Start a new session in this checkout and say `Use NFT-Studio to create…` or invoke
`$nft-studio`. The installer checks and preserves existing settings.

### Claude Code

The project skill is available as `/nft-studio`. For native MCP tools, first
inspect `claude mcp get nft-studio`. If no entry exists, register the built server
with the actual **absolute** path to this checkout (quote paths containing spaces):

```text
claude mcp add --transport stdio --scope local nft-studio -- node /absolute/path/NFT-Studio/mcp/dist/cli.mjs
```

Do not paste the placeholder path. Resolve it from this checkout. Reopen Claude
Code and use `/mcp` to check the connection. The helper above remains available
without registering anything globally.

### Other local coding agents

Read the canonical skill and use the local helper, or configure stdio with
`node` and the absolute `mcp/dist/cli.mjs` path. Client configuration formats vary;
see [MCP.md](docs/MCP.md). The website URL is a guide, not a hosted MCP endpoint.

## Mint on a phone

For VESPR, deliver the exact review link or create a compact `--payload-qr`.
The exported review page has **Open in mobile wallet (VESPR)**; if the app does
not launch, paste the complete review link into its dApp browser. The user still
reviews and signs. The encrypted relay is currently unavailable, so do not use
`--mobile` as the default. See [mobile delivery](docs/MOBILE_HANDOFF.md).

## Minting authority and real limits

The agent creates and verifies content and prepares the transaction. The user
controls final signing with a compatible wallet or an explicitly authorized
external signer. The current default delivery is an exact browser preview and
wallet review; do not claim that unattended payment-driven minting is shipped.
No seed phrase or private key belongs in chat, a request file, or this repository.

Ordinary fully embedded packages support up to eight files and 12,000 raw bytes;
complete transaction fit is checked with actual wallet inputs and live parameters.
Music has its dedicated packaging route. Contracts, gated benefits, redemption
and guaranteed collection caps need a real enforcing implementation. Discover
capabilities before promising one. A current quantity of one is not a lifetime cap.

NFT-Studio charges 0 ADA platform fee. Network fees and the NFT's minimum ADA
still apply. A preparation or transaction hash is not proof of a confirmed mint.
Read back the confirmed transaction and exact asset identity before calling it done.

Primary client documentation: [Codex MCP](https://developers.openai.com/codex/mcp),
[Claude Code skills](https://code.claude.com/docs/en/skills),
[Claude Code MCP](https://code.claude.com/docs/en/mcp).
