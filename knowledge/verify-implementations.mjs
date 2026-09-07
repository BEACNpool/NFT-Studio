// Offline register admission checks. No network, wallet, signing or source mutation.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  parseImplementations,
  validateImplementations,
  getImplementation,
  implementationsForEntry,
  listImplementations,
} from './implementations.mjs';
const text = readFileSync(
  new URL('./implementations.json', import.meta.url),
  'utf8',
);
const raw = JSON.parse(text);
const ids = [
  'living-artifact',
  'cip-0067',
  'cip-0068',
  'agent-mint-contract',
  'cip-0030',
  'standards-observatory',
  'artifact-passport',
  'cip-0008',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
let groups = 0;
function test(name, run) {
  run();
  groups++;
  console.log(`ok ${groups} - ${name}`);
}
const mutate = (change) => {
  const value = structuredClone(raw);
  change(value);
  return value;
};
const reject = (change) =>
  assert.throws(() => validateImplementations(mutate(change), ids));
test('five records, strict research join and publication filtering', () => {
  const register = parseImplementations(text, ids);
  assert.equal(register.records.length, 5);
  assert.equal(
    listImplementations(register, { publication: 'published' }).length,
    5,
  );
  assert.equal(
    listImplementations(register, { publication: 'candidate' }).length,
    0,
  );
  assert.equal(implementationsForEntry(register, 'cip-0030').length, 2);
  assert.equal(
    getImplementation(register, 'artifact-passport').publication,
    'published',
  );
  assert.equal(getImplementation(register, 'missing'), null);
  assert.throws(() =>
    validateImplementations(
      raw,
      ids.filter((id) => id !== 'cip-0030'),
    ),
  );
});
test('duplicate IDs, unknown fields and invented readiness values reject', () => {
  reject((r) => (r.records[1].id = r.records[0].id));
  reject((r) => (r.records[0].standardStatus = 'Active'));
  reject((r) => (r.records[0].publication = 'mainnet-confirmed'));
  reject(
    (r) => (r.records[0].capabilities[1].id = r.records[0].capabilities[0].id),
  );
  reject((r) => (r.records[0].evidence[1].id = r.records[0].evidence[0].id));
  reject((r) => r.records.push(r.records[0]));
});
test('immutable commit/path/hash binding and candidate boundaries reject false links', () => {
  reject((r) => (r.records[0].evidence[0].artifact.commit = 'main'));
  reject(
    (r) =>
      (r.records[0].evidence[0].artifact.url = 'https://example.com/arbitrary'),
  );
  reject((r) => (r.records[0].evidence[0].artifact.path = '../secret'));
  reject((r) => (r.records[0].evidence[0].artifact.sha256 = '0'));
  reject((r) => (r.records[0].evidence[0].artifact.commit = null));
  reject(
    (r) =>
      (r.records[3].evidence[0].artifact.url =
        'https://github.com/BEACNpool/NFT-Studio/blob/main/not-yet-published'),
  );
  reject((r) => {
    r.records[3].evidence[0].artifact.commit = null;
    r.records[3].evidence[0].artifact.url = null;
  });
  reject((r) => (r.records[3].capabilities[0].environment = 'public-mcp'));
  reject((r) => (r.sourceCatalog.path = 'other.json'));
});
test('unpublished fixtures retain candidate-only capability scope', () => {
  const candidate = structuredClone(raw);
  const record = candidate.records[3];
  record.publication = 'candidate';
  for (const item of record.evidence) {
    item.artifact.commit = null;
    item.artifact.url = null;
  }
  for (const capability of record.capabilities)
    capability.environment = 'offline-candidate';
  const valid = validateImplementations(candidate, ids);
  assert.equal(
    listImplementations(valid, { publication: 'candidate' }).length,
    1,
  );
  record.capabilities[0].environment = 'browser-local';
  assert.throws(() => validateImplementations(candidate, ids));
  record.capabilities[0].environment = 'offline-candidate';
  record.publication = 'published';
  assert.throws(() => validateImplementations(candidate, ids));
});
test('capabilities need resolved and correctly scoped dated evidence', () => {
  reject((r) => (r.records[0].capabilities[0].evidenceIds = ['missing']));
  reject((r) => (r.records[1].capabilities[0].evidenceIds = ['mcp-worker']));
  reject(
    (r) => (r.records[0].capabilities[1].evidenceIds = ['capsule-codec-check']),
  );
  reject((r) => (r.records[1].evidence[0].observedAt = null));
  reject(
    (r) => (r.records[1].evidence[0].observedAt = '2099-01-01T00:00:00.000Z'),
  );
  reject((r) => (r.asOf = '2026-02-30T00:00:00.000Z'));
});
test('inert snapshots, cumulative bounds, malformed Unicode and lookup options', () => {
  let callbacks = 0;
  const getter = { ...raw };
  Object.defineProperty(getter, 'asOf', {
    get() {
      callbacks++;
      return raw.asOf;
    },
  });
  assert.throws(() => validateImplementations(getter, ids));
  const array = mutate(() => {});
  Object.defineProperty(array.records, 'map', {
    value() {
      callbacks++;
      return [];
    },
  });
  assert.throws(() => validateImplementations(array, ids));
  const iterator = mutate(() => {});
  Object.defineProperty(iterator.records, Symbol.iterator, {
    value() {
      callbacks++;
      return [][Symbol.iterator]();
    },
  });
  assert.throws(() => validateImplementations(iterator, ids));
  const cycle = mutate(() => {});
  cycle.records[0].summary = cycle;
  assert.throws(() => validateImplementations(cycle, ids));
  reject((r) => (r.description = '\ud800'));
  assert.throws(() => parseImplementations(' '.repeat(65537)));
  assert.throws(() => parseImplementations('"' + '😀'.repeat(20000) + '"'));
  reject((r) => (r.records[0].limits = Array(10).fill('x'.repeat(8000))));
  assert.throws(() =>
    listImplementations(raw, {
      get limit() {
        callbacks++;
        return 1;
      },
    }),
  );
  assert.throws(() => listImplementations(raw, { limit: 6 }));
  assert.throws(() => listImplementations(raw, { unknown: true }));
  assert.equal(callbacks, 0);
  const copy = validateImplementations(raw, ids);
  copy.records[0].entryIds.push('changed');
  assert.notDeepEqual(copy, raw);
});
const repository =
  process.env.NFT_STUDIO_TEST_ROOT ??
  fileURLToPath(new URL('../', import.meta.url));
const catalogPath = path.join(repository, 'knowledge/catalog.json');
let admission = 'not-run: complete repository unavailable',
  checkedBlobs = 0,
  candidateFiles = 0;
if (existsSync(catalogPath)) {
  test('frozen catalog checksum, complete research joins and pinned local-git blobs', () => {
    const bytes = readFileSync(catalogPath),
      catalog = JSON.parse(bytes);
    assert.equal(hash(bytes), raw.sourceCatalog.sha256);
    const register = validateImplementations(
      raw,
      catalog.entries.map((entry) => entry.id),
    );
    for (const record of register.records)
      for (const item of record.evidence) {
        const artifact = item.artifact;
        if (artifact.commit) {
          const blob = execFileSync(
            'git',
            ['show', `${artifact.commit}:${artifact.path}`],
            { cwd: repository, maxBuffer: 1024 * 1024 },
          );
          assert.equal(hash(blob), artifact.sha256, artifact.path);
          checkedBlobs++;
        } else if (existsSync(path.join(repository, artifact.path))) {
          assert.equal(
            hash(readFileSync(path.join(repository, artifact.path))),
            artifact.sha256,
            artifact.path,
          );
          candidateFiles++;
        }
      }
    admission = 'passed';
  });
} else if (process.argv.includes('--require-repository'))
  throw new Error(
    'Full repository required for catalog and immutable blob admission checks',
  );
console.log(
  JSON.stringify(
    {
      schema: 'beacn.implementation-register-check.v1',
      groups,
      records: raw.records.length,
      repositoryAdmission: admission,
      immutableGitBlobsChecked: checkedBlobs,
      candidateFilesChecked: candidateFiles,
      catalogModified: false,
      networkWalletSigningPublication: false,
    },
    null,
    2,
  ),
);
