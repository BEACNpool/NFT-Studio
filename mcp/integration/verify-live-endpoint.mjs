import {PUBLIC_TOOL_NAMES} from './tool-names.mjs';
/** Explicit, read-only public MCP release check; only synthetic content is sent. */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

export function parseLiveOptions(args) {
  let target,expectedTools=8,expectedResources=55,seen=false,seenResources=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--expected-tools'){
      if(seen||!['8','9','10','12','13','15'].includes(args[++i]))throw new Error('--expected-tools must be 8, 9, 10, 12, 13 or 15, provided once.');
      expectedTools=Number(args[i]);seen=true;
    }else if(args[i]==='--expected-resources'){
      if(seenResources||!['55','56','61'].includes(args[++i]))throw new Error('--expected-resources must be 55, 56 or 61, provided once.');
      expectedResources=Number(args[i]);seenResources=true;
    }else if(args[i].startsWith('-')||target)throw new Error('Usage: verify-live-endpoint.mjs HTTPS_ENDPOINT [--expected-tools 8|9|10|12|13|15] [--expected-resources 55|56|61]');
    else target=args[i];
  }
  const endpoint=new URL(target||'');
  if(endpoint.protocol!=='https:'||!['/mcp','/api/mcp'].includes(endpoint.pathname)||endpoint.search||endpoint.hash||endpoint.username||endpoint.password)throw new Error('Pass the exact public HTTPS /mcp or /api/mcp endpoint.');
  return {endpoint,expectedTools,expectedResources};
}
/** Injectable transport exists for local tests; importing this module never performs I/O. */
export async function verifyLiveEndpoint({endpoint,expectedTools=8,expectedResources=55,fetchImpl=fetch}) {
  ({endpoint,expectedTools,expectedResources}=parseLiveOptions([String(endpoint),'--expected-tools',String(expectedTools),'--expected-resources',String(expectedResources)]));
const checked = result => {
  assert.ok(!result.isError, JSON.stringify(result));
  return result.structuredContent || JSON.parse(result.content[0].text);
};
const checks = [];
const boundedFetch = async (url, init = {}) => {
  assert.equal(String(url),endpoint.href,'Release verifier must not follow alternate service URLs.');
  const response=await fetchImpl(url,{...init,redirect:'manual',signal:AbortSignal.timeout(20000)});
  assert.ok(response.status<300||response.status>=400,'Redirected release endpoint.');
  if(!response.body)return response;
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;assert.ok(size<=1048576,'Release response exceeds 1 MiB.');chunks.push(value);}}
  finally{void reader.cancel().catch(()=>{});}
  return new Response(Buffer.concat(chunks),{status:response.status,headers:response.headers});
};
const implementationCheck=expectedResources>=56?await import('./verify-implementation-resource.mjs'):null;
const native=expectedTools>=9?await import('./verify-synthetic-native.mjs'):null;
const capsule=expectedTools>=10?await import('./verify-capsule-parameters.mjs'):null;
const music=expectedTools>=12?await import('./verify-music-tools.mjs'):null;
const cipSources=expectedTools===15?await import('./verify-cip-source-tools.mjs'):null;
const musicUnsigned=expectedTools>=13?await import('./verify-music-unsigned.mjs'):null;
for (const mode of ['auto', 'legacy']) {
  const client = new Client({ name: 'nft-studio-public-release-check', version: '1.0.0' }, { versionNegotiation: { mode } });
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint, { fetch: boundedFetch }));
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, expectedTools);
    const expectedNames=PUBLIC_TOOL_NAMES.filter(name=>(expectedTools>=9||name!=='prepare_unsigned_transaction')&&(expectedTools>=10||name!=='apply_state_capsule_parameters')&&(expectedTools>=12||!['create_music_release','verify_music_release'].includes(name))&&(expectedTools>=13||name!=='prepare_unsigned_music_transaction')&&(expectedTools===15||!['search_cip_sources','get_cip_source_chunk'].includes(name)));
    assert.deepEqual(tools.map(tool=>tool.name).sort(),expectedNames);
    for (const forbidden of [...(expectedTools===8?['prepare_unsigned_transaction']:[]), 'verify_signed_transaction', 'sign_transaction', 'submit_transaction']) {
      assert.ok(!tools.some(tool => tool.name === forbidden));
    }
    if(expectedTools>=9){const tool=tools.find(tool=>tool.name==='prepare_unsigned_transaction');assert.ok(tool);assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:true});}
    const capsuleParameters=capsule?await capsule.verifyCapsuleTool(client,tools):undefined;
    const musicPackages=music?await music.verifyMusicTools(client,tools):undefined;
    const sourceCorpus=cipSources?await cipSources.verifyCipSourceRelease(client):undefined;
    const unsignedMusic=musicUnsigned?await musicUnsigned.verifyMusicUnsignedTool(client,tools):undefined;
    const resources = (await client.listResources()).resources;
    assert.equal(resources.length, expectedResources);
    if(expectedResources===55)assert.ok(!resources.some(resource=>resource.uri==='nft-studio://implementations'));
    const implementations=implementationCheck?await implementationCheck.verifyImplementationResources(client,resources):undefined;
    const caps = checked(await client.callTool({ name: 'studio_capabilities', arguments: {} }));
    assert.equal(caps.publicEndpoint, endpoint.href);
    const search = checked(await client.callTool({ name: 'search_knowledge', arguments: { query: 'CIP-68', limit: 2 } }));
    assert.ok(search.results.length > 0);
    const read = checked(await client.callTool({ name: 'read_knowledge', arguments: { id: search.results[0].id } }));
    assert.ok(read.sources.length > 0);
    const args = { mode: 'data', name: 'Public MCP check', files: [{ name: 'hello.txt', mediaType: 'text/plain', base64: 'SGVsbG8sIENhcmRhbm8h' }] };
    const intent = checked(await client.callTool({ name: 'create_mint_intent', arguments: args }));
    const verified = checked(await client.callTool({ name: 'verify_mint_intent', arguments: { intent: intent.intent } }));
    assert.equal(verified.intent.intentHash, intent.intent.intentHash);
    assert.equal(intent.review.url, 'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents');
    const file = { name: 'hello.txt', base64: args.files[0].base64 };
    const proof = checked(await client.callTool({ name: 'create_proof_record', arguments: { files: [file] } }));
    const match = checked(await client.callTool({ name: 'verify_proof_record', arguments: { recordCborHex: proof.artifact.recordCborHex, file } }));
    assert.equal(match.verification.status, 'match');
    assert.equal(match.chainInclusionChecked, false);
    const changed = checked(await client.callTool({ name: 'verify_proof_record', arguments: { recordCborHex: proof.artifact.recordCborHex, file: { ...file, base64: 'Q2hhbmdlZA==' } } }));
    assert.equal(changed.verification.status, 'mismatch');
    const poisoned = structuredClone(intent.intent);
    poisoned.intentHash = '00'.repeat(32);
    assert.equal((await client.callTool({ name: 'verify_mint_intent', arguments: { intent: poisoned } })).isError, true);
    const unsigned=[];
    if(native){
      assert.equal(caps.unsignedPreparation.chainUnspentVerified,false);assert.equal(caps.unsignedPreparation.ownershipVerified,false);assert.equal(caps.unsignedPreparation.serverState,'none');
      assert.match(caps.privacy,/wallet addresses and UTxO CBOR/);
      for(const mintMode of ['nft','data']){
        const fixture=native.syntheticNativeFixture(mintMode);
        const packet=checked(await client.callTool({name:'create_mint_intent',arguments:fixture.args}));
        native.assertSyntheticIntent(packet.intent,fixture.args);
        const prepared=checked(await client.callTool({name:'prepare_unsigned_transaction',arguments:{intent:packet.intent,wallet:fixture.wallet}}));
        unsigned.push(native.assertSyntheticUnsigned(prepared,packet.intent,fixture));
      }
    }
    checks.push({...(sourceCorpus?{sourceCorpus}:{}),...(unsignedMusic?{unsignedMusic}:{}),...(musicPackages?{musicPackages}:{}),...(capsuleParameters?{capsuleParameters}:{}),...(native?{unsigned}:{}),...(implementations?{implementations}:{}), protocolEra: client.getProtocolEra(), tools: tools.map(tool => tool.name), resources: resources.length, knowledge: 'pass', intentRoundtrip: 'pass', proofMatchAndMismatch: 'pass', changedIntentRejected: true });
  } finally {
    await client.close();
  }
}
const preflight = await boundedFetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://beacnpool.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,mcp-protocol-version,mcp-method,mcp-name' } });
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://beacnpool.github.io');
const allowedHeaders=(preflight.headers.get('access-control-allow-headers')||'').toLowerCase().split(',').map(x=>x.trim());
for(const header of ['content-type','mcp-protocol-version','mcp-method','mcp-name'])assert.ok(allowedHeaders.includes(header),'Missing browser SDK preflight header: '+header);
assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
const denied = await boundedFetch(endpoint, { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' });
assert.equal(denied.status, 403);
return { expectedTools,expectedResources,syntheticWalletDataSent:expectedTools>=9, schema: 'nft-studio.public-mcp-check.v1', checkedAt: new Date().toISOString(), endpoint: endpoint.href, status: 'pass', checks, browserPreflight: 'pass', foreignOriginRejected: true, walletAccess: false, chainSubmission: false };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await verifyLiveEndpoint(parseLiveOptions(process.argv.slice(2))),null,2));
