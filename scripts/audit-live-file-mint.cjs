// Read-only audit of an existing Studio server using synthetic CIP-30 state.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer-core');
const C=require('@emurgo/cardano-serialization-lib-nodejs');
const url=process.env.STUDIO_URL||'http://127.0.0.1:8924/?create=data';
const bn=n=>C.BigNum.from_str(String(n)),key=C.PrivateKey.generate_ed25519();
const addr=C.BaseAddress.new(1,C.Credential.from_keyhash(key.to_public().hash()),C.Credential.from_keyhash(key.to_public().hash())).to_address();
const oldPolicy=C.ScriptHash.from_hex('ab'.repeat(28)),oldAsset=C.AssetName.new(new TextEncoder().encode('PRESERVE'));
const value=C.Value.new(bn(20000000)),ma=C.MultiAsset.new(),assets=C.Assets.new();assets.insert(oldAsset,bn(9));ma.insert(oldPolicy,assets);value.set_multiasset(ma);
const u=C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex('01'.repeat(32)),0),C.TransactionOutput.new(addr,value));
const fixture={changeHex:addr.to_hex(),utxos:[u.to_hex()]},params={epoch_no:653,min_fee_a:44,min_fee_b:155381,max_tx_size:16384,max_val_size:5000,coins_per_utxo_size:'4310',key_deposit:'2000000',pool_deposit:'500000000'};
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{
  async function makePage(behavior='ok'){
   const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width:1440,height:1000});
   const transactions=new Map();
   await page.exposeFunction('__fixtureSign',hex=>{const ws=C.TransactionWitnessSet.new(),v=C.Vkeywitnesses.new();v.add(C.make_vkey_witness(C.FixedTransaction.from_hex(hex).transaction_hash(),key));ws.set_vkeys(v);return ws.to_hex();});
   await page.exposeFunction('__fixtureSubmit',hex=>{const tx=C.Transaction.from_hex(hex),fixed=C.FixedTransaction.from_hex(hex),hash=fixed.transaction_hash().to_hex(),m=tx.auxiliary_data().metadata(),metadata={};for(let i=0;i<m.keys().len();i++){const label=m.keys().get(i);metadata[label.to_str()]=JSON.parse(C.decode_metadatum_to_json_str(m.get(label),C.MetadataJsonSchema.NoConversions));}
    let coin=0n,tokens=0n;for(let i=0;i<tx.body().outputs().len();i++){const o=tx.body().outputs().get(i);assert.equal(o.address().to_hex(),addr.to_hex());coin+=BigInt(o.amount().coin().to_str());const n=o.amount().multiasset()?.get(oldPolicy)?.get(oldAsset);if(n)tokens+=BigInt(n.to_str());assert.ok(BigInt(o.amount().coin().to_str())>=BigInt(C.min_ada_for_output(o,C.DataCost.new_coins_per_byte(bn(params.coins_per_utxo_size))).to_str()));}
    assert.equal(coin+BigInt(tx.body().fee().to_str()),20000000n);assert.equal(tokens,9n);assert.equal(C.hash_auxiliary_data(tx.auxiliary_data()).to_hex(),tx.body().auxiliary_data_hash().to_hex());assert.ok(fixed.to_bytes().length<=16384);
    const info={hash,metadata,bytes:fixed.to_bytes().length,mint:!!tx.body().mint(),fee:tx.body().fee().to_str()};transactions.set(hash,info);return info;});
   await page.evaluateOnNewDocument((wallet,behavior)=>{
    window.__qa={sign:0,submit:0,behavior,confirmation:null,persistedBeforeSubmit:false,network:1,spent:false,afterSign:false};
    window.cardano={qa:{name:'Synthetic QA wallet',apiVersion:'1',enable:async()=>({getNetworkId:async()=>window.__qa.network,getChangeAddress:async()=>wallet.changeHex,getUtxos:async()=>window.__qa.spent&&window.__qa.afterSign?[]:wallet.utxos,
     signTx:async hex=>{window.__qa.sign++;if(window.__qa.behavior==='delay'){await new Promise(resolve=>window.__qa.releaseSign=resolve);}const witness=await window.__fixtureSign(hex);window.__qa.afterSign=true;if(window.__qa.behavior==='storage-failure'){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('nft-studio:receipt:v1:'))throw new DOMException('Synthetic quota failure','QuotaExceededError');return original.call(this,k,v);};}return witness;},
     submitTx:async hex=>{window.__qa.submit++;const result=await window.__fixtureSubmit(hex);window.__qa.last=result;const saved=localStorage.getItem('nft-studio:receipt:v1:'+result.hash);window.__qa.persistedBeforeSubmit=!!saved&&JSON.parse(saved).signedHex===hex;if(window.__qa.behavior==='unknown')throw Error('Synthetic ambiguous response');return result.hash;}})}};
   },fixture,behavior);
   await page.setRequestInterception(true);page.on('request',async request=>{
    if(request.url().includes('koios.beacn.workers.dev/api/v1/')){
      if(request.method()==='OPTIONS')return request.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
      let body;if(request.url().endsWith('/tip'))body=[{epoch_no:653,abs_slot:197151000,block_time:Math.floor(Date.now()/1000)}];
      else if(request.url().includes('/epoch_params'))body=[params];
      else if(request.url().endsWith('/tx_status'))body=[{tx_hash:JSON.parse(request.postData())._tx_hashes[0],num_confirmations:await page.evaluate(()=>__qa.confirmation)}];
      else if(request.url().endsWith('/tx_metadata')){const hash=JSON.parse(request.postData())._tx_hashes[0];body=transactions.has(hash)?[{tx_hash:hash,metadata:transactions.get(hash).metadata}]:[];}
      else return request.abort();return request.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
    }
    if(!request.url().startsWith(new URL(url).origin)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))return request.abort();return request.continue();
   });
   return {page,context,transactions};
  }
  const click=async(page,text)=>{await page.waitForFunction(t=>Array.from(document.querySelectorAll('button')).some(e=>e.textContent.includes(t)&&!e.disabled&&e.getClientRects().length),{timeout:20000},text).catch(async error=>{console.log('MISSING BUTTON',text,await page.evaluate(()=>document.body.innerText));throw error;});const es=await page.$$('button');for(const e of es)if(await e.evaluate((n,t)=>n.textContent.includes(t)&&!n.disabled&&n.getClientRects().length,text)){await e.click();return;}throw Error('No visible button '+text);};
  const has=(page,text)=>page.waitForFunction(t=>document.body.innerText.includes(t),{timeout:30000},text);
  async function prepare(page,mode,fromHome=false){const entry=new URL(url);if(fromHome)entry.search='';await page.goto(entry.href,{waitUntil:'networkidle0'});if(fromHome)await page.locator('.ns-mode-data').click();await click(page,mode==='data'?'Data record':'NFT with files');await click(page,'Write text or code');await page.type('.ns-code-input','The bytes are the point. 🦾');await click(page,'Add this file');if(mode==='nft')await click(page,'Generate a small cover');await click(page,'Prepare exact content');await click(page,'Review with my wallet');await click(page,'Synthetic QA wallet');await click(page,'Build the review');await has(page,'I reviewed the exact files');await page.$eval('.ns-check input',e=>e.click());}
  for(const mode of ['data','nft']){
   const {page,context}=await makePage();await prepare(page,mode);await click(page,'Sign & submit');await has(page,'awaiting inclusion');
   const qa=await page.evaluate(()=>__qa);assert.equal(qa.sign,1);assert.equal(qa.submit,1);assert.equal(qa.persistedBeforeSubmit,true);assert.equal(qa.last.mint,mode==='nft');
   await page.evaluate(()=>__qa.confirmation=0);await click(page,'Check status');await has(page,'Confirmed on chain');
   const savedState=await page.evaluate(h=>JSON.parse(localStorage.getItem('nft-studio:receipt:v1:'+h)).state,qa.last.hash);
   await page.screenshot({path:path.join(process.cwd(),'live-file-'+mode+'.png'),fullPage:true});
   const downloads=fs.mkdtempSync(path.join(process.cwd(),'receipt-download-'));const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await click(page,'Save receipt');let names=[];for(let i=0;i<50;i++){names=fs.readdirSync(downloads).filter(n=>n.endsWith('.json'));if(names.length)break;await new Promise(resolve=>setTimeout(resolve,100));}assert.equal(names.length,1);const packet=JSON.parse(fs.readFileSync(path.join(downloads,names[0])));assert.equal(packet.hash,qa.last.hash);assert.equal(C.FixedTransaction.from_hex(packet.signedHex).transaction_hash().to_hex(),qa.last.hash);fs.rmSync(downloads,{recursive:true});

   // Close the dialog and use the actual shell Recovery panel.
   await page.waitForFunction(()=>!document.querySelector('.ns-file-mint .ns-busy'));await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.ns-file-mint'));await click(page,'Activity');await click(page,'Check & recover');await has(page,'Metadata hash matches');
   const recovered=await page.$eval('.ns-recovery-grid code',e=>e.textContent).catch(()=>null);
   if(mode==='nft')await click(page,'creation-1.txt');const frame=await(await page.$('.ns-recovery-grid iframe')).contentFrame();await frame.waitForSelector('pre');assert.equal(await frame.$eval('pre',e=>e.textContent),'The bytes are the point. 🦾');

   results.push({mode,signedBytes:qa.last.bytes,fee:qa.last.fee,confirmedReceiptState:savedState,recoveryHashPresent:!!recovered});await context.close();
  }
  for(const behavior of ['unknown','storage-failure']){
   const {page,context}=await makePage(behavior);await prepare(page,'data');await click(page,'Sign & submit');
   await page.waitForFunction(()=>__qa.sign===1&&!document.body.innerText.includes('Approve in your wallet…'));
   if(behavior==='unknown')await has(page,'Submission response unclear');
   const details=await page.evaluate(()=>({sign:__qa.sign,submit:__qa.submit,text:document.querySelector('.ns-file-mint')?.innerText,receiptButton:Array.from(document.querySelectorAll('button')).some(e=>e.textContent.includes('Save receipt'))}));
   if(behavior==='unknown'){await has(page,'Submission response unclear');await click(page,'Check status');assert.equal(await page.evaluate(()=>__qa.submit),1);}
   else assert.equal(details.submit,0);
   results.push({behavior,...details});await context.close();
  }
  {const {page,context}=await makePage();await prepare(page,'data');await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+241001;});await click(page,'Sign & submit');await has(page,'review expired');assert.deepEqual(await page.evaluate(()=>[__qa.sign,__qa.submit]),[0,0]);results.push({behavior:'stale-review',sign:0,submit:0});await context.close();}
  for(const navigation of ['all-formats','browser-back']){
   const {page,context}=await makePage('delay');await prepare(page,'data',navigation==='browser-back');await click(page,'Sign & submit');await page.waitForFunction(()=>typeof __qa.releaseSign==='function');
   // Both shell navigation and browser Back must cancel a pending wallet request.
   await page.evaluate(navigation=>{if(navigation==='browser-back')history.back();else{const button=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.includes('All formats'));if(!button)throw Error('No format navigation');button.click();}},navigation);
   await page.waitForFunction(()=>!document.querySelector('.ns-workbench'));await page.evaluate(()=>__qa.releaseSign());
   await page.waitForFunction(()=>__qa.afterSign);await page.waitForNetworkIdle({idleTime:500});assert.equal(await page.evaluate(()=>__qa.submit),0);results.push({behavior:'unmount-during-sign',navigation,submit:0});await context.close();
  }
  console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
