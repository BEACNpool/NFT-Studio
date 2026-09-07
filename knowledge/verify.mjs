import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadCatalog } from './node.mjs';
import { getEntry, searchKnowledge, validateCatalog } from './lib.mjs';
const c = loadCatalog();
const clone = () => structuredClone(c);
let groups = 0;
function test(name, fn) { fn(); groups++; console.log(`ok ${groups} - ${name}`); }
function rejects(fn, pattern = /Invalid knowledge/) { const modified = clone(); fn(modified); assert.throws(() => validateCatalog(modified), pattern); }
test('all source and relationship references resolve and snapshot is bounded', () => {
  assert.equal(validateCatalog(c), c); assert.ok(c.entries.length >= 50); assert.ok(c.sources.length >= 45);
  assert.equal(c.sourceRevision, '05ee6bb05982289dbe00c4187b9d54cf90e2e276');
});
test('statuses preserve adoption nuance and explicit retirement', () => {
  assert.equal(getEntry(c,'CIP68').maturity.standardStatus,'Active');
  assert.equal(getEntry(c,'CIP-67').maturity.standardStatus,'Proposed');
  assert.match(getEntry(c,'cip-0143').maturity.standardStatus,/Inactive.*0113/);
  assert.equal(getEntry(c,'CIP188').maturity.standardStatus,'Proposed');
  assert.equal(getEntry(c,'cip-9998'),null);
});
test('literal search ranks identity aliases and meaningful hazards', () => {
  for (const q of ['CIP68','CIP-68','CIP 0068']) assert.equal(searchKnowledge(c,q,{limit:1})[0].id,'cip-0068');
  assert.equal(searchKnowledge(c,'self-deposit',{kind:'standard',limit:1})[0].id,'cip-0188');
  assert.ok(searchKnowledge(c,'royalties',{limit:20}).some(e=>e.id==='cip-0102'));
  assert.ok(searchKnowledge(c,'nonce',{limit:20}).some(e=>e.id==='cip-0008'));
  assert.equal(searchKnowledge(c,'utterlyunfindable-xzq',{limit:5}).length,0);
  assert.deepEqual(searchKnowledge(c,'(a+)+$',{limit:5}).map(e=>e.id),searchKnowledge(c,'a',{limit:5}).map(e=>e.id));
});
test('filters, empty queries and bounds are deterministic', () => {
  assert.equal(searchKnowledge(c,'',{limit:7}).length,7);
  assert.deepEqual(searchKnowledge(c,'',{limit:7}),searchKnowledge(c,'',{limit:7}));
  assert.ok(searchKnowledge(c,'',{status:'Proposed',limit:50}).every(e=>e.maturity.standardStatus==='Proposed'));
  assert.ok(searchKnowledge(c,'',{tag:'CIP-68',limit:50}).every(e=>e.tags.some(t=>t.toLowerCase()==='cip-68')));
  for (const limit of [0,51,1.5,Infinity,'5']) assert.throws(()=>searchKnowledge(c,'',{limit}),/limit/);
  assert.throws(()=>searchKnowledge(c,'a'.repeat(257)),/query/);
  assert.throws(()=>searchKnowledge(c,'',{kind:'secret'}),/kind/);
});
test('duplicate and dangling references cannot enter the dataset', () => {
  rejects(x=>x.entries.push(x.entries[0])); rejects(x=>x.sources.push(x.sources[0]));
  rejects(x=>x.entries[0].sourceIds=['missing']); rejects(x=>x.entries[0].relatedIds=['missing']);
  rejects(x=>x.entries[0].facts[0].sourceIds=['cip-0068']);
});
test('research cannot silently become a verified mint or audit claim', () => {
  rejects(x=>x.entries[0].maturity.studioStatus='mainnet-confirmed');
  rejects(x=>x.entries[0].maturity.evidenceLevel='audited');
  rejects(x=>x.entries.find(e=>e.kind==='pattern').maturity.evidenceLevel='primary-source-reviewed');
});
test('unbounded and hostile data, private URLs and unknown fields fail closed', () => {
  rejects(x=>x.entries[0].summary='x'.repeat(1601)); rejects(x=>x.entries[0].title='\u0000title');
  rejects(x=>x.entries[0].execute='arbitrary shell'); rejects(x=>x.sources[0].url='http://example.com');
  rejects(x=>x.sources[0].url='https://user:pass@example.com/private');
  rejects(x=>x.sources[0].url='https://127.0.0.1/private');
  rejects(x=>x.sources[0].url='https://10.1.2.3/private');
  rejects(x=>x.sources[0].sha256='not-a-hash');
  const poison=JSON.parse(JSON.stringify(c).replace('"schemaVersion":1','"__proto__":{},"schemaVersion":1'));
  assert.throws(()=>validateCatalog(poison),/unknown key/);
});
test('public content contains no private host paths or credential markers', () => {
  const raw=readFileSync(new URL('./catalog.json',import.meta.url),'utf8');
  for (const marker of [/\/home\//,/\.openclaw/,/\.secrets/,/BEGIN [A-Z ]*PRIVATE KEY/,/10\.30\./,/192\.168\.86\./]) assert.doesNotMatch(raw,marker);
  assert.equal(createHash('sha256').update(raw).digest('hex').length,64);
});
console.log(`Verified ${groups} groups; ${c.entries.length} entries and ${c.sources.length} sources.`);
