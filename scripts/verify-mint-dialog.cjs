// Actual copied MintDialog in an isolated browser. Ephemeral fixture keys stay
// inside this test page; all chain reads and submit calls are synthetic.
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {build}=require('esbuild'),{createCanvas}=require('@napi-rs/canvas'),{createHash}=require('node:crypto');
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer-core');
const root=path.resolve(process.env.STUDIO_TEST_ROOT||'.');
(async()=>{
 const canvas=createCanvas(128,128),ctx=canvas.getContext('2d');ctx.fillStyle='#27b8ac';ctx.fillRect(0,0,128,128);
 const bytes=canvas.toBuffer('image/webp'),image={uri:'data:image/webp;base64,'+bytes.toString('base64'),mediaType:'image/webp',bytes:bytes.length,width:128,quality:80,sha256:createHash('sha256').update(bytes).digest('hex')};
 const code=`import React from 'react';import{createRoot}from'react-dom/client';import*as C from'@emurgo/cardano-serialization-lib-browser-inlined';import{MintDialog}from'./components/mint-dialog';import{INITIAL}from'./lib/art';
 const key=C.PrivateKey.generate_ed25519(),bn=n=>C.BigNum.from_str(String(n));const address=C.EnterpriseAddress.new(1,C.Credential.from_keyhash(key.to_public().hash())).to_address();const u=C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex('01'.repeat(32)),0),C.TransactionOutput.new(address,C.Value.new(bn(20000000))));
 window.__qa={sign:0,submit:0,recordBeforeSubmit:false,confirmation:null,behavior:'ok',network:1,spentAfterSigning:false,unmountAfterSigning:false,postSignReads:0};
 window.cardano={qa:{name:'Synthetic QA wallet',apiVersion:'1',enable:async()=>({getNetworkId:async()=>{if(window.__qa.sign)window.__qa.postSignReads++;return window.__qa.network;},getChangeAddress:async()=>address.to_hex(),getUtxos:async()=>window.__qa.spentAfterSigning&&window.__qa.sign?[]:[u.to_hex()],signTx:async hex=>{window.__qa.sign++;const ws=C.TransactionWitnessSet.new(),v=C.Vkeywitnesses.new();v.add(C.make_vkey_witness(C.FixedTransaction.from_hex(hex).transaction_hash(),key));ws.set_vkeys(v);if(window.__qa.unmountAfterSigning)window.__qaRoot.unmount();return ws.to_hex();},submitTx:async hex=>{window.__qa.submit++;const hash=C.FixedTransaction.from_hex(hex).transaction_hash().to_hex();const r=JSON.parse(localStorage.getItem('nft-studio:receipt:v1:'+hash));window.__qa.recordBeforeSubmit=!!r&&r.signedHex===hex&&r.broadcastAttempted===true;if(window.__qa.behavior==='unknown')throw Error('synthetic ambiguous response');return hash;}})}};
 const realFetch=window.fetch.bind(window);window.fetch=async(input,init)=>{const url=String(input);if(url.includes('koios.beacn.workers.dev/api/v1/')){const params={epoch_no:653,min_fee_a:44,min_fee_b:155381,max_tx_size:16384,max_val_size:5000,coins_per_utxo_size:'4310',key_deposit:'2000000',pool_deposit:'500000000'};const body=url.endsWith('/tip')?[{epoch_no:653,abs_slot:197151000,block_time:Math.floor(Date.now()/1000)}]:url.endsWith('/tx_status')?[{tx_hash:JSON.parse(init.body)._tx_hashes[0],num_confirmations:window.__qa.confirmation}]:[params];return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});}return realFetch(input,init);};
 window.__qaRoot=createRoot(document.querySelector('#root'));window.__qaRoot.render(<MintDialog art={{...INITIAL,name:'Receipt QA'}} pinnedImage={${JSON.stringify(image)}}/>);`;
 const built=await build({absWorkingDir:root,stdin:{contents:code,resolveDir:root,sourcefile:'qa-mint.tsx',loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_BASE_PATH':'""'},logLevel:'error',tsconfig:path.join(root,'tsconfig.json')});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?built.outputFiles[0].text:'<!doctype html><meta name="viewport" content="width=device-width"><title>Mint receipt QA</title><style>body{background:#111;color:#eee;font:16px system-ui}button{padding:10px;margin:6px}img{max-width:200px}[data-slot=dialog-overlay]{position:fixed;inset:0;z-index:10;background:#0008}[data-slot=dialog-content]{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;width:min(95vw,900px)}.mint-dialog{background:#182022;padding:20px;max-height:90vh;overflow:auto;border:1px solid #555}.mint-layout{display:flex;gap:20px}.mint-art-column{width:220px}.mint-controls{width:500px}code,dd{overflow-wrap:anywhere}.mint-error{color:#f88}</style><div id="root"></div><script src="/app.js"></script>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1100,height:1000});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message);});
  const click=async text=>{await page.waitForFunction(t=>Array.from(document.querySelectorAll('button')).some(e=>e.textContent.includes(t)&&!e.disabled),{timeout:10000},text).catch(async e=>{console.log('MISSING',text,await page.evaluate(()=>document.body.innerText));throw e;});const buttons=await page.$$('button');for(const button of buttons)if(await button.evaluate((e,t)=>e.textContent.includes(t),text)){await button.click();return;}throw Error('Missing button '+text);};
  const has=async text=>page.waitForFunction(t=>document.body.textContent.includes(t),{},text);
  const prepare=async()=>{await click('Mint on Cardano');await click('Synthetic QA wallet');await click('Prepare on-chain preview');await has('I reviewed the compact image');await page.$eval('input[type=checkbox]',e=>e.click());};
  await page.goto(url,{waitUntil:'networkidle0'});await prepare();await click('Sign & mint');await has('Submitted. Awaiting confirmation.');
  assert.deepEqual(await page.evaluate(()=>({sign:__qa.sign,submit:__qa.submit,persisted:__qa.recordBeforeSubmit})),{sign:1,submit:1,persisted:true});
  assert.equal(await page.$$eval('button',es=>es.find(e=>e.textContent.includes('Start another mint')).disabled),true);
  await page.evaluate(()=>__qa.confirmation=0);await click('Check status again');await has('Confirmed on Cardano.');
  assert.equal(await page.$$eval('button',es=>es.find(e=>e.textContent.includes('Start another mint')).disabled),false);
  const hash=await page.$eval('.transaction-hash',e=>e.textContent);
  await page.reload({waitUntil:'networkidle0'});await page.evaluate(()=>__qa.confirmation=1);await click('Mint on Cardano');await has('Confirmed on Cardano.');
  assert.equal(await page.$eval('.transaction-hash',e=>e.textContent),hash);assert.deepEqual(await page.evaluate(()=>[__qa.sign,__qa.submit]),[0,0]);
  await click('Start another mint');assert.equal(await page.evaluate(()=>localStorage.getItem('nft-studio:mint-active:v1')),null);assert.ok(await page.evaluate(h=>localStorage.getItem('nft-studio:receipt:v1:'+h),hash));
  // A fresh synthetic context exercises an ambiguous submission and reload.
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle0'});await prepare();await page.evaluate(()=>__qa.behavior='unknown');await click('Sign & mint');await has('Submission status is uncertain.');
  assert.equal(await page.evaluate(()=>__qa.submit),1);assert.equal(await page.$$eval('button',es=>es.find(e=>e.textContent.includes('Start another mint')).disabled),true);
  await page.reload({waitUntil:'networkidle0'});await click('Mint on Cardano');await has('Submission status is uncertain.');assert.deepEqual(await page.evaluate(()=>[__qa.sign,__qa.submit]),[0,0]);
  await click('Check status again');assert.equal(await page.evaluate(()=>__qa.submit),0);
  // Post-sign account/input checks still stop broadcast.
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle0'});await prepare();await page.evaluate(()=>__qa.spentAfterSigning=true);await click('Sign & mint');await has('no spendable outputs');assert.deepEqual(await page.evaluate(()=>[__qa.sign,__qa.submit]),[1,0]);
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle0'});await prepare();await page.evaluate(()=>__qa.unmountAfterSigning=true);await click('Sign & mint');await page.waitForFunction(()=>__qa.postSignReads>0);assert.deepEqual(await page.evaluate(()=>[__qa.sign,__qa.submit]),[1,0]);assert.equal(await page.evaluate(()=>document.querySelector('#root').childElementCount),0);
  assert.deepEqual(errors,[]);
  console.log('PASS actual MintDialog: persisted-before-broadcast; pending/confirmed; saved receipt reload with zero signing/submission; ambiguous no-rebroadcast; archive; post-sign spent-input and unmount guards');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
