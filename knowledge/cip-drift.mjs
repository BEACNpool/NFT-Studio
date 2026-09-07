/** Read-only, bounded drift checks against one immutable official CIPs revision. */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateCatalog } from './lib.mjs';
import { loadCatalog } from './node.mjs';

export const CIP_DRIFT_HEAD_URL =
  'https://api.github.com/repos/cardano-foundation/CIPs/commits/HEAD';
const REPOSITORY = 'https://github.com/cardano-foundation/CIPs';
const RAW_PREFIX = 'https://raw.githubusercontent.com/cardano-foundation/CIPs/';
export const CIP_DRIFT_LIMITS = Object.freeze({
  headBytes: 1024,
  sourceBytes: 1_000_000,
  frontmatterBytes: 16_384,
  requestMilliseconds: 20_000,
  runMilliseconds: 180_000,
  concurrency: 4,
  sources: 256,
});

class DriftError extends Error {
  constructor(code, message, httpStatus) {
    super(message);
    this.code = code;
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
  }
}
function issue(error) {
  // Do not expose arbitrary transport exception text, headers, response bodies or credentials.
  if (error instanceof DriftError)
    return {
      code: error.code,
      message: error.message,
      ...(error.httpStatus === undefined
        ? {}
        : { httpStatus: error.httpStatus }),
    };
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
    return {
      code: 'TIMEOUT',
      message: 'The bounded request or complete-run deadline expired.',
    };
  return {
    code: 'NETWORK_ERROR',
    message:
      'The fixed upstream request failed; no response content was trusted.',
  };
}
function sourcePath(source) {
  // All fetch destinations are constructed here, never taken from response content.
  if (!source.rawUrl.startsWith(RAW_PREFIX)) return null;
  const prefix = `${RAW_PREFIX}${source.sourceCommit}/`;
  if (!source.rawUrl.startsWith(prefix))
    throw new DriftError(
      'UNSAFE_SOURCE_PATH',
      'The source URL does not match its pinned official repository commit.',
    );
  const path = source.rawUrl.slice(prefix.length);
  if (
    path.length > 240 ||
    !/^CIP-\d{4}\/(?:[A-Za-z0-9_-]+\/){0,4}[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:md|cddl|json)$/.test(
      path,
    )
  )
    throw new DriftError(
      'UNSAFE_SOURCE_PATH',
      'The pinned CIP path is outside the reviewed README, schema and registry path profile.',
    );
  return path;
}
async function readBounded(fetchImpl, url, maxBytes, signal, accept) {
  signal.throwIfAborted();
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'error',
    credentials: 'omit',
    cache: 'no-store',
    signal,
    headers: {
      Accept: accept,
      'Cache-Control': 'no-cache',
      'User-Agent': 'BEACN-Labs-CIP-Drift',
      ...(url === CIP_DRIFT_HEAD_URL
        ? { 'X-GitHub-Api-Version': '2022-11-28' }
        : {}),
    },
  });
  if (response.redirected || (response.url && response.url !== url)) {
    await response.body?.cancel().catch(() => {});
    throw new DriftError(
      'REDIRECT_REJECTED',
      'The fixed upstream destination redirected.',
    );
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new DriftError(
      'HTTP_ERROR',
      'The fixed upstream source was unavailable.',
      response.status,
    );
  }
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    await response.body.cancel().catch(() => {});
    throw new DriftError(
      'RESPONSE_LIMIT',
      'The response exceeds its byte limit or has an invalid length header.',
    );
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes)
        throw new DriftError(
          'RESPONSE_LIMIT',
          'The streamed response exceeds its byte limit.',
        );
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, bytes);
}

/** Deliberately parses only a single ordinary CIP Status field, not arbitrary YAML. */
export function readCipStatus(bytes) {
  let text;
  const prefix = Buffer.from(
    bytes.subarray(0, CIP_DRIFT_LIMITS.frontmatterBytes),
  );
  let close = prefix.indexOf('\n---');
  while (close !== -1 && ![undefined, 10, 13].includes(prefix[close + 4]))
    close = prefix.indexOf('\n---', close + 1);
  // Only frontmatter needs decoding. A multibyte code point cut at the body window
  // boundary must not turn an otherwise readable status into a parsing failure.
  const header = close === -1 ? prefix : prefix.subarray(0, close + 4);
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      header,
    );
  } catch {
    throw new DriftError(
      'STATUS_UNREADABLE',
      'The bounded frontmatter is not valid UTF-8.',
    );
  }
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match)
    throw new DriftError(
      'STATUS_UNREADABLE',
      'A complete CIP frontmatter block was not found within the status byte limit.',
    );
  const candidates = match[1]
    .split(/\r?\n/)
    .filter((line) => /^Status\s*:/.test(line));
  if (candidates.length !== 1)
    throw new DriftError(
      'STATUS_UNREADABLE',
      'The frontmatter must declare exactly one Status field.',
    );
  const status = /^Status: ([A-Za-z][A-Za-z0-9 ()/-]{0,239})\s*$/.exec(
    candidates[0],
  );
  if (!status)
    throw new DriftError(
      'STATUS_UNREADABLE',
      'The Status value needs manual review; this checker accepts only an ordinary bounded status string.',
    );
  return status[1].trim();
}

