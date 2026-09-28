// Isolated synthetic wallet only. All chain requests and submissions are intercepted.
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
const browser=await chromium.launch({headless:true});
const key=C.PrivateKey.generate_ed25519(), cred=C.Credential.from_keyhash(key.to_public().hash());
const addr=C.BaseAddress.new(1,cred,cred).to_address();
const u=C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex('12'.repeat(32)),0),C.TransactionOutput.new(addr,C.Value.new(C.BigNum.from_str('20000000')))).to_hex();
let signed=0,submitted=0;
async function setup({network=1,reject=false,ambiguous=false,tamper=false}={}) {
 const context=await browser.newContext({viewport:{width:390,height:844}}); const page=await context.newPage(); page.setDefaultTimeout(10000); page.on("pageerror",e=>console.log("PAGEERROR",e.message));
 await page.route('https://koios.beacn.workers.dev/**',r=>r.fulfill({json:r.request().url().includes('/tip')?[{epoch_no:658,abs_slot:198000000,block_time:Math.floor(Date.now()/1000)-10}]:[{epoch_no:658,min_fee_a:44,min_fee_b:155381,max_tx_size:16384,max_val_size:5000,coins_per_utxo_size:'4310',key_deposit:'2000000',pool_deposit:'500000000'}]}));
 if(tamper)await page.route('**/intent.json',async r=>{const res=await r.fetch();const data=await res.json();data.bundle.name='tampered';await r.fulfill({json:data});});
 await page.exposeFunction('syntheticSign',hex=>{signed++;if(reject)throw Error('User declined');const tx=C.FixedTransaction.from_hex(hex);const set=C.TransactionWitnessSet.new(),v=C.Vkeywitnesses.new();v.add(C.make_vkey_witness(tx.transaction_hash(),key));set.set_vkeys(v);return set.to_hex();});
 await page.exposeFunction('syntheticSubmit',hex=>{submitted++;const tx=C.Transaction.from_hex(hex),body=tx.body();assert.equal(body.mint().len(),1);let quantity=0n;const outs=body.outputs();for(let i=0;i<outs.len();i++){const o=outs.get(i);assert.equal(o.address().to_hex(),addr.to_hex());const ma=o.amount().multiasset();if(ma)for(let p=0;p<ma.keys().len();p++){const a=ma.get(ma.keys().get(p));for(let n=0;n<a.keys().len();n++)quantity+=BigInt(a.get(a.keys().get(n)).to_str());}}assert.equal(quantity,1n);assert.ok(tx.auxiliary_data().metadata().get(C.BigNum.from_str('721')));if(ambiguous)throw Error('Network timeout');return C.FixedTransaction.from_hex(hex).transaction_hash().to_hex();});
 await page.goto('http://127.0.0.1:18765/');
 await page.evaluate(({addr,u,network})=>{window.cardano={test:{name:'Synthetic wallet',apiVersion:'1',enable:async()=>({getNetworkId:async()=>network,getChangeAddress:async()=>addr,getUtxos:async()=>[u],signTx:hex=>window.syntheticSign(hex),submitTx:hex=>window.syntheticSubmit(hex)})}};},{addr:addr.to_hex(),u,network});
 return {context,page};
}
try {
 const no=await browser.newPage();await no.goto('http://127.0.0.1:18765/');assert.equal(await no.locator('#browser-message').innerText(),'Open this inside a dApp browser');await no.locator('#art').click();assert.equal(await no.locator('dialog').isVisible(),false);await no.close();console.log('PASS image-only page, outside-wallet message, no automatic wallet calls');
 for (const opts of [{},{network:0},{reject:true},{ambiguous:true},{tamper:true}]) {
  const {page,context}=await setup(opts);await page.waitForFunction(()=>document.querySelector('#browser-message').hidden);if(process.env.SHOWCASE_SCREENSHOTS && !Object.keys(opts).length)await page.screenshot({path:process.env.SHOWCASE_SCREENSHOTS+'/wallet.png'});await page.locator('#art').click(); 
  if(opts.network===0||opts.tamper){await page.waitForFunction(()=>/mainnet|hash|integrity|content changed/i.test(document.querySelector('#status').textContent));assert.equal(await page.locator('#approve').isVisible(),false);console.log('PASS rejected',opts);}
  else {await page.locator('#approve').waitFor({state:'visible'});if(process.env.SHOWCASE_SCREENSHOTS && !Object.keys(opts).length)await page.screenshot({path:process.env.SHOWCASE_SCREENSHOTS+'/review.png'});const before=signed;assert.ok(await page.locator('#review').innerText());await page.locator('#approve').click();if(opts.reject){await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('User declined'));assert.equal(signed,before+1);}else{await page.waitForFunction(()=>/submitted|uncertain/.test(document.querySelector('#status').textContent));assert.match(await page.locator('#status').innerText(),opts.ambiguous?/uncertain/:/submitted/);const count=submitted;await page.locator('#close').click();await page.locator('#art').click();assert.equal(await page.locator('#approve').isVisible(),false);assert.equal(submitted,count); await page.reload(); await page.evaluate(()=>{window.cardano={test:{name:'Synthetic wallet',apiVersion:'1',enable:async()=>{throw Error('Must not reconnect');}}};}); await page.locator('#art').click();assert.match(await page.locator('#status').innerText(),/already attempted/);assert.equal(submitted,count);}console.log('PASS synthetic wallet',opts);}
  await context.close();
 }
}finally{await browser.close();}
