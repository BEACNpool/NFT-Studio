import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createStandardsCorpus, CORPUS_PIN } from '../lib.mjs';
const base = new URL('../', import.meta.url);
const indexJson = await readFile(new URL('index.json', base), 'utf8');
const index = JSON.parse(indexJson);
const documents = Object.fromEntries(await Promise.all(index.entries.map(async e => [e.id, await readFile(new URL(e.localPath, base), 'utf8')])));
const library = await createStandardsCorpus({ indexJson, documents });
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');

test('complete inventory joins original Git tree, root directories and filesystem independently', async () => {
  const tree = JSON.parse(await readFile(new URL('evidence/tree-recursive.json', base)));
  const root = JSON.parse(await readFile(new URL('evidence/tree-root.json', base)));
  const matches = tree.tree.filter(e => /^CIP-\d{4}\/README\.md$/.test(e.path));
  assert.equal(tree.truncated, false); assert.equal(root.truncated, false);
  assert.deepEqual(matches.map(e => e.path).sort(), index.entries.map(e => e.sourcePath).sort());
  assert.deepEqual(root.tree.filter(e => /^CIP-\d{4}$/.test(e.path) && e.type === 'tree').map(e => e.path).sort(), Object.keys(documents).sort());
  assert.deepEqual((await readdir(new URL('sources/', base))).sort(), index.entries.map(e => e.localPath.split('/')[1]).sort());
  assert.equal(matches.length, 148); assert.equal(matches.reduce((n, e) => n + e.size, 0), 3425888);
  assert.equal(hash(indexJson), CORPUS_PIN.indexSha256);
  for (const e of index.entries) {
    const bytes = await readFile(new URL(e.localPath, base));
    assert.equal(hash(bytes), e.sha256); assert.equal(bytes.length, e.bytes);
    const blob = Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]);
    assert.equal(hash(blob, 'sha1'), e.gitBlobSha1);
    assert.equal(e.gitBlobSha1, matches.find(m => m.path === e.sourcePath).sha);
    assert.deepEqual(Buffer.from(documents[e.id]), bytes);
  }
});

test('independently reconstruct Git tree object identities (all entries, no downloaded execution)', async () => {
  const root = JSON.parse(await readFile(new URL('evidence/tree-root.json', base)));
  const recursive = JSON.parse(await readFile(new URL('evidence/tree-recursive.json', base)));
  const groups = new Map([['', []]]);
  for (const entry of recursive.tree) {
    const slash = entry.path.lastIndexOf('/'); const parent = entry.path.slice(0, slash < 0 ? 0 : slash);
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push({ ...entry, name: entry.path.slice(slash + 1) });
  }
  for (const [path, entries] of groups) {
    entries.sort((a,b) => Buffer.compare(Buffer.from(a.name + (a.type === 'tree' ? '/' : '')), Buffer.from(b.name + (b.type === 'tree' ? '/' : ''))));
    const content = Buffer.concat(entries.map(e => Buffer.concat([Buffer.from(e.mode.replace(/^0/, '') + ' ' + e.name + '\0'), Buffer.from(e.sha, 'hex')])));
    const actual = hash(Buffer.concat([Buffer.from('tree ' + content.length + '\0'), content]), 'sha1');
    const expected = path ? recursive.tree.find(e => e.path === path).sha : root.sha;
    assert.equal(actual, expected, path || 'root tree');
  }
  const commit=JSON.parse(await readFile(new URL('evidence/commit.json',base)));
  const split=commit.verification.payload.indexOf('\n\n');
  const content=Buffer.from(commit.verification.payload.slice(0,split)+'\ngpgsig '+commit.verification.signature.replaceAll('\n','\n ')+'\n\n'+commit.verification.payload.slice(split+2));
  assert.equal(hash(Buffer.concat([Buffer.from('commit '+content.length+'\0'),content]),'sha1'),CORPUS_PIN.commit);
  assert.equal(commit.tree.sha,root.sha);
  assert.equal(commit.verification.payload.split('\n')[0],'tree '+root.sha);
  assert.equal(root.sha, index.treeSha1);
  assert.equal(groups.size > 148, true);
});

