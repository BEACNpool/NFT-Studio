# BEACN Workbench

**[Open the workspace](https://beacnpool.github.io/NFT-Studio/workbench/)** ·
**`npm --prefix mcp run tui`** · **MCP tool: `studio_workbench`**

The same twelve recipes power the terminal, standalone browser and embedded MCP
App. Search by purpose or CIP number, inspect the actual tool catalog, compose a
build plan, and edit an existing ordinary creation request before wallet review.
No part of the workbench connects a wallet, signs or submits a transaction.

## Pick the surface that fits

| Surface | What works |
| --- | --- |
| Terminal | Keyboard browsing, recipe selection, live MCP schemas and tool calls from explicit JSON files, private plan/result exports, exact-intent inspection, mint-option updates and full native phone QR display. |
| Browser | Recipe and tool search, plan composition and download, build-prompt copy, local exact-intent verification and mint-option editing. Content stays in this browser unless you follow a review link or explicitly share it. |
| MCP App | The same workspace inside a supporting host, plus actual tool calls, live schemas and an explicit “Use plan in chat” context action through the host bridge. |
| Text-only MCP host | All 28 Node tools remain available as structured/text responses; `studio_workbench` also returns the standalone browser URL. Rendering depends on the host. |

Update an existing checkout with `git pull --ff-only`, then
`npm --prefix mcp ci` and `npm --prefix mcp run build`. Restart the MCP connection
to discover new tools. No new credentials, endpoint or wallet permissions are needed.

## Terminal controls

Run `npm --prefix mcp run tui` from the repository root. Use arrows or **j/k**,
**1/2/3** to switch recipes/tools/review, **/** to search, **Space** to select a
recipe and **Enter** to inspect it. **p** asks for a project name and purpose,
then composes the selected recipes. **e** exports the current result to a fresh
file with private permissions; it never overwrites an existing file. **b** goes
back, **Page Up/Down** scrolls details, and **q** exits cleanly.

In Tools, **x** asks for an explicit arguments JSON file and calls the selected
tool through the local MCP. Inspect the schema first. Some tools perform public
protocol reads or an explicitly requested encrypted phone transfer; their existing
boundaries still apply. Never put a seed phrase or signing key in a request.

In Review, **l** loads and verifies an ordinary `.intent.json`, **o** applies a
mint-options JSON, **v** inspects readiness, **m** creates the native encrypted
phone QR and displays every row, complete link and expiry. Music has a separate
package and creator. QR result exports can contain private revocation information;
share the phone link/QR, not the whole private result.

```sh
node mcp/tui.mjs --intent creation.intent.json
node mcp/tui.mjs --plain
node mcp/tui.mjs --json
node mcp/tui.mjs --plan traits,message --name "Pocket Signal" --output NEW-plan.json
```

Noninteractive terminals print the catalog and exit. `NO_COLOR=1` disables color.
The TUI has its own entry point: the MCP stdio server continues to emit only protocol
messages. The terminal needs the repository’s compiled MCP and Node 22.13 or newer.

## Add a utility

Choose a recipe and read its **What you’ll need**, **How to add it**, **What this
actually guarantees** and transfer/lifecycle guidance. Add up to eight recipes to
a named plan. The planner flags incompatible creation routes and required engineering.
Download the plan or copy its prompt into your AI conversation. A plan is a brief,
not a validator, metadata file, mint intent or deployed service.

| Recipe | Standards / profile | Studio route |
| --- | --- | --- |
| `traits` | CIP-25; CIP-14 for displayed identity | Ordinary intent + mint options |
| `message` | CIP-20, label 674 | Ordinary NFT mint options |
| `interactive` | CIP-25 media; embedded program supplies the behavior | Compact program + cover, or dedicated existing game creator |
| `attachments` | CIP-25 exact media | Ordinary files + cover |
| `music` | CIP-60-aligned exact-credit profile | Dedicated Music release Lab |
| `proof` | Bounded public-hashes profile of proposed CIP-190 | Proof Lab; inclusion checked separately |
| `passport` | BEACN Artifact Passport profile | Canonical receipt export/import |
| `registry` | Bounded CIP-26 signature inspection | Registry Lab; separate explicit key trust |
| `evolving` | CIP-68, CIP-67, CIP-57 | Experimental fixed State Capsule; transaction integration still required |
| `holder-access` | CIP-8 and CIP-30 plus a trusted service | Blueprint; no deployed holder-auth backend |
| `redemption` | Signed challenges or validated state transitions | Blueprint; atomic consumption and fulfillment required |
| `royalties` | CIP-27 | Blueprint; marketplace support required |

Music, evolving state and ordinary mint options use different artifact paths.
The strict Passport producer excludes advanced options, multiple copies and the
dedicated Music/Capsule profiles. Keep full receipts and use each route’s recovery
tools. A trait called `royalty` or `holdersOnly` does not install an enforcement mechanism.

### Example: traits and a public note

First create and verify an ordinary NFT intent from the actual files. Then call:

```json
{
  "name": "configure_mint_options",
  "arguments": {
    "intent": "REPLACE WITH THE COMPLETE VERIFIED INTENT OBJECT",
    "quantity": 1,
    "mintWindowHours": 24,
    "traits": { "Series": "Pocket Signal", "Mood": "After dark" },
    "message": "Made to be carried."
  }
}
```

The placeholder is explanatory and will be rejected until replaced by the real
object. Alternatively, load the real intent in Mint review and use the form.
Verify the new hash, download the updated intent and open its exact Studio preview.
All previous QR/review links still refer to the old content; generate new ones
after edits. Studio builds afresh when the wallet review begins.

Quantity is 1–1,000 units in this transaction, **not a lifetime supply cap**.
The native policy allows additional minting until expiry, then rejects both mint
and burn; transfers continue. Each trait key/value and the Studio message are
limited to 64 UTF-8 bytes, with at most twelve traits. Those are Studio profile
limits, not claims about every use of the standards.

## New MCP tools

| Tool | Inputs | Result |
| --- | --- | --- |
| `studio_workbench` | Optional `query`, `group` (All/Create/Verify/Build) | Filtered recipes, runtime-specific toolbox, UI resource and browser fallback |
| `get_utility_recipe` | `id` from the catalog | Sources, inputs, tool sequence, lifecycle and implementation limits |
| `plan_nft_utility` | `name`, optional `purpose`, one to eight distinct `recipeIds` | Plan with compatibility blockers and required implementation |
| `inspect_mint_readiness` | Exact ordinary `intent` | Verified files/hash/options, review URL and explicitly unverified wallet/chain checks |

MCP 0.5.0 exposes **28 Node tools / 26 Worker tools / 62 resources**. The two
Node-only tools remain metadata measurement and retained ordinary-witness verification.
The new resource is `ui://nft-studio/workbench/v1`, with MIME
`text/html;profile=mcp-app`. It bundles its code, style, data and BEACN icon;
it requests no external network/asset/frame origins or device permissions.
Host-mediated actions depend on the host’s capabilities and consent policy.
Local downloads or clipboard use can be restricted by an embedded host; plan
context and the standalone workspace provide alternatives.

## Sources and verification scope

Recipe guidance was reviewed on **2026-09-12** against the primary CIP pages linked
in each recipe. It does not update or reinterpret the pinned original README corpus.
Check current adoption and the intended wallet/marketplace before promising compatibility.
MCP App integration follows [SEP-1865](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
and the [official MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview).

The repository tests exercise both protocol eras in Node and actual Workerd,
unchanged intent bytes, invalid input, route incompatibilities, tool/resource parity,
terminal output and exclusive exports. Browser/PTY release checks exercise real
controls and a sandbox host fixture. A fixture is not acceptance by every installed
MCP host, terminal, mobile device or wallet. No new live mint is implied by this release.

The small embedded icon is the existing BEACN brand master’s 64px web derivative.
It does not modify historical NFT artwork or its metadata.
