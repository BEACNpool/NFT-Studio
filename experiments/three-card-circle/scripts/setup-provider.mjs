/** Mainnet-only read/evaluate transport. Submission must be explicitly enabled. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Blockfrost,CML,applySingleCborEncoding} from '@lucid-evolution/lucid';
export const endpoint='https://cardano-mainnet.blockfrost.io/api/v0';
export function makeProvider(credentialPath,{canSubmit=false}={}){
 const credential=readFileSync(credentialPath,'utf8').trim();assert.match(credential,/^mainnet[A-Za-z0-9]+$/,'A mainnet provider credential is required');
 const provider=new Blockfrost(endpoint,credential);
 provider.fetch=async(input,init={})=>{
  const url=new URL(input);assert.equal(url.origin,new URL(endpoint).origin);assert.ok(url.pathname.startsWith('/api/v0/'));
  if(url.pathname==='/api/v0/tx/submit')assert.equal(canSubmit,true,'Submission disabled for preparation and inspection');
  try{return await fetch(url,{...init,redirect:'error',signal:init.signal??AbortSignal.timeout(30000)});}
  catch{throw Error('Mainnet provider request failed; no automatic retry');}
 };
 const json=async(path,init={})=>{
  const response=await provider.fetch(endpoint+path,{...init,headers:{project_id:credential,...init.headers}});
  if(!response.ok)throw Error(`Mainnet provider HTTP ${response.status} at ${path.split('?')[0]}`);
  return response.json();
 };
 const freshness=async()=>{
  const tip=await json('/blocks/latest');assert.ok(Number.isSafeInteger(tip.height)&&Number.isSafeInteger(tip.slot));
  assert.ok(Date.now()/1000-tip.time<600&&Date.now()/1000-tip.time>-60,'Mainnet tip is stale');return tip;
 };
 const verifyNetwork=async()=>{assert.equal((await json('/genesis')).network_magic,764824073,'Provider is not Cardano mainnet');return freshness();};
 const status=async hash=>{
  const tx=await provider.getTransactionStatus(hash);if(tx.status!=='confirmed')return {status:'not_found',hash};
  const tip=await freshness(),confirmations=tip.height-tx.confirmation.blockHeight+1;
  return {status:confirmations>=3?'confirmed':'pending',hash,confirmations,blockHeight:tx.confirmation.blockHeight,blockHash:tx.confirmation.blockHash};
 };
 const evaluate=async(unsigned,additional=[])=>{
  const parsed=CML.Transaction.from_cbor_hex(unsigned);assert.equal(parsed.witness_set().vkeywitnesses()?.len()??0,0,'Evaluation requires an unsigned transaction');
  const raw=parsed.witness_set().redeemers();if(!raw)return {nativeOnly:true};
  const declared=JSON.parse(raw.to_json()).ArrLegacyRedeemer?.arr_legacy_redeemer;
  assert.ok(Array.isArray(declared),'Unsupported redeemer representation');
  const additionalUtxoSet=additional.map(u=>{
   const value={ada:{lovelace:Number(u.assets.lovelace)}};
   for(const [unit,q] of Object.entries(u.assets))if(unit!=='lovelace'){value[unit.slice(0,56)]??={};value[unit.slice(0,56)][unit.slice(56)]=Number(q);}
   return [{txId:u.txHash,index:u.outputIndex},{address:u.address,value,datumHash:u.datumHash,datum:u.datum,script:u.scriptRef?{'plutus:v3':applySingleCborEncoding(u.scriptRef.script)}:undefined}];
  });
  const result=await json('/utils/txs/evaluate/utxos?version=6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cbor:unsigned,additionalUtxoSet})});
  const evaluations=result.result?.EvaluationResult;
  assert.ok(evaluations&&typeof evaluations==='object'&&!Array.isArray(evaluations),'Mainnet node rejected or could not evaluate the transaction');
  const tag={Spend:'spend',Mint:'mint',Cert:'certificate',Reward:'withdrawal',Voting:'vote',Proposing:'propose'};
  assert.equal(Object.keys(evaluations).length,declared.length,'Node did not evaluate every redeemer');
  for(const d of declared){const measured=evaluations[tag[d.tag]+':'+d.index];assert.ok(measured&&Number.isSafeInteger(measured.memory)&&Number.isSafeInteger(measured.steps));assert.ok(measured.memory<=d.ex_units.mem&&measured.steps<=d.ex_units.steps,'Node execution exceeds the signed budget');}
  return {evaluations};
 };
 return {provider,freshness,verifyNetwork,status,evaluate};
}
