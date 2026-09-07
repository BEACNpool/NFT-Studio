import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseImplementations,implementationsForEntry} from '../../knowledge/implementations.mjs';
import {assertImplementationEnvelope,IMPLEMENTATIONS_URI} from '../integration/verify-implementation-resource.mjs';
const catalog=JSON.parse(await readFile(new URL('../../knowledge/catalog.json',import.meta.url)));
const registerText=await readFile(new URL('../../knowledge/implementations.json',import.meta.url),'utf8');
const register=parseImplementations(registerText,catalog.entries.map(e=>e.id));

test('Implementation joins and evidence URLs reject forged links, changed research and unresolved IDs',()=>{
  const entry=catalog.entries.find(e=>e.id===register.records[0].entryIds[0]);
  const expected={entry,sources:catalog.sources.filter(s=>entry.sourceIds.includes(s.id)),implementations:{resourceUri:IMPLEMENTATIONS_URI,recordIds:implementationsForEntry(register,entry.id).map(r=>r.id)}};
  assertImplementationEnvelope(expected,entry,catalog,register);
  for(const links of [{resourceUri:'https://attacker.invalid/',recordIds:expected.implementations.recordIds},{resourceUri:IMPLEMENTATIONS_URI,recordIds:['invented-record']},{resourceUri:IMPLEMENTATIONS_URI,recordIds:[]},{...expected.implementations,extra:true}])assert.throws(()=>assertImplementationEnvelope({...expected,implementations:links},entry,catalog,register));
  assert.throws(()=>assertImplementationEnvelope({...expected,entry:{...entry,maturity:{...entry.maturity,studioStatus:'fabricated production claim'}}},entry,catalog,register));
  const url=structuredClone(register);url.records[0].evidence[0].artifact.url='https://attacker.invalid/source';assert.throws(()=>parseImplementations(JSON.stringify(url),catalog.entries.map(e=>e.id)),/immutable source link/);
  const orphan=structuredClone(register);orphan.records[0].entryIds=['unlisted-research-entry'];assert.throws(()=>parseImplementations(JSON.stringify(orphan),catalog.entries.map(e=>e.id)),/unresolved research/);
});

test('Build fails before bundling when implementation observations bind a different catalog',async()=>{
  const fixture=await mkdtemp(join(tmpdir(),'nft-studio-register-binding-'));
  for(const name of ['catalog.json','implementations.mjs'])await copyFile(new URL('../../knowledge/'+name,import.meta.url),join(fixture,name));
  const invalid=structuredClone(register);invalid.sourceCatalog.sha256='00'.repeat(32);await writeFile(join(fixture,'implementations.json'),JSON.stringify(invalid));
  const built=spawnSync(process.execPath,['build.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,NFT_STUDIO_KNOWLEDGE:fixture},encoding:'utf8',timeout:10000});
  assert.notEqual(built.status,0);assert.match(built.stderr,/source catalog SHA-256 does not match/);assert.ok(!built.stdout.includes('00'.repeat(32)));
});
