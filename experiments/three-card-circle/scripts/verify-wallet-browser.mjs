/** Real browser bundle + CIP-30 signatures against an Emulator. Never broadcasts. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Lucid,Emulator,CML,credentialToAddress,credentialToRewardAddress,getAddressDetails,utxoToCore,Data,Constr,applySingleCborEncoding} from '@lucid-evolution/lucid';
import {labels,buildStep,executePacket,context,encode,decode} from './setup-workflow.mjs';
import * as T from './transactions.mjs';
const {chromium,firefox,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CIRCLE_URL||'http://127.0.0.1:37021/showcase/three-card-circle/';
const parameters=decode(readFileSync('evidence/mainnet-parameters.json','utf8')).parameters;
function account(amount){const key=CML.PrivateKey.generate_ed25519(),hash=key.to_public().hash().to_hex();return {privateKey:key.to_bech32(),hash,address:credentialToAddress('Mainnet',{type:'Key',hash}),assets:{lovelace:amount}};}
const setup=account(55_000_000n),alice=account(20_000_000n),bob=account(20_000_000n),charlie=account(20_000_000n);
const provider=new Emulator([setup,alice,bob,{...bob,assets:{lovelace:5_000_000n}},charlie],parameters);
const lucid=await Lucid(provider,'Mainnet');lucid.selectWallet.fromPrivateKey(setup.privateKey);
const plan={operation:'activate-three-card-circle',network:'Mainnet',planHash:'browser-fixture',fundingLovelace:'55000000',setupAddress:setup.address,recipientAddress:alice.address,expiresAt:new Date(Date.now()+86400000).toISOString(),artwork:[1,2,3].map(i=>readFileSync(`../../experiments/three-card-circle/archive/showcase/card-0${i}.svg`,'utf8'))};
const journal={steps:[]},map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
for(let index=0;index<labels.length;index++){
 const packet=await buildStep({lucid,provider,plan,journal,index,now:()=>provider.now()});journal.steps[index]={...packet,status:'prepared'};
 await executePacket({packet,lucid,provider,plan,journal,storage,locks:{request:async(_,f)=>f()},save:async()=>{},freshness:async()=>{},confirm:async id=>{provider.awaitBlock(3);/* Emulator hardcodes testnet registration names; alias only its reward map for this mainnet-address fixture. */for(const [address,value] of Object.entries(provider.chain))provider.chain[credentialToRewardAddress('Mainnet',getAddressDetails(address).stakeCredential)]=value;return {hash:id,confirmations:3};},evaluate:async()=>{},now:()=>provider.now()});
}
const {c,refs}=context(plan,journal);
const config={network:'Mainnet',statePolicy:c.ids.state,tokenPolicy:c.ids.nft,transferHash:c.ids.transfer,programmableHash:c.ids.plb,startBlock:100,confirmations:3,bootstrap:{transactionId:journal.steps[0].hash,admin:c.admin},referenceOutref:refs[0].txHash+'#'+refs[0].outputIndex};
const dataJson=d=>typeof d==='bigint'?{int:Number(d)}:typeof d==='string'?{bytes:d}:Array.isArray(d)?{list:d.map(dataJson)}:d instanceof Map?{map:[...d].map(([k,v])=>({k:dataJson(k),v:dataJson(v)}))}:{constructor:d.index,fields:d.fields.map(dataJson)};
const out=u=>({tx_hash:u.txHash,tx_index:u.outputIndex,address:u.address,block_height:110,is_spent:false,value:String(u.assets.lovelace),asset_list:Object.entries(u.assets).filter(([k])=>k!=='lovelace').map(([k,q])=>({policy_id:k.slice(0,56),asset_name:k.slice(56),quantity:String(q)})),inline_datum:u.datum?{bytes:u.datum,value:dataJson(Data.from(u.datum))}:null,datum_hash:u.datumHash||null,reference_script:u.scriptRef?{type:'plutusV3',bytes:applySingleCborEncoding(u.scriptRef.script)}:null});
const p=parameters;
const rawParameters={...Object.fromEntries('pvt_motion_no_confidence pvt_committee_normal pvt_committee_no_confidence pvt_hard_fork_initiation pvtpp_security_group dvt_motion_no_confidence dvt_committee_normal dvt_committee_no_confidence dvt_update_to_constitution dvt_hard_fork_initiation dvt_p_p_network_group dvt_p_p_economic_group dvt_p_p_technical_group dvt_p_p_gov_group dvt_treasury_withdrawal committee_min_size committee_max_term_length gov_action_lifetime drep_activity max_block_size max_bh_size max_epoch optimal_pool_count influence monetary_expand_rate treasury_growth_rate decentralisation protocol_major protocol_minor max_block_ex_mem max_block_ex_steps'.split(' ').map(k=>[k,0])),extra_entropy:null,block_hash:null,min_utxo_value:'0',min_pool_cost:'0',nonce:'0',epoch_no:658,min_fee_a:p.minFeeA,min_fee_b:p.minFeeB,max_tx_size:p.maxTxSize,max_val_size:p.maxValSize,key_deposit:String(p.keyDeposit),pool_deposit:String(p.poolDeposit),drep_deposit:String(p.drepDeposit),gov_action_deposit:String(p.govActionDeposit),price_mem:p.priceMem,price_step:p.priceStep,max_tx_ex_mem:Number(p.maxTxExMem),max_tx_ex_steps:Number(p.maxTxExSteps),coins_per_utxo_size:String(p.coinsPerUtxoByte),collateral_percent:p.collateralPercentage,max_collateral_inputs:p.maxCollateralInputs,min_fee_ref_script_cost_per_byte:p.minFeeRefScriptCostPerByte,cost_models:p.costModels};
const all=()=>Object.values(provider.ledger).filter(e=>!e.spent).map(e=>e.utxo);
let actor=alice,signs=0,posts=0,unknown=false,changedWallet=false,staleInput=false,changeDuringSign=false;
const checks=[],errors=[],evaluationContexts=[];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureWallet',async(method,arg)=>{
  const a=changedWallet?charlie:actor;
  if(method==='getNetworkId')return 1;
  if(method==='getChangeAddress')return CML.Address.from_bech32(a.address).to_hex();
  if(method==='getUsedAddresses')return [CML.Address.from_bech32(a.address).to_hex()];
  if(method==='getUnusedAddresses'||method==='getRewardAddresses')return [];
  if(method==='getUtxos'||method==='getCollateral'){let u=await provider.getUtxos(a.address);if(method==='getCollateral')u=u.filter(x=>x.assets.lovelace>=5_000_000n).slice(0,1);return u.map(x=>utxoToCore(x).to_cbor_hex());}
  if(method==='signTx'){if(changeDuringSign)changedWallet=true;evaluationContexts.push({unsigned:arg,ledger:all()});signs++;const tx=CML.Transaction.from_cbor_hex(arg),w=CML.TransactionWitnessSetBuilder.new();w.add_vkey(CML.make_vkey_witness(CML.hash_transaction(tx.body()),CML.PrivateKey.from_bech32(a.privateKey)));return w.build().to_cbor_hex();}
  if(method==='submitTx'){posts++;if(unknown)throw Error('Simulated unknown response');const id=await provider.submitTx(arg);provider.awaitBlock(3);return id;}
  throw Error('Unexpected wallet method '+method);
 });
 await page.addInitScript(()=>{window.cardano={vespr:{name:'Synthetic VESPR',enable:async()=>Object.fromEntries(['getNetworkId','getChangeAddress','getUsedAddresses','getUnusedAddresses','getRewardAddresses','getUtxos','getCollateral','signTx','submitTx'].map(m=>[m,arg=>window.fixtureWallet(m,arg)]))}};});
 await page.route('**/deployment.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({status:'active',deployment:config})}));
 await page.route('**/api/v1/**',async r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST'}});
  const url=new URL(r.request().url()),body=r.request().postDataJSON();let rows;
  if(url.pathname.endsWith('/tip'))rows=[{block_no:120,block_time:Date.now()/1000}];
  else if(url.pathname.endsWith('/epoch_params'))rows=[rawParameters];
  else if(url.pathname.endsWith('/asset_utxos'))rows=all().filter(u=>body._asset_list.some(([p,n])=>u.assets[p+n])).map(out);
  else if(url.pathname.endsWith('/utxo_info'))rows=(staleInput?[]:all()).filter(u=>body._utxo_refs.includes(u.txHash+'#'+u.outputIndex)).map(out);
  else throw Error('Unexpected chain request '+url.pathname);
  return r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(rows,(_,v)=>typeof v==='bigint'?String(v):v)});
 });
 await page.goto(base);
 const ready=async()=>page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('Confirmed ledger revision'));
 const connect=async()=>{await ready();await page.locator('#connect').click();await page.locator('#wallet-list button').click();await page.locator('#transfer-form').waitFor({state:'visible',timeout:15000});};
 const prepare=async(indices,dest)=>{
  for(let i=0;i<3;i++){const box=page.locator(`#transfer-cards input[value="${i}"]`);if(!await box.isDisabled())await box.setChecked(indices.includes(i));}
  await page.locator('#transfer-destination').fill(dest);await page.locator('#transfer-prepare').click();
  await page.waitForFunction(()=>!document.querySelector('#transfer-review').hidden||!document.querySelector('#transfer-prepare').disabled,{timeout:30000});
 };
 const send=async()=>{await page.locator('#transfer-sign').click();await page.locator('#wallet-status').filter({hasText:'Submitted.'}).waitFor({timeout:30000});await page.locator('#wallet-dialog [data-close]').click();await page.locator('#refresh').click();await ready();};
 await connect();await prepare([0,1,2],bob.address);
 assert.equal(await page.locator('#transfer-review').isVisible(),true,await page.locator('#wallet-status').textContent());assert.equal(await page.locator('#review-destination').textContent(),c.holder(bob.hash));assert.equal(signs,0);assert.equal(posts,0);mkdirSync('../../tmp/agent-site-qa/circle',{recursive:true});await page.screenshot({path:'../../tmp/agent-site-qa/circle/transfer-review-mobile.png',fullPage:true});checks.push('unsigned review shows exact programmable destination and fee before signing');
 changedWallet=true;await page.locator('#transfer-sign').click();await page.locator('#wallet-status').filter({hasText:'wallet changed'}).waitFor();assert.equal(signs,0);changedWallet=false;checks.push('wallet change refused before signing');
 await page.locator('#transfer-back').click();await prepare([0,1,2],bob.address);staleInput=true;await page.locator('#transfer-sign').click();await page.locator('#wallet-status').filter({hasText:'was spent'}).waitFor();assert.equal(signs,0);staleInput=false;checks.push('spent inputs refused before signing');
 await page.locator('#transfer-back').click();await prepare([0,1,2],bob.address);changeDuringSign=true;await page.locator('#transfer-sign').click();await page.locator('#wallet-status').filter({hasText:'wallet changed'}).waitFor();assert.equal(signs,1);assert.equal(posts,0);changeDuringSign=false;changedWallet=false;checks.push('wallet changes after signing prevent submission');
 await page.locator('#transfer-back').click();await prepare([0,1,2],bob.address);await send();assert.equal(signs,2);assert.equal(posts,1);assert.deepEqual(T.decodeState(await provider.getUtxoByUnit(c.ids.state+T.names.state)).owners,Array(3).fill(bob.hash));checks.push('all-three transfer to a new owner signs and updates actual Emulator ledger');
 actor=bob;await connect();await prepare([0],alice.address);await send();checks.push('all-three holder can introduce an owner with a subset');
 actor=alice;await connect();const before=signs;await prepare([0],charlie.address);await page.locator('#wallet-status').filter({hasText:'split ownership'}).waitFor();assert.equal(signs,before);assert.equal(await page.locator('#transfer-review').isVisible(),false);await page.locator('#wallet-dialog [data-close]').click();checks.push('split-to-new-owner rejected with no signature request');
 actor=bob;await connect();await prepare([1,2],alice.address);await send();assert.deepEqual(T.decodeState(await provider.getUtxoByUnit(c.ids.state+T.names.state)).owners,Array(3).fill(alice.hash));checks.push('split cards reunite with an existing owner atomically');
 actor=alice;await connect();await prepare([0,1,2],bob.address);unknown=true;const priorPosts=posts;await page.locator('#transfer-sign').click();await page.locator('#wallet-status').filter({hasText:'outcome unclear'}).waitFor();assert.equal(posts,priorPosts+1);assert.equal(await page.locator('#transfer-sign').isDisabled(),true);await page.locator('#wallet-dialog [data-close]').click();
 await connect();await prepare([0,1,2],bob.address);const priorSigns=signs;await page.locator('#transfer-sign').click();await page.locator('#wallet-status').filter({hasText:'previous attempt'}).waitFor();assert.equal(posts,priorPosts+1);assert.equal(signs,priorSigns);checks.push('uncertain submission persists across reopening and blocks a second signature or POST');
 assert.deepEqual(errors,[]);
 mkdirSync('../../tmp/agent-site-qa/circle',{recursive:true});await page.screenshot({path:'../../tmp/agent-site-qa/circle/transfer-unknown-mobile.png',fullPage:true});
 await page.close();
}finally{await browser.close();}
// Confirm the same WASM bundle initializes in the other supported browser engines.
for(const [name,type] of Object.entries({firefox,webkit})){
 const b=await type.launch({headless:true});try{const page=await b.newPage();await page.goto(base);const result=await page.evaluate(async()=>{const m=await import('./wallet/transfer.js');return typeof m.prepareTransfer;});assert.equal(result,'function');checks.push(name+' loads the actual transfer engine');}finally{await b.close();}
}
writeFileSync('evidence/wallet-evaluation-raw.json',encode(evaluationContexts)+'\n');
writeFileSync('evidence/wallet-browser-checks.json',JSON.stringify({ok:true,createdAt:new Date().toISOString(),mode:'real browser bundle, synthetic CIP-30 key witnesses and Emulator only; no mainnet submission or physical-wallet claim',checks,signatures:signs,submissionCalls:posts},null,2)+'\n');
console.log(`PASS: ${checks.length} browser wallet checks; ${signs} synthetic signatures, ${posts} Emulator/unknown submission calls.`);
