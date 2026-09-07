import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createPublicMcpHandler } from '../dist/worker.mjs';
const origin='https://mcp.example.org';
const config={publicOrigin:origin,studioUrl:'https://beacnpool.github.io/NFT-Studio/'};
const file={name:'hello.txt',mediaType:'text/plain',base64:Buffer.from('Hello, Cardano!').toString('base64')};
const unpack=raw=>{assert.equal(raw.isError,undefined,JSON.stringify(raw));return raw.structuredContent||JSON.parse(raw.content[0].text);};

test('Standalone web-standard Worker artifact serves modern and legacy official clients without Node, keys or wallet tools',async()=>{
  for(const mode of ['auto','legacy']){
    const handler=createPublicMcpHandler(config),client=new Client({name:'worker-integration',version:'1.0.0'},{versionNegotiation:{mode}});
    const transport=new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{fetch:(input,init)=>handler.fetch(new Request(input,init))});
    try{
      await client.connect(transport);assert.equal(client.getProtocolEra(),mode==='auto'?'modern':'legacy');
      const tools=(await client.listTools()).tools;assert.equal(tools.length,8);assert.ok(tools.every(tool=>tool.annotations.readOnlyHint));assert.ok(!tools.some(tool=>tool.name.includes('unsigned')||tool.name.includes('signed')));
      const resources=(await client.listResources()).resources;assert.ok(resources.length>20);
      const caps=unpack(await client.callTool({name:'studio_capabilities',arguments:{}}));assert.equal(caps.publicEndpoint,origin+'/mcp');assert.equal(caps.service,'public preparation only');
      const packet=unpack(await client.callTool({name:'create_mint_intent',arguments:{mode:'data',name:'Worker example',files:[file]}}));
      assert.equal(packet.intent.schema,'nft-studio.intent.v1');assert.equal(packet.intent.mode,'data');
      const proofFile={name:'proof.txt',base64:'SGVsbG8sIENhcmRhbm8h'};
      const proof=unpack(await client.callTool({name:'create_proof_record',arguments:{files:[proofFile]}}));
      const proofCheck=unpack(await client.callTool({name:'verify_proof_record',arguments:{recordCborHex:proof.artifact.recordCborHex,file:proofFile}}));
      assert.equal(proofCheck.verification.status,'match');assert.equal(proofCheck.chainInclusionChecked,false);
      assert.equal(proof.processing.networkRequestsByTool,false);

      assert.equal(packet.review.url,'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents');
      const valid=unpack(await client.callTool({name:'verify_mint_intent',arguments:{intent:JSON.parse(packet.packetJson)}}));assert.equal(valid.intent.intentHash,packet.intent.intentHash);
      const invalid=await client.callTool({name:'create_mint_intent',arguments:{mode:'data',name:'Bad',files:[{...file,name:'../../x'}]}});assert.equal(invalid.isError,true);
      let error=false;try{const bad=await client.callTool({name:'prepare_unsigned_transaction',arguments:{wallet:'disallowed'}});error=bad.isError;}catch{error=true;}assert.ok(error);
      await assert.rejects(client.readResource({uri:'file:///etc/passwd'}));
    }finally{await client.close();await handler.close();}
  }
});

test('Public Worker enforces exact host/origin, byte/JSON/method bounds and documented per-isolate rate limit',async()=>{
  assert.throws(()=>createPublicMcpHandler({...config,publicOrigin:'http://mcp.example.org'}));
  assert.throws(()=>createPublicMcpHandler({...config,allowedOrigins:['https://example.org/path']}));
  assert.throws(()=>createPublicMcpHandler({...config,studioUrl:config.studioUrl+'?untrusted=1'}));
  const handler=createPublicMcpHandler(config);
  const req=(body='{}',headers={},url=origin+'/mcp',method='POST')=>handler.fetch(new Request(url,{method,headers:{'content-type':'application/json',...headers},...(method==='GET'?{}:{body})}));
  try{
    assert.equal((await req('{}',{},'https://attacker.example/mcp')).status,403);
    // An internal proxy Host does not replace the authoritative Worker URL origin.
    assert.equal((await req('{}',{host:'internal-proxy.example'})).status,400);
    assert.equal((await req('{}',{origin:'https://mcp.example.org.evil'})).status,403);
    assert.equal((await req('{}',{origin:'null'})).status,403);
    assert.equal((await req('{}',{},origin+'/mcp?path=/etc/passwd')).status,404);
    assert.equal((await req('x'.repeat(98305))).status,413);
    assert.equal((await req('{')).status,400);
    assert.equal((await req('[]')).status,400);
    assert.equal((await req(new Uint8Array([255]))).status,400);
    assert.equal((await req('{}',{'content-type':'text/plain'})).status,415);
    assert.equal((await req('{}',{'content-encoding':'gzip'})).status,415);
    assert.equal((await req(undefined,{},undefined,'GET')).status,405);
    const preflight=await req('',{origin:'https://beacnpool.github.io'},undefined,'OPTIONS');assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://beacnpool.github.io');assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
  }finally{await handler.close();}
  const low=createPublicMcpHandler({...config,rateLimit:1});try{await low.fetch(new Request(origin+'/mcp'));assert.equal((await low.fetch(new Request(origin+'/mcp'))).status,429);}finally{await low.close();}
});

test('A configured application MCP route advertises its exact path and rejects all other routes',async()=>{
  for(const endpointPath of ['', '/', '/mcp/', '//mcp', '/a/../mcp', '/mcp?x=1', '/mcp#fragment', '/a%2fb', 1]) assert.throws(()=>createPublicMcpHandler({...config,endpointPath}),/MCP path/);
  const handler=createPublicMcpHandler({...config,endpointPath:'/api/mcp'});
  try{
    assert.equal((await handler.fetch(new Request(origin+'/mcp'))).status,404);
    assert.equal((await handler.fetch(new Request(origin+'/api/mcp?x=1'))).status,404);
    const client=new Client({name:'custom-route-check',version:'1.0.0'});
    try{
      await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/api/mcp'),{fetch:(input,init)=>handler.fetch(new Request(input,init))}));
      const caps=unpack(await client.callTool({name:'studio_capabilities',arguments:{}}));
      assert.equal(caps.publicEndpoint,origin+'/api/mcp');
      assert.equal((await client.listTools()).tools.length,8);
    }finally{await client.close();}
  }finally{await handler.close();}
});
