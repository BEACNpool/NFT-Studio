import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const evidence=JSON.parse(readFileSync(new URL('./evidence/sources.json',import.meta.url)));
const online=process.argv.includes('--online');
for(const source of evidence.sources){
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 if(hash(readFileSync(new URL(source.path,import.meta.url)))!==source.sha256)throw Error('Archived source mismatch: '+source.id);
 if(online){const response=await fetch(source.rawUrl,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Source HTTP '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(hash(bytes)!==source.sha256)throw Error('Online source mismatch: '+source.id);}
}
console.log(JSON.stringify({sources:evidence.sources.length,archivedHashesMatch:true,immutableOnlineHashesMatch:online ? true : null}));
