import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium,firefox,webkit}=await import(modulePath);
const base=process.env.CIRCLE_URL||'http://127.0.0.1:42805/NFT-Studio/showcase/three-card-circle/';
const output='tmp/agent-site-qa/circle';await mkdir(output,{recursive:true});
const results=[];
for (const [engine,type] of Object.entries({chromium,firefox,webkit})) {
 const browser=await type.launch({headless:true});
 try {
  for (const width of [320,390,768,1440]) {
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   assert.equal((await page.goto(base,{waitUntil:'networkidle'})).status(),200);
   await page.locator('#refresh-status').filter({hasText:'Mainnet remains inactive'}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${engine} ${width}: overflow`);
   assert.equal(await page.locator('.cards img').count(),3);
   assert.equal(await page.locator('.owner strong').allTextContents().then(v=>v.every(x=>x==='Not issued')),true);
   assert.equal(await page.locator('#more-history').isVisible(),false);
   await page.locator('#connect').click();
   await page.locator('#wallet-status').filter({hasText:'dApp browser'}).waitFor();
   await page.locator('summary').click();
   if(engine==='chromium'&&[390,1440].includes(width)) await page.screenshot({path:`${output}/${engine}-${width}.png`,fullPage:true});
   assert.deepEqual(errors,[]);
   if(modulePath.startsWith('/')) {
    await page.addScriptTag({content:await readFile(new URL('../axe-core/axe.min.js',pathToFileURL(modulePath)),'utf8')});
    const violations=await page.evaluate(async()=>(await axe.run()).violations.map(v=>({id:v.id,impact:v.impact})));
    assert.deepEqual(violations,[],`${engine} ${width}: accessibility`);
   }
   results.push({engine,width,layout:true,missingWallet:true,errors:[],accessibility:true});await page.close();
  }
  for(const mode of ['mainnet','wrong-network','declined']) {
   const page=await browser.newPage();
   await page.addInitScript(mode=>{
    window.signCalls=0;
    window.cardano={test:{name:'Test wallet',enable:async()=>{
      if(mode==='declined')throw {info:'Wallet connection declined.'};
      return {getNetworkId:async()=>mode==='wrong-network'?0:1,signTx:async()=>{window.signCalls++;throw Error('Unexpected signature request');},submitTx:async()=>{throw Error('Unexpected broadcast');}};
    }}};
   },mode);
   await page.goto(base,{waitUntil:'networkidle'});await page.locator('#connect').click();await page.locator('#wallet-list button').click();
   const expected=mode==='mainnet'?'connected on mainnet':mode==='wrong-network'?'Switch your wallet to mainnet':'Wallet connection declined';
   await page.locator('#wallet-status').filter({hasText:expected}).waitFor();
   assert.equal(await page.evaluate(()=>window.signCalls),0);
   results.push({engine,mode,readOnlyWallet:true});await page.close();
  }
  const page=await browser.newPage();
  await page.route('**/deployment.json',r=>r.fulfill({status:503,body:'unavailable'}));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#chain-status').filter({hasText:'UNVERIFIED'}).waitFor();
  assert.deepEqual(await page.locator('.owner strong').allTextContents(),['Unavailable','Unavailable','Unavailable']);
  results.push({engine,unavailableActivationFailsClosed:true});await page.close();
 } finally {await browser.close();}
}
await writeFile(`${output}/results.json`,JSON.stringify({ok:true,results},null,2)+'\n');
await writeFile('experiments/three-card-circle/evidence/site-checks.json',JSON.stringify({ok:true,mode:'local static subdirectory export; isolated browser contexts and synthetic wallets',results},null,2)+'\n');
console.log(`PASS: ${results.length} layout, wallet and unavailable-state cases across three browsers.`);
