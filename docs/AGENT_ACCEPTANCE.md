# Agent minting acceptance

**Release gate open: a real wallet signing and confirmed on-chain mint remain
unverified. Promotion stays on hold.** This record distinguishes the working
agent handoff from the remaining live acceptance step.

The intended journey is: install the local MCP and repository skill → describe
a supported compact NFT → open the agent's exact review link → inspect its
content → connect a compatible browser wallet → review and approve the mint →
verify the confirmed receipt. The [setup page](https://beacnpool.github.io/NFT-Studio/mcp/)
is an installation guide; it is not a hosted MCP endpoint.

## Observed on 2026-09-07

| Stage | Evidence | Result |
| --- | --- | --- |
| Clean MCP dependency install and build | [Codex receipt](../experiments/agent-acceptance/codex/codex-acceptance-20260907.json) | Passed without root or ancestor dependencies; 17 tools and 61 resources discovered. |
| Codex installation and repository skill | [Codex report](../experiments/agent-acceptance/codex/CODEX_ACCEPTANCE.md) | Actual CLI installation and repeat-run no-op passed. Codex read the project skill without its body being pasted into the prompt. |
| Native Windows installation | [Windows observation](../experiments/agent-acceptance/windows-install/README.md) | Actual Node 24.14.0 / Codex 0.153.4 npm launcher installed the MCP and repeated as a no-op; 17 tools / 61 resources and ten focused tests passed. Two long-path archive omissions were repaired and hash-verified. This observation includes no model inference or wallet. |
| Natural-language creation | Same Codex receipt | A real Codex CLI 0.153.4 session using an existing ChatGPT login created a 200-byte spaceship SVG, called the MCP to package and verify it, and returned the complete direct review link. Exact bytes and identities were independently checked. |
| Larger prepared media | [Original flag/music example](../experiments/labor-day-worker-demo/README.md) and [Codex materialization](../experiments/labor-day-worker-demo/evidence/codex-materialization.json) | Actual Codex ran the local-file helper to package 8,146 bytes through three real SDK MCP calls and save the exact 15,684-character link. This used prepared assets and a shell command; it did not prove fresh music composition by the model or model-side base64 copying. |
| Windows agent helper invocation | [Observed policy gate](../experiments/agent-acceptance/windows-helper/README.md) | The aligned checkout passed 16 focused Windows tests, but unattended Codex was blocked by execution policy before running the helper. No output was created; the outer verifier rejected the model's placeholder final JSON. Interactive Windows agent acceptance remains open. |
| Browser review, consent, signing, submission and receipt | [Synthetic browser report](../experiments/agent-acceptance/browser/public-verification.json) | Twenty scenarios passed at 1440- and 390-pixel widths. The wallet, signing keys and provider responses were synthetic; no real transaction was submitted. |
| Development-mode request recovery | [StrictMode regression](../experiments/agent-acceptance/strictmode/README.md) | Seven React development cases reproduce the original lost-link bug and verify its fix, supersession, Clear, invalid input and unmount. The real component and codec run with inert UI/wallet substitutes. |
| No Studio fee | [CBOR/value review](../experiments/agent-acceptance/browser/REVIEW.md) and [oracle](../experiments/agent-acceptance/browser/oracle.mjs) | The ordinary native builder sends all outputs to the connected wallet. Actual fixture CBOR preserved ADA and existing native tokens with 0 ADA platform fee. |
| Named wallet and real-chain result | No receipt yet | Pending user wallet acceptance, inclusion and independent asset/content/destination verification. |

The original dated receipts preserve their own scope and exact candidate hashes.
The [source association](../experiments/agent-acceptance/source-association/README.md)
checks which current files match the Codex inputs and records the two additive
capability fields separately; it does not rewrite the original receipt.
The browser receipt alone did not test Codex; the separate Codex receipt supplies
that evidence. Neither establishes live chain inclusion. The final portable
browser harness was rerun against the corrected component and export; see its
[reproduction instructions](../experiments/agent-acceptance/browser/README.md).

## What the first release supports

The direct link carries an ordinary `nft-studio.intent.v1` request. Supported
packages contain up to eight files and 12,000 total raw bytes, with an image cover
for an NFT. Complete signed-transaction fit is checked later with the wallet.
Dedicated music release packets retain their Music Lab import workflow. Scrolls,
Books and larger catalogue programs use their browser creators.

Opening a review link connects no wallet and authorizes no signature. Its content
is in the URL fragment and is removed from the current history entry before
asynchronous verification. The fragment is not sent in the HTTP request, but the
agent, browser and anyone given the complete link can read the content. It is not
an encrypted or private publication channel.

The ordinary mint has **0 ADA Studio platform fee**. Cardano network fees still
apply, and minimum ADA stays with the NFT in the user's output. An AI subscription
does not fund those costs. The signature-plus-expiry native policy mints one token
in this transaction; it does not establish permanent one-of-one supply while the
policy remains open.

## Finish the live gate

Use the exact verified agent request in a browser with the chosen wallet. Record
the wallet name/version, selected Cardano network, displayed output and costs,
user approval, expected transaction hash and resulting receipt. After submission,
observe inclusion and independently verify the policy, exact asset name, quantity,
destination and reconstructed media against the request. If submission is
uncertain, inspect the recorded hash; do not submit a replacement to resolve it.

Publish a sanitized acceptance receipt with the tested software commit and wallet
version before removing the hold in [the announcement draft](ANNOUNCEMENT.md).
Only claim the clients, operating systems, formats and wallet versions actually
covered by evidence.
