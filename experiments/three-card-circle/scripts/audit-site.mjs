import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {bech32} from '@scure/base';
import {addressForOwner,stateName,cardNames} from './chain-reader.mjs';
const modulePath=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium,firefox,webkit}=await import(modulePath);
const base=process.env.CIRCLE_URL||'http://127.0.0.1:42805/NFT-Studio/showcase/three-card-circle/';
const output='tmp/agent-site-qa/circle';await mkdir(output,{recursive:true});
const results=[];
const config={network:'Mainnet',statePolicy:'11'.repeat(28),tokenPolicy:'22'.repeat(28),transferHash:'33'.repeat(28),programmableHash:'44'.repeat(28),startBlock:100,confirmations:3};
const keys=['55','66','77'].map(x=>x.repeat(28));
const stateAddress=bech32.encode('addr',bech32.toWords(Uint8Array.from(Buffer.from('71'+config.statePolicy,'hex'))),150);
const out=(policy,name,hash,address)=>({tx_hash:hash.repeat(64),tx_index:0,address,block_height:110,is_spent:false,asset_list:[{policy_id:policy,asset_name:name,quantity:'1'}]});
async function fixture(page,{active=false}={}){
 const model={active,owners:[...keys],revision:2,block:115,stale:false,unavailable:false,historyQueries:[],assetQueries:0};
 await page.route('**/deployment.json',r=>r.fulfill({status:model.unavailable?503:200,contentType:'application/json',body:JSON.stringify(model.active?{status:'active',deployment:config}:{status:'inactive',deployment:null})}));
 await page.route('**/api/v1/**',r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET, POST'}});
  const url=new URL(r.request().url()),body=r.request().postDataJSON();let rows;
  if(url.pathname.endsWith('/tip'))rows=[{block_no:model.block,block_time:Date.now()/1000-(model.stale?3600:1)}];
  else if(url.pathname.endsWith('/asset_utxos')){
   model.assetQueries++;
   rows=body._asset_list[0][0]===config.statePolicy?[{...out(config.statePolicy,stateName,'1',stateAddress),inline_datum:{value:{constructor:0,fields:[{int:1},{bytes:config.tokenPolicy},{bytes:config.transferHash},{list:model.owners.map(bytes=>({bytes}))},{constructor:1,fields:[]},{int:model.revision}]}}}]:cardNames.map((name,i)=>out(config.tokenPolicy,name,String(i+2),addressForOwner(config,model.owners[i])));
  }else if(url.pathname.endsWith('/asset_txs')){
   model.historyQueries.push(url.searchParams.toString());
   const offset=Number(url.searchParams.get('offset')),limit=Number(url.searchParams.get('limit'));
   rows=Array.from({length:7},(_,i)=>({tx_hash:(i+10).toString(16).padStart(64,'0'),block_height:113-i,block_time:Date.now()/1000-120-i*20})).slice(offset,offset+limit);
  }else throw Error('Unexpected API request '+url.pathname);
  return r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(rows)});
 });
 return model;
}
async function ready(page,active=false){
 try{await page.waitForFunction(text=>document.querySelector('#refresh-status')?.textContent.includes(text),active?'Confirmed ledger revision':'The contract is not activated',{timeout:10000});}
 catch(error){throw Error(`Ledger did not become ready: ${await page.locator('#refresh-status').textContent()}`,{cause:error});}
}
async function assertLayout(page,{allowVertical=false}={}){
 const metrics=await page.evaluate(()=>{
  const visible=[...document.querySelectorAll('header,footer,.title-row,.rules,.card,.owner')].map(el=>({name:el.className||el.tagName,x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom}));
  const addresses=[...document.querySelectorAll('.address')].map(el=>({height:el.clientHeight,scrollHeight:el.scrollHeight,right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom,cardBottom:el.closest('.card').getBoundingClientRect().bottom}));
  return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,visible,addresses};
 });
 assert.ok(metrics.scrollWidth<=metrics.width+1,'Horizontal overflow');
 if(!allowVertical)assert.ok(metrics.scrollHeight<=metrics.height+1,`Vertical overflow: ${JSON.stringify(metrics)}`);
 for(const el of metrics.visible){assert.ok(el.x>=-1&&el.right<=metrics.width+1);if(!allowVertical)assert.ok(el.bottom<=metrics.height+1&&el.y>=0);}
 for(const a of metrics.addresses){assert.ok(a.scrollHeight<=a.height+1);assert.ok(a.bottom<=a.cardBottom-3,'Full address overflows its card');}
 const controls=await page.locator('.card').evaluateAll(nodes=>nodes.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));
 if(metrics.width<=700)for(let i=1;i<controls.length;i++)assert.ok(controls[i].top>=controls[i-1].bottom,'Cards overlap');
}
for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
 const browser=await type.launch({headless:true});
 try{
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900],[844,390]])for(const active of [false,true]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const model=await fixture(page,{active});assert.equal((await page.goto(base,{waitUntil:'networkidle'})).status(),200);await ready(page,active);
   await assertLayout(page);assert.equal(await page.locator('.cards img').count(),3);
   assert.deepEqual(await page.locator('.address').allTextContents(),active?keys.map(k=>addressForOwner(config,k)):Array(3).fill('Not issued'));
   if(!active)assert.equal(model.assetQueries,0,'Inactive UI must never query fake NFT identities');
   if(modulePath.startsWith('/')){
    await page.addScriptTag({content:await readFile(new URL('../axe-core/axe.min.js',pathToFileURL(modulePath)),'utf8')});
    assert.deepEqual(await page.evaluate(async()=>(await axe.run()).violations.map(v=>({id:v.id,impact:v.impact}))),[]);
   }
   if(engine==='chromium')await page.screenshot({path:`${output}/${engine}-${width}-${height}-${active?'active':'inactive'}.png`,fullPage:true});
   assert.deepEqual(errors,[]);results.push({engine,width,height,active,singleScreen:true,fullAddresses:true,accessibility:true});await page.close();
  }
  // A 1280x800 desktop at 200% zoom has a 640x400 CSS viewport.
  const zoom=await browser.newPage({viewport:{width:640,height:400},deviceScaleFactor:2});await fixture(zoom,{active:true});await zoom.goto(base);await ready(zoom,true);await assertLayout(zoom,{allowVertical:true});results.push({engine,equivalent200PercentZoomReflow:true});await zoom.close();
  for(const mode of ['missing','mainnet','wrong-network','declined']){
   const page=await browser.newPage();await fixture(page);
   await page.addInitScript(mode=>{window.signCalls=0;if(mode==='missing')return;window.cardano={test:{name:'Test wallet',enable:async()=>{if(mode==='declined')throw {info:'Wallet connection declined.'};return {getNetworkId:async()=>mode==='wrong-network'?0:1,signTx:async()=>{window.signCalls++;throw Error('Unexpected signature');},submitTx:async()=>{throw Error('Unexpected submission');}};}}};},mode);
   await page.goto(base);await ready(page);await page.locator('#connect').click();
   if(mode!=='missing')await page.locator('#wallet-list button').click();
   const expected={missing:'dApp browser',mainnet:'connected. Mainnet activation pending', 'wrong-network':'Switch your wallet to Cardano mainnet',declined:'Wallet connection declined'}[mode];
   await page.locator('#wallet-status').filter({hasText:expected}).waitFor();assert.equal(await page.evaluate(()=>window.signCalls),0);
   await page.locator('#wallet-dialog [data-close]').click();assert.equal(await page.locator('#connect').evaluate(el=>el===document.activeElement),true);
   results.push({engine,mode,readOnlyWallet:true,dialogFocusRestored:true});await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}}),model=await fixture(page,{active:true});
  await page.addInitScript(()=>{window.copied='';window.clipboardFails=false;Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(window.clipboardFails)throw Error('Denied');window.copied=value;}}});});
  await page.goto(base);await ready(page,true);await page.locator('[data-copy="0"]').click();assert.equal(await page.evaluate(()=>window.copied),addressForOwner(config,keys[0]));
  await page.evaluate(()=>{window.clipboardFails=true;});await page.locator('[data-copy="1"]').click();assert.equal(await page.locator('#address-text').inputValue(),addressForOwner(config,keys[1]));await page.locator('#address-dialog [data-close]').click();
  await page.locator('#history-open').click();await page.locator('#history-page').filter({hasText:'1'}).waitFor();assert.equal(await page.locator('#history-list li').count(),3);model.block+=10;
  await page.locator('#history-older').click();await page.locator('#history-page').filter({hasText:'2'}).waitFor();assert.equal(await page.locator('#history-list li').count(),3);
  await page.locator('#history-older').click();await page.locator('#history-page').filter({hasText:'3'}).waitFor();assert.equal(await page.locator('#history-list li').count(),1);assert.equal(await page.locator('#history-older').isDisabled(),true);
  assert.equal(model.historyQueries.every(q=>new URLSearchParams(q).get('block_height')==='lte.113'),true);
  await page.locator('#history-newer').click();await page.locator('#history-page').filter({hasText:'2'}).waitFor();await page.locator('#history-dialog [data-close]').click();
  model.owners=Array(3).fill(keys[1]);model.revision=3;await page.locator('#refresh').click();await page.locator('#chain-status').filter({hasText:'All 3 together'}).waitFor();assert.deepEqual(await page.locator('.address').allTextContents(),Array(3).fill(addressForOwner(config,keys[1])));
  model.stale=true;await page.locator('#refresh').click();await page.locator('#chain-status').filter({hasText:'Data unavailable'}).waitFor();assert.deepEqual(await page.locator('.address').allTextContents(),Array(3).fill('Unverified'));
  await page.locator('#history-open').click();await page.locator('#history-note').filter({hasText:'data is unavailable'}).waitFor();await page.locator('#history-dialog [data-close]').click();
  model.stale=false;model.unavailable=true;await page.locator('#refresh').click();await page.locator('#refresh-status').filter({hasText:'could not be verified'}).waitFor();assert.equal(await page.locator('[data-copy]:disabled').count(),3);
  results.push({engine,copyFullAddress:true,clipboardFallback:true,pagedConfirmedHistory:true,ledgerUpdate:true,providerFailureClearsAddresses:true});
  await page.locator('#create-open').click();await page.locator('#create-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('.create-steps li').count(),3);assert.match(await page.locator('.creator-boundary').textContent(),/Custom rules require contract work/);
  await page.evaluate(()=>{window.clipboardFails=false;});await page.locator('#copy-prompt').click();assert.equal(await page.evaluate(()=>window.copied),await page.locator('#creator-prompt').inputValue());
  await page.evaluate(()=>{window.clipboardFails=true;});await page.locator('#copy-prompt').click();await page.locator('#create-status').filter({hasText:'Select and copy'}).waitFor();
  assert.equal(await page.locator('#create-dialog a[href="../../mcp/"]').count(),1);
  if(engine==='chromium')await page.screenshot({path:`${output}/creator-guide-mobile.png`,fullPage:true});
  await page.locator('#create-dialog [data-close]').click();assert.equal(await page.locator('#create-open').evaluate(el=>el===document.activeElement),true);
  results.push({engine,creatorGuide:true,copyableStartingPrompt:true,creatorClipboardFallback:true,contractBoundaries:true});await page.close();
 }finally{await browser.close();}
}
const result={ok:true,mode:'isolated browser contexts; synthetic authenticated-chain fixtures and wallets; no signing or real submission',results};
await writeFile(`${output}/results.json`,JSON.stringify(result,null,2)+'\n');
await writeFile('experiments/three-card-circle/evidence/site-checks.json',JSON.stringify(result,null,2)+'\n');
console.log(`PASS: ${results.length} compact-layout, ledger, history and wallet cases.`);
