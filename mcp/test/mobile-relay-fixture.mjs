/** In-memory fixed-origin relay for tests; never contacts the public service. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
export function mobileRelayFixture(){
 const records=new Map(),calls=[];let scenario='normal';
 const fetch=async(input,init)=>{
  const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);
  assert.equal(url.origin,'https://handoff.beacnpool.org');assert(!url.hash);assert(!url.search);
  const body=await request.text();calls.push({url:request.url,method:request.method,body});
  if(request.method==='POST'){
   assert.equal(url.pathname,'/api/handoffs');const sealed=JSON.parse(body);
   assert.deepEqual(Object.keys(sealed).sort(),['ciphertext','iv','v']);
   if(scenario==='unavailable')return new Response('Unavailable',{status:503});
   if(scenario==='redirect')return new Response(null,{status:302,headers:{location:'https://attacker.invalid/'}});
   const id=randomBytes(16).toString('base64url'),revokeToken=randomBytes(32).toString('base64url'),expiresAt=Date.now()+900000;
   records.set(id,{sealed,revokeToken,expiresAt});return Response.json({id,revokeToken,expiresAt});
  }
  const id=url.pathname.split('/').at(-1),row=records.get(id);if(!row)return new Response('Missing',{status:404});
  if(request.method==='DELETE'){assert.equal(request.headers.get('authorization'),'Bearer '+row.revokeToken);records.delete(id);return new Response(null,{status:204});}
  assert.equal(request.method,'GET');
  if(scenario==='expired')return new Response('Expired',{status:410});
  if(scenario==='oversized')return new Response(' '.repeat(108001));
  const data=structuredClone({sealed:row.sealed,expiresAt:row.expiresAt});
  if(scenario==='tampered')data.sealed.ciphertext=(data.sealed.ciphertext[0]==='A'?'B':'A')+data.sealed.ciphertext.slice(1);
  if(scenario==='expiry-mismatch')data.expiresAt--;
  return Response.json(data);
 };
 return {fetch,records,calls,setScenario:value=>{scenario=value;}};
}
