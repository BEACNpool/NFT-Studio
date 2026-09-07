import {verifyCipSourceRelease} from './verify-cip-source-tools.mjs';
import {PUBLIC_TOOL_NAMES} from './tool-names.mjs';
import {verifyCapsuleTool} from './verify-capsule-parameters.mjs';
import {verifyMusicTools} from './verify-music-tools.mjs';
import {verifyMusicUnsignedTool} from './verify-music-unsigned.mjs';
/** Actual Workerd + official SDK integration against a staged application build. */
import assert from 'node:assert/strict';
import {verifyImplementationResources} from './verify-implementation-resource.mjs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import {protocolFixture} from '../test/workerd-helper.mjs';
import {address,utxo} from '../test/wallet-fixtures.mjs';
import { createHash } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--dist','--project-root'].includes(args[i])||!args[i+1])throw new Error('Usage: node verify-site-wrapper.mjs --dist /staged/dist --project-root /source/checkout');options[args[i]]=args[i+1];}
if(!options['--dist']||!options['--project-root'])throw new Error('Staged dist and project root are required.');
const dist=resolve(options['--dist']),projectRoot=resolve(options['--project-root']);
const require=createRequire(join(projectRoot,'package.json'));
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(require.resolve('miniflare')));
const record=JSON.parse(await readFile(join(dist,'mcp-wrapper-receipt.json'),'utf8'));
const origin=record.publicOrigin;
assert.equal(new URL(origin).protocol,'https:');
assert.equal(new URL(origin).origin,origin);
const config=JSON.parse(await readFile(join(dist,'server/wrangler.json'),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(record.sourceAppSha256,digest(await readFile(join(dist,'server/studio-app.js'))));
assert.equal(record.wasm.sha256,digest(await readFile(join(dist,'server',record.wasm.filename))));
const quote=protocolFixture(),protocolReads=[];
const runtime=async(entry)=>{const options={
  compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags||[],
  modulesRoot:join(dist,'server'),
  modules:[{type:'ESModule',path:join(dist,'server',entry)},...(await listFiles(join(dist,'server'))).filter(file=>/\.m?js$/.test(file)&&file!==join(dist,'server',entry)).map(path=>({type:'ESModule',path})),...(await listFiles(join(dist,'server'))).filter(file=>file.endsWith('.wasm')).map(path=>({type:'CompiledWasm',path}))],
  assets:{directory:join(dist,'client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:false}},
  outboundService:async request=>{
    assert.equal(request.method,'GET');assert.equal(request.headers.get('authorization'),null);assert.equal(await request.text(),'');
    assert.ok(['https://koios.beacn.workers.dev/api/v1/tip','https://koios.beacn.workers.dev/api/v1/epoch_params?order=epoch_no.desc&limit=1'].includes(request.url));
    protocolReads.push(request.url);return Response.json([request.url.endsWith('/tip')?quote.tip:quote.parameters]);
  },
};return new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);};
const baseline=await runtime('studio-app.js'),wrapped=await runtime('index.js');
const observations=[];
const checked=raw=>{assert.ok(!raw.isError,JSON.stringify(raw));return raw.structuredContent||JSON.parse(raw.content[0].text);};
async function listFiles(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const file=join(directory,entry.name);if(entry.isDirectory())result.push(...await listFiles(file));else result.push(file);}return result;}
try{
  const files=await listFiles(join(dist,'client'));
  const assetPaths=[relative(join(dist,'client'),files.find(file=>file.endsWith('/studio-navigation.js'))),relative(join(dist,'client'),files.find(file=>file.endsWith('.css'))),relative(join(dist,'client'),files.find(file=>file.endsWith('.svg')||file.endsWith('.png')))];
  for(const path of assetPaths){
    const a=await baseline.dispatchFetch(origin+'/'+path),b=await wrapped.dispatchFetch(origin+'/'+path);
    assert.equal(a.status,200,`Baseline asset ${path}`);assert.equal(b.status,200,`Wrapped asset ${path}`);
    const expected=await readFile(join(dist,'client',path));
    assert.equal(digest(Buffer.from(await a.arrayBuffer())),digest(expected));
    assert.equal(digest(Buffer.from(await b.arrayBuffer())),digest(expected));
    assert.equal(b.headers.get('content-type'),a.headers.get('content-type'));
    observations.push({route:'/'+path,status:200,byteIdentical:true});
  }
  const serverConfig=JSON.parse(await readFile(join(dist,'server/vinext-server.json'),'utf8'));
  const homePath=serverConfig.basePath?serverConfig.basePath+'/':'/';
  // Some prior Pages builds encode basePath in the bundle rather than vinext-server.json.
  const homeCandidates=[homePath,'/NFT-Studio/','/NFT-Studio'];
  let observedHome=false;
  for(const path of [...new Set(homeCandidates)]){
    const a=await baseline.dispatchFetch(origin+path),b=await wrapped.dispatchFetch(origin+path);
    assert.equal(b.status,a.status,`App fallback status ${path}`);
    observations.push({route:path,baselineStatus:a.status,wrappedStatus:b.status,location:a.headers.get('location')});
    const first=await a.text(),second=await b.text();
    if(a.status===200){assert.match(first,/NFT.Studio/i);assert.match(second,/NFT.Studio/i);observedHome=true;observations.push({route:path,status:200,appFallback:true});break;}
  }
  assert.ok(observedHome,'The original application must render at its configured base path. '+JSON.stringify(observations));
  for(const mode of ['auto','legacy']){
    const client=new Client({name:'nft-studio-wrapped-workerd-check',version:'1.0.0'},{versionNegotiation:{mode}});
    try{
      await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/api/mcp'),{fetch:(url,init)=>wrapped.dispatchFetch(url,init)}));
      const tools=(await client.listTools()).tools;assert.deepEqual(tools.map(t=>t.name).sort(),PUBLIC_TOOL_NAMES);
      const capsuleParameters=await verifyCapsuleTool(client,tools);
      const musicPackages=await verifyMusicTools(client,tools);
      const unsignedMusic=await verifyMusicUnsignedTool(client,tools);
      const sourceCorpus=await verifyCipSourceRelease(client);
      const resources=(await client.listResources()).resources;
      const implementations=await verifyImplementationResources(client,resources);
      const caps=checked(await client.callTool({name:'studio_capabilities',arguments:{}}));assert.equal(caps.publicEndpoint,origin+'/api/mcp');
      const search=checked(await client.callTool({name:'search_knowledge',arguments:{query:'CIP-68',limit:2}}));assert.ok(search.results.length>0);
      const intent=checked(await client.callTool({name:'create_mint_intent',arguments:{mode:'data',name:'Wrapped app proof',files:[{name:'hello.txt',mediaType:'text/plain',base64:'SGVsbG8sIENhcmRhbm8h'}]}}));
      const verified=checked(await client.callTool({name:'verify_mint_intent',arguments:{intent:intent.intent}}));assert.equal(verified.intent.intentHash,intent.intent.intentHash);
      assert.equal(intent.review.url,'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents');
      const proofFile={name:'proof.txt',base64:'SGVsbG8sIENhcmRhbm8h'};
      const proof=checked(await client.callTool({name:'create_proof_record',arguments:{files:[proofFile]}}));
      const proofCheck=checked(await client.callTool({name:'verify_proof_record',arguments:{recordCborHex:proof.artifact.recordCborHex,file:proofFile}}));
      assert.equal(proofCheck.verification.status,'match');assert.equal(proofCheck.chainInclusionChecked,false);

      const prepared=checked(await client.callTool({name:'prepare_unsigned_transaction',arguments:{intent:intent.intent,wallet:{changeHex:address().to_hex(),utxos:[utxo(1,{tokens:3})]}}}));
      assert.equal(prepared.schema,'nft-studio.stateless-unsigned.v1');assert.equal(prepared.signed,false);assert.equal(prepared.submitted,false);
      assert.equal(prepared.transactionHash,C.FixedTransaction.from_hex(prepared.unsignedHex).transaction_hash().to_hex());
      assert.equal(prepared.reviewUrl,intent.review.url);assert.match(prepared.checks.walletInputs,/unverified/);
      observations.push({route:'/api/mcp',protocolEra:client.getProtocolEra(),tools:tools.length,sourceCorpus,capsuleParameters,musicPackages,unsignedMusic,implementations,unsignedHash:prepared.transactionHash,mode:prepared.mode,resources:resources.length,intentHash:intent.intent.intentHash,proofRecordHash:proof.artifact.recordSha256,proofMatch:true});
    }finally{await client.close();}
  }
  const post=(url,body,headers={})=>wrapped.dispatchFetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body});
  assert.equal((await post('https://attacker.example/api/mcp','{}')).status,403);
  assert.equal((await post(origin+'/api/mcp','{}',{origin:'https://attacker.example'})).status,403);
  assert.equal((await post(origin+'/api/mcp','x'.repeat(98305))).status,413);
  assert.equal((await post(origin+'/api/mcp?payload=forbidden','{}')).status,404);
  assert.equal(protocolReads.length,8);
  const report={schema:'nft-studio.mcp-wrapper-check.v1',status:'pass',runtime:'Miniflare/Workerd',compatibilityDate:config.compatibility_date,sourceAppSha256:record.sourceAppSha256,mcpSha256:record.mcpSha256,wasm:record.wasm,syntheticProtocolReads:protocolReads.length,publicNetworkCalls:0,observations,negativeChecks:['wrong URL origin','wrong browser Origin','96KiB body cap','query rejection'],deployed:false,networkSubmission:false};
  await writeFile(join(dist,'mcp-wrapper-check.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await Promise.allSettled([baseline.dispose(),wrapped.dispose()]);}
