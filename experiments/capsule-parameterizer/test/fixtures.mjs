import {sha256} from '@noble/hashes/sha2.js';
const utf8 = new TextEncoder();
const hash = text => Array.from(sha256(utf8.encode(text)),b=>b.toString(16).padStart(2,'0')).join('');
export function parameterFixtures(){
  const indices=[0,1,23,24,255,256,32767,65535];
  const names=['CAPSULE','A','A'.repeat(23),'A'.repeat(24),'A'.repeat(28),'é','e\u0301','🦑','🦑'.repeat(7),'界'.repeat(9)+'!','\u0000','a\nb','/','\\','\ufeffBEACN','\u202eNFT'];
  const values=[{seed:{transactionId:'11'.repeat(32),outputIndex:0},baseName:'CAPSULE'}];
  for(const [ni,baseName]of names.entries())for(const outputIndex of indices)values.push({seed:{transactionId:hash('capsule-public-fixture/name/'+ni+'/'+outputIndex),outputIndex},baseName});
  for(let i=0;values.length<256;i++)values.push({seed:{transactionId:hash('capsule-public-fixture/generated/'+i),outputIndex:(i*997)%65536},baseName:('BEACN-'+hash(String(i))).slice(0,1+(i%28))});
  return values;
}
export const valid={seed:{transactionId:'11'.repeat(32),outputIndex:0},baseName:'CAPSULE'};
