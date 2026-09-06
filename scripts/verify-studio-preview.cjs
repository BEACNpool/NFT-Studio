// Exercises only the standalone import preview, with synthetic hostile fixtures.
// An isolated Chromium process is started and closed by this script.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {build}=require('esbuild');
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer-core');
const root=path.resolve(process.env.STUDIO_TEST_ROOT||'.');
(async()=>{
 const js=await build({absWorkingDir:root,entryPoints:['lib/studio-payload.ts'],bundle:true,platform:'browser',format:'iife',globalName:'StudioPayload',write:false,logLevel:'error'});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/payload.js'?'text/javascript':'text/html');res.end(req.url==='/payload.js'?js.outputFiles[0].text:'<!doctype html><title>Preview isolation test</title><script src="/payload.js"></script>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),requests=[];await page.setViewport({width:390,height:844});
  page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:'))requests.push(r.url());});
  await page.goto(origin,{waitUntil:'networkidle0'});
  const result=await page.evaluate(async()=>{
   window.cardano={qa:{enable(){throw new Error('wallet reached');}}};window.__compromised=false;
   const html=`<!doctype html><meta http-equiv="refresh" content="0;url=https://preview-attacker.invalid/meta"><base href="https://preview-attacker.invalid/"><link rel="stylesheet" href="https://preview-attacker.invalid/link"><style>body{background:#171b24;color:white}div{background-image:url(https://preview-attacker.invalid/css)}</style><h1>Imported file</h1><div>Static content is visible.</div><script>parent.__compromised=true;fetch('https://preview-attacker.invalid/script');location='https://preview-attacker.invalid/nav';<\/script><img src="https://preview-attacker.invalid/img" onerror="parent.__compromised=true"><iframe src="https://preview-attacker.invalid/frame"></iframe><form action="https://preview-attacker.invalid/form"><button>Submit</button></form><a id="escape" href="https://preview-attacker.invalid/link" target="_top" ping="https://preview-attacker.invalid/ping">A harmless label</a><svg xmlns="http://www.w3.org/2000/svg"><a href="https://preview-attacker.invalid/svg"><text y="20">SVG label</text></a><script>parent.__compromised=true<\/script></svg><svg xmlns="http://www.w3.org/2000/svg"><a id="animated" target="_self"><set attributeName="href" to="https://preview-attacker.invalid/animated"/><text y="20">Animated link</text></a></svg><template><meta http-equiv="refresh" content="0;url=https://preview-attacker.invalid/nested"></template>`;
   const bundle=await StudioPayload.preparePayloadBundle({name:'Hostile import',files:[{name:'probe.html',mediaType:'text/html',bytes:new TextEncoder().encode(html)}]});
   const before=bundle.files[0].sha256,preview=StudioPayload.staticPayloadPreview(bundle.files[0]);
   const frame=document.createElement('iframe');frame.id='preview';frame.setAttribute('sandbox',preview.sandbox);frame.referrerPolicy=preview.referrerPolicy;frame.srcdoc=preview.srcDoc;frame.style='width:100%;height:600px;border:0';document.body.append(frame);
   return{sha:before,unchanged:before===bundle.files[0].sha256,sandbox:preview.sandbox,markup:preview.srcDoc};
  });
  assert.equal(result.unchanged,true);assert.equal(result.sandbox,'');
  const frame=await(await page.$('#preview')).contentFrame();await frame.waitForSelector('h1');
  assert.equal(await frame.$eval('h1',e=>e.textContent),'Imported file');
  assert.equal(await frame.$$eval('script,base,iframe,form,object,embed,link,svg,math',e=>e.length),0);
  assert.equal(await frame.$$eval('meta',es=>es.filter(e=>/refresh/i.test(e.httpEquiv)).length),0);
  assert.equal(await frame.$$eval('[href],[src],[srcdoc],[action],[onerror]',es=>es.length),0);
  await frame.click('#escape');
  await page.screenshot({path:path.join(root,'preview-isolation.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>window.__compromised),false);assert.equal(page.url(),origin+'/');
  assert.equal(await frame.evaluate(()=>{try{return typeof parent.cardano;}catch{return'blocked';}}),'blocked');
  assert.deepEqual(requests,[]);
  // SVG remains an image resource: even malicious SVG never becomes parent DOM.
  await page.evaluate(async()=>{
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>parent.__compromised=true<\/script><image href="https://preview-attacker.invalid/svg-resource"/><rect width="100" height="100" fill="cyan"/></svg>';
    const bundle=await StudioPayload.preparePayloadBundle({name:'SVG test',files:[{name:'x.svg',mediaType:'image/svg+xml',bytes:new TextEncoder().encode(svg)}],coverIndex:0});
    document.querySelector('#preview').srcdoc=StudioPayload.staticPayloadPreview(bundle.files[0]).srcDoc;
  });
  const svgFrame=await(await page.$('#preview')).contentFrame();await svgFrame.waitForSelector('img');
  await svgFrame.waitForFunction(()=>document.querySelector('img').complete);
  assert.equal(await page.evaluate(()=>window.__compromised),false);assert.deepEqual(requests,[]);
  console.log('PASS hostile HTML and SVG remain inert, opaque, same-parent safe; no external requests; exact payload unchanged');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
