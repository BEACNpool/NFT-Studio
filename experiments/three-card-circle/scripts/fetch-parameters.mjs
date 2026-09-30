import {Koios} from '@lucid-evolution/lucid';import {writeFileSync} from 'node:fs';
const url='https://koios.beacn.workers.dev/api/v1',provider=new Koios(url);const parameters=await provider.getProtocolParameters();
writeFileSync('evidence/mainnet-parameters.json',JSON.stringify({source:url,observedAt:new Date().toISOString(),parameters},(_,v)=>typeof v==='bigint'?{$bigint:String(v)}:v,2)+'\n');console.log('Current mainnet parameters saved; read-only request.');
