# Connect an agent to NFT Studio

## Interactive creation

Start with **studio_guide** for a guided conversation, or choose the **nft-studio**
MCP prompt. Ask one question at a time, carry the returned creative state, show a
real preview, then offer revisions, wallet review, or keeping the files without
minting. **studio_inspiration** provides curated original editions, play links,
source attribution and copy-review links where supported. See
[the guide contract](CREATIVE_GUIDE.md) for state, native forms, cancellation and
one-prompt usage. These tools do not generate media or touch wallets.


NFT Studio ships a real Model Context Protocol service using the official TypeScript SDK **2.0.0**. It supports local stdio and authenticated Streamable HTTP, with the 2026-07-28 protocol and legacy negotiation. Its builder creates actual unsigned Cardano mainnet transactions from the same source used by the browser. Your wallet keeps signing authority.

## Public connection

**Share the repository-hosted setup page:**
[beacnpool.github.io/NFT-Studio/mcp/](https://beacnpool.github.io/NFT-Studio/mcp/).

The public distribution is the [NFT-Studio repository](https://github.com/BEACNpool/NFT-Studio).
Your MCP client runs its server locally over stdio. The setup page is a guide,
**not an HTTP MCP endpoint**: GitHub Pages hosts static files and cannot run the
server process. See [GitHub's hosting documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The local Node server provides **21 tools and 61 resources**. It includes Cardano
knowledge, original CIP source search, exact payloads, music packages, proof
records, fixed Capsule parameters, unsigned native NFT/data/music transactions
and external witness verification. No tool holds a signing key, connects to a
wallet or submits a transaction. Unsigned preparation queries public Cardano
network parameters; the bot supplies its explicitly authorized wallet snapshot.

Ask your bot: “Use NFT-Studio to create a pixel-art spaceship NFT and give me its
review link.” `create_mint_intent.review.url` opens the exact verified content in
**Labs → Agent minting**. Inspect it, connect a compatible browser wallet, then
review and approve the mint. Keep `packetJson` under its returned filename as a
file-import fallback. Dedicated music packages still use **Music release** import.

For audio, binary files or larger agent results, use the included
[local-file review exporter](MCP_LOCAL_FILES.md). It sends exact file bytes through
the local MCP and saves a complete review page and request without copying media
or a long link through model prose. A prepared
[Labor Day flag and original whistle march](../experiments/labor-day-worker-demo/README.md)
demonstrates this path; it is not a confirmed mint.

The separately deployable Worker has a 19-tool subset. It requires an operator's
own HTTPS host; no hosted address is advertised in this repository. A setup-page
URL cannot substitute for that endpoint. The [operator integration guide](../mcp/integration/README.md)
describes explicit host configuration and real-client verification.

### Historical hosted evidence

[The dated hosted-service receipt](MCP_PUBLIC_VERIFICATION.json) retains the
actual modern/legacy client observations from September 7. Its original hostname
has been explicitly redacted for privacy. The placeholder is not a service URL,
and these observations do not describe a newly deployed endpoint.

Earlier [initial](verification/mcp-public-initial-20260907.json),
[native preparation](verification/mcp-native-20260907.json),
[implementation-resource](verification/mcp-implementation-register-20260907.json),
[music package](verification/mcp-music-packages-20260907.json) and
[unsigned music](verification/mcp-music-unsigned-20260907.json) observations remain
as explicitly redacted historical records. Results, timestamps and content hashes
are retained. See [receipt privacy handling](verification/PRIVACY.md).

The [original Midnight Beacon preparation](verification/midnight-beacon-public-preparation-20260907.json)
used fresh public parameters and invented inputs: 8,600 raw file bytes,
13,194 metadata bytes and 13,697 estimated signed bytes. Independent checks bound
exact credits, transaction commitments and value conservation. It remains unminted.

## Local connection

Install from the repository with Node **22.13+**:

```sh
git clone https://github.com/BEACNpool/NFT-Studio.git
cd NFT-Studio
npm --prefix mcp ci
npm --prefix mcp run build
```

Run `npm --prefix mcp test` to reproduce the MCP verification suite.

### Codex CLI and the included agent skill

With Codex installed and signed in, run from the repository:

```sh
node mcp/install-codex.mjs --check
node mcp/install-codex.mjs --install
codex
```

The default/`--check` only discovers the local MCP. Explicit `--install` adds the
`nft-studio` server using this checkout's absolute compiled path, verifies the
saved configuration, and refuses to overwrite a different existing entry.
Starting Codex in this checkout exposes the public
[NFT-Studio skill](../.agents/skills/nft-studio/SKILL.md). Ask
`$nft-studio Create a pixel-art spaceship NFT and give me its review link.`
The skill teaches tool selection, exact files, supported limits, research and
wallet handoff; it does not retrain the model. Your existing Codex login supplies
the AI service, subject to your plan's limits. No extra model-provider key is
required by this MCP. See [official Codex MCP setup](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

On Windows, the installer supports a native `codex.exe` or the standard npm
`@openai/codex` installation. It invokes the npm JavaScript entry with Node and
preserves arguments without a command shell. Unsupported shims fail before any
configuration change. Open a new terminal after installing Codex.

For a Windows checkout in a deep folder, use repository-local long-path support:

```sh
git clone --config core.longpaths=true https://github.com/BEACNpool/NFT-Studio.git
```

Some archived research filenames are long. Check clone/checkout warnings even if
Git returns success; a partially checked-out research corpus is not a clean
installation. This option changes only the new repository's Git setting.

The Studio fee is **0 ADA**. Network fees still apply; minimum ADA kept with an
NFT remains in the user's output. An AI subscription does not fund the wallet.

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
| `search_cip_sources` / `get_cip_source_chunk` | Bounded id/title/status search across 148 pinned originals and exact UTF-8 source chunks with attribution |
| `search_knowledge` / `read_knowledge` | Bounded, cited knowledge lookup with standard status and implementation maturity |
| `validate_payload` | Exact file bytes, MIME signature/UTF-8 checks, canonical embedded URIs, SHA-256 and data metadata measurement |
| `validate_metadata` | Ledger-safe JSON subset validation and actual auxiliary CBOR size/hash |
| `create_proof_record` / `verify_proof_record` | Proposed CIP-190 public hash records and exact-byte verification, with raw record/metadata CBOR exports |
| `create_mobile_handoff` / `revoke_mobile_handoff` | Native encrypted 15-minute phone transfer, visible terminal QR text plus SVG, exact-content read-back, and creator revocation |
| `create_mint_intent` / `verify_mint_intent` | Deterministic file packet for visible browser review |
| `create_music_release` / `verify_music_release` | Canonical files-and-credits package for the Music release lab |
| `apply_state_capsule_parameters` | Apply exact seed/name parameters to the pinned experimental program and export its blueprint and identity |
| `prepare_unsigned_transaction` | Actual unsigned transaction, identity, fee, outputs, protocol quote and review expiry |
| `prepare_unsigned_music_transaction` | Stateless unsigned music NFT with complete package/credit identity, actual metadata and value checks; no retained Node packet |
| `verify_signed_transaction` | External witness verification, unchanged body/metadata and complete signed size/fee check; signed CBOR returned to caller |

Resources expose `nft-studio://capabilities`, a knowledge index, each allowed knowledge entry, and the fixed `nft-studio://implementations` register. Knowledge entries keep their original research status; sibling implementation IDs link to separately scoped evidence. The live verifier checks that the returned register matches the exact release source, all linked entries resolve, and unrelated entries have empty links. It does not fetch evidence URLs or rerun their recorded experiments. Tools accept file **bytes as canonical base64**, not local paths, network URLs or commands. They never execute HTML or imported programs.

Image, music, game, app, motion and file/data payloads use the shared compact packager. A new package has at most eight files and **12,000 total raw bytes**; NFT mode requires an image cover. Full signed transactions must also fit live network limits and the Studio's **16,384-byte** cap, so some payloads need to be smaller. The builder charges no platform fee and rejects network fees above **2 ADA**.

Scroll and Book use different protocols and remain browser creators. Some existing trusted catalogue programs exceed the new-package bound and retain their existing browser paths. This MCP does not claim CIP-68 updates, one-shot mint policies, token-gated utility, or arbitrary Plutus transaction support. Search the knowledge base for their actual status and prerequisites.

## Intent → visible browser review

1. Call `create_mint_intent` with `mode`, `name`, optional `description`, `files`, and optional `coverIndex`.
2. Retain the returned `packetJson` as its suggested `.intent.json` fallback file.
3. Open the exact returned `review.url`. Its `#mint=v1.` fragment contains unpadded base64url UTF-8 canonical intent JSON; the query selects **Labs → Agent minting**. Studio clears a recognized fragment from the current history entry before parsing and checking it, then shows its content for review. No manual import is needed for this path.
4. Inspect its title, description, exact files and hashes. Explicitly continue to wallet review.
5. The browser builds afresh with the user's connected wallet, then follows the existing signing, submission and receipt flow.

The review link contains the same content as the request file. Share it only
with intended reviewers. URL fragments are not sent in HTTP requests or Referer
headers, but the link is visible to your MCP client, agent, browser and anyone
you give it to; clearing current history is not a promise to erase copies or
browser synchronization. No URL shortener or third-party upload is used.

Decoding accepts only canonical unpadded base64url, strict UTF-8, canonical
intent JSON and matching file/content hashes. Bounds are 80,000 decoded bytes
and 106,700 fragment characters. Malformed recognized links clear and display
an error; unrelated fragments are ignored. Requests have no expiry because they
contain content, not transaction authorization. The browser builds a fresh
transaction and performs its existing wallet, fee and validity checks.

The packet contains no wallet address or transaction. Its hash binds content,
not authorship or approval. A valid packet does not prove that its artwork or
code is trustworthy; imported HTML stays inert in Studio previews. Opening any
link never connects a wallet, signs, submits or establishes chain confirmation.

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

## Music and contract packages

`create_music_release` creates a `beacn.music-release.v1` package containing exact
artwork/audio bytes and validated credits. Save the returned `packetJson` exactly
as `filename`; `review.url` opens **Labs → Music release**. Use
`verify_music_release` with that canonical packet to check the complete package.
The server receives the supplied files and credits, including any inert credit
links. It does not fetch those links. The browser rebuilds the transaction from
the reviewed package and the connected wallet. The ordinary unsigned tool
does not accept music packages. See [the music tool contract](../mcp/MUSIC_PACKAGES.md)
and [the metadata profile](MUSIC_RELEASE.md) for exact arguments and limits.

The dedicated `prepare_unsigned_music_transaction` accepts canonical `packetJson`
and an explicitly authorized wallet snapshot. It builds actual unsigned native
music CBOR, checks complete files and credits against the transaction metadata,
and shares ordinary preparation's two-slot limit and value checks. Its Node and
Worker contract is stateless: no `packetId`, retained preparation or compatibility
with the Node stored-witness verifier. Save the original package for fresh browser
wallet review, or independently verify the complete transaction before using an
external signer. See [unsigned music preparation](../mcp/MUSIC_UNSIGNED.md).

`apply_state_capsule_parameters` accepts only the fixed Capsule program's
`seed: {transactionId, outputIndex}` and `baseName`. It returns deterministic
compiled bytes, a Plutus V3 policy/script hash, paired asset names and the applied
blueprint. The exact program matched the pinned Aiken CLI across 256 parameter
cases. This tool performs no seed lookup, wallet access, transaction preparation
or node evaluation. A returned identity does not establish an existing or usable
mint. See [the parameter contract](../mcp/CAPSULE_PARAMETERS.md).

## External wallet integration with the Node service

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

Node preparations and wallet snapshots exist only in process RAM, with random packet IDs, a four-minute lifetime, a 64-packet cap and periodic cleanup. Restarting the process invalidates IDs. A shared HTTP bearer token identifies one operator context; do not use a single token as a multi-tenant identity system. Run separate processes/tokens or add independently reviewed principal isolation for multiple customers.

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

## Public Worker with stateless unsigned preparation

The [dated public verification receipt](MCP_PUBLIC_VERIFICATION.json) records the running tool/resource inventory and the exact checks made against that deployment. Other operators must verify their own deployments; a successful local build does not update a hosted service.

`prepare_unsigned_transaction` prepares native NFT/data transactions. `prepare_unsigned_music_transaction` uses the separate canonical music package. Both return stateless unsigned transactions; the endpoint's discovery and release receipt determine its enabled capabilities.

`mcp/dist/worker.mjs` exports `createPublicMcpHandler`. It uses web APIs and the pinned CSL 17 browser WASM, with **no Node compatibility requirement**. The adjacent `cardano_serialization_lib_bg.wasm` must be uploaded as a **compiled Worker module**, not served only as a static asset. The build extracts and verifies this exact binary from the pinned package. Keep both files together. See [WASM packaging evidence and limitations](../mcp/integration/WASM_DEPLOYMENT.md).

The public unsigned tool accepts precisely the same `{intent, wallet: {changeHex, utxos}}` shape shown above. Its response is `nft-studio.stateless-unsigned.v1`: actual `unsignedHex`, `bodyHex`, transaction hash, exact selected input references, required payment-key hashes, outputs and minimum ADA, fee and signed-size estimate, metadata/auxiliary commitment, native policy identity, fresh protocol parameters and validity. It returns **no packet ID** and stores no preparation. `verify_signed_transaction` remains exclusive to the full Node service; it cannot verify this public response using an invented packet ID. An external signer must independently verify the complete signed body, witnesses, fee and current chain inputs. Alternatively, import the original intent into Studio for a fresh browser build.

| Contract | Public Worker | Full Node service |
| --- | --- | --- |
| Tools in this source revision | 19, including native mobile QR handoff and stateless unsigned preparation | 21, additionally including metadata measurement and stored ordinary-transaction witness verification |
| Wallet snapshot limit | 32 UTxOs; 16 KiB each; 32 KiB aggregate; 512 native assets | Ordinary: 128 UTxOs, 16 KiB each, 128 KiB aggregate. Music: same limits as Worker. |
| Caller CBOR preflight | 4,096 nodes and depth 16 before CSL | Same preflight for UTxOs and external witness sets |
| Preparation state | None | Ordinary: RAM packet cache, four-minute TTL, 64 packets. Music: none. |
| Chain input ownership/unspent proof | Not checked | Caller snapshots, plus payment signatures at witness verification; unspent state not checked |
| Signing/submission | No tools | No tools |

Public preparation arguments are capped at **88 KiB**, within the transport's **96 KiB** complete JSON-RPC frame cap. Only canonical mainnet key payment addresses and ordinary UTxOs without datum/reference scripts are accepted. Duplicate input references, unsupported policy/recipient/URL overrides, malformed or structurally excessive CBOR, oversized asset inventories and tampered intents reject before fetching parameters. All outputs return to the supplied change address; value conservation, exact body/auxiliary commitments, current minimum ADA, the 16,384-byte signed-size estimate and 2 ADA fee cap are checked. Signed size remains an estimate until external witnesses are inspected.

The new tool receives wallet addresses and complete supplied UTxO CBOR. Supply a snapshot only with the wallet user's authorization. It does not connect to wallets, read private files, establish ownership, prove inputs unspent, sign or submit. It fetches only fixed read-only Koios `/tip` and latest `/epoch_params` URLs from the Studio provider; no supplied content, wallet address, UTxO or caller header enters those requests. Each response is capped at 64 KiB; redirects, malformed UTF-8/JSON, stale tip data, inconsistent epochs and invalid parameters reject. Two preparations may run at once, with a ten-second provider deadline. A failed request releases capacity.

The mobile tools use the fixed Studio relay to create, verify or revoke an explicitly requested encrypted transfer. The remaining content and research tools make no network requests. Proof records remain exports; the unsigned native builder does not attach their label-309 metadata automatically. Neither public tool set supplies custodial signing, chain inclusion, arbitrary Plutus transactions or a paid multi-tenant account system.

An operator can wrap the module in an existing HTTPS Worker:

```js
import { createPublicMcpHandler } from './mcp/dist/worker.mjs';

const mcp = createPublicMcpHandler({
  publicOrigin: 'https://your-public-host.example',
  endpointPath: '/api/mcp',
  studioUrl: 'https://beacnpool.github.io/NFT-Studio/',
  allowedOrigins: [
    'https://your-public-host.example',
    'https://beacnpool.github.io'
  ]
});

export default { fetch: request => mcp.fetch(request) };
```

The placeholder is not a deployed endpoint. `endpointPath` defaults to `/mcp`; the existing Sites wrapper uses `/api/mcp` because the front dispatcher reserves `/mcp`. The exact `Request.url.origin` is authoritative for Worker routing; proxy-internal raw Host cannot override it. The Node listener separately checks raw Host. Browser origins use an exact HTTPS allowlist, including the standard SDK request headers; nonbrowser callers may omit Origin.

Public requests need no bearer token. The handler transforms only explicitly supplied data and makes the fixed protocol reads and requested encrypted mobile transfers described above. It does not log request bodies. Explicit mobile handoffs store AES-GCM ciphertext on the fixed Studio relay for 15 minutes; their decryption key stays in the phone URL fragment. Hosting-provider infrastructure can retain operational metadata. Do not send secrets. Intent review URLs contain the supplied content in their fragment. Native phone URLs contain a temporary content decryption key in their fragment.

The Worker rejects invalid UTF-8/JSON, batches, compressed content, URL queries and non-MCP paths. It allows eight concurrent requests, bounds body reads to ten seconds, and enforces 120 requests/minute **per isolate**. Isolates restart and scale independently; this is a best-effort local bound, not a durable global quota. Platform-level controls are required for a shared global quota.

`npm --prefix mcp test` exercises all public tools in actual Workerd without Node compatibility, with modern and legacy official clients. It compares NFT/data/two-key unsigned output against Node CSL and tests schema/CBOR/asset/parameter/feed/concurrency/timeout failures. All network responses and wallet outputs in these tests are synthetic. The separate [wrapper verifier](../mcp/integration/README.md) checks the discovered tools alongside the actual application and byte-identical JavaScript, CSS and images. Deployment and actual public SDK verification remain separate release steps.

## Send to mobile with a QR code

After the preview, choose **Send to mobile (QR)** or ask “Send this to my phone.”
The agent calls `create_mobile_handoff` with the exact verified ordinary intent
and displays its QR, complete HTTPS phone link and expiry. This uses the same
15-minute encrypted transfer as **Continue on phone → Create QR code** in Studio.
The local-file helper supports `--mobile` and saves PNG/SVG QR images and a phone
review page. Opening the link grants no wallet permission.

See [the native mobile workflow](MOBILE_HANDOFF.md) for agent steps, saved files,
privacy, expiry and supported package limits.


## Public payload QR and mint options (MCP 0.4.0)

After preview, offer Add utility & mint options (`studio_utilities`, then
`configure_mint_options`) and Print & share payload QR (`create_payload_qr`).
Use one short question at a time and retain preferences already supplied.
Copies are 1–1,000 units in this transaction, not a lifetime cap or shared edition.
Policy duration starts at transaction preparation. CIP-25 traits and a CIP-20
message are public descriptions, not enforced benefits. Apply options to the
canonical intent before creating any QR; v2 binds all choices in its hash.

BEACN Payload QR embeds small public content with no transfer expiry, upload or
revocation; 2,331 encoded URL bytes maximum. This is distinct from the existing
15-minute encrypted `create_mobile_handoff` for private phone continuation.
Local-file helper: `--payload-qr` for print PNG/SVG and link; `--mobile` for relay.
Never substitute an uploaded link when an embedded payload exceeds capacity.
Docs: https://github.com/BEACNpool/NFT-Studio/blob/main/docs/PAYLOAD_QR.md and
https://github.com/BEACNpool/NFT-Studio/blob/main/docs/MINT_OPTIONS.md .
