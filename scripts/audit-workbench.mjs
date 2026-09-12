/** Owned browser/host fixture. No wallet, protocol provider, signing or relay calls. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const require=createRequire(import.meta.url),mcpRequire=createRequire(new URL('../mcp/package.json',import.meta.url));
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer-core');
const {Client}=await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client')));
const {StdioClientTransport}=await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client/stdio')));
const output=resolve(process.env.WORKBENCH_QA_DIR||'tmp/workbench-qa');await mkdir(output,{recursive:true});
const html=await readFile(new URL('../mcp/dist/workbench.html',import.meta.url));
const client=new Client({name:'workbench-browser-qa',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../mcp/dist/cli.mjs',import.meta.url))],stderr:'pipe'}));
const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});assert(!r.isError,JSON.stringify(r));return r.structuredContent;};
const {intent}=await call('create_mint_intent',{mode:'nft',name:'BEACN Browser Fixture',coverIndex:0,files:[{name:'cover.svg',mediaType:'image/svg+xml',base64:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#b4f3ce"/></svg>').toString('base64')}]});
const fixture=join(output,'creation.intent.json');await writeFile(fixture,JSON.stringify(intent));
const host=`<!doctype html><title>Owned MCP App test host</title><iframe title="BEACN Workbench" src="/workbench/" sandbox="allow-scripts allow-same-origin allow-downloads" style="width:100%;height:1100px;border:0"></iframe><script>window.addEventListener('message',async event=>{if(event.source!==document.querySelector('iframe').contentWindow||!event.data.id)return;const result=await window.hostRpc(event.data);event.source.postMessage({jsonrpc:'2.0',id:event.data.id,...result},event.origin);});</script>`;
const server=createServer((req,res)=>{if(req.url==='/workbench/'){res.setHeader('content-type','text/html');res.end(html);}else if(req.url==='/host'){res.setHeader('content-type','text/html');res.end(host);}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});
const errors=[],requests=[],checks=[];let releaseCall;
const click=async(p,selector)=>{const el=await p.$(selector);assert(el,selector);await el.evaluate(e=>e.scrollIntoView({block:'center'}));await el.click();};
const fill=async(p,selector,text)=>{await p.focus(selector);await p.keyboard.down('Control');await p.keyboard.press('KeyA');await p.keyboard.up('Control');await p.keyboard.press('Backspace');await p.keyboard.type(text);};
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))requests.push(r.url());});
  for(const width of [320,390,820,1440]){
    await page.setViewport({width,height:900});await page.goto(base+'/workbench/');await page.waitForSelector('[data-recipe="traits"]');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
    assert.equal(await page.$$eval('.rail nav button',els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;}).length),4,'All navigation is reachable');
    await page.screenshot({path:join(output,`library-${width}.png`),fullPage:true});checks.push(`layout-${width}`);
  }
  await fill(page,'#search','CIP-68');assert(await page.$('[data-recipe="evolving"]'));
  await fill(page,'#search','no-such-feature');assert.match(await page.$eval('.recipe-list',e=>e.textContent),/No recipes/);
  await fill(page,'#search','');await click(page,'[data-recipe="message"]');await click(page,'[data-add="message"]');assert.equal(await page.$eval('#plan-count',e=>e.textContent),'1');
  await click(page,'.rail [data-view="plan"]');await fill(page,'#project-name','BEACN Browser Plan');await click(page,'#build-plan');await page.waitForSelector('#export-plan');
  const session=await page.createCDPSession();await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:output});await click(page,'#export-plan');
  await page.waitForFunction(()=>document.getElementById('plan-result').textContent.includes('Ready to create'));
  await fill(page,'#project-name','Changed');assert.equal(await page.$('#export-plan'),null);checks.push('plan-export-and-invalidation');
  await click(page,'input[data-check="music"]');await click(page,'#build-plan');await page.waitForSelector('#export-plan');assert.match(await page.$eval('#plan-result',e=>e.textContent),/Separate creation routes/);checks.push('incompatible-music-options');
  await click(page,'.rail [data-view="review"]');await (await page.$('#intent-file')).uploadFile(fixture);await page.waitForSelector('#apply-options');
  await fill(page,'#quantity','37');await fill(page,'#memo','BEACN public note');await click(page,'#apply-options');await page.waitForSelector('#download-intent');
  assert.notEqual(await page.$eval('#intent-summary .hash',e=>e.textContent),intent.intentHash);
  await click(page,'#download-intent');await fill(page,'#memo','Changed again');assert.equal(await page.$('#download-intent'),null);checks.push('exact-review-option-binding-and-stale-link-removal');
  await fill(page,'#quantity','1001');await click(page,'#apply-options');assert.match(await page.$eval('#review-result',e=>e.textContent),/1–1,000/);assert.equal(await page.$('#download-intent'),null);
  await click(page,'#clear-intent');assert.equal(await page.$('#apply-options'),null);
  await page.setViewport({width:390,height:844});await click(page,'.rail [data-view="plan"]');await page.screenshot({path:join(output,'plan-mobile.png'),fullPage:true});
  await click(page,'.rail [data-view="tools"]');await fill(page,'#search','plan_nft');await click(page,'[data-tool="plan_nft_utility"]');await click(page,'#run-tool');await page.waitForFunction(()=>document.getElementById('tool-output').textContent.includes('beacn.utility-plan.v1'));checks.push('standalone-tool-run');
  await page.screenshot({path:join(output,'tool-mobile.png'),fullPage:true});
  const trace=[];await page.exposeFunction('hostRpc',async message=>{
    trace.push(message.method+(message.params?.name?':'+message.params.name:''));
    if(message.method==='ui/initialize')return {result:{protocolVersion:'2026-01-26',hostInfo:{name:'owned-test-host',version:'1'},hostCapabilities:{serverTools:{},serverResources:{},updateModelContext:{}},hostContext:{displayMode:'inline'}}};
    if(message.method==='tools/list')return {result:await client.listTools()};
    if(message.method==='tools/call'){
      assert.equal(message.params.name,'plan_nft_utility');if(releaseCall)await new Promise(resolve=>{releaseCall=resolve;});
      return {result:await client.callTool(message.params)};
    }
    if(message.method==='ui/update-model-context'){assert.equal(message.params.structuredContent.status,'plan-only');return {result:{}};}
    return {error:{code:-32601,message:'Unsupported test request'}};
  });
  await page.setViewport({width:1440,height:1000});await page.goto(base+'/host');let frame;
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow);frame=page.frames().find(f=>f.url().endsWith('/workbench/'));
  await frame.waitForFunction(()=>document.getElementById('connection').textContent==='MCP connected');
  await click(frame,'[data-add="traits"]');await click(frame,'.rail [data-view="plan"]');await click(frame,'#build-plan');await frame.waitForSelector('#context-plan');await click(frame,'#context-plan');await frame.waitForFunction(()=>document.getElementById('notice').textContent.includes('Plan added'));
  assert(trace.includes('tools/call:plan_nft_utility'));assert(trace.includes('ui/update-model-context'));checks.push('embedded-app-live-mcp-and-explicit-context');
  await frame.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:'https://untrusted.invalid',data:{jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{query:'forged'}}}})));
  await click(frame,'.rail [data-view="recipes"]');assert.equal(await frame.$eval('#search',e=>e.value),'');checks.push('reject-foreign-frame-message');
  await click(frame,'.rail [data-view="tools"]');await click(frame,'[data-tool="plan_nft_utility"]');
  releaseCall=true;await click(frame,'#run-tool');while(typeof releaseCall!=='function')await new Promise(r=>setTimeout(r,10));
  await frame.$eval('#tool-input',e=>{e.value='{}';e.dispatchEvent(new Event('input',{bubbles:true}));});releaseCall();releaseCall=null;
  await new Promise(r=>setTimeout(r,200));assert.match(await frame.$eval('#tool-output',e=>e.textContent),/Inputs changed/);checks.push('ignore-late-tool-result-after-input-edit');
  await page.screenshot({path:join(output,'embedded-tools.png'),fullPage:true});
  // Downloads finish asynchronously. Read complete files with a bounded retry.
  async function downloaded(name){for(let i=0;i<30;i++){try{return JSON.parse(await readFile(join(output,name),'utf8'));}catch{await new Promise(r=>setTimeout(r,100));}}throw Error('Download did not complete: '+name);}
  const plan=await downloaded('beacn-utility-plan.json');assert.equal(plan.name,'BEACN Browser Plan');assert.equal(plan.submitted,false);
  const edited=await downloaded('beacn-creation.intent.json');assert.equal(edited.mintOptions.quantity,37);assert.equal(edited.mintOptions.message,'BEACN public note');assert.equal((await call('verify_mint_intent',{intent:edited})).intent.intentHash,edited.intentHash);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const receipt={status:'pass',checks,errors,externalRequests:requests,hostFixture:true,actualInstalledHostAcceptance:false,walletAccess:false,signing:false,submission:false};
  await writeFile(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close();await client.close();await new Promise(r=>server.close(r));}
