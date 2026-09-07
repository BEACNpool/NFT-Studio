/** Pure, bounded knowledge validation and search. No network, filesystem or execution. */
const ID = /^[a-z][a-z0-9-]{0,79}$/;
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const KINDS = new Set(['standard', 'tool', 'pattern']);
const EVIDENCE = new Set(['primary-source-reviewed', 'design-proposal']);
function fail(message) { throw new TypeError(`Invalid knowledge catalog: ${message}`); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} must be an ordinary object`);
}
function text(value, label, max = 2400) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`${label} must be bounded text`);
}
function list(value, label, max = 24, min = 0) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${label} has an invalid length`);
}
function strings(value, label, max = 24, min = 0, length = 2400) {
  list(value, label, max, min); value.forEach((v, i) => text(v, `${label}[${i}]`, length));
}
function keys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (BAD_KEYS.has(key) || !allowed.includes(key)) fail(`${label} contains unknown key ${key}`);
}
function sourceUrl(value, label) {
  text(value, label, 1200);
  let url; try { url = new URL(value); } catch { fail(`${label} is not a URL`); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) fail(`${label} must be a public HTTPS URL without credentials`);
}
function refs(value, known, label, min = 1) {
  strings(value, label, 24, min, 80);
  if (new Set(value).size !== value.length) fail(`${label} contains duplicates`);
  for (const id of value) if (!known.has(id)) fail(`${label} has unresolved reference ${id}`);
}
/** Throws TypeError for malformed, oversized, dangling or falsely promoted data; returns input on success. */
export function validateCatalog(catalog) {
  keys(catalog, ['schemaVersion', 'asOf', 'sourceRevision', 'description', 'sources', 'entries'], 'catalog');
  if (catalog.schemaVersion !== 1) fail('unsupported schemaVersion');
  if (typeof catalog.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(catalog.asOf) || Number.isNaN(Date.parse(catalog.asOf))) fail('invalid asOf');
  if (!/^[a-f0-9]{40}$/.test(catalog.sourceRevision ?? '')) fail('invalid sourceRevision');
  text(catalog.description, 'description');
  list(catalog.sources, 'sources', 256, 1); list(catalog.entries, 'entries', 256, 1);
  const sourceIds = new Set(); const entryIds = new Set();
  for (const source of catalog.sources) {
    keys(source, ['id','title','url','rawUrl','sourceCommit','sha256','accessedAt','declaredStatus','license','created','attribution','sourceType','release'], 'source');
    if (!ID.test(source.id ?? '') || sourceIds.has(source.id)) fail('invalid or duplicate source ID');
    sourceIds.add(source.id);
    for (const key of ['title','declaredStatus','license','attribution','sourceType']) text(source[key], `source.${key}`, key === 'attribution' ? 2400 : 300);
    for (const key of ['url','rawUrl']) sourceUrl(source[key], `source.${key}`);
    if (!/^[a-f0-9]{40}$/.test(source.sourceCommit ?? '') || !/^[a-f0-9]{64}$/.test(source.sha256 ?? '')) fail('invalid source commit or SHA-256');
    if (typeof source.accessedAt !== 'string' || source.accessedAt.length > 64 || Number.isNaN(Date.parse(source.accessedAt))) fail('invalid source access time');
    if (source.created !== undefined) text(source.created, 'source.created', 80);
    if (source.release !== undefined) {
      keys(source.release, ['tag_name','published_at','html_url','prerelease','status','reason'], 'source.release');
      for (const [key,value] of Object.entries(source.release)) {
        if (key === 'prerelease') { if (typeof value !== 'boolean') fail('release.prerelease must be boolean'); }
        else text(value, `source.release.${key}`, 1200);
      }
      if (source.release.html_url) sourceUrl(source.release.html_url, 'release.html_url');
    }
  }
  for (const entry of catalog.entries) {
    keys(entry, ['id','title','kind','summary','tags','sourceIds','facts','designNotes','enforcement','lifecycle','risks','interoperability','maturity','opportunities','relatedIds'], 'entry');
    if (!ID.test(entry.id ?? '') || entryIds.has(entry.id)) fail('invalid or duplicate entry ID');
    entryIds.add(entry.id);
    if (!KINDS.has(entry.kind)) fail('invalid entry kind');
    text(entry.title, 'entry.title', 300); text(entry.summary, 'entry.summary', 1600);
    strings(entry.tags, 'entry.tags', 20, 1, 80); refs(entry.sourceIds, sourceIds, 'entry.sourceIds');
    list(entry.facts, 'entry.facts', 16, entry.kind === 'pattern' ? 0 : 1);
    for (const fact of entry.facts) {
      keys(fact, ['text','sourceIds'], 'fact'); text(fact.text, 'fact.text'); refs(fact.sourceIds, sourceIds, 'fact.sourceIds');
      if (fact.sourceIds.some(id => !entry.sourceIds.includes(id))) fail('fact source must be declared by its entry');
    }
    for (const key of ['designNotes','lifecycle','risks','interoperability','opportunities']) strings(entry[key], `entry.${key}`, 24, 1);
    keys(entry.enforcement, ['layer','guarantees','doesNotGuarantee'], 'enforcement');
    text(entry.enforcement.layer, 'enforcement.layer', 100);
    strings(entry.enforcement.guarantees, 'enforcement.guarantees', 16, 1);
    strings(entry.enforcement.doesNotGuarantee, 'enforcement.doesNotGuarantee', 16, 1);
    keys(entry.maturity, ['standardStatus','studioStatus','evidenceLevel','version'], 'maturity');
    for (const key of ['standardStatus','studioStatus','evidenceLevel','version']) text(entry.maturity[key], `maturity.${key}`, 300);
    if (entry.maturity.studioStatus !== 'research-only' || !EVIDENCE.has(entry.maturity.evidenceLevel)) fail('research catalog cannot claim implementation evidence; use a reviewed capability receipt');
    if ((entry.kind === 'pattern') !== (entry.maturity.evidenceLevel === 'design-proposal')) fail('pattern evidence mismatch');
  }
  for (const entry of catalog.entries) refs(entry.relatedIds, entryIds, 'relatedIds', 0);
  if (JSON.stringify(catalog).length > 1_000_000) fail('catalog exceeds one million characters');
  return catalog;
}
function normalized(value) {
  return value.normalize('NFKC').toLowerCase().replace(/\bcip[\s_-]*0*(\d{1,4})\b/g, (_, n) => `cip-${n.padStart(4, '0')}`);
}
function checkedQuery(query) {
  if (typeof query !== 'string' || query.length > 256) throw new TypeError('Knowledge query must be a string of at most 256 characters');
  return normalized(query).trim();
}
export function getEntry(catalog, id) {
  if (typeof id !== 'string' || id.length > 80) throw new TypeError('Knowledge ID must be at most 80 characters');
  const key = normalized(id.trim());
  return catalog.entries.find(entry => entry.id === key) ?? null;
}
/** Returns full entries plus score. All query terms must match. Query is literal text, never regex or code. */
export function searchKnowledge(catalog, query = '', options = {}) {
  const q = checkedQuery(query);
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Search options must be an object');
  const { limit = 12, kind, tag, status } = options;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('Knowledge limit must be an integer from 1 to 50');
  if (kind !== undefined && !KINDS.has(kind)) throw new TypeError('Unknown knowledge kind');
  for (const value of [tag, status]) if (value !== undefined && (typeof value !== 'string' || value.length > 160)) throw new TypeError('Invalid knowledge filter');
  const terms = [...new Set(q.split(/[^\p{L}\p{N}-]+/u).filter(Boolean))].slice(0, 32);
  const found = [];
  for (const entry of catalog.entries) {
    if (kind && entry.kind !== kind) continue;
    if (tag && !entry.tags.some(t => normalized(t) === normalized(tag))) continue;
    if (status && entry.maturity.standardStatus !== status) continue;
    const title = normalized(`${entry.id} ${entry.title}`);
    const tags = normalized(entry.tags.join(' '));
    const summary = normalized(entry.summary);
    const detail = normalized(JSON.stringify([entry.facts,entry.designNotes,entry.enforcement,entry.lifecycle,entry.risks,entry.interoperability,entry.opportunities]));
    let score = entry.id === q ? 100 : 0; let matches = true;
    for (const term of terms) {
      const weight = (title.includes(term) ? 12 : 0) + (tags.includes(term) ? 8 : 0) + (summary.includes(term) ? 4 : 0) + (detail.includes(term) ? 1 : 0);
      if (!weight) { matches = false; break; } score += weight;
    }
    if (matches) found.push({ ...entry, score });
  }
  return found.sort((a,b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