test('raw frontmatter/copyright spans roundtrip exact UTF8 and selected fields remain verbatim', () => {
  for (const e of index.entries) {
    const bytes = Buffer.from(documents[e.id]);
    assert.equal(bytes.subarray(e.frontmatter.offsetBytes, e.frontmatter.endOffsetBytes).toString('utf8'), e.frontmatter.rawText);
    assert.equal(bytes.subarray(e.attribution.copyrightOffsetBytes, e.attribution.copyrightEndOffsetBytes).toString('utf8'), e.attribution.copyrightRawText);
    for (const [field, selected] of [['Title', e.title], ['Status', e.status], ['License', e.license]]) {
      assert.equal(e.frontmatter.rawText.split(/\r?\n/).find(line => line.startsWith(field + ':')).slice(field.length + 1).trim(), selected);
    }
    assert.ok(e.frontmatter.rawText.includes(e.attribution.authorsRawText));
    assert.equal(e.number, Number(e.id.slice(4)));
  }
  assert.equal(index.entries.find(e => e.id === 'CIP-0017').status, 'Inactive (abandoned for lack of interest)');
  assert.deepEqual(index.entries.find(e => e.id === 'CIP-0121').retainedLicenses, ['CC-BY-4.0', 'Apache-2.0']);
});

test('title/id/status search is deterministic, bounded and separate from prose', () => {
  for (const q of ['CIP-0026', 'cip26', '26', 'CIP 26']) assert.equal(library.search({query:q}).results[0].id, 'CIP-0026');
  assert.equal(library.search({query:'music'}).results[0].id, 'CIP-0060');
  const active = library.search({status:'Active', limit:25});
  assert.equal(active.results.length, 25); assert.equal(active.totalMatches, 62);
  assert.equal(library.search({query:'Proposed',limit:25}).totalMatches, 83);
  assert.equal(library.search({query:'Inactive'}).totalMatches, 3);
  assert.equal(library.search({query:'deliberately nonexistent search tokens'}).totalMatches, 0);
  assert.equal(library.search().results.length, 12);
  for (const r of library.search().results) assert.equal(Object.hasOwn(r, 'summary'), false);
  assert.deepEqual(library.search({query:'wallet'}), library.search({query:'wallet'}));
});

test('all exact documents and all chunk continuations reconstruct original hashes', () => {
  let chunks = 0;
  for (const entry of index.entries) {
    const doc = library.getDocument({id:entry.id});
    assert.equal(hash(doc.text), entry.sha256); assert.equal(doc.text, documents[entry.id]);
    const parts=[]; let offset=0;
    do {
      const chunk=library.getChunk({id:entry.id,offsetBytes:offset,limitBytes:1027});
      assert.equal(chunk.offsetBytes,offset); assert.ok(chunk.returnedBytes<=1027);
      assert.equal(Buffer.byteLength(chunk.text),chunk.returnedBytes);
      assert.equal(chunk.sha256,entry.sha256); assert.equal(chunk.totalBytes,entry.bytes);
      assert.equal(chunk.endOffsetBytes-chunk.offsetBytes,chunk.returnedBytes);
      assert.ok(chunk.returnedBytes>0); parts.push(chunk.text); offset=chunk.nextOffsetBytes; chunks++;
    } while(offset!==null);
    assert.equal(parts.join(''),documents[entry.id]);
  }
  assert.ok(chunks>3300);
  const large=library.getDocument({id:'CIP-0190'}); assert.equal(large.totalBytes,380819);
});

test('UTF8 offsets reject continuation bytes and small chunks never split actual multibyte source', () => {
  let boundaries=0;
  for(const e of index.entries){
    const bytes=Buffer.from(documents[e.id]);
    for(let i=0;i<bytes.length;i++) {
      if ((bytes[i]&0xc0)===0x80) { assert.throws(()=>library.getChunk({id:e.id,offsetBytes:i,limitBytes:4}),/splits/); boundaries++; }
      else if(bytes[i]>=0xc0) {
        const chunk=library.getChunk({id:e.id,offsetBytes:i,limitBytes:4});
        assert.deepEqual(Buffer.from(chunk.text),bytes.subarray(i,chunk.endOffsetBytes));
      }
    }
    const eof=library.getChunk({id:e.id,offsetBytes:bytes.length,limitBytes:4});
    assert.equal(eof.text,''); assert.equal(eof.nextOffsetBytes,null);
  }
  assert.ok(boundaries>1000);
});

