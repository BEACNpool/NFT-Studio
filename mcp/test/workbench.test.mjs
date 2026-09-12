import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {createPublicMcpHandler} from './workerd-helper.mjs';
import {payload} from './wallet-fixtures.mjs';
import {RECIPES,TOOLBOX,workbenchCatalog,planUtility,WORKBENCH_URI} from '../../lib/studio-workbench.mjs';
import {terminalFrame,safeText} from '../tui.mjs';
test('recipe search, source identities and incompatible utility plans retain enforcement boundaries',()=>{
  assert.equal(new Set(RECIPES.map(r=>r.id)).size,12);
  for(const r of RECIPES){assert(r.steps.length>=3);assert(r.limits.length>=2);assert(r.lifecycle);assert(r.tools.every(t=>TOOLBOX.some(x=>x.name===t)));for(const s of r.standards)assert.match(s.url,/^https:\/\/cips.cardano.org\/cip\/CIP-\d{4}$/);}
  assert(workbenchCatalog({query:'CIP-68'}).recipes.some(r=>r.id==='evolving'));
  assert.equal(workbenchCatalog({query:'does-not-exist'}).recipes.length,0);
  for(const recipeIds of [['music','traits'],['evolving','interactive'],['passport','message']]){const p=planUtility({name:'Test',recipeIds});assert.equal(p.compatible,false);assert(p.blockers.length);assert.equal(p.status,'plan-only');assert.equal(p.signed,false);}
  assert.deepEqual(planUtility({name:'Members',recipeIds:['holder-access']}).requiresImplementation,['holder-access']);
  for(const args of [{name:'\x1b[2J',recipeIds:['traits']},{name:'Test',recipeIds:['traits','traits']},{name:'Test',recipeIds:['unknown']},{name:'Test',recipeIds:[]},{name:'\ud800',recipeIds:['traits']}])assert.throws(()=>planUtility(args));
});
for(const runtime of ['node','worker'])for(const era of ['auto','legacy'])test(`${runtime}/${era}: workbench App resource, live toolbox parity, plans and exact readiness`,async()=>{
  const origin='https://workbench-test.example.org';
  const worker=runtime==='worker'?await createPublicMcpHandler({publicOrigin:origin}):null;
  const client=new Client({name:'workbench-verifier',version:'1.0.0'},{versionNegotiation:{mode:era}});
  try{
    await client.connect(worker?new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{fetch:(u,i)=>worker.dispatchFetch(u,i)}):new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/cli.mjs',import.meta.url))],stderr:'pipe'}));
    const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});assert(!r.isError,JSON.stringify(r));return r.structuredContent;};
    const tools=(await client.listTools()).tools,book=await call('studio_workbench');
    assert.deepEqual(book.tools.map(t=>t.name).sort(),tools.map(t=>t.name).sort());
    assert.equal(tools.find(t=>t.name==='studio_workbench')._meta.ui.resourceUri,WORKBENCH_URI);
    const res=(await client.readResource({uri:WORKBENCH_URI})).contents[0];assert.equal(res.mimeType,'text/html;profile=mcp-app');
    assert.equal(res.text,await readFile(new URL('../dist/workbench.html',import.meta.url),'utf8'));
    assert.deepEqual(res._meta.ui.csp,{connectDomains:[],resourceDomains:[],frameDomains:[]});assert(!res.text.includes('/* WORKBENCH_APP */'));assert(!res.text.includes('BEACN_BRAND_DATA'));
    assert.equal((await call('get_utility_recipe',{id:'royalties'})).status,'Blueprint');
    assert.equal((await call('plan_nft_utility',{name:'Signal',recipeIds:['traits','message']})).compatible,true);
    const {intent}=await call('create_mint_intent',{...payload,mode:'nft'});
    const ready=await call('inspect_mint_readiness',{intent});assert.equal(ready.intentHash,intent.intentHash);assert.equal(ready.checks.completeSignedSize,false);assert(ready.files.every(f=>Number.isInteger(f.bytes)&&f.sha256.length===64));
    assert((await client.callTool({name:'inspect_mint_readiness',arguments:{intent:{...intent,intentHash:'0'.repeat(64)}}})).isError);
    assert((await client.callTool({name:'plan_nft_utility',arguments:{name:'Test',recipeIds:['traits'],wallet:{}}})).isError);
    if(worker)assert.equal(worker.calls.length,0,'Planning and UI discovery cause no network requests.');
  }finally{await client.close();if(worker)await worker.close();}
});
test('terminal rejects control sequences, prints without a TTY, and exclusive plan export never overwrites',async()=>{
  assert.equal(safeText('\x1b[2J\rtitle\u202e'),' [2J title ');
  const state={tab:'recipes',query:'',index:0,choices:new Set(),panel:null};
  for(const width of [40,80,120]){const output=terminalFrame(state,{width,height:24,color:false});assert(!output.includes('\x1b'));assert(output.split('\n').every(line=>line.length<=width));}
  const script=fileURLToPath(new URL('../tui.mjs',import.meta.url));
  const plain=spawnSync(process.execPath,[script,'--plain'],{encoding:'utf8',timeout:10000});assert.equal(plain.status,0);assert.match(plain.stdout,/BEACN|B E A C N/);assert(!plain.stdout.includes('\x1b'));
  assert.equal(spawnSync(process.execPath,[script,'--intent','nonexistent.json'],{encoding:'utf8',timeout:10000}).status,1);
  const directory=await mkdtemp(join(tmpdir(),'workbench-export-')),path=join(directory,'plan.json');
  const args=[script,'--plan','traits,message','--name','Build $(no shell)','--output',path];
  assert.equal(spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000}).status,0);const before=await readFile(path,'utf8');assert.equal(JSON.parse(before).name,'Build $(no shell)');
  assert.equal(spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000}).status,1);assert.equal(await readFile(path,'utf8'),before);
});
