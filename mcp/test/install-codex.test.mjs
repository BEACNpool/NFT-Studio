import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installPlan,readExisting,preflight,assertSupportedNode} from '../install-codex.mjs';
const node='/usr/bin/node',entry='/spaces and apostrophes/Studio/mcp/dist/cli.mjs';
const existing={name:'nft-studio',enabled:true,transport:{type:'stdio',command:node,args:[entry],env:{},env_vars:[],cwd:null}};
test('installer adds only absent server and preserves exact same setup',()=>{
 assert.deepEqual(installPlan(null,node,entry),{action:'add',args:['mcp','add','nft-studio','--',node,entry]});
 assert.equal(installPlan(existing,node,entry).action,'already-installed');
});
test('installer preserves conflicting commands, environment, disabled server and tool filters',()=>{
 for(const x of [{...existing,enabled:false},{...existing,transport:{...existing.transport,type:'http'}},{...existing,transport:{...existing.transport,args:['other']}},{...existing,transport:{...existing.transport,env:{TOKEN:'synthetic-test-value'}}},{...existing,transport:{...existing.transport,env_vars:['TOKEN']}},{...existing,transport:{...existing.transport,cwd:'/elsewhere'}},{...existing,enabled_tools:[]},{...existing,enabled_tools:['studio_capabilities']},{...existing,disabled_tools:['create_mint_intent']}])assert.throws(()=>installPlan(x,node,entry));
});
test('installer accepts exact CLI response and fails closed on ambiguous output',()=>{
 assert.deepEqual(readExisting(()=>({status:0,stdout:JSON.stringify(existing),stderr:''})),existing);
 assert.equal(readExisting(()=>({status:1,stdout:'',stderr:"Error: No MCP server named 'nft-studio' found.\n"})),null);
 for(const r of [{status:null,stdout:'',stderr:''},{status:1,stdout:'',stderr:'Permission denied'},{status:0,stdout:'{',stderr:''},{status:0,stdout:'null',stderr:''},{status:0,stdout:'{"name":"another"}',stderr:''}])assert.throws(()=>readExisting(()=>r));
});
test('installer requires Node 22.13 and an existing compiled build',async()=>{
 for(const v of ['20.19.0','22.0.0','22.12.99','invalid'])assert.throws(()=>assertSupportedNode(v));
 for(const v of ['22.13.0','22.22.2','24.0.0'])assert.doesNotThrow(()=>assertSupportedNode(v));
 await assert.rejects(preflight('/missing/compiled-cli.mjs'));
});
