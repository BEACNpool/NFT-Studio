/** Bounded activation rehearsal. Emulator only; never loads keys or submits to a network. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Lucid,Emulator,generateEmulatorAccountFromPrivateKey,getAddressDetails,credentialToAddress,validatorToScriptHash,CML} from '@lucid-evolution/lucid';
import * as T from './transactions.mjs';
import {verifySigned,feeCalculator} from './submission.mjs';

const snapshot=JSON.parse(readFileSync('evidence/mainnet-parameters.json','utf8'),(_,v)=>v?.$bigint?BigInt(v.$bigint):v);
assert.ok(Date.now()-Date.parse(snapshot.observedAt)<86400000,'Refresh the read-only protocol parameter snapshot');
const budget=55_000_000n,collateralAmount=5_000_000n;
const setup=generateEmulatorAccountFromPrivateKey({lovelace:budget});
const recipient=generateEmulatorAccountFromPrivateKey({lovelace:0n});
const key=a=>getAddressDetails(a.address).paymentCredential.hash;
const recipientBase=credentialToAddress('Custom',{type:'Key',hash:key(recipient)},{type:'Key',hash:'ab'.repeat(28)});
const emulator=new Emulator([setup],snapshot.parameters),lucid=await Lucid(emulator,'Custom');
lucid.selectWallet.fromPrivateKey(setup.privateKey);
const report={mode:'isolated emulator; synthetic setup and recipient keys; one 55 ADA funding output; no network access',parametersObservedAt:snapshot.observedAt,createdAt:new Date().toISOString(),fundingLovelace:String(budget),transactions:[]};
const ref=u=>u.txHash+'#'+u.outputIndex;
let collateral;
async function send(label,tx,{referenceBytes=0,plutus=true,changeAddress=setup.address}={}){
 const built=await tx.complete({coinSelection:false,changeAddress,setCollateral:3_000_000n,...(collateral?{presetWalletInputs:[collateral]}:{})});
 const signed=await built.sign.withWallet().complete();
 const body=signed.toTransaction().body(),inputs=body.inputs();
 if(plutus){
  const cs=body.collateral_inputs();assert.equal(cs?.len(),1,'Exactly one separate collateral output');
  const ci=cs.get(0);assert.equal(ci.transaction_id().to_hex()+'#'+ci.index(),ref(collateral),'Collateral reservation changed');
  assert.equal(body.total_collateral(),3_000_000n);
  assert.ok(body.total_collateral()*100n>=body.fee()*BigInt(snapshot.parameters.collateralPercentage));
  for(let i=0;i<inputs.len();i++)assert.notEqual(inputs.get(i).transaction_id().to_hex()+'#'+inputs.get(i).index(),ref(collateral),'Collateral must never fund a normal input');
 }
 const verified=verifySigned({unsigned:built.toCBOR(),signed:signed.toCBOR(),parameters:snapshot.parameters,feeCapLovelace:1_500_000n,requiredKeys:[key(setup)],minimumFee:feeCalculator(snapshot.parameters,referenceBytes)});
 const id=await signed.submit();emulator.awaitBlock();assert.equal(id,verified.id);
 report.transactions.push({label,...verified});
 console.log('PASS',label,verified.signedBytes,'bytes;',verified.feeLovelace,'lovelace fee');
 return id;
}
const initial=await emulator.getUtxos(setup.address);
let split=lucid.newTx().collectFrom(initial);
for(let i=0;i<5;i++)split=split.pay.ToAddress(setup.address,{lovelace:2_000_000n});
split=split.pay.ToAddress(setup.address,{lovelace:collateralAmount});
const splitId=await send('prepare five seeds and separate collateral',split,{plutus:false});
const outputs=(await emulator.getUtxos(setup.address)).filter(u=>u.txHash===splitId).sort((a,b)=>a.outputIndex-b.outputIndex);
const seeds=Object.fromEntries(['params','template','registry','state','issue'].map((name,i)=>[name,outputs[i]]));
collateral=outputs[5];assert.equal(collateral.assets.lovelace,collateralAmount);
const reserved=new Set([...Object.values(seeds),collateral].map(ref));
const c=T.derive({seeds,admin:key(setup),network:'Custom'});
const get=unit=>emulator.getUtxoByUnit(unit),state=()=>get(c.ids.state+T.names.state),params=()=>get(c.ids.params+T.names.params),registry=()=>get(c.ids.registry+c.ids.nft);
async function feeInput(){
 const eligible=(await emulator.getUtxos(setup.address)).filter(u=>!reserved.has(ref(u))&&!u.scriptRef&&Object.keys(u.assets).length===1);
 assert.equal(eligible.length,1,'A single bounded fee/change output must remain');return eligible[0];
}
await send('register bootstrap authority',T.registration(lucid,c,['lock']).collectFrom([await feeInput()]));
await send('bootstrap immutable CIP-113 core',T.bootstrap(lucid,c).collectFrom([await feeInput()]));
await send('create bounded ownership record',T.createState(lucid,c).collectFrom([await feeInput()]));
for(const keys of [['dispatcher','delegate','transfer'],['issue','issuance']])await send('register '+keys.join('/'),T.registration(lucid,c,keys).collectFrom([await feeInput()]));
await send('register collection policy once',T.registerPolicy(lucid,c,{state:await state(),params:await params(),template:await get(c.ids.template+T.names.template),covering:await get(c.ids.registry)}).collectFrom([await feeInput()]));
const referenceId=await send('publish recoverable state reference',T.references(lucid,c,setup.address,['state']).collectFrom([await feeInput()]),{plutus:false});
const refs=(await emulator.getUtxos(setup.address)).filter(u=>u.txHash===referenceId&&u.scriptRef);
assert.equal(refs.length,1);assert.equal(validatorToScriptHash(refs[0].scriptRef),c.ids.state);
// Fee calculation uses raw script bytes, not the CBOR bytestring wrapper.
const referenceBytes=CML.PlutusV3Script.from_cbor_hex(refs[0].scriptRef.script).to_raw_bytes().length;
const context=async()=>({state:await state(),params:await params(),registry:await registry(),refs});
const metadata={};
for(let i=1;i<=3;i++){
 const art=readFileSync(`../../public/showcase/three-card-circle/card-0${i}.svg`);
 metadata['CARD0'+i]={name:`NFT-Studio Circle ${i}/3`,mediaType:'image/svg+xml',image:('data:image/svg+xml;base64,'+art.toString('base64')).match(/.{1,64}/g),description:['Three distinct programmable NFT-Studio cards.','Hold one or two: send to an existing holder.','Hold all three before transfer: invite a new owner.'],website:['https://beacnpool.github.io/NFT-Studio/','showcase/three-card-circle/']};
}
await send('issue all three cards to setup key',T.mintAll(lucid,c,{...await context(),metadata}).collectFrom([await feeInput()]),{referenceBytes});
assert.deepEqual(T.decodeState(await state()).owners,[key(setup),key(setup),key(setup)]);
const cards=await Promise.all(T.cardNames.map(n=>get(c.ids.nft+n)));
await send('transfer complete set to recipient key',T.transfer(lucid,c,{...await context(),cards,moves:Object.fromEntries(T.cardNames.map(n=>[n,key(recipient)])),signers:[key(setup)]}).collectFrom([await feeInput()]),{referenceBytes});
assert.deepEqual(T.decodeState(await state()).owners,[key(recipient),key(recipient),key(recipient)]);
for(const name of T.cardNames)assert.equal((await get(c.ids.nft+name)).address,c.holder(key(recipient)));
assert.equal((await emulator.getUtxosByOutRef([collateral])).length,1,'Successful setup leaves collateral unspent');
const change=await feeInput();
// After every contract step is confirmed, return both free change and collateral
// to an ordinary base address, retaining only the availability reserve.
const refundId=await send('return all unused ADA and collateral',lucid.newTx().collectFrom([change,collateral]),{plutus:false,changeAddress:recipientBase});
const refunds=(await emulator.getUtxos(recipientBase)).filter(u=>u.txHash===refundId);
assert.equal(refunds.length,1);assert.ok(refunds[0].assets.lovelace>5_000_000n);
const remaining=await emulator.getUtxos(setup.address);assert.equal(remaining.length,1);assert.equal(ref(remaining[0]),ref(refs[0]));
report.referenceReserveLovelace=String(refs[0].assets.lovelace);
report.returnedUnusedLovelace=String(refunds[0].assets.lovelace);
report.totalFeesLovelace=String(report.transactions.reduce((sum,t)=>sum+BigInt(t.feeLovelace),0n));
report.recipientAddressBytes=57;
report.recipientBase=recipientBase;
report.recipientOwnsAllThree=true;
report.ok=true;
writeFileSync('evidence/budget-checks.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS: bounded activation and recipient ownership with 55 synthetic ADA.');
