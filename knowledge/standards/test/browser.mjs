// Browser verification only. Runtime library itself has no Node dependency.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const puppeteer = (await import(process.env.PUPPETEER_MODULE || 'puppeteer-core')).default;
const root = new URL('../', import.meta.url);
const indexJson = await readFile(new URL('index.json', root), 'utf8');
const index=JSON.parse(indexJson);
const documents=Object.fromEntries(await Promise.all(index.entries.map(async e=>[e.id,await readFile(new URL(e.localPath,root),'utf8')])));
const files=new Map(await Promise.all(['lib.mjs','pin.mjs'].map(async f=>['/'+f,await readFile(new URL(f,root))])));
const server=createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>CIP corpus test</title>');return;}
  if(files.has(req.url)){res.setHeader('content-type','text/javascript');res.end(files.get(req.url));return;}
  res.statusCode=404;res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;const external=[],errors=[];
try{
  browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request',r=>{if(!r.url().startsWith(origin+'/')&&!r.url().startsWith('data:')){external.push(r.url());void r.abort();}else void r.continue();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'networkidle0'});
  const result=await page.evaluate(async({indexJson,documents})=>{
    const {createStandardsCorpus}=await import('/lib.mjs');
    const calls=[];for(const key of ['fetch','XMLHttpRequest','WebSocket','EventSource'])globalThis[key]=function(){calls.push(key);throw Error('Forbidden runtime network')};
    Object.defineProperty(globalThis,'cardano',{get(){calls.push('cardano');throw Error('Forbidden wallet')}});
    let checks=0;const ok=(condition,label)=>{if(!condition)throw Error(label);checks++;};
    const reject=async(fn,label)=>{let threw=false;try{await fn()}catch{threw=true}ok(threw,label)};
    const corpus=await createStandardsCorpus({indexJson,documents});
    ok(corpus.index.entries.length===148,'count');ok(corpus.search({query:'CIP26'}).results[0].id==='CIP-0026','id lookup');
    ok(corpus.search({query:'music'}).results[0].id==='CIP-0060','title search');
    ok(corpus.search({status:'Active'}).totalMatches===62,'status search');
    const digests=[];
    for(const entry of corpus.index.entries){
      let offset=0;const parts=[];
      do{const chunk=corpus.getChunk({id:entry.id,offsetBytes:offset,limitBytes:2049});ok(new TextEncoder().encode(chunk.text).length<=2049,'chunk bound');parts.push(chunk.text);offset=chunk.nextOffsetBytes;}while(offset!==null);
      ok(parts.join('')===documents[entry.id],'all chunk exact text');
      const whole=corpus.getDocument({id:entry.id});ok(whole.text===documents[entry.id],'whole exact text');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(parts.join('')))),b=>b.toString(16).padStart(2,'0')).join('');
      ok(hash===entry.sha256,'browser digest');digests.push([entry.id,hash]);
    }
    await reject(()=>corpus.getChunk({id:'CIP-0026',limitBytes:16385}),'large bound');
    await reject(()=>corpus.getChunk({id:'../README.md'}),'path input');
    await reject(()=>corpus.getChunk({id:'CIP-0026',url:'https://example.com'}),'URL input');
    await reject(()=>corpus.search({query:'\ud800'}),'unpaired surrogate');
    await reject(()=>createStandardsCorpus({indexJson:indexJson.replace('Active','active'),documents}),'index corruption');
    await reject(()=>createStandardsCorpus({indexJson,documents:{...documents,'CIP-0026':documents['CIP-0026'].replace('Cardano','cardano')}}),'source corruption');
    let invoked=false;await reject(()=>corpus.search(Object.defineProperty({},'query',{enumerable:true,get(){invoked=true;return ''}})),'getter');ok(!invoked,'getter not invoked');
    const unicodeEntry=corpus.index.entries.find(e=>new TextEncoder().encode(documents[e.id]).some(b=>(b&0xc0)===0x80));
    const ubytes=new TextEncoder().encode(documents[unicodeEntry.id]);const continuation=ubytes.findIndex(b=>(b&0xc0)===0x80);
    await reject(()=>corpus.getChunk({id:unicodeEntry.id,offsetBytes:continuation}),'unicode boundary');
    ok(calls.length===0,'zero runtime network/wallet calls');
    return{checks,digests,runtimeCalls:calls};
  },{indexJson,documents});
  for(const [id,digest]of result.digests)assert.equal(digest,createHash('sha256').update(documents[id]).digest('hex'));
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),browser:await browser.version(),checks:result.checks,documents:result.digests.length,independentNodeDigestComparisons:148,externalRequests:external,runtimeCalls:result.runtimeCalls,applicationErrors:errors,build:'Native browser ES modules; no bundler or Node shims',scope:'Fixed local corpus with preloaded data; no user URL, wallet or provider'},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
