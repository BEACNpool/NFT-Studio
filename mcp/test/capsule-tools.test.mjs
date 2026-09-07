import test from 'node:test';
import assert from 'node:assert/strict';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';
import {createService} from '../dist/server.mjs';
import {createHttpService} from '../dist/http.mjs';
import {createPublicMcpHandler} from './workerd-helper.mjs';
import {verifyCapsuleTool,loadCapsuleOracle,assertCapsuleApplication} from '../integration/verify-capsule-parameters.mjs';
import {PUBLIC_TOOL_NAMES,NODE_TOOL_NAMES} from '../integration/tool-names.mjs';
const token='capsule-synthetic-local-test-only-token-000000000000000000';
const valid={seed:{transactionId:'11'.repeat(32),outputIndex:0},baseName:'CAPSULE'};
async function reject(client,args){let rejected=false;try{rejected=(await client.callTool({name:'apply_state_capsule_parameters',arguments:args})).isError===true;}catch{rejected=true;}assert.ok(rejected,'Unexpected accepted capsule parameters');}
async function invalidCases(client){
  const cases=[{}, {...valid,blueprint:{}},{...valid,compiledCode:'00'},{...valid,url:'https://attacker.invalid/'},{...valid,wallet:{}},{...valid,seed:{...valid.seed,datum:'00'}}];
  for(const baseName of ['', 'x'.repeat(29),'🦑'.repeat(8),'\ud800','\udfff','x'.repeat(4096)])cases.push({...valid,baseName});
  for(const outputIndex of [-1,65536,0.1,'0'])cases.push({...valid,seed:{...valid.seed,outputIndex}});
  for(const transactionId of ['a'.repeat(63),'A'.repeat(64),'00'.repeat(33),{}])cases.push({...valid,seed:{...valid.seed,transactionId}});
  for(const input of cases)await reject(client,input);
  const actual=await client.callTool({name:'apply_state_capsule_parameters',arguments:valid});assert.ok(!actual.isError);return cases.length;
}
for(const mode of ['auto','legacy']){
  test('Node '+mode+' SDK applies all 256 fixed capsule oracle fixtures with no provider or retained packets',async()=>{
    let reads=0;const service=createService({protocol:async()=>{reads++;throw new Error('No protocol reads allowed');}}),http=createHttpService({port:0,token,service,rateLimit:1000});const address=await http.listen();
    const client=new Client({name:'capsule-node-fixtures',version:'1.0.0'},{versionNegotiation:{mode}});
    try{
      await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:'+address.port+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token}}}));
      const tools=(await client.listTools()).tools;assert.deepEqual(tools.map(t=>t.name).sort(),NODE_TOOL_NAMES);
      const result=await verifyCapsuleTool(client,tools,{allFixtures:true});assert.equal(result.fixtures,256);assert.equal(await invalidCases(client),20);assert.equal(reads,0);assert.equal(service.packetCount(),0);
    }finally{await client.close();await http.close();service.close();}
  });
  test('Workerd '+mode+' SDK applies all 256 fixed capsule oracle fixtures while provider is unavailable',async()=>{
    const handler=await createPublicMcpHandler({publicOrigin:'https://capsules.example.org',rateLimit:1000});handler.setScenario('unavailable');const client=new Client({name:'capsule-workerd-fixtures',version:'1.0.0'},{versionNegotiation:{mode}});
    try{
      await client.connect(new StreamableHTTPClientTransport(new URL('https://capsules.example.org/mcp'),{fetch:(url,init)=>handler.dispatchFetch(url,init)}));
      const tools=(await client.listTools()).tools;assert.deepEqual(tools.map(t=>t.name).sort(),PUBLIC_TOOL_NAMES);
      const result=await verifyCapsuleTool(client,tools,{allFixtures:true});assert.equal(result.fixtures,256);assert.equal(await invalidCases(client),20);assert.equal(handler.calls.length,0);
    }finally{await client.close();await handler.close();}
  });
}
test('Actual stdio exposes the same fixed capsule tool and rejects altered script/policy claims in independent verification',async()=>{
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/cli.mjs',import.meta.url))],stderr:'pipe'}),client=new Client({name:'capsule-stdio',version:'1.0.0'});let stderr='';transport.stderr?.on('data',chunk=>{stderr+=chunk;});
  try{await client.connect(transport);const tools=(await client.listTools()).tools;assert.deepEqual(tools.map(t=>t.name).sort(),NODE_TOOL_NAMES);assert.equal((await verifyCapsuleTool(client,tools)).fixtures,5);
    const raw=await client.callTool({name:'apply_state_capsule_parameters',arguments:valid}),actual=raw.structuredContent||JSON.parse(raw.content[0].text),oracle=await loadCapsuleOracle();
    for(const change of [value=>{value.application.policyId='00'.repeat(28);},value=>{value.application.appliedBlueprint.validators[1].compiledCode='00';},value=>{value.application.limitations.nodeEvaluated=true;},value=>{value.application.source.blueprintSha256='00'.repeat(32);},value=>{value.application.parameters.seed.outputIndex=1;}]){const fake=structuredClone(actual);change(fake);assert.throws(()=>assertCapsuleApplication(fake,oracle.cases[0],oracle.source));}
  }finally{await client.close();}assert.equal(stderr,'');
});
