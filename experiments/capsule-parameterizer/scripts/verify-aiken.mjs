/** Local oracle cross-check: the pinned Aiken binary only receives generated public fixtures. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import {applyCapsuleParameters,CAPSULE_PARAMETERIZER_SOURCE} from '../src/index.mjs';
import {parameterFixtures} from '../test/fixtures.mjs';
import {assetNames,serialiseData,toHex} from '../trusted/capsule-codec.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const executable=process.env.AIKEN_BIN||'aiken';
function aiken(args){const run=spawnSync(executable,args,{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:512*1024,shell:false});assert.equal(run.status,0,run.error?.message||run.stderr||run.stdout);return run.stdout.trim();}
assert.equal(aiken(['--version']),'aiken v1.1.23+8949565');
const pathLookup=spawnSync('which',[executable],{encoding:'utf8',shell:false});assert.equal(pathLookup.status,0);const resolved=await realpath(pathLookup.stdout.trim());
const binarySha256=createHash('sha256').update(await readFile(resolved)).digest('hex');
const temp=await mkdtemp(join(tmpdir(),'capsule-parameter-oracle-'));const cases=[];const started=performance.now();
for(const [index,input]of parameterFixtures().entries()){
  const actual=applyCapsuleParameters(input);
  const seedCbor=toHex(serialiseData({constructor:0,fields:[{bytes:input.seed.transactionId},{int:input.seed.outputIndex}]}));
  const nameCbor=toHex(serialiseData({bytes:assetNames(input.baseName).baseNameHex}));
  assert.equal(actual.parameters.seedCborHex,seedCbor);assert.equal(actual.parameters.baseNameCborHex,nameCbor);
  const seedFile=join(temp,'seed-'+index+'.json'),appliedFile=join(temp,'applied-'+index+'.json');
  aiken(['blueprint','apply','-i','trusted/plutus.json','-o',seedFile,seedCbor]);
  aiken(['blueprint','apply','-i',seedFile,'-o',appliedFile,nameCbor]);
  const expected=JSON.parse(await readFile(appliedFile,'utf8'));
  assert.deepEqual(actual.appliedBlueprint,expected,'Complete blueprint differs for fixture '+index);
  for(const validator of expected.validators){
    assert.equal(validator.compiledCode,actual.compiledCode);assert.equal(validator.hash,actual.policyId);assert.ok(!validator.parameters?.length);
    const script=CSL.PlutusScript.new_v3(Buffer.from(validator.compiledCode,'hex'));const hash=script.hash();assert.equal(hash.to_hex(),actual.policyId);hash.free();script.free();
  }
  cases.push({input,compiledCode:actual.compiledCode,policyId:actual.policyId,scriptBytes:actual.scriptBytes,compiledCodeSha256:createHash('sha256').update(Buffer.from(actual.compiledCode,'hex')).digest('hex')});
  if((index+1)%64===0)console.log('Aiken CLI + CSL byte/hash parity: '+(index+1)+'/256');
}
assert.equal(new Set(cases.map(c=>c.policyId)).size,256);
await mkdir(join(root,'evidence'),{recursive:true});await writeFile(join(root,'fixtures/aiken-oracle.json'),JSON.stringify({schema:'beacn.capsule-parameter-oracle.v1',source:CAPSULE_PARAMETERIZER_SOURCE,cases},null,2)+'\n');
const receipt={schema:'beacn.capsule-parameter-check.v1',status:'pass',checkedAt:new Date().toISOString(),aikenVersion:'v1.1.23+8949565',aikenBinarySha256:binarySha256,cases:cases.length,handlerByteComparisons:cases.length*3,cliInvocations:cases.length*2,distinctPolicies:256,completeAppliedBlueprintsEqual:true,sharedCodecParameterCborEqual:true,independentCslVersion:'17.0.0',independentCslScriptHashesEqual:true,source:CAPSULE_PARAMETERIZER_SOURCE,elapsedMs:Math.round(performance.now()-started),sourceCheckoutEdited:false,publicNetworkCalls:0,walletAccess:false,transactionPrepared:false,nodeEvaluation:false,signing:false,submission:false};
await writeFile(join(root,'evidence/aiken-parity.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
