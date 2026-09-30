/** Evaluate saved unsigned synthetic packets only. No signer or submission. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {makeProvider} from './setup-provider.mjs';
import {decode} from './setup-workflow.mjs';
const transport=makeProvider(process.env.BLOCKFROST_PROJECT_ID_FILE);await transport.verifyNetwork();
const mode=process.argv[2]||'setup';assert.ok(['setup','setup-token','wallet'].includes(mode));
const contexts=decode(readFileSync(`evidence/${mode}-evaluation-raw.json`,'utf8'));
const results=[];
for(const [index,packet] of contexts.entries()){
 const result=await transport.evaluate(packet.unsigned,packet.ledger);results.push({index,label:packet.label??'browser owner transfer',...result});
 console.log('PASS unsigned node evaluation',mode,index,result.nativeOnly?'native only':Object.keys(result.evaluations).length+' redeemers');
}
writeFileSync(`evidence/${mode}-node-checks.json`,JSON.stringify({ok:true,createdAt:new Date().toISOString(),mode:'unsigned transactions with synthetic additional UTxOs; no real signature or submission',results},null,2)+'\n');