test('caller bounds, ids, unknown fields, getters, coercion, and prototype tricks reject', () => {
  for (const id of ['cip-0026','CIP-26','../../README.md','https://example.com','CIP-0000',26,null,'CIP-0026\n']) assert.throws(()=>library.getDocument({id}));
  for (const offsetBytes of [-0,-1,0.1,NaN,Infinity,'0',999999]) assert.throws(()=>library.getChunk({id:'CIP-0026',offsetBytes}));
  for (const limitBytes of [-0,-1,0,1,3,16385,1.1,'4',null]) assert.throws(()=>library.getChunk({id:'CIP-0026',limitBytes}));
  for (const args of [{query:'x'.repeat(257)},{query:'é'.repeat(129)},{query:'\ud800'},{query:'a '.repeat(13)},{query:'\0'},{limit:26},{limit:0},{status:'Inactive'},{url:'https://example.com'},{query:{toString(){throw Error('must not run')}}}]) assert.throws(()=>library.search(args));
  assert.throws(()=>library.getDocument({id:'CIP-0026',offsetBytes:0}));
  assert.throws(()=>library.getChunk({id:'CIP-0026',extra:0}));
  let invoked=0;
  const accessor=Object.defineProperty({},'query',{enumerable:true,get(){invoked++;return 'wallet'}});
  assert.throws(()=>library.search(accessor)); assert.equal(invoked,0);
  assert.throws(()=>library.search(Object.create({query:'wallet'})));
  assert.throws(()=>library.search({[Symbol('query')]:'wallet'}));
  assert.throws(()=>library.search(Object.defineProperty({},'query',{value:'wallet'})));
});

test('fixed index and all documents authenticate before corpus is usable', async () => {
  await assert.rejects(createStandardsCorpus({indexJson:indexJson+'\n',documents}));
  await assert.rejects(createStandardsCorpus({indexJson,documents:{...documents,'CIP-0026':'\ufeff'+documents['CIP-0026']}}));
  await assert.rejects(createStandardsCorpus({indexJson,documents:{...documents,'CIP-0026':documents['CIP-0026'].replaceAll('\n','\r\n')}}));
  await assert.rejects(createStandardsCorpus({indexJson:indexJson.replace('Active','active'),documents}));
  const changed={...documents,'CIP-0026':documents['CIP-0026'].replace('Cardano','cardano')};
  await assert.rejects(createStandardsCorpus({indexJson,documents:changed}),/commitment/);
  const fewer={...documents};delete fewer['CIP-0026'];await assert.rejects(createStandardsCorpus({indexJson,documents:fewer}));
  await assert.rejects(createStandardsCorpus({indexJson,documents,extra:true}));
  await assert.rejects(createStandardsCorpus({indexJson,documents:{...documents,'CIP-0026':'\ud800'}}));
  await assert.rejects(createStandardsCorpus({indexJson,documents:{...documents,'CIP-0026':'x'.repeat(524289)}}));
  let invoked=0;const accessor={...documents};Object.defineProperty(accessor,'CIP-0026',{get(){invoked++;return documents['CIP-0026']},enumerable:true});
  await assert.rejects(createStandardsCorpus({indexJson,documents:accessor}));assert.equal(invoked,0);
});

test('captured data cannot change during async validation, and results cannot mutate internal state', async () => {
  const mutable={...documents};const promise=createStandardsCorpus({indexJson,documents:mutable});
  mutable['CIP-0026']='changed after invocation';
  const corpus=await promise;assert.equal(corpus.getDocument({id:'CIP-0026'}).text,documents['CIP-0026']);
  assert.throws(()=>{corpus.index.entries[0].status='fabricated'});
  assert.throws(()=>{corpus.search().results[0].title='changed'});
  assert.equal(corpus.index.entries[0].status,'Active');
});

test('independent root table differences and missing sources stay explicit', async () => {
  const comparison=JSON.parse(await readFile(new URL('evidence/enumeration.json',base)));
  assert.equal(comparison.rootReadmeTableRows,143);assert.equal(comparison.rootDirectoryCount,148);
  assert.deepEqual(comparison.treeIdsMissingFromRootReadmeRows,['CIP-0168','CIP-0172','CIP-0178','CIP-0183','CIP-0188']);
  assert.equal(comparison.differences.filter(d=>d.kind==='row-link-id-mismatch').length,1);
  const link=comparison.differences.find(d=>d.kind==='row-link-id-mismatch');assert.equal(link.rowId,'CIP-0162');assert.equal(link.linkedId,'CIP-0161');
  assert.deepEqual(comparison.differences.filter(d=>d.kind==='table-status-differs'&&d.tableValue==='Proposed').map(d=>d.id),['CIP-0088','CIP-0151','CIP-0158']);
});
