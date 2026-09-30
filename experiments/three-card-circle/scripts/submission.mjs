/** Exact-body signing checks and durable at-most-once submission. No key loading. */
import {CML,fromHex,getAddressDetails} from '@lucid-evolution/lucid';
const requireThat=(condition,message)=>{if(!condition)throw Error(message);};
const stringify=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v);
function scriptWitnesses(witnesses){const value=JSON.parse(witnesses.to_json());delete value.vkeywitnesses;delete value.bootstrap_witnesses;return stringify(value);}
export function verifySigned({unsigned,signed,parameters,feeCapLovelace,requiredKeys=[],minimumFee}){
 const before=CML.Transaction.from_cbor_hex(unsigned),after=CML.Transaction.from_cbor_hex(signed);
 requireThat(before.body().to_cbor_hex()===after.body().to_cbor_hex(),'Signed transaction body changed');
 requireThat(before.is_valid()&&after.is_valid(),'Invalid-script flag is not permitted');
 requireThat(before.auxiliary_data()?.to_cbor_hex()===after.auxiliary_data()?.to_cbor_hex(),'Signed metadata changed');
 requireThat(scriptWitnesses(before.witness_set())===scriptWitnesses(after.witness_set()),'Scripts, datums or redeemers changed');
 if(after.auxiliary_data())requireThat(CML.hash_auxiliary_data(after.auxiliary_data()).to_hex()===after.body().auxiliary_data_hash()?.to_hex(),'Metadata commitment mismatch');
 requireThat(signed.length/2<=parameters.maxTxSize,'Signed transaction exceeds live size limit');
 requireThat(after.body().fee()<=BigInt(feeCapLovelace),'Fee exceeds reviewed allowance');
 requireThat(typeof minimumFee==='function','A live complete fee calculation is required');
 requireThat(after.body().fee()>=minimumFee(after),'Signed transaction fee is insufficient');
 const id=CML.hash_transaction(after.body()).to_hex(),required=new Set(requiredKeys);
 const signers=after.body().required_signers();for(let i=0;i<(signers?.len()??0);i++)required.add(signers.get(i).to_hex());
 const witnesses=after.witness_set().vkeywitnesses();
 for(let i=0;i<(witnesses?.len()??0);i++){
  const witness=witnesses.get(i);requireThat(witness.vkey().verify(fromHex(id),witness.ed25519_signature()),'Invalid wallet signature');
  required.delete(witness.vkey().hash().to_hex());
 }
 requireThat(required.size===0,'Required payment, collateral or owner signature is missing');
 return {id,signedBytes:signed.length/2,feeLovelace:String(after.body().fee())};
}
export function inputKeys(inputs){return [...new Set(inputs.map(u=>getAddressDetails(u.address).paymentCredential).filter(c=>c?.type==='Key').map(c=>c.hash))];}
export function feeCalculator(parameters,referenceScriptBytes=0){
 const price=n=>{const scale=1_000_000_000n;return CML.SubCoin.new(BigInt(Math.round(n*Number(scale))),scale);};
 const linear=CML.LinearFee.new(BigInt(parameters.minFeeA),BigInt(parameters.minFeeB),BigInt(parameters.minFeeRefScriptCostPerByte));
 const execution=CML.ExUnitPrices.new(price(parameters.priceMem),price(parameters.priceStep));
 return tx=>CML.min_fee(tx,linear,execution,BigInt(referenceScriptBytes));
}
export async function submitOnce({scope,packet,storage,locks,preflight,sign,inspect,submit}){
 requireThat(locks?.request,'Web Locks are required for this wallet flow');
 return locks.request('nft-studio-circle:'+scope,async()=>{
  const key='nft-studio-circle-attempt:'+scope;
  const previous=await storage.getItem(key);
  requireThat(!previous,'A previous attempt must be reconciled on chain before preparing another');
  // Both calls must check network, wallet identity, parameters, expiry, current
  // inputs and the exact ownership-state outref. A stale packet is never rebuilt.
  await preflight(packet);
  const signed=await sign(packet.unsigned);
  await preflight(packet);
  const verified=await inspect(packet,signed);
  const record={...verified,status:'attempted',attemptedAt:new Date().toISOString(),stateOutref:packet.stateOutref};
  const encoded=stringify(record);await storage.setItem(key,encoded);
  requireThat(await storage.getItem(key)===encoded,'Attempt marker could not be durably read back');
  try {
   const returned=await submit(signed);
   requireThat(returned===verified.id,'Submission returned a different transaction ID');
   record.status='submitted';await storage.setItem(key,stringify(record));return record;
  }catch(error){
   // Preserve the pre-submit marker even if this follow-up write fails. Never
   // retry automatically, even for a wallet/provider timeout or storage failure.
   try{await storage.setItem(key,stringify({...record,status:'unknown'}));}catch{}
   throw Object.assign(Error('Submission outcome unclear. Check the saved transaction ID; do not retry.'),{transactionId:verified.id,cause:error});
  }
 });
}
