# Connect an agent to NFT Studio

NFT Studio ships a real Model Context Protocol service using the official TypeScript SDK **2.0.0**. It supports local stdio and authenticated Streamable HTTP, with the 2026-07-28 protocol and legacy negotiation. Its builder creates actual unsigned Cardano mainnet transactions from the same source used by the browser. Your wallet keeps signing authority.

## Public connection

The public preparation service is live at:

```text
https://beacn-nft-studio.davidmjensen17.chatgpt.site/api/mcp
```

Connect with Streamable HTTP and no API key. This endpoint exposes **eight tools**
and **55 resources**: Cardano knowledge, exact payloads, browser mint requests,
and proof records. It receives only content explicitly supplied in requests.
It does not accept a wallet snapshot or build/sign/submit a transaction.
The full Node service described below has additional capabilities and remains a
separately installed package. GitHub Pages serves the app, not the MCP process.

A common MCP client config (clients may use a different settings wrapper):

```json
{
  "mcpServers": {
    "beacn-nft-studio": {
      "url": "https://beacn-nft-studio.davidmjensen17.chatgpt.site/api/mcp"
    }
  }
}
```

Ask your bot: “Use BEACN NFT Studio to prepare a mint request for these files.
Return the request JSON for me to inspect in Studio.” The bot calls
`create_mint_intent`, saves its `packetJson` as the returned `filename`, and gives
you the `review.url`. Open that file under **Labs → Agent minting**, inspect it,
and continue through the existing visible wallet review.

[Live verification receipt](MCP_PUBLIC_VERIFICATION.json): official current and
legacy clients passed knowledge lookup, intent roundtrip/tamper rejection, proof
match/mismatch, resource discovery and browser-origin checks on 2026-09-07.
Reproduce the read-only check using synthetic content:

```sh
node mcp/integration/verify-live-endpoint.mjs https://beacn-nft-studio.davidmjensen17.chatgpt.site/api/mcp
```

The Sites front dispatcher reserves `/mcp`; this service uses the application's
`/api/mcp` route. It is ordinary public MCP, not a Sites OAuth integration.


## Local connection

From a clean repository checkout (Node **22.13+**):

```sh
npm --prefix mcp ci
npm --prefix mcp run build
npm --prefix mcp test
```

No root Studio dependency install is required. The Worker build resolves the shared
TypeScript modules' npm imports from `mcp/node_modules`, using this package's lockfile.
`npm --prefix mcp run test:clean` checks that promise in a fresh source-only temporary
fixture: nested `npm ci`, Node and Worker builds, and the actual SDK integration tests.
The verifier rejects root/ancestor dependency directories, copies no installed
dependencies, and retains its fixture plus `mcp-clean-install-check.json` evidence.

Example MCP client configuration; replace the absolute checkout path:

```json
{
  "mcpServers": {
    "beacn-nft-studio": {
      "command": "node",
      "args": ["/absolute/path/NFT-Studio/mcp/dist/cli.mjs"]
    }
  }
}
```

Run the compiled file directly. `npm run` can write banners to stdout, which is reserved for JSON-RPC when a client launches a stdio server. No model-provider credentials are needed.

## What your agent can do

| Tool | Result |
| --- | --- |
| `studio_capabilities` | Real format support, byte limits, policy semantics and implementation boundaries |
| `search_knowledge` / `read_knowledge` | Bounded, cited knowledge lookup with standard status and implementation maturity |
| `validate_payload` | Exact file bytes, MIME signature/UTF-8 checks, canonical embedded URIs, SHA-256 and data metadata measurement |
| `validate_metadata` | Ledger-safe JSON subset validation and actual auxiliary CBOR size/hash |
| `create_proof_record` / `verify_proof_record` | Proposed CIP-190 public hash records and exact-byte verification, with raw record/metadata CBOR exports |
| `create_mint_intent` / `verify_mint_intent` | Deterministic file packet for visible browser review |
| `prepare_unsigned_transaction` | Actual unsigned transaction, identity, fee, outputs, protocol quote and review expiry |
| `verify_signed_transaction` | External witness verification, unchanged body/metadata and complete signed size/fee check; signed CBOR returned to caller |

