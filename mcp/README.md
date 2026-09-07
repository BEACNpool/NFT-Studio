# NFT Studio MCP

Real MCP tools for Cardano knowledge, exact content packages, browser mint intents,
actual unsigned transactions and external wallet witness verification.

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
The authenticated Node HTTP listener offers eleven tools. The Worker source
candidate offers nine tools, including stateless unsigned preparation; deployed
capabilities must be checked separately. The Worker requires its adjacent compiled
CSL WASM module. Its public unsigned result has no Node packet ID or witness-verifier state. Read [the complete setup, tool and signing contract](../docs/MCP.md).

No tool signs, submits, reads private keys or accepts arbitrary paths/URLs.
