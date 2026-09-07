/** Pure implementation-register parsing and lookup. No I/O, fetching, execution or admission. */
export const IMPLEMENTATION_LIMITS = Object.freeze({
  bytes: 65536,
  records: 8,
  evidencePerRecord: 12,
  capabilitiesPerRecord: 8,
  depth: 10,
  nodes: 4096,
});
const REPOSITORY = 'https://github.com/BEACNpool/NFT-Studio';
const ID = /^[a-z][a-z0-9-]{0,79}$/;
const HASH = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const PATH = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/;
const KINDS = new Set([
  'source',
  'documentation',
  'local-test',
  'synthetic-transaction-test',
  'independent-node-evaluation',
  'live-service-check',
  'upstream-source-check',
]);
const ENVIRONMENTS = new Set([
  'browser-local',
  'node-local',
  'independent-node-evaluation',
  'public-mcp',
  'offline-candidate',
  'repository-tooling',
]);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const wellFormed = (text) => decoder.decode(encoder.encode(text)) === text;
const bad = (message) => {
  throw new TypeError(`Invalid implementation register: ${message}`);
};

// Reject accessors, extended arrays and custom prototypes before traversing data.
// A cumulative byte budget bounds intermediate serialization as well as final output.
function snapshot(input) {
  let nodes = 0,
    bytes = 0;
  const active = new Set();
  function count(fragment) {
    bytes += encoder.encode(fragment).length;
    if (bytes > IMPLEMENTATION_LIMITS.bytes) bad('byte limit');
  }
  function copy(value, depth) {
    if (
      ++nodes > IMPLEMENTATION_LIMITS.nodes ||
      depth > IMPLEMENTATION_LIMITS.depth
    )
      bad('structure limit');
    if (value === null || typeof value === 'boolean') {
      count(String(value));
      return value;
    }
    if (typeof value === 'string') {
      if (value.length > 8192 || !wellFormed(value))
        bad('text limit or Unicode');
      count(JSON.stringify(value));
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || Object.is(value, -0))
        bad('integer required');
      count(String(value));
      return value;
    }
    if (!value || typeof value !== 'object' || active.has(value))
      bad('inert acyclic data required');
    const array = Array.isArray(value);
    if (
      array
        ? Object.getPrototypeOf(value) !== Array.prototype
        : ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      bad('ordinary data required');
    if (Object.getOwnPropertySymbols(value).length) bad('symbol properties');
    const length = array
      ? Object.getOwnPropertyDescriptor(value, 'length').value
      : 0;
    if (length > 64) bad('array limit');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.keys(descriptors);
    if (names.length > 65 || (array && names.length !== length + 1))
      bad('extended record or array');
    active.add(value);
    let result;
    if (array) {
      count('[]');
      result = [];
      for (let i = 0; i < length; i++) {
        const d = descriptors[String(i)];
        if (!d?.enumerable || !Object.hasOwn(d, 'value'))
          bad('inert dense array required');
        if (i) count(',');
        result.push(copy(d.value, depth + 1));
      }
    } else {
      count('{}');
      result = {};
      for (let i = 0; i < names.length; i++) {
        const name = names[i],
          d = descriptors[name];
        if (
          name.length > 80 ||
          ['__proto__', 'prototype', 'constructor'].includes(name) ||
          !d.enumerable ||
          !Object.hasOwn(d, 'value')
        )
          bad('inert record fields required');
        count((i ? ',' : '') + JSON.stringify(name) + ':');
        result[name] = copy(d.value, depth + 1);
      }
    }
    active.delete(value);
    return result;
  }
  return copy(input, 0);
}
function object(value, fields) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(value, key))
  )
    bad('missing or unknown fields');
}
function text(value, max = 1200) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  )
    bad('bounded display text required');
}
function list(value, max, min = 1) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    bad('list length');
}
function strings(value, max, length = 1200) {
  list(value, max);
  for (const item of value) text(item, length);
  if (new Set(value).size !== value.length) bad('duplicate list item');
}
function id(value) {
  if (typeof value !== 'string' || !ID.test(value)) bad('invalid ID');
}
function path(value) {
  if (
    typeof value !== 'string' ||
    value.length > 240 ||
    !PATH.test(value) ||
    value.split('/').some((p) => p === '.' || p === '..')
  )
    bad('repository-relative path required');
}
function date(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    bad('UTC observation timestamp required');
}