/** Dependency injection is for offline tests; CLI offers no destination/path override. */
export async function monitorCipDrift(
  catalog,
  { fetchImpl = globalThis.fetch, now = () => new Date() } = {},
) {
  validateCatalog(catalog);
  if (typeof fetchImpl !== 'function' || typeof now !== 'function')
    throw new TypeError('Invalid drift-check dependencies');
  const checkedAt = now().toISOString();
  const sources = [];
  const skipped = [];
  const results = [];
  for (const source of catalog.sources) {
    try {
      const path = sourcePath(source);
      if (path === null)
        skipped.push({
          id: source.id,
          reason:
            'Non-CIP repository source; outside this fixed official-CIPs monitor.',
        });
      else sources.push({ source, path });
    } catch (error) {
      results.push({
        id: source.id,
        outcome: 'rejected-source',
        error: issue(error),
      });
    }
  }
  const report = {
    schemaVersion: 1,
    kind: 'beacn.cip-drift-report',
    checkedAt,
    catalog: {
      asOf: catalog.asOf,
      sourceRevision: catalog.sourceRevision,
      entries: catalog.entries.length,
      sources: catalog.sources.length,
    },
    upstream: {
      repository: REPOSITORY,
      headEndpoint: CIP_DRIFT_HEAD_URL,
      commit: null,
      immutableCommitUrl: null,
    },
    limits: CIP_DRIFT_LIMITS,
    complete: false,
    reviewRequired: true,
    catalogModified: false,
    claimChangesApplied: false,
    summary: null,
    results,
    skipped,
    interpretation:
      'Content and declared-status drift only. Changes require human source review and separate implementation evidence. No claim, catalog entry, software dependency or capability is updated by this report.',
  };
  const deadline = AbortSignal.timeout(CIP_DRIFT_LIMITS.runMilliseconds);
  const requestSignal = () =>
    AbortSignal.any([
      deadline,
      AbortSignal.timeout(CIP_DRIFT_LIMITS.requestMilliseconds),
    ]);
  try {
    const body = await readBounded(
      fetchImpl,
      CIP_DRIFT_HEAD_URL,
      CIP_DRIFT_LIMITS.headBytes,
      requestSignal(),
      'application/vnd.github.sha',
    );
    const commit = body.toString('utf8').trim();
    if (!/^[a-f0-9]{40}$/.test(commit))
      throw new DriftError(
        'MALFORMED_HEAD',
        'The upstream HEAD response is not one full lowercase commit SHA.',
      );
    report.upstream.commit = commit;
    report.upstream.immutableCommitUrl = `${REPOSITORY}/commit/${commit}`;
  } catch (error) {
    report.upstream.error = issue(error);
  }
  const queue = [...sources];
  async function worker() {
    while (queue.length) {
      const { source, path } = queue.shift();
      const row = {
        id: source.id,
        path,
        pinnedCommit: source.sourceCommit,
        pinnedSha256: source.sha256,
        pinnedDeclaredStatus: source.declaredStatus,
        immutableSourceUrl: report.upstream.commit
          ? `${RAW_PREFIX}${report.upstream.commit}/${path}`
          : null,
        sha256: null,
        bytes: null,
        shaChanged: null,
        declaredStatus: null,
        statusChanged: null,
        statusComparison: path.endsWith('/README.md')
          ? 'pending'
          : 'not-applicable-supporting-artifact',
        outcome: 'not-checked',
      };
      results.push(row);
      if (!report.upstream.commit) {
        row.error = {
          code: 'HEAD_UNRESOLVED',
          message:
            'No source was fetched because a single immutable upstream HEAD could not be resolved.',
        };
        continue;
      }
      try {
        const body = await readBounded(
          fetchImpl,
          row.immutableSourceUrl,
          CIP_DRIFT_LIMITS.sourceBytes,
          requestSignal(),
          'text/plain, application/octet-stream',
        );
        row.bytes = body.byteLength;
        row.sha256 = createHash('sha256').update(body).digest('hex');
        row.shaChanged = row.sha256 !== source.sha256;
        if (path.endsWith('/README.md')) {
          row.declaredStatus = readCipStatus(body);
          row.statusChanged = row.declaredStatus !== source.declaredStatus;
          row.statusComparison = 'compared';
        }
        row.outcome =
          row.shaChanged || row.statusChanged ? 'changed' : 'unchanged';
      } catch (error) {
        row.error = issue(error);
        row.outcome =
          row.error.code === 'STATUS_UNREADABLE'
            ? 'status-unreadable'
            : 'unavailable';
        if (row.outcome === 'status-unreadable')
          row.statusComparison = 'unreadable';
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(CIP_DRIFT_LIMITS.concurrency, queue.length) },
      worker,
    ),
  );
  results.sort((a, b) => a.id.localeCompare(b.id));
  skipped.sort((a, b) => a.id.localeCompare(b.id));
  report.summary = {
    cipSources: results.length,
    unchanged: results.filter((row) => row.outcome === 'unchanged').length,
    changed: results.filter((row) => row.outcome === 'changed').length,
    shaChanged: results.filter((row) => row.shaChanged === true).length,
    statusChanged: results.filter((row) => row.statusChanged === true).length,
    errors: results.filter(
      (row) => !['changed', 'unchanged'].includes(row.outcome),
    ).length,
    skippedNonCipSources: skipped.length,
  };
  report.complete =
    Boolean(report.upstream.commit) && report.summary.errors === 0;
  report.reviewRequired = !report.complete || report.summary.changed > 0;
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.length !== 3 || process.argv[2] !== '--online') {
    console.error('Usage: node knowledge/cip-drift.mjs --online');
    process.exitCode = 2;
  } else {
    try {
      const report = await monitorCipDrift(loadCatalog());
      console.log(JSON.stringify(report, null, 2));
      if (!report.complete) process.exitCode = 1;
    } catch {
      console.log(
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: 'beacn.cip-drift-report',
            complete: false,
            reviewRequired: true,
            catalogModified: false,
            claimChangesApplied: false,
            error: {
              code: 'INVALID_CATALOG_OR_INPUT',
              message:
                'The fixed bundled catalog or checker input failed validation; no drift conclusion is available.',
            },
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
    }
  }
}
