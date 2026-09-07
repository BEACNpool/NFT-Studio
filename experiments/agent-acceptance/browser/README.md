# Synthetic agent-to-wallet acceptance candidate

Twenty scenarios passed at 2026-09-07T16:02:27.760Z using an owned loopback server over a copied Pages export and the actual local MCP stdio entry point. This is private staging evidence. **The user’s live release gate is still open.** No real wallet extension, Codex subscriber authentication, fresh dependency installation or live chain inclusion was exercised.

The two successful viewports (1440 and 390) each consumed a fresh `create_mint_intent` response, used its exact ordinary-intent fragment (with only the configured origin adapted to loopback), inspected the inert files, connected a synthetic CIP-30 wallet, displayed a separate fixture signing prompt, signed with an ephemeral synthetic key, invoked a submission stub once, and downloaded an exact receipt after a mocked inclusion response. Confirmation screenshots are explicitly synthetic. The application build and shared mint code were unchanged.

Actual signed sizes/network fees were 1,827 B / 235,945 lovelace on desktop and 1,826 B / 235,901 lovelace on phone; different fixture titles explain the byte difference. Every output returned to the supplied synthetic address, all supplied native tokens were preserved, and input ADA equalled outputs plus the ledger fee. The visible Studio fee row said 0 ADA. The separate ambiguous-response scenario confirmed the expected hash via the stub without another submission.

## Reproduce

Requirements: Node 22.13+, Chromium, the tested repository frontend export and installed MCP dependencies, plus an installed `puppeteer-core`. Use an isolated copy of the built Pages export; the harness binds its own ephemeral loopback port and closes its own server, browser and stdio child. It never connects to a production provider.

```sh
STUDIO_SOURCE=/absolute/path/NFT-Studio \
MCP_ROOT=/absolute/path/NFT-Studio/mcp \
STUDIO_DIST=/absolute/path/held-pages-export \
PUPPETEER_PACKAGE_ROOT=/absolute/path/package-with-puppeteer-core \
CHROMIUM_EXECUTABLE_PATH=/absolute/path/chromium \
node run.mjs
```

The harness records and checks ten source/build hashes before and after the run and hashes all 14 actual served files. It reads existing dependencies; it does not constitute a clean install test. The portable harness defaults source to the current working directory, writes new output under the OS temporary directory, and accepts ACCEPTANCE_OUTPUT_PARENT for a chosen existing private output directory. Set the documented dependency/browser paths explicitly for your installation. This portable harness was actually run for the final 20-scenario result. The prior frozen receipts remain separate historical evidence. No root package/CI/source edits are needed to review this kit. Root can choose how to integrate the private acceptance script after review.

## Scope and limits

`oracle.mjs` independently reconstructs the expected intent and metadata from explicit original inputs, derives SHA-256 identities with Node crypto, and derives raw body, auxiliary data and native policy BLAKE2b commitments with noble. CSL17 parses CBOR and verifies the actual signature; it is shared with production, so this is not a wholly independent CBOR/signature implementation or a ledger evaluator. It also checks the sole mint, exact file recovery, outputs, min-ADA, ADA and token sums, signed size and fee, preserved body/aux bytes, and absent unexpected transaction actions.

The private synthetic wallet is an injected CIP-30 fixture with visible connect/sign approve/reject prompts. It is not VESPR, Eternl, Lace, an installed extension or a browser-wallet compatibility claim. Ephemeral generated fixture keys never leave process memory. No real UTxO, model-provider key, private wallet key or chain submission exists in this run.

A delayed SubtleCrypto promise is used in one case to prove fragment removal happens before validation resolves. A Clear request app action is dispatched on the real Clear button while the synthetic prompt is open; it is not a native pointer click through a modal. The separate packet-age behavior is intentional: content requests have no expiry; the stale case tests the four-minute transaction review. Unknown fragments are preserved. All protocol/status requests are intercepted before network and receive fixed synthetic responses. The full report retains those counts.

The first run stopped because a Chromium debug request object retained the fragment; the corrected privacy assertion inspects actual HTTP request paths and Referer headers. The next run stopped because an unscoped `.ns-payload-review` selector found a kept-mounted different Lab; the final harness scopes it to `.ns-lab-agent`. These were harness corrections, not production fixes. Earlier failure receipts remain outside this frozen candidate.

## Remaining live release evidence

Keep promotion on hold until the actual Codex subscriber path installs the repo-local MCP without a separate model-provider API key, describes a supported ordinary NFT, obtains and opens the returned review link, connects the chosen real wallet in its supported browser, reviews the exact transaction and explicitly approves within the user-authorized budget, submits once, and observes real inclusion. Verify real transaction identity, output destination, exact media/metadata, native token/ADA conservation and absence of a Studio fee independently from the chain receipt. A fixed reader’s inclusion observation can change with the chain; it is not irreversible finality.

## Final setup followup

`setup-evidence/` independently checks the final static setup HTML, SHA-256 `290996b7a7926c6f674f1f57915a0fbdc543dd13d9ace89ec2893a6da58a805c`, at 16:03:54.422Z. The generic-client disclosure is 45.59375px tall at both widths, with a 3px focus outline and added space before the path note. Native keyboard expansion/collapse and no overflow/errors were observed. Actual installer/copy/download checks were not repeated in this CSS-only followup; the prior 51-case page receipt supplies that separate scope.

The final source includes the root-owned effect handling fix. This suite runs the production build; it does not claim to exercise development StrictMode effect replay. That edge check is separate. The later static setup-page margin change touched no file served by the 20-scenario Agent flow.
