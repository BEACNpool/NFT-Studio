/** Independent SDK checks against the fixed Aiken CLI oracle; no evidence URL is fetched. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
const trustedBytes=await readFile(new URL('../../experiments/capsule-parameterizer/trusted/plutus.json',import.meta.url));assert.ok(trustedBytes.length<=32768);
const trustedBlueprint=JSON.parse(trustedBytes);
const oracleUrl=new URL('../../experiments/capsule-parameterizer/fixtures/aiken-oracle.json',import.meta.url);
const checked=raw=>{assert.ok(!raw.isError,raw.content?.[0]?.text);return raw.structuredContent||JSON.parse(raw.content[0].text);};
export async function loadCapsuleOracle(){const bytes=await readFile(oracleUrl);assert.ok(bytes.length<2*1024*1024);const oracle=JSON.parse(bytes);assert.equal(oracle.cases.length,256);return oracle;}
export function assertCapsuleApplication(result,expected,source){
  const app=result.application;assert.equal(app.schema,'beacn.state-capsule.applied.v1');assert.equal(createHash('sha256').update(trustedBytes).digest('hex'),source.blueprintSha256);assert.equal(app.readiness,'experimental-parameterized-only');assert.equal(app.plutusVersion,'PlutusV3');assert.equal(app.uplcVersion,'1.1.0');
  assert.equal(app.compiledCode,expected.compiledCode);assert.equal(app.policyId,expected.policyId);assert.equal(app.scriptHash,expected.policyId);assert.equal(app.scriptBytes,expected.scriptBytes);assert.deepEqual(app.source,source);
  assert.deepEqual(app.parameters.seed,expected.input.seed);assert.equal(app.parameters.baseName,expected.input.baseName);assert.equal(app.parameters.baseNameHex,Buffer.from(expected.input.baseName).toString('hex'));
  assert.deepEqual(app.assetNames,{baseNameHex:app.parameters.baseNameHex,referenceAssetNameHex:'000643b0'+app.parameters.baseNameHex,userAssetNameHex:'000de140'+app.parameters.baseNameHex});
  assert.equal(app.appliedBlueprint.validators.length,3);for(const v of app.appliedBlueprint.validators){assert.equal(v.compiledCode,expected.compiledCode);assert.equal(v.hash,expected.policyId);assert.ok(!v.parameters?.length);}
  const expectedBlueprint=structuredClone(trustedBlueprint);for(const validator of expectedBlueprint.validators){delete validator.parameters;validator.compiledCode=expected.compiledCode;validator.hash=expected.policyId;}
  assert.deepEqual(app.appliedBlueprint,expectedBlueprint);assert.deepEqual(JSON.parse(app.appliedBlueprintJson),app.appliedBlueprint);assert.equal(createHash('sha256').update(app.appliedBlueprintJson).digest('hex'),app.appliedBlueprintSha256);
  assert.deepEqual(app.limitations,{seedExistsVerified:false,seedUnspentVerified:false,seedOwnershipVerified:false,transactionPrepared:false,nodeEvaluated:false,walletApproved:false,signed:false,submitted:false,chainInclusionVerified:false});
  assert.equal(result.processing.networkRequestsByTool,false);assert.equal(result.processing.inputPersistedByTool,false);assert.match(result.processing.privacy,/Remote MCP receives this reference and name/);
  const script=CSL.PlutusScript.new_v3(Buffer.from(app.compiledCode,'hex'));const hash=script.hash();assert.equal(hash.to_hex(),app.policyId);hash.free();script.free();
  assert.ok(Buffer.byteLength(JSON.stringify(result))<=80*1024);assert.ok(!Object.hasOwn(result,'packetId'));
}
export async function verifyCapsuleTool(client,tools,{allFixtures=false}={}){
  const tool=tools.find(t=>t.name==='apply_state_capsule_parameters');assert.ok(tool);assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false});
  assert.equal(tool.inputSchema.additionalProperties,false);assert.equal(tool.inputSchema.properties.seed.additionalProperties,false);
  const oracle=await loadCapsuleOracle(),selected=allFixtures?oracle.cases:[0,32,64,128,255].map(index=>oracle.cases[index]);
  for(const item of selected){const result=checked(await client.callTool({name:tool.name,arguments:item.input}));assertCapsuleApplication(result,item,oracle.source);}
  const caps=checked(await client.callTool({name:'studio_capabilities',arguments:{}})).stateCapsuleParameterization;assert.equal(caps.tool,tool.name);assert.equal(caps.status,'experimental-parameterized-only');assert.deepEqual(caps.source,oracle.source);assert.equal(caps.networkRequestsByTool,false);assert.equal(caps.transactionPreparation,false);assert.equal(caps.remoteServerReceivesSeedReferenceAndName,true);
  return {tool:tool.name,fixtures:selected.length,handlerByteComparisons:selected.length*3,aikenOracleBytesMatch:true,cslScriptHashesMatch:true,parameterizedOnly:true,chainStateVerified:false,evidenceUrlsFetched:false};
}
