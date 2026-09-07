import test from 'node:test';
import assert from 'node:assert/strict';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {createService} from '../dist/server.mjs';
import {createHttpService} from '../dist/http.mjs';
import {createPublicMcpHandler} from './workerd-helper.mjs';
import {verifyCipSourceTools} from '../integration/verify-cip-source-tools.mjs';
import {PUBLIC_TOOL_NAMES,NODE_TOOL_NAMES} from '../integration/tool-names.mjs';
for(const era of ['auto','legacy']){
 test('Pinned original CIP source tools via Node official '+era+' SDK',async()=>{
  const service=createService({protocol:()=>{throw Error('Source tools cannot read protocol')}}),http=createHttpService({port:0,token:'synthetic-corpus-test-token-0000000000000000000',service});
  const addr=await http.listen(),client=new Client({name:'corpus-node',version:'1.0.0'},{versionNegotiation:{mode:era}});
  try{await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:'+addr.port+'/mcp'),{requestInit:{headers:{authorization:'Bearer synthetic-corpus-test-token-0000000000000000000'}}}));
    assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),NODE_TOOL_NAMES);assert.equal(NODE_TOOL_NAMES.length,17);await verifyCipSourceTools(client);
  }finally{await client.close();await http.close();}
 });
 test('Pinned original CIP source tools in actual Workerd official '+era+' SDK',async()=>{
  const origin='https://corpus.example.org',handler=await createPublicMcpHandler({publicOrigin:origin,rateLimit:250}),client=new Client({name:'corpus-worker',version:'1.0.0'},{versionNegotiation:{mode:era}});
  try{await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{fetch:(input,init)=>handler.fetch(new Request(input,init))}));assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),PUBLIC_TOOL_NAMES);assert.equal(PUBLIC_TOOL_NAMES.length,15);await verifyCipSourceTools(client);assert.equal(handler.calls.length,0);
  }finally{await client.close();await handler.close();}
 });
}
