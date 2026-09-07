/** Reusable browser-only QA. Reads source/oracle files; writes only the requested QA output directory. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(process.env.STUDIO_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const puppeteer=(await import(pathToFileURL(process.env.PUPPETEER_MODULE||join(root,'experiments/capsule-parameterizer/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')))).default;
const C=await import(pathToFileURL(join(root,'node_modules/@emurgo/cardano-serialization-lib-nodejs/cardano_serialization_lib.js')));
const oracle=JSON.parse(await readFile(join(root,'experiments/capsule-parameterizer/fixtures/aiken-oracle.json'),'utf8'));
const reference=await import(pathToFileURL(process.env.REFERENCE_MODULE||join(root,'experiments/capsule-parameterizer/src/index.mjs')));
const target=new URL(process.env.STUDIO_URL||'http://127.0.0.1:8983/NFT-Studio/?view=labs&lab=contract');
assert.equal(target.hostname,'127.0.0.1','QA accepts only the explicitly local preview.');
const output=resolve(process.env.QA_OUTPUT||join(root,'outputs/capsule-contract-qa'));await mkdir(output,{recursive:true});
const checks=[],screenshots=[],requests=[],externalRequests=[],pageErrors=[],consoleErrors=[];let browser;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function check(name,fn){try{const detail=await fn();checks.push({name,status:'pass',...(detail?{detail}:{})});}catch(error){checks.push({name,status:'fail',error:error.message});throw error;}}
async function input(page,selector,value){await page.focus(selector);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.keyboard.sendCharacter(value);assert.equal(await page.$eval(selector,e=>e.value),value);}
async function clickText(page,text){for(const button of await page.$$('button'))if((await button.evaluate(b=>b.textContent.trim()))===text){await button.click();return;}throw new Error('Missing button '+text);}
async function ready(page){await page.waitForSelector('[data-contract-policy]',{timeout:15000});return page.$eval('[data-contract-policy]',e=>e.textContent.trim());}
async function clearResult(page){assert.equal(await page.$('[data-contract-policy]'),null);assert.equal(await page.$('[data-contract-download]'),null);}
async function capture(page,name){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));const path=join(output,name+'.png');await page.screenshot({path,fullPage:true});screenshots.push({name,path});}
async function overflow(page){return page.evaluate(()=>{const width=document.documentElement.clientWidth;return {viewport:innerWidth,clientWidth:width,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('[data-capsule-contract] *')].map(e=>({tag:e.tagName,className:e.className,text:e.textContent?.slice(0,90),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.left < -1||e.right>width+1)};});}
async function exportsFor(page,label,expected){
  await page.click('[data-contract-download]');await clickText(page,'Export identity record');
  await page.waitForFunction(()=>window.__qaDownloads.length>=2&&window.__qaDownloads.every(d=>d.text!==undefined));
  const downloads=await page.evaluate(()=>window.__qaDownloads.splice(0));assert.equal(downloads.length,2);
  const blueprint=downloads.find(d=>d.name==='state-capsule.plutus.json'),identity=downloads.find(d=>d.name==='state-capsule.applied.json');assert.ok(blueprint&&identity);assert.equal(blueprint.type,'application/json');
  const b=JSON.parse(blueprint.text),record=JSON.parse(identity.text);
  assert.equal(record.policyId,expected.policyId);assert.equal(record.compiledCode,expected.compiledCode);assert.deepEqual(record.parameters,expected.parameters);
  assert.deepEqual(b,expected.appliedBlueprint);assert.equal(b.validators.length,3);for(const v of b.validators){assert.equal(v.compiledCode,expected.compiledCode);assert.equal(v.hash,expected.policyId);assert.ok(!v.parameters?.length);}
  assert.equal(sha(blueprint.text),record.appliedBlueprintSha256);assert.equal(blueprint.text,record.appliedBlueprintJson);
  const script=C.PlutusScript.new_v3(Buffer.from(record.compiledCode,'hex')),hash=script.hash();assert.equal(hash.to_hex(),expected.policyId);hash.free();script.free();
  await page.$$eval('[data-capsule-contract] details',details=>{for(const d of details)if(d.querySelector('summary')?.textContent.includes('Source and exact'))d.open=true;});
  assert.ok(await page.$eval('[data-capsule-contract]',e=>e.textContent.includes('Blueprint export SHA-256')));assert.ok(await page.$eval('[data-capsule-contract]',(e,hash)=>e.textContent.includes(hash),record.appliedBlueprintSha256));
  for(const d of downloads)await writeFile(join(output,label+'-'+d.name),d.text);
  return {policyId:record.policyId,scriptBytes:record.scriptBytes,handlerBytesEqual:true,blueprintSha256:record.appliedBlueprintSha256,filename:blueprint.name,parameterizedOnly:record.readiness==='experimental-parameterized-only'};
}
async function setupPage(width){
  const page=await browser.newPage();const control={holdNextScript:false,held:[]};page.__qaControl=control;await page.setViewport({width,height:width===390?844:1000,deviceScaleFactor:1});await page.setCacheEnabled(false);
  await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(!['data:','blob:'].includes(url.protocol)&&url.origin!==target.origin){externalRequests.push({url:request.url(),method:request.method()});void request.abort();}else{requests.push({url:request.url(),type:request.resourceType(),method:request.method()});if(control.holdNextScript&&request.resourceType()==='script'&&url.pathname.includes('/_next/static/chunks/')){control.holdNextScript=false;control.held.push(request);}else void request.continue();}});
  page.on('pageerror',error=>pageErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.evaluateOnNewDocument(()=>{
    window.__qaDownloads=[];window.__qaWalletCalls=[];window.__qaRuntimeCalls=[];
    const deny=name=>(...args)=>{window.__qaWalletCalls.push(name);throw new Error('Wallet access forbidden in Contract Lab QA');};
    window.cardano={qa:{name:'Synthetic QA wallet',apiVersion:'1.0.0',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',enable:deny('enable'),isEnabled:deny('isEnabled')}};
    const objectUrls=new Map(),create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);objectUrls.set(url,blob);return url;};
    const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){const blob=objectUrls.get(this.href);if(this.download&&blob){const record={name:this.download,type:blob.type};window.__qaDownloads.push(record);blob.text().then(text=>{record.text=text;});return;}return click.call(this);};
    const fetch=window.fetch.bind(window);window.fetch=(...args)=>{window.__qaRuntimeCalls.push({kind:'fetch',url:String(args[0]?.url||args[0])});return fetch(...args);};
    const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){window.__qaRuntimeCalls.push({kind:'xhr',url:String(url),method});return open.call(this,method,url,...rest);};
    const beacon=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=(url,data)=>{window.__qaRuntimeCalls.push({kind:'beacon',url:String(url)});return beacon(url,data);};
  });
  await page.goto(target.href,{waitUntil:'networkidle0',timeout:30000});await page.waitForSelector('[data-capsule-contract]',{timeout:30000});return page;
}
try{
  browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/snap/bin/chromium',headless:true,userDataDir:await mkdtemp(join(homedir(),'tmp/capsule-contract-ui-')),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking']});
  for(const width of [1440,390]){
    const page=await setupPage(width);
    await check(width+' initial route and labels',async()=>{assert.equal(await page.$eval('#contract-seed',e=>e.value),'');assert.equal(await page.$eval('#contract-index',e=>e.value),'0');assert.equal(await page.$eval('#contract-name',e=>e.value),'CAPSULE');for(const id of ['contract-seed','contract-index','contract-name'])assert.ok(await page.$eval('#'+id,e=>e.labels.length>0));await capture(page,width+'-initial');const initialViewport=join(output,width+'-initial-viewport.png');await page.screenshot({path:initialViewport});screenshots.push({name:width+'-initial-viewport',path:initialViewport});});
    await check(width+' example blueprint / handlers / export hash',async()=>{await page.click('[data-contract-example]');assert.equal(await ready(page),oracle.cases[0].policyId);const expected=reference.applyCapsuleParameters(oracle.cases[0].input);const detail=await exportsFor(page,width+'-example',expected);await capture(page,width+'-example');return detail;});
    await check(width+' no horizontal overflow with policy and source hashes',async()=>{const state=await overflow(page);assert.ok(state.scrollWidth<=state.clientWidth+1,JSON.stringify(state));assert.equal(state.offenders.length,0,JSON.stringify(state));return state;});
    await check(width+' changing every input clears old result and export buttons',async()=>{
      for(const [selector,value]of [['#contract-name','CAPSULE2'],['#contract-index','1'],['#contract-seed','22'.repeat(32)]]){await input(page,selector,value);await clearResult(page);await page.click('[data-contract-apply]');await ready(page);}
      return {clearedOn:['baseName','outputIndex','transactionId']};
    });
    await check(width+' malformed hash and numeric indices reject',async()=>{
      for(const [selector,value,pattern]of [['#contract-seed','a'.repeat(63),'32 bytes of lowercase hex'],['#contract-seed','A'.repeat(64),'32 bytes of lowercase hex']]){await input(page,selector,value);await clearResult(page);await page.click('[data-contract-apply]');await page.waitForSelector('[data-capsule-contract] [role="alert"]');assert.match(await page.$eval('[data-capsule-contract] [role="alert"]',e=>e.textContent),new RegExp(pattern));}
      await input(page,'#contract-seed','11'.repeat(32));
      for(const index of ['-1','01','1.5','65536']){await input(page,'#contract-index',index);await page.click('[data-contract-apply]');await page.waitForSelector('[data-capsule-contract] [role="alert"]');await clearResult(page);}
      await input(page,'#contract-index','65535');await page.click('[data-contract-apply]');await ready(page);
      await input(page,'#contract-index','0');
      return {malformedHashCases:2,invalidIndexCases:4,maxIndexAccepted:65535};
    });
    await check(width+' UTF-8 byte ceiling and exact Unicode',async()=>{
      await input(page,'#contract-name','🦑'.repeat(8));assert.ok(await page.$eval('[data-capsule-contract]',e=>e.textContent.includes('32 / 28 UTF-8 bytes')));await page.click('[data-contract-apply]');await page.waitForSelector('[data-capsule-contract] [role="alert"]');assert.match(await page.$eval('[data-capsule-contract] [role="alert"]',e=>e.textContent),/1–28 UTF-8 bytes/);await clearResult(page);await capture(page,width+'-utf8-error');
      const identities=[];
      for(const name of ['A'.repeat(28),'🦑'.repeat(7),'é','e\u0301']){
        await input(page,'#contract-name',name);await clearResult(page);await page.click('[data-contract-apply]');const policy=await ready(page),expected=reference.applyCapsuleParameters({seed:{transactionId:'11'.repeat(32),outputIndex:0},baseName:name});assert.equal(policy,expected.policyId);await exportsFor(page,width+'-unicode-'+identities.length,expected);identities.push({baseName:name,utf8Bytes:Buffer.byteLength(name),hex:Buffer.from(name).toString('hex'),policyId:policy});
      }
      assert.notEqual(identities[2].policyId,identities[3].policyId);return {overLimitRejected:32,identities};
    });
    await check(width+' no wallet or runtime network operations',async()=>{const observed=await page.evaluate(()=>({walletCalls:window.__qaWalletCalls,runtimeCalls:window.__qaRuntimeCalls}));assert.deepEqual(observed.walletCalls,[]);assert.deepEqual(observed.runtimeCalls,[]);return observed;});
    await page.close();
  }
  await check('Changing identity during a delayed compiler import discards the stale result',async()=>{
    const page=await setupPage(390),control=page.__qaControl;
    try{
      control.holdNextScript=true;await page.click('[data-contract-example]');
      const deadline=Date.now()+10000;while(!control.held.length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));assert.ok(control.held.length,'Expected one delayed lazy compiler module request.');
      await input(page,'#contract-name','NEW IDENTITY');await clearResult(page);assert.equal(await page.$eval('[data-contract-apply]',e=>e.disabled),false);
      for(const request of control.held.splice(0))await request.continue();
      await page.waitForNetworkIdle({idleTime:500,timeout:15000});await clearResult(page);assert.equal(await page.$('[data-capsule-contract] [role="alert"]'),null);
      await page.click('[data-contract-apply]');const expected=reference.applyCapsuleParameters({seed:{transactionId:'11'.repeat(32),outputIndex:0},baseName:'NEW IDENTITY'});assert.equal(await ready(page),expected.policyId);
      return {staleResultDiscarded:true,currentInputRecoverable:true};
    }finally{for(const request of control.held.splice(0))await request.continue();await page.close();}
  });
  assert.deepEqual(externalRequests,[]);assert.deepEqual(pageErrors,[]);
}catch(error){checks.push({name:'QA completion',status:'fail',error:error.stack||error.message});}
finally{if(browser)await browser.close();}
const report={schema:'beacn.capsule-contract-browser-qa.v1',checkedAt:new Date().toISOString(),target:target.href,status:checks.some(c=>c.status==='fail')?'fail':'pass',checks,screenshots,requests,externalRequests,pageErrors,consoleErrors,sourceEdited:false,realWalletAccess:false,transactionSubmitted:false};
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:checks.map(({name,status,error})=>({name,status,...(error?{error}:{})})),screenshots,externalRequests,pageErrors,consoleErrors},null,2));if(report.status!=='pass')process.exitCode=1;