Resources expose `nft-studio://capabilities`, a knowledge index and each allowed knowledge entry. Tools accept file **bytes as canonical base64**, not local paths, network URLs or commands. They never execute HTML or imported programs.

Image, music, game, app, motion and file/data payloads use the shared compact packager. A new package has at most eight files and **12,000 total raw bytes**; NFT mode requires an image cover. Full signed transactions must also fit live network limits and the Studio's **16,384-byte** cap, so some payloads need to be smaller. The builder charges no platform fee and rejects network fees above **2 ADA**.

Scroll and Book use different protocols and remain browser creators. Some existing trusted catalogue programs exceed the new-package bound and retain their existing browser paths. This MCP does not claim CIP-68 updates, one-shot mint policies, token-gated utility, or arbitrary Plutus transaction support. Search the knowledge base for their actual status and prerequisites.

## Intent → visible browser review

1. Call `create_mint_intent` with `mode`, `name`, optional `description`, `files`, and optional `coverIndex`.
2. Save the returned `packetJson` exactly to its suggested `.intent.json` filename.
3. Open the returned Studio link directly to **Labs → Agent minting** and import the packet. The link uses `?view=labs&lab=agents`; it contains no packet or file content.
4. Inspect its title, description, exact files and hashes. Explicitly continue to wallet review.
5. The browser builds afresh with the user's connected wallet, then follows the existing signing, submission and receipt flow.

The URL carries no file content. The packet contains no wallet address or transaction. Its hash binds content, not authorship or approval. A valid packet does not prove that its embedded artwork or code is trustworthy; imported HTML stays inert in Studio previews.

Schema `nft-studio.intent.v1` is shared in `lib/studio-intent.ts`. Canonical core order is `schema`, `mode`, `bundle`; bundle order is `schema`, `name`, `description`, `cover`, `bytes`, `files`, `sha256`; each file orders `name`, `mediaType`, `bytes`, `sha256`, `uri`. `intentHash` is SHA-256 over UTF-8 `JSON.stringify(core)`. Verification reconstructs actual files, checks the existing payload hash and rejects unknown/missing fields. The compact serialized packet is capped at 80,000 UTF-8 bytes.

Example tool arguments:

```json
{
  "mode": "data",
  "name": "Hello from an agent",
  "files": [{
    "name": "hello.txt",
    "mediaType": "text/plain",
    "base64": "SGVsbG8sIENhcmRhbm8h"
  }]
}
```

## Public proof records

`create_proof_record` creates the **public hash-only profile of Proposed CIP-190 v1**. It receives explicitly supplied base64 file bytes and returns a sidecar artifact, canonical raw record CBOR, byte-string chunks for label **309**, and complete metadata-map CBOR. This is an export; it creates no transaction, publication or timestamp. The existing unsigned NFT/data builder does not automatically attach these proof records.

```json
{
  "files": [{"name": "hello.txt", "base64": "SGVsbG8sIENhcmRhbm8h"}],
  "algorithms": ["sha2-256", "blake2b-256"]
}
```

`verify_proof_record` accepts `recordCborHex`, one `file` object with `name` and canonical `base64`, and optional `itemIndex` (default 0). Its verdict distinguishes `match`, `mismatch`, `invalid-record` and `unsupported-profile`. Every declared supported digest must match; other CIP-190 features are not silently accepted. Empty files have valid commitments.

Creation accepts **1–16 files**; verification accepts **one file per call**. Both cap total supplied raw file bytes at **48 KiB** and argument JSON at **80 KiB**. Verification additionally caps imported record CBOR at **16 KiB**. The public transport still caps the complete framed request at 96 KiB. Use the browser's local hashing flow for larger originals.

A remote MCP server necessarily receives the file bytes supplied to it. These tools make no external fetch and do not persist or publish them. Use browser-only hashing when original bytes must remain on your own device. Only digests and algorithm IDs enter the generated record; filenames and sizes remain in its sidecar. Public hashes are not encryption and can reveal matches to guessed files.

