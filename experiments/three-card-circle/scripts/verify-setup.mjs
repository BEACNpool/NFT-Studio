/** Exercises the exact operator workflow with synthetic keys and an Emulator only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Lucid,Emulator,generateEmulatorAccountFromPrivateKey,getAddressDetails,credentialToAddress,CML} from '@lucid-evolution/lucid';
import {limits,labels,buildStep,executePacket,context,validatePlan,encode,decode} from './setup-workflow.mjs';
import * as T from './transactions.mjs';
const params=decode(readFileSync('evidence/mainnet-parameters.json','utf8'));
assert.ok(Date.now()-Date.parse(params.observedAt)<86400000);
const setup=generateEmulatorAccountFromPrivateKey({lovelace:limits.funding});
const recipient=generateEmulatorAccountFromPrivateKey({lovelace:0n}),recipientKey=getAddressDetails(recipient.address).paymentCredential.hash;
const provider=new Emulator([setup],params.parameters),lucid=await Lucid(provider,'Custom');lucid.selectWallet.fromPrivateKey(setup.privateKey);
const plan={operation:'activate-three-card-circle',network:'Custom',planHash:'synthetic-operator-test',fundingLovelace:String(limits.funding),setupAddress:setup.address,recipientAddress:credentialToAddress('Custom',{type:'Key',hash:recipientKey},{type:'Key',hash:'ab'.repeat(28)}),expiresAt:new Date(Date.now()+86400000).toISOString(),artwork:[1,2,3].map(i=>readFileSync(`../../public/showcase/three-card-circle/card-0${i}.svg`,'utf8'))};
validatePlan(plan);
assert.throws(()=>validatePlan({...plan,recipientAddress:setup.address}),/separate key/);
assert.throws(()=>validatePlan({...plan,expiresAt:'2020-01-01'}),/expired/);
assert.throws(()=>validatePlan({...plan,fundingLovelace:'100000000'}));
const journal={steps:[]},map=new Map();let posts=0,saves=0,checks=0;
const submit=provider.submitTx.bind(provider);provider.submitTx=async tx=>{posts++;return submit(tx);};
const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},locks={request:async(_,f)=>f()};
const save=async state=>{assert.deepEqual(decode(encode(state)),state);saves++;};
const freshness=async()=>{checks++;},confirm=async id=>{provider.awaitBlock(3);return {hash:id,confirmations:3,mode:'simulated'};},evaluate=async unsigned=>{assert.equal(CML.Transaction.from_cbor_hex(unsigned).witness_set().vkeywitnesses()?.len()??0,0);};
const now=()=>provider.now();
const evaluationContexts=[];
for(let index=0;index<labels.length;index++){
 const packet=await buildStep({lucid,provider,plan,journal,index,now});
 evaluationContexts.push({index,label:labels[index],unsigned:packet.unsigned,ledger:Object.values(provider.ledger).filter(x=>!x.spent).map(x=>x.utxo)});
 if(index===0){
  await assert.rejects(executePacket({packet:{...packet,expiresAt:now()},lucid,provider,plan,journal,storage,locks,save,freshness,confirm,evaluate,now}),/expired/);assert.equal(posts,0);
  await assert.rejects(executePacket({packet,lucid,provider,plan,journal,storage,locks,save,freshness,confirm,evaluate:async()=>{throw Error('Node rejected unsigned transaction');},now}),/Node rejected/);assert.equal(posts,0);
 }
 journal.steps[index]={...packet,status:'prepared'};await save(journal);
 const result=await executePacket({packet,lucid,provider,plan,journal,storage,locks,save,freshness,confirm,evaluate,now});
 assert.equal(result.status,'confirmed');assert.equal(posts,index+1);
 await assert.rejects(executePacket({packet,lucid,provider,plan,journal,storage,locks,save,freshness,confirm,evaluate,now}),/previous attempt/);assert.equal(posts,index+1);
 console.log('PASS',index,labels[index],result.signedBytes,result.feeLovelace);
}
const {c,refs}=context(plan,journal);
assert.deepEqual(T.decodeState(await provider.getUtxoByUnit(c.ids.state+T.names.state)).owners,Array(3).fill(recipientKey));
for(const n of T.cardNames)assert.equal((await provider.getUtxoByUnit(c.ids.nft+n)).address,c.holder(recipientKey));
const remaining=await provider.getUtxos(plan.setupAddress);assert.equal(remaining.length,1);assert.equal(remaining[0].txHash,refs[0].txHash);
const refunded=(await provider.getUtxos(plan.recipientAddress)).reduce((n,u)=>n+u.assets.lovelace,0n);assert.ok(refunded>=limits.minRefund);
const report={ok:true,mode:'exact production workflow; Emulator, synthetic keys, no real network submission',createdAt:new Date().toISOString(),parametersObservedAt:params.observedAt,transactions:journal.steps.map(({index,label,hash,signedBytes,feeLovelace,status})=>({index,label,hash,signedBytes,feeLovelace,status})),fundingLovelace:String(limits.funding),refundLovelace:String(refunded),referenceReserveLovelace:String(refs[0].assets.lovelace),feesLovelace:String(journal.steps.reduce((n,s)=>n+BigInt(s.feeLovelace),0n)),negativeChecks:['wrong recipient key','expired approval','wrong funding allowance','expired transaction','node evaluation rejection','each of eleven repeated submissions blocked'],durableRoundtripChecks:saves,preflightChecks:checks};
writeFileSync('evidence/setup-checks.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('evidence/setup-evaluation-raw.json',encode(evaluationContexts)+'\n');
console.log('PASS: exact setup workflow completed; no repeat submissions.');
