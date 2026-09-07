/** Real Chromium proof of the self-contained browser ESM; local fixture delivery only. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {homedir} from 'node:os';
import {join} from 'node:path';
import puppeteer from 'puppeteer-core';
const bytes=await readFile(new URL('../dist/capsule-parameterizer.mjs',import.meta.url));
const oracle=JSON.parse(await readFile(new URL('../fixtures/aiken-oracle.json',import.meta.url),'utf8'));
const routes=[];let browser;
const server=createServer((request,response)=>{
  routes.push(request.url);
  if(request.url==='/capsule-parameterizer.mjs'){response.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});response.end(bytes);}
  else if(request.url==='/'){response.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'none'; base-uri 'none'"});response.end('<!doctype html><title>State Capsule parameterizer local verification</title>');}
  else{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
try{
  browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_BIN||'/snap/bin/chromium',headless:true,userDataDir:await mkdtemp(join(homedir(),'tmp/capsule-parameter-browser-')),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking']});
  const page=await browser.newPage();const external=[];await page.setRequestInterception(true);page.on('request',request=>{if(new URL(request.url()).origin!==origin){external.push(request.url());request.abort();}else request.continue();});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin,{waitUntil:'load'});
  const result=await page.evaluate(async fixture=>{
    const api=await import('/capsule-parameterizer.mjs');
    const fail=()=>{throw new Error('Forbidden runtime network or wallet access');};
    window.fetch=fail;window.XMLHttpRequest=fail;window.WebSocket=fail;window.EventSource=fail;navigator.sendBeacon=fail;Object.defineProperty(window,'cardano',{get:fail});
    const assert=(ok,message)=>{if(!ok)throw new Error(message);};
    assert(typeof process==='undefined'&&typeof Buffer==='undefined'&&typeof require==='undefined','Unexpected Node globals in browser');
    const frozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(frozen));
    const start=performance.now();let matched=0;
    for(const item of fixture.cases){
      const actual=api.applyCapsuleParameters(item.input);
      assert(actual.compiledCode===item.compiledCode&&actual.policyId===item.policyId,'Browser applied bytes or policy differ');
      assert(actual.appliedBlueprint.validators.every(v=>v.compiledCode===item.compiledCode&&v.hash===item.policyId&&!v.parameters?.length),'Browser handler mismatch');
      assert(frozen(actual),'Mutable browser result');matched++;
    }
    const good=fixture.cases[0].input;
    for(const input of [{...good,script:'00'},{...good,baseName:'🦑'.repeat(8)},{...good,baseName:'\ud800'},{...good,seed:{...good.seed,outputIndex:65536}}]){let rejected=false;try{api.applyCapsuleParameters(input);}catch{rejected=true;}assert(rejected,'Browser accepted malformed parameters');}
    return {matched,elapsedMs:Math.round(performance.now()-start),nodeGlobalsAbsent:true,networkAndWalletApisDisabled:true,deeplyFrozenResults:true,negativeCases:4};
  },oracle);
  assert.equal(result.matched,256);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  const receipt={schema:'beacn.capsule-parameter-browser.v1',status:'pass',checkedAt:new Date().toISOString(),browser:await browser.version(),...result,handlerByteComparisons:768,oracle:'Pinned Aiken v1.1.23+8949565 CLI and independent CSL17',localOnlyRoutes:[...new Set(routes)],externalPageRequests:0,source:oracle.source,liveMintFlow:false};
  await writeFile(new URL('../evidence/browser-runtime.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
