// Synthetic wallet only. Serve the static export and supply STUDIO_REVIEW_URL_FILE.
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const original=(await readFile(process.env.STUDIO_REVIEW_URL_FILE || 'review-url.txt','utf8')).trim();
const base=process.env.STUDIO_URL || 'http://127.0.0.1:18770/NFT-Studio/';
const url=base+'?view=labs&lab=agents'+new URL(original).hash;
for(const [name,type] of Object.entries({chromium,webkit})){
const browser=await type.launch({headless:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedUrl=text;}}}));
await page.goto(url);await page.getByRole('button',{name:'Copy URL',exact:true}).waitFor();
await page.getByRole('button',{name:'Copy URL',exact:true}).click();
const copied=await page.evaluate(()=>window.copiedUrl);
assert.equal(new URL(copied).hash,new URL(original).hash);
assert.match(await page.locator('body').innerText(),/Paste this into a dApp browser/);
await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('blocked');}}}));
await page.getByRole('button',{name:'URL copied'}).click();
assert.equal(await page.getByRole('textbox',{name:'Creation URL',exact:true}).inputValue(),copied);
await page.getByRole('textbox',{name:'Creation URL',exact:true}).focus();
assert.equal(await page.getByRole('textbox',{name:'Creation URL',exact:true}).evaluate(e=>e.selectionEnd-e.selectionStart),copied.length);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('.ns-browser-help').screenshot({path:`handoff-${name}.png`});
if(name==='chromium'){
const key=C.PrivateKey.generate_ed25519(),cred=C.Credential.from_keyhash(key.to_public().hash()),addr=C.BaseAddress.new(1,cred,cred).to_address();
const utxo=C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex('12'.repeat(32)),0),C.TransactionOutput.new(addr,C.Value.new(C.BigNum.from_str('20000000')))).to_hex();
let submits=0;
await page.exposeFunction('fixtureSign',hex=>{const set=C.TransactionWitnessSet.new(),v=C.Vkeywitnesses.new();v.add(C.make_vkey_witness(C.FixedTransaction.from_hex(hex).transaction_hash(),key));set.set_vkeys(v);return set.to_hex();});
await page.exposeFunction('fixtureSubmit',()=>{submits++;});
await page.route('https://koios.beacn.workers.dev/**',async route=>{
const path=new URL(route.request().url()).pathname;
const row=path.endsWith('/tip')?{epoch_no:658,abs_slot:198000000,block_time:Math.floor(Date.now()/1000)}:path.endsWith('/epoch_params')?{epoch_no:658,min_fee_a:44,min_fee_b:155381,max_tx_size:16384,max_val_size:5000,coins_per_utxo_size:'4310',key_deposit:'2000000',pool_deposit:'500000000'}:null;
await route.fulfill({json:row?[row]:[]});
});
await page.evaluate(({address,utxo})=>{window.cardano={vespr:{name:'VESPR test fixture',apiVersion:'1',enable:async()=>({getNetworkId:async()=>1,getChangeAddress:async()=>address,getUtxos:async()=>[utxo],signTx:hex=>window.fixtureSign(hex),submitTx:async()=>{await window.fixtureSubmit();throw {code:2,info:'Synthetic ledger refusal for diagnostic test'};}})}};},{address:addr.to_hex(),utxo});
await page.getByRole('button',{name:'Review with my wallet',exact:true}).click();
await page.getByRole('button',{name:'VESPR test fixture',exact:true}).click();
await page.getByRole('button',{name:'Build the review',exact:true}).click();
await page.getByRole('checkbox').check();
await page.getByRole('button',{name:'Sign & submit',exact:true}).click();
await page.getByText('Submission response unclear',{exact:true}).waitFor();
assert.match(await page.getByRole('alert').innerText(),/Synthetic ledger refusal/);
await page.getByText('Show transaction report (no download needed)',{exact:true}).click();
const report=JSON.parse(await page.getByRole('textbox',{name:'Transaction report',exact:true}).inputValue());
assert.equal(report.submission.walletError,'Synthetic ledger refusal for diagnostic test');assert.equal(submits,1);
await page.locator('.ns-file-mint').screenshot({path:'wallet-error-mobile.png'});
await page.goto(base+'diagnostics/');
await page.getByRole('button',{name:'Read saved receipts'}).click();await page.locator('#receipts').selectOption('0');
const saved=JSON.parse(await page.locator('#report').inputValue());assert.equal(saved.hash,report.hash);assert.equal(saved.submission.walletError,report.submission.walletError);assert.ok(saved.signedHex.length>0);
assert.equal(submits,1);
}
assert.deepEqual(errors,[]);console.log('PASS',name,'exact phone URL, clipboard and fallback, mobile layout; Chromium synthetic signing/refusal/recovery');
}finally{await browser.close();}
}
