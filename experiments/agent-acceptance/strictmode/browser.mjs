import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=process.argv[2],chromium=process.argv[3],kit=import.meta.dirname;if(!root||!chromium)throw Error('Pass installed Puppeteer toolkit package path and Chromium executable path.');
const require=createRequire(root+'/package.json');const {default:puppeteer}=await import(pathToFileURL(require.resolve('puppeteer-core')).href);
const assets=new Map(await Promise.all(['before.js','after.js'].map(async n=>['/'+n,await readFile(kit+'/'+n)])));
const server=createServer((req,res)=>{if(assets.has(req.url)){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(assets.get(req.url));return;}if(['/before','/after'].includes(req.url)){res.writeHead(200,{'Content-Type':'text/html'});res.end(`<!doctype html><html><head><meta charset="utf-8"><title>StrictMode regression</title></head><body><div id="root"></div><script type="module" src="${req.url}.js"></script></body></html>`);return;}res.writeHead(404);res.end();});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await puppeteer.launch({executablePath:chromium,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const checks=[],errors=[],external=[];
async function pageFor(variant){const page=await browser.newPage();await page.setViewport({width:1000,height:900});page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{if(new URL(r.url()).origin!==origin){external.push(r.url());r.abort();}else r.continue();});await page.goto(origin+'/'+variant);await page.waitForFunction(()=>!!window.testHarness);return page;}
const read=page=>page.evaluate(()=>({text:document.body.innerText,hash:location.hash,walletCalls:window.walletCalls,downloads:window.downloads}));
try{
 for(const [variant,strict,works] of [['before',true,false],['before',false,true],['after',true,true]]){
  const page=await pageFor(variant);const fixture=await page.evaluate(()=>window.testHarness.make('StrictMode Spaceship'));
  await page.evaluate(({url,strict})=>{history.replaceState(null,'',location.pathname+new URL(url).hash);window.testHarness.mount(strict);},{url:fixture.url,strict});
  if(works)await page.waitForFunction(()=>document.body.innerText.includes('Content hashes verified'));
  else await new Promise(r=>setTimeout(r,700));
  const state=await read(page);assert.equal(state.hash,'');assert.equal(state.text.includes('Content hashes verified'),works);assert.equal(state.walletCalls,0);assert.equal(state.downloads,0);
  if(!works)assert(state.text.includes('Checking files'));
  if(works)assert(state.text.includes(fixture.intent.intentHash));
  await page.screenshot({path:kit+'/'+variant+(strict?'-strict':'-normal')+'.png',fullPage:true});checks.push({case:variant+(strict?'-strict':'-normal'),verified:works,hashRemoved:true,walletCalls:0});await page.close();
 }
 const page=await pageFor('after');const one=await page.evaluate(()=>window.testHarness.make('First held request')),two=await page.evaluate(()=>window.testHarness.make('Second current request'));
 await page.evaluate(url=>{window.testHarness.hold();history.replaceState(null,'',location.pathname+new URL(url).hash);window.testHarness.mount(true);},one.url);
 await page.waitForFunction(()=>document.body.innerText.includes('Checking files'));
 await page.evaluate(url=>{location.hash=new URL(url).hash;},two.url);await page.waitForFunction(()=>location.hash==='');
 await page.evaluate(()=>window.testHarness.release());await page.waitForFunction(()=>document.body.innerText.includes('Content hashes verified'));
 let state=await read(page);assert(state.text.includes('Second current request'));assert(!state.text.includes(one.intent.intentHash));assert(state.text.includes(two.intent.intentHash));checks.push({case:'new-hash-supersedes-held-parse',pass:true});
 await page.click('button[aria-label="Clear agent request"]');state=await read(page);assert(!state.text.includes('Content hashes verified'));checks.push({case:'clear-invalidates-result',pass:true});
 await page.evaluate(()=>{location.hash='#mint=v1.invalid';});await page.waitForFunction(()=>!!document.querySelector('[role="alert"]'));state=await read(page);assert.equal(state.hash,'');assert(!state.text.includes('Content hashes verified'));assert.equal(state.walletCalls,0);checks.push({case:'malformed-link-cleared-and-rejected',pass:true});await page.close();
 const unmounted=await pageFor('after');const sample=await unmounted.evaluate(()=>window.testHarness.make('Unmounted request'));
 await unmounted.evaluate(url=>{window.testHarness.hold();history.replaceState(null,'',location.pathname+new URL(url).hash);window.testHarness.mount(true);},sample.url);await unmounted.waitForFunction(()=>document.body.innerText.includes('Checking files'));await unmounted.evaluate(()=>{window.testHarness.unmount();window.testHarness.release();});await new Promise(r=>setTimeout(r,250));state=await read(unmounted);assert.equal(state.text,'');assert.equal(state.walletCalls,0);checks.push({case:'unmount-invalidates-held-result',pass:true});await unmounted.close();
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 const receipt={schema:'nft-studio.agent-link-strictmode-regression.v1',status:'pass',react:'19.2.8',mode:'actual development StrictMode',components:'exact before/after snapshots; real shared payload/intent/review codec',stubbed:['UI primitives/icons','PayloadPreview rendering','FileMintDialog wallet control','export helpers','errorText'],checks,externalRequests:0,walletCalls:0,source:JSON.parse(await readFile(kit+'/source.json','utf8')),limits:['This is a component lifecycle regression, not media preview, actual wallet or production-export acceptance.']};await writeFile(kit+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'pass',checks:checks.length,externalRequests:0,walletCalls:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
