# Windows agent execution gate

The clean published `91e25773` checkout passed **16 focused Windows tests**,
MCP discovery (17 tools / 61 resources) and repeat installation as a no-op.
The public demo and recording handoff were staged and hash-verified.

The actual unattended Codex 0.153.4 prepared-file attempt was then **blocked by
Codex execution policy before the local helper ran**. There were no completed
command/tool events and no output directory. The specific observation is
preserved in [the sanitized receipt](blocked-attempt.json).

The success-only test output schema could not represent a failure. Codex
acknowledged the block in prose but emitted zero hashes in the final JSON. The
outer verifier rejected that response; it is not a valid intent or evidence of
execution. Future acceptance schemas must represent blocked/error outcomes and
require independently observed outputs before accepting success.

No policy, sandbox, saved client setting, GUI or wallet was changed to force
execution; no retry occurred. This receipt does not diagnose the exact underlying
policy rule. Actual interactive Windows Codex acceptance remains open.

The [separate Linux Codex helper run](../../labor-day-worker-demo/evidence/codex-materialization.json)
passed within its stated scope. The published Studio content review and direct
Windows helper tests also remain valid. A prepared review file can be used for
manual rehearsal, but it does not establish that the blocked agent executed.
Wallet approval and confirmed chain inclusion are still separate required steps.
