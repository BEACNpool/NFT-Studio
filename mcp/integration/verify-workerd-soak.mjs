/** Local synthetic 1,000-build soak. Diagnostic exports exist only in the test VM. */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import {createPublicMcpHandler} from '../test/workerd-helper.mjs';
import {address,utxo,payload} from '../test/wallet-fixtures.mjs';
const origin='https://candidate.example.org',count=1000;
// This local-test-only cap encourages GC under a smaller heap than the host limit.
process.env.MINIFLARE_WORKERD_V8_FLAGS='--max-old-space-size=64';
const handler=await createPublicMcpHandler({publicOrigin:origin,endpointPath:'/api/mcp',rateLimit:1000},{memoryProbe:true});
const checked=raw=>{assert.ok(!raw.isError,raw.content?.[0]?.text);return raw.structuredContent||JSON.parse(raw.content[0].text);};
let client,ws,sequence=0;const waiting=new Map();
async function connect(){client=new Client({name:'synthetic-workerd-soak',version:'1.0.0'});await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/api/mcp'),{fetch:(url,init)=>handler.dispatchFetch(url,init)}));}
const call=(name,args)=>client.callTool({name,arguments:args}).then(checked);
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{waiting.delete(id);reject(new Error('Inspector deadline: '+method));},5000);waiting.set(id,{resolve:result=>{clearTimeout(timer);resolve(result);},reject});ws.send(JSON.stringify({id,method,params}));});
const samples=[];
async function sample(builds){const memory=await(await handler.dispatchFetch(origin+'/__fixture_memory__')).json();const heap=await cdp('Runtime.getHeapUsage');samples.push({builds,wasmLinearBytes:memory.linearBytes,...heap});console.log(JSON.stringify(samples.at(-1)));assert.ok(memory.linearBytes+heap.usedSize+heap.embedderHeapUsedSize+heap.backingStorageSize<112*1024*1024,'Observed JS + WASM + embedder/backing usage leaves headroom below 128 MiB.');}
const start=Date.now();
try{
  const inspector=await handler.getInspectorURL();
  const discovery=new URL('/json/list',inspector);discovery.protocol='http:';
  const targets=await(await fetch(discovery)).json();
  const target=targets.find(t=>t.id==='core:user:');assert.ok(target?.webSocketDebuggerUrl);
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const value=JSON.parse(event.data),pending=waiting.get(value.id);if(pending){waiting.delete(value.id);value.error?pending.reject(new Error(JSON.stringify(value.error))):pending.resolve(value.result);}});
  await connect();
  const intent=(await call('create_mint_intent',{...payload,mode:'nft'})).intent;
  const dataIntent=(await call('create_mint_intent',{...payload,mode:'data'})).intent;
  const request={intent,wallet:{changeHex:address().to_hex(),utxos:[utxo(1,{tokens:3})]}};
  const cases=[request,{...request,intent:dataIntent},{...request,wallet:{changeHex:address().to_hex(),utxos:[utxo(2,{coin:1500000}),utxo(3,{coin:1500000,key:'cd'})]}},{...request,wallet:{changeHex:address().to_hex(),utxos:Array.from({length:32},(_,i)=>utxo(100+i,{tokens:16}))}}];
  await sample(0);
  for(let i=1;i<=count;i++){
    if(i===501){await client.close();await handler.dispatchFetch(origin+'/__fixture_reset_handler__');await connect();}
    const input=cases[(i-1)%cases.length];
    const result=await call('prepare_unsigned_transaction',input);
    assert.equal(result.submitted,false);assert.equal(result.signed,false);assert.equal(result.intentHash,input.intent.intentHash);
    const fixed=C.FixedTransaction.from_hex(result.unsignedHex);assert.equal(result.transactionHash,fixed.transaction_hash().to_hex());fixed.free();
    if(i%50===0)await sample(i);
  }
  assert.equal(handler.calls.length,count*2);
  const collecting=cdp('HeapProfiler.collectGarbage');
  for(let i=0;i<10;i++){await handler.dispatchFetch(origin+'/__fixture_memory__');await new Promise(resolve=>setTimeout(resolve,20));}
  await collecting;await sample('after-diagnostic-GC');
  const report={schema:'nft-studio.workerd-native-soak.v1',status:'pass',builds:count,cases:{nft:250,data:250,twoPaymentKeys:250,maximumUtxosAndNativeAssetCount:250},localV8Flags:process.env.MINIFLARE_WORKERD_V8_FLAGS,runtime:'Actual Miniflare/Workerd',compatibilityDate:'2026-05-15',nodeCompatibility:false,elapsedMs:Date.now()-start,publicNetworkCalls:0,syntheticProtocolReads:handler.calls.length,realWallets:0,privateKeys:0,signatures:0,submissions:0,inspectorTarget:target.id,forcedGarbageCollections:1,handlerResetAt:500,wasmInstanceResets:0,artifacts:{workerSha256:createHash('sha256').update(await readFile(new URL('../dist/worker.mjs',import.meta.url))).digest('hex')},samples,limits:'WASM linear capacity and CDP V8 heap measurements are recorded separately. They do not measure all isolate overhead or establish production CPU capacity. Workerd is tested with a local-only 64 MiB V8 old-space cap. There is no forced GC during the 1,000-build run; a single final diagnostic GC measures retained heap after completion. The test-only handler reset bypasses the configured request-window cap after 500 builds while preserving the exact same WASM instance.'};
  await writeFile(new URL('../workerd-soak-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,builds:count,elapsedMs:report.elapsedMs,initial:samples[0],final:samples.at(-1)}));
}finally{ws?.close();await client?.close();await handler.close();}
