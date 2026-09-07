import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.CIP26_PUPPETEER_PATH || 'puppeteer-core');
const bytes=readFileSync(new URL('../dist/cip26-inspector.mjs',import.meta.url));
const vectors=JSON.parse(readFileSync(new URL('./browser-vectors.json',import.meta.url)));
const server=createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>CIP26 local module checks</title><body>Local module verification</body>');}
 else if(req.url==='/module.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bytes);}
 else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await puppeteer.launch({executablePath:process.env.CIP26_CHROMIUM || '/snap/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-sync','--no-first-run']});
 const page=await browser.newPage();const requests=[],blocked=[];
 await page.setRequestInterception(true);
 page.on('request',r=>{requests.push(r.url());if(r.url().startsWith(origin+'/'))r.continue();else{blocked.push(r.url());r.abort();}});
 await page.goto(origin,{waitUntil:'networkidle0'});
 const result=await page.evaluate(async vectors=>{
  let apiCalls=0;
  const forbidden=()=>{apiCalls++;throw Error('External capability disabled');};
  window.fetch=forbidden;window.XMLHttpRequest=forbidden;window.WebSocket=forbidden;window.EventSource=forbidden;
  Object.defineProperty(window,'cardano',{get:forbidden});
  const {createCip26Inspector,PROFILE}=await import('/module.mjs');
  const plain=createCip26Inspector();let checks=0;
  const need=(v)=>{if(!v)throw Error('Browser assertion failed: '+checks);checks++;};
  const trust=(subject,key,observations=[])=>createCip26Inspector(JSON.stringify({schema:'beacn.cip26.trust.v1',bindings:[{subject,publicKeys:[key]}],observations}));
  need(typeof Buffer==='undefined'&&typeof process==='undefined'&&typeof require==='undefined');
  const start=performance.now();
  for(const o of vectors.oracles){
   const r=plain.inspect(JSON.stringify({subject:o.subject,[o.property]:{value:o.value,sequenceNumber:o.sequenceNumber}})).entries[0];
   need(r.attestationDigestHex===o.digest);need(JSON.stringify(Object.values(r.components).map(v=>v.cborHex))===JSON.stringify(o.cborHex));
  }
  for(const v of vectors.published){
   const json=JSON.stringify(v.record);const property=Object.keys(v.record).find(k=>k!=='subject');
   const key=v.record[property].signatures[0].publicKey;
   need(plain.inspect(json).entries[0].signatureTrust==='untrusted');
   need(trust(v.record.subject,key).inspect(json).entries[0].signatureTrust==='trusted');
  }
  const record=vectors.synthetic.record,key=vectors.synthetic.publicKey,prop=Object.keys(record).find(k=>k!=='subject');
  const first=trust(record.subject,key).inspect(JSON.stringify(record));
  const conflict=trust(record.subject,key,[{subject:record.subject,property:prop,sequenceNumber:0,attestationDigestHex:'00'.repeat(32)}]).inspect(JSON.stringify(record));
  need(conflict.entries[0].sequenceStatus==='conflict'&&!conflict.entries[0].eligibleForTrustedDisplay);
  const identity='01'+'00'.repeat(31);const weak={subject:record.subject,[prop]:{...record[prop],signatures:[{publicKey:identity,signature:identity+'00'.repeat(32)}]}};
  need(plain.inspect(JSON.stringify(weak)).entries[0].signatureTrust==='invalid');
  for(const bad of ['{"subject":"x","subject":"y"}','{"subject":"x","\\u0073ubject":"y"}','['.repeat(12)+'0'+']'.repeat(12)]){let rejected=false;try{plain.inspect(bad);}catch{rejected=true;}need(rejected);}
  let getters=0;const obj={get subject(){getters++;return'x';}};let rejected=false;try{plain.inspect(obj);}catch{rejected=true;}need(rejected&&getters===0);
  need(apiCalls===0);need(Object.isFrozen(first.entries[0]));need(PROFILE.policyAuthentication===false);
  for(const value of ['https://example.com/a[b]','https://example.com/?x=[v]','https://example.com/#a#b','https://@example.com/','https://user@example.com/','https:///example.com/a','https:////example.com/x','https://example.com/#[]']) need(plain.inspect(JSON.stringify({subject:'s',url:{value,sequenceNumber:0}})).entries[0].status==='unsupported');
  for(const value of ['https://[2001:db8::1]:443/a%5Bb%5D?x=%23#frag%23one','https://example.com/?next=/a?b=c#f?/a','HTTPS://EXAMPLE.COM:443/%2f','https://example.com/#','https://example.com/a;b:c@d!$&()*+,=._~-']) {const e=plain.inspect(JSON.stringify({subject:'s',url:{value,sequenceNumber:0}})).entries[0];need(e.status==='inspected'&&e.value===value&&e.signatureTrust==='unsigned');}
  return {checks,oracleCases:vectors.oracles.length,publishedAttestations:vectors.published.length,elapsedMs:Math.round(performance.now()-start),externalApiCalls:apiCalls,nodeGlobalsPresent:false};
 },vectors);
 if(blocked.length)throw Error('Unexpected network requests');
 const receipt={checkedAt:new Date().toISOString(),browserVersion:await browser.version(),...result,moduleBytes:bytes.length,moduleSha256:createHash('sha256').update(bytes).digest('hex'),sameOriginRequests:requests.length,externalRequests:blocked.length,realWalletAccess:false,signingPerformed:false,chainQueries:false};
 writeFileSync(new URL('../evidence/browser-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
