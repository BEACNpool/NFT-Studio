# Contributing to NFT-Studio and BEACN Labs

Useful contributions include a reproducible encoding fix, a narrowly supported
Cardano capability, a clearer creator flow, or a sourced correction to the public
knowledge base. Explain the behavior being changed and show the evidence for it.

Original contributions use the repository's Apache-2.0 license. Retain upstream
licenses and author attribution when adding fixtures or adapting code. Only add
artwork and other material you have the right to share.

## Work locally

Use Node 22.13 or newer. Run `npm ci`, then `npm run dev`. No wallet or API secret
is needed to design, inspect, hash, export, or run the deterministic test suite.
The MCP package installs separately with `npm --prefix mcp ci`; see
[its client setup and transport limits](docs/MCP.md).

Run the checks relevant to your change, plus `npm run typecheck` and `npm run lint`:

| Area | Checks |
| --- | --- |
| Native minting / files | `npm run verify:mint` and `npm run verify:studio` |
| Labs codecs / proof records | `npm run verify:labs` |
| Knowledge schema / search | `npm run verify:knowledge` |
| MCP tools / transports | `npm run verify:mcp` |
| State-capsule codec / unsigned transactions | `npm run verify:capsules` |
| Aiken policy or spending rule | Pinned compiler commands in `contracts/state-capsule/README.md` |
| Browser UI / route changes | Production-style `npm run build:pages`, then applicable browser audits under `scripts/` |

The [Labs browser audit](scripts/audit-labs.cjs) and navigation audit accept
`STUDIO_URL`, `PUPPETEER_MODULE`, and `CHROMIUM_EXECUTABLE_PATH`. They use generated
synthetic wallets and intercepted chain/submission responses. They do not spend
funds or establish real-wallet acceptance. Browser downloads need a temporary
directory visible to the browser; `LABS_TMPDIR` can override the audit's default.

## Contribute knowledge with evidence

Follow [knowledge admission](knowledge/ADMISSION.md). Record a primary source's
immutable revision, retrieval date, digest and attribution. Keep proposal status,
local implementation, node evaluation, chain inclusion and external review as
separate claims. Put contradictions in `knowledge/review-issues.json`.
Automated source checks may identify a changed proposal; they cannot approve
a new mint template or rewrite an evidence claim.

## Change a capability's complete lifecycle

Explain issuance, authority, holder use, transfer, final state and recovery.
Test cases should establish the intended rule as well as meaningful rejection
cases. Metadata does not enforce access or rights by itself. Include actual full
transaction size, fee and preserved-value evidence where a builder is changed.
Keep experimental features clearly identified until the complete path is verified.

Never include private keys, API credentials, personal wallet snapshots or private
infrastructure in a contribution. Do not add live spending to CI. Public source
verification and deployment are separate steps; see [publishing](docs/PUBLISHING.md).
