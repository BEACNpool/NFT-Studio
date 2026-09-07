# Read-only CIP drift monitoring

The knowledge catalog is a reviewed snapshot. `cip-drift.mjs` compares its pinned official CIP sources with one freshly resolved upstream HEAD and produces a JSON report. It does not edit the catalog, update dependencies, promote implementation claims, or open issues or pull requests.

Run with Node 22 or later; no npm install or credentials are required:

```sh
node knowledge/verify-cip-drift.mjs
node knowledge/cip-drift.mjs --online > cip-drift-report.json
```

The checker calls the fixed official repository's [get-commit endpoint](https://docs.github.com/en/rest/commits/commits#get-a-commit) once, using its SHA response format to resolve `HEAD`. All subsequent source URLs include that same full commit. This avoids comparing documents fetched from different moving branch revisions. GitHub's response supplies repository identity over HTTPS; this tool does not independently authenticate maintainer signatures or assert commit ancestry.

Only paths already present in the validated catalog under `cardano-foundation/CIPs` are eligible. The current snapshot contains 40 CIP README files and seven supporting CDDL/registry/JSON schema files. The 26 other implementation and tool sources appear explicitly in `skipped`; this report says nothing about their freshness. It also does not discover new CIPs, unmerged proposals, linked external files, releases, deployed contracts or wallet support.

Each eligible result records its old commit, SHA-256 and declared status alongside the newly resolved immutable URL, actual byte count and SHA-256. README status comparison reads one ordinary `Status` field from bounded frontmatter. Supporting schemas and registries receive a byte comparison and `not-applicable-supporting-artifact` for status; their catalog classification is not presented as an upstream CIP status.

The earlier committed [sample report](../CIP_DRIFT_SAMPLE.json) completed at 2026-09-07T05:08:19.217Z against commit `05ee6bb05982289dbe00c4187b9d54cf90e2e276`: 40 unchanged sources, zero errors and ten explicitly skipped non-CIP sources. This receipt records that check only; it is not a claim of perpetual freshness.

`summary.changed` counts readable sources whose bytes or status differ. `shaChanged` and `statusChanged` are separate counts. Missing files, transport errors, unreadable status, unsafe paths and an unresolved HEAD produce incomplete findings. A 404 is not treated as evidence that a proposal was withdrawn. Even a status transition to Active supplies no new implementation or interoperability evidence for NFT-Studio.

Exit code 0 means the eligible checks completed, including when drift was found. Read `reviewRequired`, the counts and individual records to see whether review is needed. Exit code 1 means the run was incomplete or its catalog invalid; exit code 2 means incorrect CLI arguments. An incomplete result must not be displayed as an unchanged or current knowledge base.

The request profile is fixed: unauthenticated HTTPS GET, no redirects, no caller-selected URL or path, four concurrent source requests, a 20-second deadline per request and a 180-second complete-run deadline. The HEAD body is limited to 1 KiB, each source to 1,000,000 bytes and the status header window to 16 KiB. The catalog validator caps sources at 256. Response bodies and arbitrary transport exception text are excluded from error reports. A tool failure may reflect rate limiting or a network problem and should be retried or reviewed independently.

## Optional GitHub workflow

`.github/workflows/knowledge-drift.yml` can be included after review. It runs manually or Mondays at 09:17 UTC, tests the offline fixtures, and saves only a JSON report artifact for 30 days. It has `contents: read`, no persisted checkout credentials, no API token passed to the checker, and no comments, messages, repository writes, deployment or automatic admission. The action commits are pinned to the official v4 tag resolutions observed on 2026-09-07. GitHub may delay schedules; [scheduled workflows run from the default branch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Keep only `workflow_dispatch` if scheduled execution is unwanted.

Review the report's immutable sources, compare the changed text, then follow the [admission policy](../ADMISSION.md) in a separate reviewed change. Refreshing catalog hashes without revisiting affected factual summaries defeats the purpose of the snapshot.

## Verification

The six deterministic test groups include original unchanged/content-change/status-change/missing-HTTP/malformed-HEAD fixtures; supporting schema bytes; a single revision across every eligible source request (47 in the current snapshot) with the four-request concurrency bound; rejected paths and invalid catalogs; HTTP errors, redirect rejection, streamed and declared byte limits, timeout error classification; and missing, duplicate or malformed status frontmatter. Tests assert that serialized catalog data is unchanged and exercise no live network requests.
