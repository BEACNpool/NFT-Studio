// SPDX-License-Identifier: Apache-2.0
// This module consumes data. It never loads a URL/path, evaluates source, or renders HTML.
import { CORPUS_PIN } from './pin.mjs';
export { CORPUS_PIN } from './pin.mjs';

export const CORPUS_LIMITS = Object.freeze({ indexBytes: 524288, documentBytes: 524288, documentCount: 148, totalBytes: 3425888, queryBytes: 256, queryTokens: 12, results: 25, chunkBytes: 16384, minimumChunkBytes: 4 });
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const idPattern = /^CIP-[0-9]{4}$/;
const sha256 = async bytes => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');

function fields(input, allowed, required = []) {
  if (!input || typeof input !== 'object' || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) throw new TypeError('Expected a plain data object.');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > allowed.length || keys.some(key => typeof key !== 'string' || !allowed.includes(key))) throw new TypeError('Unknown field.');
  const copy = Object.create(null);
  for (const key of keys) {
    const d = descriptors[key];
    if (!Object.hasOwn(d, 'value') || !d.enumerable) throw new TypeError('Only enumerable data fields are accepted.');
    copy[key] = d.value;
  }
  if (required.some(key => !Object.hasOwn(copy, key))) throw new TypeError('Missing required field.');
  return copy;
}
function textBytes(text, max, label) {
  if (typeof text !== 'string' || text.length > max || !text.isWellFormed()) throw new TypeError(`${label} must be bounded, well-formed text.`);
  const bytes = encoder.encode(text);
  if (bytes.length > max) throw new RangeError(`${label} exceeds its byte limit.`);
  return bytes;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) throw new RangeError(`${label} is outside its allowed range.`);
  return value;
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function brief(entry) {
  const { id, number, title, status, license, licenseUrl, retainedLicenses, licenseNotes, sourcePath, sourceCommit, sourceUrl, rawUrl, bytes, sha256, gitBlobSha1 } = entry;
  return Object.freeze({ id, number, title, status, license, licenseUrl, retainedLicenses, licenseNotes, sourcePath, sourceCommit, sourceUrl, rawUrl, bytes, sha256, gitBlobSha1 });
}

/**
 * Authenticate the exact generated index and all 148 preloaded UTF-8 documents.
 * `documents` maps canonical CIP ids to original text. Caller chooses how to load
 * fixed bundled files; no loader/network access exists here. Capture all inputs
 * synchronously before awaiting hashes. Returned source text is inert data.
 */