/** Returns a fresh bounded data snapshot. Pass catalog entry IDs to check the join. */
export function validateImplementations(input, knownEntryIds) {
  const value = snapshot(input);
  object(value, [
    'schemaVersion',
    'kind',
    'asOf',
    'repository',
    'sourceCatalog',
    'description',
    'records',
  ]);
  if (
    value.schemaVersion !== 1 ||
    value.kind !== 'beacn.implementation-register' ||
    value.repository !== REPOSITORY
  )
    bad('profile or repository');
  date(value.asOf);
  text(value.description);
  object(value.sourceCatalog, ['path', 'sha256']);
  if (
    value.sourceCatalog.path !== 'knowledge/catalog.json' ||
    !HASH.test(value.sourceCatalog.sha256 ?? '')
  )
    bad('source catalog binding');
  let known;
  if (knownEntryIds !== undefined) {
    if (
      !Array.isArray(knownEntryIds) ||
      knownEntryIds.length < 1 ||
      knownEntryIds.length > 256
    )
      bad('known entry IDs');
    // These IDs come from the host's already-validated frozen catalog.
    known = new Set(knownEntryIds);
    if (known.size !== knownEntryIds.length) bad('duplicate known entry IDs');
    for (const entryId of known) id(entryId);
  }
  list(value.records, IMPLEMENTATION_LIMITS.records);
  const records = new Set();
  for (const record of value.records) {
    object(record, [
      'id',
      'entryIds',
      'title',
      'publication',
      'summary',
      'capabilities',
      'evidence',
      'limits',
      'nextEvidence',
    ]);
    id(record.id);
    if (records.has(record.id)) bad('duplicate implementation ID');
    records.add(record.id);
    strings(record.entryIds, 8, 80);
    for (const entryId of record.entryIds) {
      id(entryId);
      if (known && !known.has(entryId)) bad('unresolved research entry ID');
    }
    text(record.title, 160);
    text(record.summary);
    if (!['published', 'candidate'].includes(record.publication))
      bad('publication status');
    strings(record.limits, 10);
    strings(record.nextEvidence, 8);
    list(record.evidence, IMPLEMENTATION_LIMITS.evidencePerRecord);
    const evidence = new Map();
    for (const item of record.evidence) {
      object(item, ['id', 'kind', 'observedAt', 'description', 'artifact']);
      id(item.id);
      if (evidence.has(item.id)) bad('duplicate evidence ID');
      evidence.set(item.id, item);
      if (!KINDS.has(item.kind)) bad('evidence kind');
      text(item.description);
      if (item.observedAt !== null) {
        date(item.observedAt);
        if (item.observedAt > value.asOf)
          bad('observation after register snapshot');
      }
      object(item.artifact, ['path', 'sha256', 'commit', 'url']);
      const artifact = item.artifact;
      path(artifact.path);
      if (!HASH.test(artifact.sha256 ?? '')) bad('artifact SHA-256');
      if (artifact.commit === null) {
        if (artifact.url !== null || record.publication !== 'candidate')
          bad(
            'unpublished artifact cannot have a public link or published status',
          );
      } else if (
        !COMMIT.test(artifact.commit ?? '') ||
        artifact.url !==
          `${REPOSITORY}/blob/${artifact.commit}/${artifact.path}`
      )
        bad('exact immutable source link required');
      if (
        [
          'independent-node-evaluation',
          'live-service-check',
          'upstream-source-check',
        ].includes(item.kind) &&
        (item.observedAt === null || artifact.commit === null)
      )
        bad('external observation requires a dated published artifact');
    }
    if (
      ![...evidence.values()].some((x) => x.kind === 'source') ||
      ![...evidence.values()].some((x) => x.kind === 'documentation')
    )
      bad('source and scope documentation required');
    list(record.capabilities, IMPLEMENTATION_LIMITS.capabilitiesPerRecord);
    const caps = new Set();
    for (const capability of record.capabilities) {
      object(capability, [
        'id',
        'title',
        'environment',
        'description',
        'evidenceIds',
      ]);
      id(capability.id);
      if (caps.has(capability.id)) bad('duplicate capability ID');
      caps.add(capability.id);
      text(capability.title, 160);
      text(capability.description);
      if (!ENVIRONMENTS.has(capability.environment))
        bad('capability environment');
      strings(capability.evidenceIds, 8, 80);
      for (const ref of capability.evidenceIds)
        if (!evidence.has(ref)) bad('unresolved evidence reference');
      if (
        record.publication === 'candidate' &&
        capability.environment !== 'offline-candidate'
      )
        bad('candidate cannot claim a published capability');
      const required =
        capability.environment === 'public-mcp'
          ? 'live-service-check'
          : capability.environment === 'independent-node-evaluation'
            ? 'independent-node-evaluation'
            : null;
      if (
        required &&
        !capability.evidenceIds.some(
          (ref) => evidence.get(ref).kind === required,
        )
      )
        bad('capability lacks its scoped observation');
    }
  }
  return value;
}
/** Pure loader for already-read UTF-8 JSON text. Callers own any file/network access. */
export function parseImplementations(jsonText, knownEntryIds) {
  if (
    typeof jsonText !== 'string' ||
    jsonText.length > IMPLEMENTATION_LIMITS.bytes ||
    encoder.encode(jsonText).length > IMPLEMENTATION_LIMITS.bytes ||
    !wellFormed(jsonText)
  )
    bad('JSON text limit');
  return validateImplementations(JSON.parse(jsonText), knownEntryIds);
}
/** Lookups take the validated register; they neither mutate nor promote it. */
export function getImplementation(register, implementationId) {
  id(implementationId);
  return (
    register.records.find((record) => record.id === implementationId) ?? null
  );
}
export function implementationsForEntry(register, entryId) {
  id(entryId);
  return register.records.filter((record) => record.entryIds.includes(entryId));
}
export function listImplementations(register, options = {}) {
  options = snapshot(options);
  object(options, Object.keys(options));
  if (
    Object.keys(options).some(
      (key) => !['publication', 'entryId', 'limit'].includes(key),
    )
  )
    bad('lookup options');
  const { publication, entryId, limit = IMPLEMENTATION_LIMITS.records } = options;
  if (
    publication !== undefined &&
    !['published', 'candidate'].includes(publication)
  )
    bad('lookup publication');
  if (entryId !== undefined) id(entryId);
  if (!Number.isInteger(limit) || limit < 1 || limit > IMPLEMENTATION_LIMITS.records) bad('lookup limit');
  return register.records
    .filter(
      (record) =>
        (!publication || record.publication === publication) &&
        (!entryId || record.entryIds.includes(entryId)),
    )
    .slice(0, limit);
}