A matching digest does not prove chain inclusion, authorship, rights, truth or ownership. Imported records cannot recover files. Ledger timing requires separately observed transaction inclusion. The returned CBOR uses **raw byte strings**, not hex text substituted into JSON metadata; a transaction integrator must preserve those types. See the [Proposed CIP-190 specification](https://cips.cardano.org/cip/CIP-0190) and this repository's source-pinned proof profile for the precise supported scope.

## External wallet integration

`prepare_unsigned_transaction` takes a verified intent and a CIP-30 wallet snapshot:

```json
{
  "intent": {"...": "the exact returned intent object"},
  "wallet": {
    "changeHex": "CIP-30 getChangeAddress() hex",
    "utxos": ["CIP-30 getUtxos() transaction_unspent_output CBOR hex"]
  }
}
```

The response includes `packetId`, `unsignedHex`, transaction body hash, all selected inputs, required payment-key hashes, recipient, exact asset-name bytes, policy script and expiry, fee/size estimate, actual metadata and live protocol quote. Independently review them before an external wallet calls `signTx(unsignedHex, true)`. Return the resulting **witness-set CBOR** as `witnessSetHex`, plus `packetId` and a refreshed wallet snapshot, to `verify_signed_transaction`.

The verifier uses only the server's original preparation; it never trusts a client-supplied prepared object's required keys, body or metadata. It checks every required payment signature, exact transaction body, auxiliary-data commitment, current protocol parameters, selected wallet snapshot, full signed bytes and minimum fee. The result is a signed **candidate**, not a receipt. There is no sign or submit tool.

The input snapshot comes from the caller. This service does **not independently prove UTxOs are unspent on chain** or that a caller controls their asserted address before signing. Before an external wallet/client submits, it must check current unspent inputs, validity and expected identity, record the transaction hash before broadcast, submit at most once, resolve ambiguous responses by hash, and verify inclusion. The Studio browser performs its existing wallet/review/submission checks instead of trusting an exported unsigned transaction.

The native policy requires a payment signature and closes after its expiry. It mints quantity one in this transaction but **does not enforce a lifetime supply of one**. Its closed mint window also forbids later burning. Metadata describes content; it cannot activate a holder gate or mutable contract.

Preparations and wallet snapshots exist only in process RAM, with random packet IDs, a four-minute lifetime, a 64-packet cap and periodic cleanup. Restarting the process invalidates IDs. A shared HTTP bearer token identifies one operator context; do not use a single token as a multi-tenant identity system. Run separate processes/tokens or add independently reviewed principal isolation for multiple customers.

## Host the full Node service

The built-in listener binds **loopback only**. Put an operator-managed TLS reverse proxy in front of `/mcp` for remote use. Supply `MCP_AUTH_TOKEN` through your secret manager or service environment; it must contain 32–256 URL-safe characters with high entropy. Do not place it in a URL, a checked-in config or a shell command saved in history.

```sh
# MCP_AUTH_TOKEN is already injected securely by the service manager.
MCP_PORT=8787 node mcp/dist/cli.mjs --http
```

| Environment | Meaning |
| --- | --- |
| `MCP_AUTH_TOKEN` | Required shared bearer secret for every actual MCP request |
| `MCP_BIND` | `127.0.0.1` (default) or `::1`; remote bind is rejected |
| `MCP_PORT` | Loopback port; default 8787 |
| `MCP_ALLOWED_HOSTS` | Comma-separated exact extra hostnames accepted by a preserving reverse proxy |
| `MCP_ALLOWED_ORIGINS` | Comma-separated exact HTTPS browser origins; default rejects every Origin header |

MCP clients send `Authorization: Bearer …`. This release implements static bearer authentication, not OAuth discovery/registration; clients requiring OAuth need a separately implemented gateway. Requests without an Origin header are valid for nonbrowser MCP clients. Allowed browser preflight requests expose no tool data; POST still requires the bearer secret. CORS does not replace authentication. The application ignores forwarding headers for identity/rate policy. Configure the proxy to preserve or deliberately replace Host and remove untrusted forwarding headers.

The service rejects arbitrary hosts/origins, compressed requests, non-JSON requests, batches and bodies over **512 KiB**. It allows eight concurrent HTTP requests, two concurrent transaction preparations, 32 connections and 120 requests/minute globally per process. Protocol feed reads are fixed-origin, read-only, limited to 64 KiB per response, reject redirects and time out after ten seconds. There are no filesystem, shell, user URL-fetch, private-key or chain-submission tools. Request bodies, headers, wallet addresses and CBOR are never logged by this package; configure the reverse proxy accordingly.

## Reproducibility and evidence

The nested `mcp/package-lock.json` pins the SDK and all dependencies. The build bundles the repository's actual `studio-payload.ts`, `studio-intent.ts`, `studio-transaction.ts` and Cardano guards; it does not fork the builder. The pinned knowledge catalogue is included in the artifact, so serving it does not fetch or execute source documents. Rebuild after source/catalogue changes.

`npm --prefix mcp test` uses real official MCP clients over child-process stdio and ephemeral HTTP, both protocol eras, fixed-resource discovery, strict negative input cases and synthetic Cardano keys. It checks NFT and data transactions, token/ADA conservation, multi-key signing, body/metadata preservation, wrong signatures, stale reviews, dangerous UTxOs, input tampering, body/auth/origin/host/rate limits and oversized stdio. It does not use a real wallet, spend funds, contact a chain or claim independent security audit.

Primary implementation sources, checked 2026-09-07: [official SDK stable release and packages](https://github.com/modelcontextprotocol/typescript-sdk), [SDK v2 protocol negotiation](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions), [web-standard handler API](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/server/createMcpHandler.html), [MCP transport specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports), [CIP-30 wallet API](https://cips.cardano.org/cip/CIP-0030), [CIP-25 NFT metadata](https://cips.cardano.org/cip/CIP-0025). Research statuses and exact source provenance live in `knowledge/`.

## Public Worker subset

`mcp/dist/worker.mjs` is a standalone web-standard artifact with no Node imports. It exports `createPublicMcpHandler`, which returns a fetch handler. It exposes **eight** public tools: capabilities, knowledge search/read, payload validation, intent creation/verification, and proof record creation/verification. It has no unsigned builder, wallet/UTxO/witness input, network lookup, packet cache, authentication secret, private storage or chain submission.

An operator can wrap it in an existing HTTPS Worker. The default path is `/mcp`; configure `endpointPath: '/api/mcp'` where the host reserves that path:

```js
import { createPublicMcpHandler } from './mcp/dist/worker.mjs';

const mcp = createPublicMcpHandler({
  publicOrigin: 'https://your-public-host.example',
  studioUrl: 'https://beacnpool.github.io/NFT-Studio/',
  allowedOrigins: [
    'https://your-public-host.example',
    'https://beacnpool.github.io'
  ]
});

export default { fetch: request => mcp.fetch(request) };
```

The placeholder is not an existing endpoint. The wrapper must use the actual deployed origin. The Worker's authoritative `Request.url.origin` is checked exactly; proxy-internal raw Host headers can differ and do not override this routing identity. The Node listener separately validates raw Host before constructing a URL. Browser origins are exact HTTPS allowlist entries. Nonbrowser clients may omit Origin. Requests need no bearer token because this route grants only public knowledge lookup and transformation of **explicitly supplied** content; it cannot read anything from a user's wallet or computer. Do not put secrets in payloads you send to a public service. Intent URLs never contain payload data.

The Worker rejects bodies over **96 KiB**, invalid UTF-8/JSON, batches, compressed content, URL queries and non-MCP paths. It allows eight concurrent requests, bounds body-read time to ten seconds, and enforces 120 requests/minute **per isolate**. That rate counter is best effort: Worker isolates restart and scale independently. A public production operator must add platform-level abuse/rate controls if shared global quotas are needed. This package does not claim a durable global rate limit or a multi-tenant paid service.

Deploying this artifact and verifying an actual endpoint are separate release steps. The bundled Worker is exercised with both official SDK protocol eras in the package test suite; the host must additionally verify its actual Worker runtime, routing and public client access before announcing a URL.

For the existing Sites application's root-owned release, [the reversible wrapper kit](../mcp/integration/README.md) stages `/mcp` alongside the original Worker and verifies both the app/static-asset fallback and official MCP client flows in actual Miniflare/Workerd. Staging is separate from deployment; use the exact intended release build.
