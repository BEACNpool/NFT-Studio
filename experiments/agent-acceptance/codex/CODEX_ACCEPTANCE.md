# Codex acceptance: verified request and browser handoff

A real Codex CLI 0.153.4 session, authenticated through an existing ChatGPT login,
used the local NFT-Studio MCP to create a 200-byte spaceship SVG and verify its
mint intent. The agent discovered the repository's `$nft-studio` skill, followed
its separate music workflow and complete-link instructions, and returned the
complete 1,092-character review link. An independent checker decoded that link
and compared its canonical intent, package identity, file bytes and hashes.

The [machine-readable receipt](./codex-acceptance-20260907.json) identifies the
exact source hashes and limits. The runtime changes and skill were pending over
the receipt's base commit when tested. Raw CLI, MCP and syscall traces remain
private; they contain local execution details and are not needed to use Studio.

The clean source fixture installed dependencies only under `mcp/`, then built and
discovered 17 tools and 61 resources. Six invalid-request checks passed. The
installer's collision, CLI-error and Node-version checks passed. An actual
user-scoped installation succeeded; repeating it preserved the same setup.

## Reproduce the setup

Use Node.js 22.13 or newer and a working Codex CLI login. From the cloned repository:

```sh
npm --prefix mcp ci
npm --prefix mcp run build
node mcp/install-codex.mjs --check
node mcp/install-codex.mjs --install
codex
```

In the new Codex session, ask `$nft-studio` to create a small spaceship SVG NFT,
verify the request and provide **Review and mint in NFT-Studio**. Codex reads
repository skills from `.agents/skills`; it also receives this MCP's workflow
instructions during initialization. The installer copies no global skill.
See the official [MCP configuration guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
and [skills guide](https://learn.chatgpt.com/docs/build-skills).

The installer adds one named local stdio server. It refuses different existing
settings, including tool filters, instead of replacing them. It does not grant
wallet access. To remove this server, run `codex mcp remove nft-studio`.

## What remains a user action

This acceptance stops at a verified request. The user still opens the review
link, checks the content, connects a compatible browser wallet, reviews the
transaction and approves signing and submission. Chain inclusion must then be
observed before calling it a confirmed mint. No wallet, transaction, signature,
submission or chain inclusion was exercised by the agent harness.

NFT-Studio charges 0 ADA platform fee. Cardano network fees still apply, and
minimum ADA remains with the NFT in the user's output. A Codex subscription does
not pay those costs. This was one controlled Linux test with an existing ChatGPT
session; Windows, macOS, new-account enrollment and every client/model were not
tested. The private harness saved exact returned files; the receipt does not
claim the agent itself wrote them through a filesystem tool.
