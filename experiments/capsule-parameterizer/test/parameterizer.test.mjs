import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,copyFile,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import {applyCapsuleParameters,CAPSULE_PARAMETERIZER_SOURCE,CAPSULE_PARAMETERIZER_LIMITS} from '../src/index.mjs';
import {valid,parameterFixtures} from './fixtures.mjs';
const deepFrozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(deepFrozen));

test('Fixed blueprint and demo identity match all handlers, CSL V3 and exact export bytes',async()=>{
  const trusted=await readFile(new URL('../trusted/plutus.json',import.meta.url));assert.equal(createHash('sha256').update(trusted).digest('hex'),CAPSULE_PARAMETERIZER_SOURCE.blueprintSha256);
  const actual=applyCapsuleParameters(valid),expected=JSON.parse(await readFile(new URL('../fixtures/applied-demo.json',import.meta.url),'utf8'));
  assert.deepEqual(actual.appliedBlueprint,expected);assert.equal(actual.policyId,'a3ef3e0109b585376e6366833f022964dbf487da828fcfd35ee28d1d');
  assert.deepEqual(JSON.parse(actual.appliedBlueprintJson),expected);assert.equal(createHash('sha256').update(actual.appliedBlueprintJson).digest('hex'),actual.appliedBlueprintSha256);
  const script=CSL.PlutusScript.new_v3(Buffer.from(actual.compiledCode,'hex'));assert.equal(script.hash().to_hex(),actual.policyId);script.free();
  assert.equal(actual.scriptHash,actual.policyId);assert.equal(actual.scriptBytes,3100);assert.equal(actual.readiness,'experimental-parameterized-only');assert.ok(Object.values(actual.limitations).every(v=>v===false));
});

test('Malformed, inherited, accessor and additional fields reject without reading getters or coercing values',()=>{
  const bad=[null,[],true,'x',{},Object.create(valid),{...valid,blueprint:{}},{...valid,script:'00'},{...valid,url:'https://attacker.invalid/'},{...valid,seed:null},{...valid,seed:[]},{...valid,seed:{...valid.seed,extra:true}}];
  for(const transactionId of ['',valid.seed.transactionId.toUpperCase().replace('1','A'),'a'.repeat(63),'aa'.repeat(33),'\u0000'.repeat(64),new String(valid.seed.transactionId),{toString(){throw new Error('must not coerce');}}])bad.push({...valid,seed:{...valid.seed,transactionId}});
  for(const outputIndex of [-1,-0,65536,4294967295,NaN,Infinity,0.5,'0',0n])bad.push({...valid,seed:{...valid.seed,outputIndex}});
  for(const baseName of ['',null,undefined,0,{},'a'.repeat(29),'🦑'.repeat(8),'\ud800','\udfff','a'.repeat(1000000)])bad.push({...valid,baseName});
  let reads=0;const getter={...valid};Object.defineProperty(getter,'baseName',{get(){reads++;return 'CAPSULE';},enumerable:true});bad.push(getter);
  const nested={...valid,seed:{...valid.seed}};Object.defineProperty(nested.seed,'transactionId',{get(){reads++;return valid.seed.transactionId;},enumerable:true});bad.push(nested);
  const hidden={...valid};Object.defineProperty(hidden,'baseName',{value:'CAPSULE',enumerable:false});bad.push(hidden);
  const symbolic={...valid,[Symbol('script')]:'00'};bad.push(symbolic);
  for(const input of bad)assert.throws(()=>applyCapsuleParameters(input),TypeError);
  assert.equal(reads,0);assert.equal(applyCapsuleParameters(valid).policyId,'a3ef3e0109b585376e6366833f022964dbf487da828fcfd35ee28d1d');
});

test('Input snapshots and nested exports are immutable; later calls cannot be contaminated',()=>{
  const input=structuredClone(valid);const result=applyCapsuleParameters(input);input.seed.transactionId='22'.repeat(32);input.baseName='changed';
  assert.equal(result.parameters.baseName,'CAPSULE');assert.equal(result.parameters.seed.transactionId,valid.seed.transactionId);assert.ok(deepFrozen(result));assert.ok(deepFrozen(CAPSULE_PARAMETERIZER_SOURCE));assert.ok(deepFrozen(CAPSULE_PARAMETERIZER_LIMITS));
  assert.throws(()=>result.appliedBlueprint.validators[0].compiledCode='00');assert.throws(()=>result.assetNames.userAssetNameHex='00');assert.throws(()=>CAPSULE_PARAMETERIZER_SOURCE.plutusVersion='PlutusV2');
  assert.equal(applyCapsuleParameters(valid).compiledCode,result.compiledCode);
  assert.equal(applyCapsuleParameters(Object.assign(Object.create(null),valid)).policyId,result.policyId);
});

test('Exact Unicode and each seed parameter remain load-bearing at byte boundaries',()=>{
  const first=applyCapsuleParameters(valid);const altered=[{...valid,seed:{...valid.seed,transactionId:'10'+'11'.repeat(31)}},{...valid,seed:{...valid.seed,outputIndex:1}},{...valid,baseName:'CAPSULE!'}];
  for(const input of altered)assert.notEqual(applyCapsuleParameters(input).policyId,first.policyId);
  const composed=applyCapsuleParameters({...valid,baseName:'é'}),decomposed=applyCapsuleParameters({...valid,baseName:'e\u0301'});assert.notEqual(composed.policyId,decomposed.policyId);assert.equal(composed.parameters.baseNameHex,'c3a9');assert.equal(decomposed.parameters.baseNameHex,'65cc81');
  assert.equal(applyCapsuleParameters({...valid,baseName:'🦑'.repeat(7)}).parameters.baseNameHex.length,56);
  assert.equal(applyCapsuleParameters({...valid,baseName:'\ufeffBEACN'}).parameters.baseNameHex,'efbbbf424541434e');
  assert.equal(applyCapsuleParameters({...valid,seed:{...valid.seed,outputIndex:65535}}).parameters.seedCborHex.slice(-8),'19ffffff');
});

test('All 256 generated requests match independently generated Aiken oracle bytes and policies',async()=>{
  const oracle=JSON.parse(await readFile(new URL('../fixtures/aiken-oracle.json',import.meta.url),'utf8'));assert.deepEqual(oracle.source,CAPSULE_PARAMETERIZER_SOURCE);assert.deepEqual(oracle.cases.map(c=>c.input),parameterFixtures());
  for(const expected of oracle.cases){const actual=applyCapsuleParameters(expected.input);assert.equal(actual.compiledCode,expected.compiledCode);assert.equal(actual.policyId,expected.policyId);assert.ok(actual.scriptBytes<=3200);}
  assert.equal(new Set(oracle.cases.map(c=>c.policyId)).size,256);
});

test('A changed fixed source fails before untrusted bytes reach the UPLC parser',async()=>{
  const fixture=await mkdtemp(join(tmpdir(),'capsule-fixed-pin-'));await copyFile(new URL('../src/index.mjs',import.meta.url),join(fixture,'index.mjs'));await symlink(new URL('../node_modules',import.meta.url).pathname,join(fixture,'node_modules'));
  const fixed=await readFile(new URL('../src/fixed-blueprint.mjs',import.meta.url),'utf8');assert.ok(fixed.includes('590be1'));await writeFile(join(fixture,'fixed-blueprint.mjs'),fixed.replaceAll('590be1','ffffff'));
  await assert.rejects(import(pathToFileURL(join(fixture,'index.mjs'))),/Trusted blueprint SHA-256 mismatch/);
});
