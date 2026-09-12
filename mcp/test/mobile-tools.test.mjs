import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {createMobileHandoff,receivePhoneTransfer} from '../dist/mobile-tools.mjs';
import {createReview} from '../create-review.mjs';
import {mobileExport} from '../mobile-export.mjs';
import {mobileRelayFixture} from './mobile-relay-fixture.mjs';
import {createPublicMcpHandler} from './workerd-helper.mjs';
const entry=fileURLToPath(new URL('./mobile-stdio-entry.mjs',import.meta.url));
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 0L20 20H0Z"/></svg>';
const args={mode:'nft',mintOptions:{quantity:25,mintWindowHours:24,traits:{Edition:'Mobile'},message:'Carried exactly'},name:'Mobile fixture',coverIndex:0,files:[{name:'cover.svg',mediaType:'image/svg+xml',base64:Buffer.from(svg).toString('base64')}]};
const unpack=r=>{assert(!r.isError,JSON.stringify(r));return r.structuredContent;};
const decode=png=>{const p=PNG.sync.read(png);return jsQR(new Uint8ClampedArray(p.data),p.width,p.height)?.data;};
for(const runtime of ['stdio','workerd'])for(const era of ['auto','legacy'])test(`${runtime} ${era}: native QR transfers exact intent, advertises boundaries and revokes`,async()=>{
 const relay=mobileRelayFixture(),origin='https://mobile-test.example.org';
 const worker=runtime==='workerd'?await createPublicMcpHandler({publicOrigin:origin},{handoffRelay:relay.fetch}):null;
 const client=new Client({name:'mobile-test',version:'1.0.0'},{versionNegotiation:{mode:era}});
 try{
  await client.connect(worker?new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{fetch:(url,init)=>worker.dispatchFetch(url,init)}):new StdioClientTransport({command:process.execPath,args:[entry],stderr:'pipe',env:{PATH:process.env.PATH}}));
  const call=async(name,args={})=>unpack(await client.callTool({name,arguments:args}));
  const tools=(await client.listTools()).tools;for(const name of ['create_mobile_handoff','revoke_mobile_handoff'])assert(tools.some(t=>t.name===name));
  assert.equal(tools.find(t=>t.name==='create_mobile_handoff').annotations.readOnlyHint,false);
  assert.equal((await call('studio_capabilities')).mobileHandoff.expiresAfterSeconds,900);
  const made=await call('create_mint_intent',args),mobile=await call('create_mobile_handoff',{intent:made.intent});
  const files=await mobileExport(mobile,made.intent);assert.equal(decode(files['mobile-qr.png']),mobile.url);
  assert.equal(mobile.qr.svg,files['mobile-qr.svg']);assert.equal(mobile.checks.exactIntentReadBack,true);
  assert(!files['mobile.html'].includes(mobile.endTransfer.arguments.revokeToken));
  if(worker){assert.deepEqual(relay.calls.map(c=>c.method),['POST','GET']);const old=globalThis.fetch;try{globalThis.fetch=relay.fetch;assert.deepEqual((await receivePhoneTransfer(new URL(mobile.url).hash)).intent,made.intent);}finally{globalThis.fetch=old;}}
  const ended=await call('revoke_mobile_handoff',mobile.endTransfer.arguments);assert.equal(ended.status,'ended-or-already-unavailable');
  assert.equal((await call('revoke_mobile_handoff',mobile.endTransfer.arguments)).status,'ended-or-already-unavailable');
  if(worker){assert.equal(relay.records.size,0);for(const scenario of ['redirect','tampered','expired']){relay.setScenario(scenario);assert.equal((await client.callTool({name:'create_mobile_handoff',arguments:{intent:made.intent}})).isError,true);assert.equal(relay.records.size,0);}relay.setScenario('normal');}
  assert.equal((await client.callTool({name:'create_mobile_handoff',arguments:{intent:{...made.intent,intentHash:'00'.repeat(32)}}})).isError,true);
 }finally{await client.close();await worker?.close();}
});
test('native transfer fails closed and revokes failed read-back; invalid intent causes no upload',async()=>{
 const client=new Client({name:'mobile-negative',version:'1.0.0'}),relay=mobileRelayFixture(),old=globalThis.fetch;
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:[entry],stderr:'pipe'}));
  const intent=unpack(await client.callTool({name:'create_mint_intent',arguments:args})).intent;globalThis.fetch=relay.fetch;
  await assert.rejects(createMobileHandoff({intent:{...intent,extra:true}}));assert.equal(relay.calls.length,0);
  for(const scenario of ['tampered','expiry-mismatch','expired','oversized','redirect','unavailable']){
   relay.setScenario(scenario);await assert.rejects(createMobileHandoff({intent}));assert.equal(relay.records.size,0,scenario);
  }
  relay.setScenario('normal');const mobile=await createMobileHandoff({intent});
  for(const change of [x=>x.url=x.url.replace('beacnpool.github.io','attacker.invalid'),x=>x.intentHash='00'.repeat(32),x=>x.expiresAt=Date.now()-1,x=>x.endTransfer.arguments.id='A'.repeat(22)]){
   const bad=structuredClone(mobile);change(bad);await assert.rejects(mobileExport(bad,intent));
  }
 }finally{globalThis.fetch=old;await client.close();}
});
test('local helper --mobile saves independently decoded QR, exact content and private revocation file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-mobile-'));
 try{
  await writeFile(join(dir,'cover.svg'),svg);await writeFile(join(dir,'request.json'),JSON.stringify({...args,files:[{path:'cover.svg',name:'cover.svg',mediaType:'image/svg+xml'}]}));
  const result=await createReview(join(dir,'request.json'),join(dir,'out'),{entry,mobile:true});
  assert.equal(decode(await readFile(join(dir,'out/mobile-qr.png'))),result.mobile.url);
  assert.equal(result.mcpCalls.at(-1),'create_mobile_handoff');assert.equal(result.signed,false);assert.equal(result.submitted,false);
  const privateFile=JSON.parse(await readFile(join(dir,'out/mobile-transfer.private.json'),'utf8'));
  assert.equal(privateFile.url,result.mobile.url);assert.equal((await stat(join(dir,'out/mobile-transfer.private.json'))).mode&0o777,0o600);
  assert(!(await readFile(join(dir,'out/mobile.html'),'utf8')).includes(privateFile.endTransfer.arguments.revokeToken));
  const intent=JSON.parse(await readFile(join(dir,'out/intent.json'),'utf8'));assert.equal(intent.intentHash,result.intentHash);assert.equal(intent.bundle.bytes,Buffer.byteLength(svg));
 }finally{await rm(dir,{recursive:true,force:true});}
});
