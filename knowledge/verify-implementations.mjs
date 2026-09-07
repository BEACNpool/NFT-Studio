// Offline register admission checks. No network, wallet, signing or source mutation.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  IMPLEMENTATION_LIMITS,
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
const ids = [...new Set(raw.records.flatMap((record) => record.entryIds))];
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
test('six records, strict research join and publication filtering', () => {
  const register = parseImplementations(text, ids);
  assert.equal(register.records.length, 6);
  assert.equal(listImplementations(register).length, 6);
  assert.equal(
    listImplementations(register, { publication: 'published' }).length,
    6,
  );
  assert.equal(
    listImplementations(register, { publication: 'candidate' }).length,
    0,
  );
  assert.equal(implementationsForEntry(register, 'cip-0030').length, 3);
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
test('record/list cap is eight while byte and per-record bounds remain unchanged', () => {
  assert.deepEqual(IMPLEMENTATION_LIMITS, {
    bytes: 65536, records: 8, evidencePerRecord: 12,
    capabilitiesPerRecord: 8, depth: 10, nodes: 4096,
  });
  const schema = JSON.parse(readFileSync(new URL('./implementations.schema.json', import.meta.url)));
  assert.equal(schema.properties.records.maxItems, IMPLEMENTATION_LIMITS.records);
  const recordSchema = schema.properties.records.items.properties;
  assert.equal(recordSchema.evidence.maxItems, IMPLEMENTATION_LIMITS.evidencePerRecord);
  assert.equal(recordSchema.capabilities.maxItems, IMPLEMENTATION_LIMITS.capabilitiesPerRecord);
  const fixture = structuredClone(raw);
  const minimal = structuredClone(fixture.records[4]);
  minimal.entryIds = ['cip-0008'];
  minimal.evidence = minimal.evidence.filter((e) => ['source', 'documentation'].includes(e.kind)).slice(0, 1)
    .concat(minimal.evidence.filter((e) => e.kind === 'documentation').slice(0, 1));
  minimal.capabilities = [{ id: 'local', title: 'Local fixture', environment: 'offline-candidate',
    description: 'Synthetic capacity fixture.', evidenceIds: minimal.evidence.map((e) => e.id) }];
  minimal.summary = 'Synthetic capacity fixture.';
  minimal.limits = ['Capacity test only.']; minimal.nextEvidence = ['No implementation claim.'];
  while (fixture.records.length < IMPLEMENTATION_LIMITS.records) {
    const record = structuredClone(minimal); record.id = 'capacity-' + fixture.records.length;
    fixture.records.push(record);
  }
  const valid = validateImplementations(fixture, ids);
  assert.equal(valid.records.length, 8);
  assert.equal(listImplementations(valid).length, 8);
  for (const limit of [6, 7, 8]) assert.equal(listImplementations(valid, { limit }).length, limit);
  fixture.records.push({ ...minimal, id: 'ninth-record' });
  assert.throws(() => validateImplementations(fixture, ids), /list length/);
  reject((r) => r.records[0].evidence.push({ ...r.records[0].evidence[0], id: 'thirteenth-evidence' }));
  reject((r) => { while (r.records[0].capabilities.length < 9)
    r.records[0].capabilities.push({ ...r.records[0].capabilities[0], id: 'cap-' + r.records[0].capabilities.length }); });
});
test('31 historical evidence pins survive and new observations retain local scope', () => {
  const counts = [7, 8, 6, 6, 4];
  const historical = raw.records.slice(0, 5).map((record, index) => ({
    id: record.id, evidence: record.evidence.slice(0, counts[index]),
  }));
  assert.equal(hash(JSON.stringify(historical)), '45b628455b61813e5a52afa5bf8eb5e180a0588d49f609c3f09f1f97e5dc8fba');
  const capsule = getImplementation(raw, 'living-artifact'), music = getImplementation(raw, 'music-release');
  assert.equal(capsule.evidence.length, 12); assert.equal(music.evidence.length, 12);
  assert.equal(music.publication, 'published');
  for (const record of [music, { capabilities: capsule.capabilities.slice(3), evidence: capsule.evidence.slice(7) }]) {
    for (const capability of record.capabilities) assert.ok(['node-local', 'browser-local'].includes(capability.environment));
    for (const item of record.evidence) {
      assert.equal(item.artifact.commit, 'e87e2b0b27cd88b380e5b2bab2f7c0034ae03857');
      assert.ok(!['independent-node-evaluation', 'live-service-check', 'upstream-source-check'].includes(item.kind));
    }
  }
  assert.deepEqual(music.entryIds, ['cip-0060', 'cip-0025', 'cip-0030', 'agent-mint-contract']);
  assert.equal(implementationsForEntry(raw, 'cip-0060')[0].id, 'music-release');
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
  assert.throws(() => listImplementations(raw, { limit: IMPLEMENTATION_LIMITS.records + 1 }));
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
