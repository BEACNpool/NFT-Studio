/** Bounded eleven-step setup. The caller owns approval, durable storage and transport. */
import assert from 'node:assert/strict';
import {CML,coreToTxOutput,getAddressDetails,validatorToScriptHash,applySingleCborEncoding} from '@lucid-evolution/lucid';
import * as T from './transactions.mjs';
import {verifySigned,feeCalculator,inputKeys,submitOnce} from './submission.mjs';

export const limits=Object.freeze({funding:55_000_000n,fees:5_500_000n,perFee:1_500_000n,collateral:5_000_000n,declaredCollateral:3_000_000n,minRefund:5_000_000n});
export const labels=['prepare seed outputs','register bootstrap authority','bootstrap immutable core','create ownership record','register transfer modules','register issuance modules','register collection policy','publish state reference','issue three NFTs','deliver all three to recipient','return unused ADA'];
export const ref=u=>u.txHash+'#'+u.outputIndex;
export const encode=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?{$bigint:String(v)}:v,2);
export const decode=text=>JSON.parse(text,(_,v)=>v?.$bigint?BigInt(v.$bigint):v);
const key=address=>getAddressDetails(address).paymentCredential?.hash;
const same=(a,b)=>encode(a)===encode(b);
function txRefs(list){return Array.from({length:list?.len()??0},(_,i)=>({txHash:list.get(i).transaction_id().to_hex(),outputIndex:Number(list.get(i).index())}));}
export function outputs(cbor){const tx=CML.Transaction.from_cbor_hex(cbor),body=tx.body(),id=CML.hash_transaction(body).to_hex(),list=body.outputs();return Array.from({length:list.len()},(_,i)=>({txHash:id,outputIndex:i,...coreToTxOutput(list.get(i))}));}
export function context(plan,journal){
 assert.equal(journal.steps[0]?.status,'confirmed','Seed split must be confirmed');
 const out=outputs(journal.steps[0].unsigned);
 const seeds=Object.fromEntries(['params','template','registry','state','issue'].map((name,i)=>[name,out[i]]));
 const collateral=out[5];assert.equal(collateral.assets.lovelace,limits.collateral);
 const c=T.derive({seeds,admin:key(plan.setupAddress),network:plan.network});
 const refs=journal.steps[7]?.status==='confirmed'?outputs(journal.steps[7].unsigned).filter(u=>u.scriptRef):[];
 return {c,seeds,collateral,refs};
}
export function validatePlan(plan,now=Date.now()){
 assert.equal(plan.operation,'activate-three-card-circle');assert.ok(['Mainnet','Custom'].includes(plan.network));
 assert.equal(plan.fundingLovelace,String(limits.funding));
 for(const address of [plan.setupAddress,plan.recipientAddress]){const d=getAddressDetails(address);assert.equal(d.paymentCredential?.type,'Key');assert.equal(d.networkId,plan.network==='Mainnet'?1:0);}
 assert.notEqual(key(plan.setupAddress),key(plan.recipientAddress),'Recipient must control a separate key');
 assert.ok(Date.parse(plan.expiresAt)>now,'Approval plan expired');
 assert.equal(plan.artwork.length,3);assert.ok(plan.artwork.every(x=>typeof x==='string'&&x.startsWith('<svg')));
}
function metadata(plan){return Object.fromEntries(plan.artwork.map((art,i)=>['CARD0'+(i+1),{name:`NFT-Studio Circle ${i+1}/3`,mediaType:'image/svg+xml',image:('data:image/svg+xml;base64,'+Buffer.from(art).toString('base64')).match(/.{1,64}/g),description:['Three distinct programmable NFT-Studio cards.','Hold one or two: send to an existing holder.','Hold all three before transfer: invite a new owner.'],website:['https://beacnpool.github.io/NFT-Studio/','showcase/three-card-circle/']} ]));}
export async function buildStep({lucid,provider,plan,journal,index,now=Date.now}){
 validatePlan(plan,now());assert.ok(Number.isInteger(index)&&index>=0&&index<labels.length);
 assert.equal(journal.steps.length,index,'Resume or reconcile the previous step first');
 assert.ok(journal.steps.every(s=>s.status==='confirmed'));
 const wallet=await provider.getUtxos(plan.setupAddress);
 const options={coinSelection:false,changeAddress:plan.setupAddress,setCollateral:limits.declaredCollateral};
 let tx,referenceBytes=0,collateral;
 if(index===0){
  assert.equal(wallet.length,1,'Send one exact funding output to the dedicated wallet');
  assert.equal(Object.keys(wallet[0].assets).length,1,'Funding must be ADA only');
  assert.equal(wallet[0].assets.lovelace,limits.funding,'Funding amount differs from reviewed plan');
  assert.ok(!wallet[0].datum&&!wallet[0].datumHash&&!wallet[0].scriptRef);
  tx=lucid.newTx().collectFrom(wallet);
  for(let i=0;i<5;i++)tx=tx.pay.ToAddress(plan.setupAddress,{lovelace:2_000_000n});
  tx=tx.pay.ToAddress(plan.setupAddress,{lovelace:limits.collateral});
 }else{
  const ctx=context(plan,journal),{c,seeds,refs}=ctx;collateral=ctx.collateral;
  options.presetWalletInputs=[collateral];
  const excluded=new Set([...Object.values(seeds),collateral,...refs].map(ref));
  const feeInputs=wallet.filter(u=>!excluded.has(ref(u))&&!u.scriptRef&&!u.datum&&!u.datumHash&&Object.keys(u.assets).length===1);
  assert.equal(feeInputs.length,1,'Expected one bounded fee/change output');
  const feeInput=feeInputs[0],get=unit=>provider.getUtxoByUnit(unit);
  const state=()=>get(c.ids.state+T.names.state),params=()=>get(c.ids.params+T.names.params),registry=()=>get(c.ids.registry+c.ids.nft);
  if(index===1)tx=T.registration(lucid,c,['lock']);
  if(index===2)tx=T.bootstrap(lucid,c);
  if(index===3)tx=T.createState(lucid,c);
  if(index===4)tx=T.registration(lucid,c,['dispatcher','delegate','transfer']);
  if(index===5)tx=T.registration(lucid,c,['issue','issuance']);
  if(index===6)tx=T.registerPolicy(lucid,c,{state:await state(),params:await params(),template:await get(c.ids.template+T.names.template),covering:await get(c.ids.registry)});
  if(index===7)tx=T.references(lucid,c,plan.setupAddress,['state']);
  if(index===8||index===9){
   assert.equal(refs.length,1);assert.equal(validatorToScriptHash(refs[0].scriptRef),c.ids.state);
   referenceBytes=applySingleCborEncoding(refs[0].scriptRef.script).length/2;
   const live={state:await state(),params:await params(),registry:await registry(),refs};
   if(index===8)tx=T.mintAll(lucid,c,{...live,metadata:metadata(plan)});
   else{
    assert.deepEqual(T.decodeState(live.state).owners,Array(3).fill(c.admin));
    tx=T.transfer(lucid,c,{...live,cards:await Promise.all(T.cardNames.map(n=>get(c.ids.nft+n))),moves:Object.fromEntries(T.cardNames.map(n=>[n,key(plan.recipientAddress)])),signers:[c.admin]});
   }
  }
  if(index===10){
   const s=await state();assert.deepEqual(T.decodeState(s).owners,Array(3).fill(key(plan.recipientAddress)));
   for(const n of T.cardNames){const card=await get(c.ids.nft+n);assert.equal(card.address,c.holder(key(plan.recipientAddress)));assert.equal(card.assets[c.ids.nft+n],1n);}
   tx=lucid.newTx().collectFrom([collateral]);options.changeAddress=plan.recipientAddress;
  }
  tx=tx.collectFrom([feeInput]);
 }
 // Short lived packets. This is also checked again immediately before POST.
 const expiresAt=now()+5*60_000;
 tx=tx.validTo(expiresAt);
 const built=await tx.complete(options),unsigned=built.toCBOR(),body=built.toTransaction().body();
 const inputs=txRefs(body.inputs()),refs=txRefs(body.reference_inputs()),collateralRefs=txRefs(body.collateral_inputs());
 if(![0,7,10].includes(index)){
  assert.equal(collateralRefs.length,1);assert.equal(ref(collateralRefs[0]),ref(collateral));
  assert.ok(!inputs.some(i=>ref(i)===ref(collateral)));
  assert.equal(body.total_collateral(),limits.declaredCollateral);
 }
 const inputsNow=await provider.getUtxosByOutRef(inputs);assert.equal(inputsNow.length,inputs.length);
 const previousFees=journal.steps.reduce((n,s)=>n+BigInt(s.feeLovelace),0n);
 assert.ok(previousFees+body.fee()<=limits.fees,'Total fee cap exceeded');
 if(index===10){const out=outputs(unsigned);assert.equal(out.length,1);assert.equal(out[0].address,plan.recipientAddress);assert.ok(out[0].assets.lovelace>=limits.minRefund,'Refund is below reviewed minimum');}
 return {index,label:labels[index],unsigned,hash:CML.hash_transaction(body).to_hex(),expiresAt,referenceBytes,requiredKeys:inputKeys([...inputsNow, ...(collateral?[collateral]:[])]),inputRefs:inputs,referenceRefs:refs,collateralRefs,parameters:lucid.config().protocolParameters,feeLovelace:String(body.fee()),stateOutref:index>7?ref((await provider.getUtxoByUnit(context(plan,journal).c.ids.state+T.names.state))):null};
}
export async function executePacket({packet,lucid,provider,plan,journal,storage,locks,save,freshness,confirm,evaluate,now=Date.now}){
 const preflight=async()=>{
  validatePlan(plan,now());assert.ok(now()<packet.expiresAt-30_000,'Packet expired or too close to expiry');
  assert.ok(journal.steps.slice(0,packet.index).every(s=>s.status==='confirmed'));
  await freshness();assert.ok(same(await provider.getProtocolParameters(),packet.parameters),'Protocol parameters changed; re-prepare before signing');
  const wanted=[...packet.inputRefs,...packet.referenceRefs,...packet.collateralRefs],current=await provider.getUtxosByOutRef(wanted);
  const found=new Set(current.map(ref));assert.ok(wanted.every(u=>found.has(ref(u))),'An input, reference or collateral output was spent');
  if(packet.stateOutref){const {c}=context(plan,journal);assert.equal(ref(await provider.getUtxoByUnit(c.ids.state+T.names.state)),packet.stateOutref,'Ownership record changed');}
 };
 const result=await submitOnce({scope:plan.planHash+':'+packet.index,packet,storage,locks,preflight,
  sign:async unsigned=>{
   await evaluate(unsigned,packet);
   return (await lucid.fromTx(unsigned).sign.withWallet().complete()).toCBOR();
  },
  inspect:(_,signed)=>verifySigned({unsigned:packet.unsigned,signed,parameters:packet.parameters,feeCapLovelace:limits.perFee,requiredKeys:packet.requiredKeys,minimumFee:feeCalculator(packet.parameters,packet.referenceBytes)}),
  submit:async signed=>{
   // Store the exact signed packet before a single transport call; never retry POST.
   journal.steps[packet.index]={...packet,status:'attempted',signed};await save(journal);
   return provider.submitTx(signed);
  }
 });
 journal.steps[packet.index]={...journal.steps[packet.index],...result,status:'submitted'};await save(journal);
 const confirmation=await confirm(result.id);
 journal.steps[packet.index]={...journal.steps[packet.index],status:'confirmed',confirmation};await save(journal);
 return journal.steps[packet.index];
}