export async function createStandardsCorpus(input) {
  const { indexJson, documents } = fields(input, ['indexJson', 'documents'], ['indexJson', 'documents']);
  const indexBytes = textBytes(indexJson, CORPUS_LIMITS.indexBytes, 'Index');
  if (indexBytes.length !== CORPUS_PIN.indexBytes) throw new TypeError('Index length differs from the fixed pin.');
  if (!documents || typeof documents !== 'object' || (Object.getPrototypeOf(documents) !== Object.prototype && Object.getPrototypeOf(documents) !== null)) throw new TypeError('Documents must be a plain data object.');
  const descriptors = Object.getOwnPropertyDescriptors(documents);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== CORPUS_LIMITS.documentCount || keys.some(key => typeof key !== 'string' || !idPattern.test(key))) throw new TypeError('Expected exactly 148 canonical CIP ids.');
  const captured = new Map();
  let total = 0;
  for (const id of keys) {
    const d = descriptors[id];
    if (!Object.hasOwn(d, 'value') || !d.enumerable) throw new TypeError('Document getters/non-enumerable fields are not accepted.');
    const bytes = textBytes(d.value, CORPUS_LIMITS.documentBytes, 'Document');
    total += bytes.length;
    if (total > CORPUS_LIMITS.totalBytes) throw new RangeError('Corpus total byte limit exceeded.');
    captured.set(id, { text: d.value, bytes });
  }
  if (total !== CORPUS_LIMITS.totalBytes || await sha256(indexBytes) !== CORPUS_PIN.indexSha256) throw new TypeError('Fixed corpus/index commitment mismatch.');
  // The exact index hash is checked before parsing; this is not general caller JSON.
  const index = freeze(JSON.parse(indexJson));
  if (index.documentCount !== CORPUS_PIN.documentCount || index.sourceCommit !== CORPUS_PIN.commit) throw new TypeError('Fixed index metadata mismatch.');
  const byId = new Map();
  for (const entry of index.entries) {
    const doc = captured.get(entry.id);
    if (!doc || doc.bytes.length !== entry.bytes || await sha256(doc.bytes) !== entry.sha256) throw new TypeError(`Source commitment mismatch: ${entry.id}.`);
    byId.set(entry.id, { entry, brief: brief(entry), ...doc });
  }
  function lookup(id) {
    if (typeof id !== 'string' || !idPattern.test(id)) throw new TypeError('Use a canonical id such as CIP-0026.');
    const item = byId.get(id);
    if (!item) throw new RangeError('CIP id is not present in this pinned inventory.');
    return item;
  }
  return Object.freeze({
    pin: CORPUS_PIN,
    index,
    search(input = {}) {
      const options = fields(input, ['query', 'status', 'limit']);
      const query = options.query === undefined ? '' : options.query;
      textBytes(query, CORPUS_LIMITS.queryBytes, 'Query');
      if (/[\u0000-\u001f\u007f]/u.test(query)) throw new TypeError('Query contains control characters.');
      const limit = options.limit === undefined ? 12 : integer(options.limit, 1, CORPUS_LIMITS.results, 'Result limit');
      if (options.status !== undefined && (typeof options.status !== 'string' || !Object.hasOwn(index.statusCounts, options.status))) throw new TypeError('Status must match an exact source status from index.statusCounts.');
      const normalized = query.trim().toLowerCase();
      const tokens = normalized.split(/\s+/u).filter(Boolean);
      if (tokens.length > CORPUS_LIMITS.queryTokens) throw new RangeError('Too many search tokens.');
      const idQuery = /^(?:cip[- ]?)?([0-9]{1,4})$/.exec(normalized);
      const exactId = idQuery ? 'CIP-' + idQuery[1].padStart(4, '0') : null;
      const hits = index.entries.filter(entry => {
        if (options.status !== undefined && entry.status !== options.status) return false;
        if (exactId) return entry.id === exactId;
        const haystack = (entry.id + ' ' + entry.title + ' ' + entry.status).toLowerCase();
        return tokens.every(token => haystack.includes(token));
      });
      return Object.freeze({ sourceCommit: CORPUS_PIN.commit, query, totalMatches: hits.length, limit, results: Object.freeze(hits.slice(0, limit).map(entry => byId.get(entry.id).brief)) });
    },
    getDocument(input) {
      const { id } = fields(input, ['id'], ['id']);
      const item = lookup(id);
      return Object.freeze({ ...item.brief, offsetBytes: 0, endOffsetBytes: item.bytes.length, totalBytes: item.bytes.length, text: item.text, complete: true });
    },
    getChunk(input) {
      const options = fields(input, ['id', 'offsetBytes', 'limitBytes'], ['id']);
      const item = lookup(options.id);
      const offset = options.offsetBytes === undefined ? 0 : integer(options.offsetBytes, 0, item.bytes.length, 'Byte offset');
      const limit = options.limitBytes === undefined ? 8192 : integer(options.limitBytes, CORPUS_LIMITS.minimumChunkBytes, CORPUS_LIMITS.chunkBytes, 'Chunk byte limit');
      if (offset < item.bytes.length && (item.bytes[offset] & 0xc0) === 0x80) throw new RangeError('Byte offset splits a UTF-8 code point.');
      let end = Math.min(offset + limit, item.bytes.length);
      while (end < item.bytes.length && (item.bytes[end] & 0xc0) === 0x80) end--;
      const text = decoder.decode(item.bytes.subarray(offset, end));
      return Object.freeze({ ...item.brief, offsetBytes: offset, endOffsetBytes: end, nextOffsetBytes: end < item.bytes.length ? end : null, returnedBytes: end - offset, totalBytes: item.bytes.length, text, complete: offset === 0 && end === item.bytes.length });
    },
  });
}
