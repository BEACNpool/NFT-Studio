import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  monitorCipDrift,
  readCipStatus,
  CIP_DRIFT_HEAD_URL,
  CIP_DRIFT_LIMITS,
} from './cip-drift.mjs';
import { loadCatalog } from './node.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/cip-drift.json', import.meta.url)),
);
const original = loadCatalog();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date('2026-09-07T12:00:00.000Z');
function catalog() {
  const value = structuredClone(original);
  value.sources = [
    value.sources.find((source) => source.id === 'cip-0001'),
    value.sources.find((source) => source.id === 'tool-aiken'),
  ];
  value.sources[0].sha256 = fixture.baselineSha256;
  value.sources[0].declaredStatus = 'Proposed';
  value.entries = [value.entries[0]];
  value.entries[0].relatedIds = [];
  return value;
}
let groups = 0;
async function test(name, action) {
  await action();
  console.log(`ok ${++groups} - ${name}`);
}
await test('six deterministic unchanged, changed, missing and malformed fixtures', async () => {
  assert.equal(hash(fixture.baselineBody), fixture.baselineSha256);
  for (const scenario of fixture.cases) {
    const value = catalog();
    const before = JSON.stringify(value);
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push(url);
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.Authorization, undefined);
      assert.ok(options.signal instanceof AbortSignal);
      if (url === CIP_DRIFT_HEAD_URL) return new Response(scenario.head);
      assert.equal(
        url,
        `https://raw.githubusercontent.com/cardano-foundation/CIPs/${scenario.head}/CIP-0001/README.md`,
      );
      return new Response(scenario.body, { status: scenario.status });
    };
    const report = await monitorCipDrift(value, { fetchImpl, now });
    const row = report.results[0];
    assert.equal(report.checkedAt, now().toISOString());
    assert.equal(report.complete, scenario.expected.complete, scenario.name);
    assert.equal(row.outcome, scenario.expected.outcome, scenario.name);
    assert.equal(report.catalogModified, false);
    assert.equal(report.claimChangesApplied, false);
    assert.equal(report.skipped[0].id, 'tool-aiken');
    assert.equal(report.summary.skippedNonCipSources, 1);
    assert.equal(calls.filter((url) => url === CIP_DRIFT_HEAD_URL).length, 1);
    for (const field of ['shaChanged', 'statusChanged'])
      if (field in scenario.expected)
        assert.equal(
          row[field],
          scenario.expected[field],
          `${scenario.name}:${field}`,
        );
    if (row.sha256 !== null) assert.equal(row.sha256, scenario.bodySha256);
    if (scenario.expected.errorCode)
      assert.equal(row.error.code, scenario.expected.errorCode);
    if (scenario.expected.httpStatus)
      assert.equal(row.error.httpStatus, scenario.expected.httpStatus);
    if (scenario.expected.headErrorCode) {
      assert.equal(report.upstream.error.code, scenario.expected.headErrorCode);
      assert.equal(calls.length, 1);
      assert.equal(row.immutableSourceUrl, null);
    } else
      assert.match(row.immutableSourceUrl, new RegExp(`/${scenario.head}/`));
    assert.equal(
      JSON.stringify(value),
      before,
      'Catalog must remain byte-for-byte unchanged as serialized.',
    );
  }
});
await test('supporting registry and CDDL bytes are checked without invented status fields', async () => {
  const value = catalog();
  value.sources.push(
    structuredClone(
      original.sources.find((source) => source.id === 'cip-0060-v3-cddl'),
    ),
  );
  const report = await monitorCipDrift(value, {
    now,
    fetchImpl: async (url) =>
      new Response(
        url === CIP_DRIFT_HEAD_URL
          ? 'c'.repeat(40)
          : url.endsWith('README.md')
            ? fixture.baselineBody
            : 'fixture-cddl = int\n',
      ),
  });
  const artifact = report.results.find((row) => row.id === 'cip-0060-v3-cddl');
  assert.equal(artifact.outcome, 'changed');
  assert.equal(artifact.statusComparison, 'not-applicable-supporting-artifact');
  assert.equal(artifact.statusChanged, null);
  assert.equal(artifact.declaredStatus, null);
});
await test('one HEAD snapshot serves all 40 current CIP sources with at most four concurrent reads', async () => {
  const calls = [];
  let active = 0,
    maximum = 0;
  const fetchImpl = async (url, options) => {
    calls.push(url);
    if (url === CIP_DRIFT_HEAD_URL) {
      assert.equal(options.headers.Accept, 'application/vnd.github.sha');
      return new Response('d'.repeat(40));
    }
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    assert.match(
      url,
      /^https:\/\/raw\.githubusercontent\.com\/cardano-foundation\/CIPs\/d{40}\/CIP-\d{4}\//,
    );
    return new Response(fixture.baselineBody);
  };
  const report = await monitorCipDrift(original, { fetchImpl, now });
  assert.equal(report.summary.cipSources, 40);
  assert.equal(report.summary.skippedNonCipSources, 10);
  assert.equal(calls.length, 41);
  assert.equal(calls.filter((url) => url === CIP_DRIFT_HEAD_URL).length, 1);
  assert.equal(maximum, CIP_DRIFT_LIMITS.concurrency);
});
await test('unsafe paths fail closed before fetch; a malformed catalog triggers no network', async () => {
  for (const suffix of [
    '../README.md',
    'README.md?raw=true',
    'README.md#fragment',
    'README%2emd',
    'README.md/../../secret',
  ]) {
    const value = catalog();
    value.sources[0].rawUrl = `https://raw.githubusercontent.com/cardano-foundation/CIPs/${value.sources[0].sourceCommit}/CIP-0001/${suffix}`;
    const calls = [];
    const report = await monitorCipDrift(value, {
      now,
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response('e'.repeat(40));
      },
    });
    assert.equal(report.results[0].outcome, 'rejected-source');
    assert.equal(report.complete, false);
    assert.deepEqual(calls, [CIP_DRIFT_HEAD_URL]);
  }
  const invalid = catalog();
  invalid.schemaVersion = 99;
  await assert.rejects(
    monitorCipDrift(invalid, {
      fetchImpl: () => {
        throw new Error('Unexpected fetch');
      },
    }),
    /Invalid knowledge catalog/,
  );
});
await test('HEAD errors, redirects, body limits and deadlines do not become unchanged verdicts', async () => {
  for (const response of [
    new Response('x', { status: 404 }),
    new Response('x', { status: 403 }),
    new Response('x'.repeat(CIP_DRIFT_LIMITS.headBytes + 1)),
    new Response('a'.repeat(40), { headers: { 'content-length': '9999' } }),
  ]) {
    let count = 0;
    const report = await monitorCipDrift(catalog(), {
      now,
      fetchImpl: async () => {
        count++;
        return response;
      },
    });
    assert.equal(report.complete, false);
    assert.equal(report.results[0].outcome, 'not-checked');
    assert.equal(count, 1);
  }
  for (const mode of [
    'stream-limit',
    'declared-limit',
    'redirect',
    'timeout',
    'network',
  ]) {
    const report = await monitorCipDrift(catalog(), {
      now,
      fetchImpl: async (url) => {
        if (url === CIP_DRIFT_HEAD_URL) return new Response('f'.repeat(40));
        if (mode === 'timeout')
          throw new DOMException('Secret transport detail', 'TimeoutError');
        if (mode === 'network') throw new Error('Secret transport detail');
        if (mode === 'stream-limit')
          return new Response('x'.repeat(CIP_DRIFT_LIMITS.sourceBytes + 1));
        if (mode === 'declared-limit')
          return new Response('x', {
            headers: {
              'content-length': String(CIP_DRIFT_LIMITS.sourceBytes + 1),
            },
          });
        const response = new Response('x');
        Object.defineProperty(response, 'redirected', { value: true });
        return response;
      },
    });
    assert.equal(report.complete, false);
    assert.equal(report.results[0].outcome, 'unavailable', mode);
    assert.equal(report.summary.unchanged, 0);
    assert.equal(
      JSON.stringify(report).includes('Secret transport detail'),
      false,
    );
  }
});
await test('status reader rejects ambiguous, missing, oversized and malformed frontmatter', () => {
  assert.equal(
    readCipStatus(
      Buffer.from(
        '---\nStatus: Inactive (incorporated into candidate CIP-0113)\n---\n',
      ),
    ),
    'Inactive (incorporated into candidate CIP-0113)',
  );
  assert.equal(
    readCipStatus(Buffer.from('---\r\nStatus: Active\r\n---\r\n')),
    'Active',
  );
  assert.equal(
    readCipStatus(
      Buffer.concat([
        Buffer.from('---\nStatus: Proposed\n---\n'),
        Buffer.from([255]),
      ]),
    ),
    'Proposed',
  );
  for (const value of [
    'Status: Active',
    '---\nTitle: Only\n---\n',
    '---\nStatus: [Active]\n---\n',
    '---\nStatus: Active\nStatus: Inactive\n---\n',
    `---\n${'x'.repeat(CIP_DRIFT_LIMITS.frontmatterBytes)}\nStatus: Active\n---\n`,
  ])
    assert.throws(
      () => readCipStatus(Buffer.from(value)),
      /frontmatter|Status/,
    );
  assert.throws(() => readCipStatus(Uint8Array.of(255)), /UTF-8/);
});
console.log(
  `Verified ${groups} CIP drift groups using deterministic fixtures; no live requests or catalog edits.`,
);
