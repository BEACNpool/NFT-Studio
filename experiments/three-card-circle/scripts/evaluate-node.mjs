/** Read-only node evaluation. Synthetic pre-deployment UTxOs, never submit. */
import {readFileSync,writeFileSync} from 'node:fs';
import {CML,applySingleCborEncoding} from '@lucid-evolution/lucid';
const credentialPath=process.env.BLOCKFROST_PROJECT_ID_FILE;
if(!credentialPath)throw Error('An existing Blockfrost credential path is required');
const projectId=readFileSync(credentialPath,'utf8').trim();
if(!/^mainnet[A-Za-z0-9]+$/.test(projectId))throw Error('Expected a mainnet API credential');
const context=JSON.parse(readFileSync('evidence/evaluation-context-raw.json','utf8'),(_,v)=>v?.$bigint?BigInt(v.$bigint):v);
const additionalUtxoSet=context.ledger.map(u=>{
 const value={ada:{lovelace:Number(u.assets.lovelace)}};
 for(const [unit,q] of Object.entries(u.assets))if(unit!=='lovelace'){value[unit.slice(0,56)]??={};value[unit.slice(0,56)][unit.slice(56)]=Number(q);}
 return [{txId:u.txHash,index:u.outputIndex},{address:u.address,value,datumHash:u.datumHash,datum:u.datum,script:u.scriptRef?{'plutus:v3':applySingleCborEncoding(u.scriptRef.script)}:undefined}];
});
const original=CML.Transaction.from_cbor_hex(context.unsigned);
if(original.witness_set().vkeywitnesses()?.len())throw Error('Node evaluation must remain unsigned');
const endpoint='https://cardano-mainnet.blockfrost.io/api/v0/utils/txs/evaluate/utxos?version=6';
const results=[];
for(const test of [{name:'existing-holder-transfer',expect:'accept',cbor:context.unsigned},{name:'new-owner-with-only-one-card',expect:'reject',cbor:context.forbidden}]){
 const response=await fetch(endpoint,{method:'POST',headers:{project_id:projectId,'Content-Type':'application/json'},body:JSON.stringify({cbor:test.cbor,additionalUtxoSet}),redirect:'error',signal:AbortSignal.timeout(30000)});
 const raw=(await response.text()).replaceAll(projectId,'[redacted]');let result;try{result=JSON.parse(raw);}catch{result={text:raw.slice(0,2000)};}
 results.push({name:test.name,expect:test.expect,httpStatus:response.status,response:result});
 console.log(test.name,'HTTP',response.status,JSON.stringify(result).slice(0,2600));
 if(!response.ok)break;
}
writeFileSync('evidence/node-evaluation.json',JSON.stringify({observedAt:new Date().toISOString(),endpoint,mode:'unsigned transactions with synthetic additional UTxOs; no submission',results},null,2)+'\n');
