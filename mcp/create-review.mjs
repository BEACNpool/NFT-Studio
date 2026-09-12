#!/usr/bin/env node
/** Explicit local files -> local MCP -> exact saved review. Never connects a wallet. */
import {open,lstat,mkdir,writeFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {renderTerminalQr,mobileTerminalMessage} from './terminal-qr.mjs';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
export const LIMITS=Object.freeze({requestBytes:16384,files:8,rawBytes:12000,responseBytes:524288,intentBytes:80000,timeoutMs:30000});
const STUDIO='https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents';
const sha=value=>createHash('sha256').update(value).digest('hex');
const textDecoder=new TextDecoder('utf-8',{fatal:true});
function fields(v,required,optional=[]){if(!v||typeof v!=='object'||Array.isArray(v)||required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>!required.includes(k)&&!optional.includes(k)))throw Error('Unexpected or missing request fields.');}
function boundedText(v,max,empty=false){if(typeof v!=='string'||!v.isWellFormed()||Buffer.byteLength(v)>max||(!empty&&!v.trim())||Array.from(v).some(c=>{const n=c.codePointAt(0);return n===127||(n<32&&![9,10,13].includes(n));}))throw Error('Invalid or oversized request text.');}
async function boundedFile(path,limit){
 const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||before.size>limit)throw Error('Input must be a bounded regular local file, not a symlink or directory.');
 const handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0)|(constants.O_NONBLOCK||0));
 try{const stat=await handle.stat();if(!stat.isFile()||stat.size>limit)throw Error('Input changed or exceeds its byte bound.');const buffer=Buffer.alloc(limit+1);let n=0;while(n<buffer.length){const read=await handle.read(buffer,n,buffer.length-n,null);if(!read.bytesRead)break;n+=read.bytesRead;}if(n>limit)throw Error('Input exceeds its byte bound.');return buffer.subarray(0,n);}finally{await handle.close();}
}
export async function readRequest(requestPath){
 const path=resolve(requestPath);let value;try{value=JSON.parse(textDecoder.decode(await boundedFile(path,LIMITS.requestBytes)));}catch(error){if(error instanceof SyntaxError)throw Error('Request must be valid UTF-8 JSON.');throw error;}
 fields(value,['mode','name','files'],['description','coverIndex','mintOptions']);if(!['nft','data'].includes(value.mode))throw Error('Mode must be nft or data.');boundedText(value.name,64);if(value.description!==undefined)boundedText(value.description,1024,true);
 if(!Array.isArray(value.files)||value.files.length<1||value.files.length>LIMITS.files)throw Error('Use one to eight explicit files.');
 if(value.coverIndex!==undefined&&(!Number.isSafeInteger(value.coverIndex)||value.coverIndex<0||value.coverIndex>=value.files.length))throw Error('Invalid coverIndex.');
 const files=[];let total=0;
 for(const file of value.files){fields(file,['path','name','mediaType']);boundedText(file.path,4096);boundedText(file.name,64);boundedText(file.mediaType,64);if(/^[a-z][a-z0-9+.-]*:\/\//i.test(file.path)||file.path.startsWith('//')||file.path.startsWith('data:')||file.path.startsWith('file:')||file.path.startsWith('\\\\'))throw Error('Use a local filesystem path, not a URL or network share.');const bytes=await boundedFile(resolve(dirname(path),file.path),LIMITS.rawBytes);total+=bytes.length;if(!bytes.length||total>LIMITS.rawBytes)throw Error('Use 1–12000 total raw file bytes.');files.push({name:file.name,mediaType:file.mediaType,base64:bytes.toString('base64')});}
 return {mode:value.mode,name:value.name,...(value.mintOptions===undefined?{}:{mintOptions:value.mintOptions}),...(value.description===undefined?{}:{description:value.description}),...(value.coverIndex===undefined?{}:{coverIndex:value.coverIndex}),files};
}
export function unpackResponse(result){
 if(Buffer.byteLength(JSON.stringify(result))>LIMITS.responseBytes)throw Error('MCP response exceeds the 512 KiB limit.');
 if(result.isError)throw Error('Local MCP rejected the request; check file types, names and payload limits.');
 const texts=result.content?.filter(c=>c.type==='text')||[];
 if(texts.length<1||texts.length>2)throw Error('Unexpected MCP response content.');
 const parsed=JSON.parse(texts[0].text);
 if(result.structuredContent!==undefined)assert.deepEqual(parsed,result.structuredContent,'MCP text and structured results differ.');
 if(texts.length===2){
  assert.equal(parsed.schema,'nft-studio.mobile-handoff.v1');
  const terminal=renderTerminalQr(parsed.url);
  assert.deepEqual(Object.fromEntries(Object.keys(terminal).map(k=>[k,parsed.qr?.[k]])),terminal,'Terminal QR differs from the phone link.');
  assert.equal(texts[1].text,mobileTerminalMessage(parsed),'MCP display and structured results differ.');
 }
 return result.structuredContent??parsed;
}
function decodeFile(file){const prefix=`data:${file.mediaType}`;if(file.uri.startsWith(prefix+';base64,')){const raw=file.uri.slice(prefix.length+8),bytes=Buffer.from(raw,'base64');assert.equal(bytes.toString('base64'),raw);return bytes;}assert(file.uri.startsWith(prefix+','));return Buffer.from(decodeURIComponent(file.uri.slice(prefix.length+1)),'utf8');}
export function verifyHandoff(made,verified,args){
 const intent=made.intent;assert.equal(verified.valid,true);assert.deepEqual(verified.intent,intent);assert.equal(typeof made.packetJson,'string');assert(Buffer.byteLength(made.packetJson)<=LIMITS.intentBytes);assert.deepEqual(JSON.parse(made.packetJson),intent);
 fields(intent,args.mintOptions?['schema','mode','bundle','mintOptions','intentHash']:['schema','mode','bundle','intentHash']);assert.equal(intent.schema,args.mintOptions?'nft-studio.intent.v2':'nft-studio.intent.v1');if(args.mintOptions)assert.deepEqual(intent.mintOptions,args.mintOptions);assert.equal(intent.mode,args.mode);const b=intent.bundle;fields(b,['schema','name','description','cover','bytes','files','sha256']);assert.equal(b.schema,'nft-studio.payload.v1');assert.equal(b.name,args.name);assert.equal(b.description,args.description||'');assert.equal(b.cover,args.coverIndex!==undefined);
 const expected=[...args.files];if(args.coverIndex!==undefined)expected.unshift(...expected.splice(args.coverIndex,1));assert.equal(b.files.length,expected.length);let total=0;
 for(let i=0;i<expected.length;i++){const f=b.files[i],input=expected[i],bytes=Buffer.from(input.base64,'base64');fields(f,['name','mediaType','bytes','sha256','uri']);assert.equal(f.name,input.name);assert.equal(f.mediaType,input.mediaType);assert.equal(f.bytes,bytes.length);assert.equal(f.sha256,sha(bytes));assert.deepEqual(decodeFile(f),bytes);total+=bytes.length;}
 assert.equal(b.bytes,total);assert.equal(b.sha256,sha(JSON.stringify({schema:b.schema,name:b.name,description:b.description,cover:b.cover,files:b.files.map(({name,mediaType,bytes,sha256})=>({name,mediaType,bytes,sha256}))})));
 const canonicalBundle={schema:b.schema,name:b.name,description:b.description,cover:b.cover,bytes:b.bytes,files:b.files.map(({name,mediaType,bytes,sha256,uri})=>({name,mediaType,bytes,sha256,uri})),sha256:b.sha256};const core={schema:intent.schema,mode:intent.mode,bundle:canonicalBundle,...(args.mintOptions?{mintOptions:intent.mintOptions}:{})};assert.equal(intent.intentHash,sha(JSON.stringify(core)));const canonical={...core,intentHash:intent.intentHash};assert.equal(JSON.stringify(intent),JSON.stringify(canonical));
 assert.equal(made.review?.url,STUDIO+'#mint=v1.'+Buffer.from(JSON.stringify(canonical)).toString('base64url'));return canonical;
}
const escapeHtml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function reviewHtml(title,url){return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><title>Review NFT-Studio request</title><h1>${escapeHtml(title)}</h1><p>Unminted request. Inspect the exact content in Studio before connecting your own wallet.</p><p><a href="${escapeHtml(url)}" rel="noreferrer">Review in NFT-Studio</a></p><p>Opening this link grants no wallet permission. Studio adds 0 ADA fee; Cardano network fees and minimum output ADA apply. This page contains your content in its link. Share only with intended reviewers.</p></html>\n`;}
export async function createReview(requestPath,outputPath,{entry=fileURLToPath(new URL('./dist/cli.mjs',import.meta.url)),mobile=false,payloadQr=false}={}){
 const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<13))throw Error('Use Node.js 22.13 or newer.');
 const args=await readRequest(requestPath),out=resolve(outputPath);await lstat(out).then(()=>{throw Error('Output directory already exists; choose a fresh path.');},e=>{if(e.code!=='ENOENT')throw e;});await access(entry).catch(()=>{throw Error('Build the repo MCP first: npm --prefix mcp ci && npm --prefix mcp run build');});
 const client=new Client({name:'nft-studio-local-review-export',version:'1.1.0'}),transport=new StdioClientTransport({command:process.execPath,args:[entry],stderr:'pipe',env:{PATH:process.env.PATH}});
 let transfer,complete=false;
 const call=async(name,args={},timeout=LIMITS.timeoutMs)=>unpackResponse(await client.callTool({name,arguments:args},{timeout}));
 try{
  await client.connect(transport,{timeout:LIMITS.timeoutMs});
  const caps=await call('studio_capabilities');
  if(!Number.isSafeInteger(caps.limits?.files)||caps.limits.files<1||!Number.isSafeInteger(caps.limits?.rawPayloadBytes)||caps.limits.rawPayloadBytes<1||args.files.length>Math.min(LIMITS.files,caps.limits.files)||args.files.reduce((n,f)=>n+Buffer.from(f.base64,'base64').length,0)>Math.min(LIMITS.rawBytes,caps.limits.rawPayloadBytes))throw Error('Request exceeds the local MCP advertised payload limits.');
  if(mobile&&caps.mobileHandoff?.createTool!=='create_mobile_handoff')throw Error('This MCP does not advertise native mobile handoff. Update and rebuild it, or use Continue on phone in Studio.');
  const made=await call('create_mint_intent',args),verified=await call('verify_mint_intent',{intent:made.intent}),intent=verifyHandoff(made,verified,args);
  const contents={'intent.json':made.packetJson,'review-url.txt':made.review.url+'\n','review.html':reviewHtml(intent.bundle.name,made.review.url)};
  const calls=['studio_capabilities','create_mint_intent','verify_mint_intent'];
  if(mobile){
   transfer=await call('create_mobile_handoff',{intent},70000);
   const {mobileExport}=await import('./mobile-export.mjs');
   Object.assign(contents,await mobileExport(transfer,intent));calls.push('create_mobile_handoff');
  }
  if(payloadQr){
   const result=await call('create_payload_qr',{intent});
   const {payloadExport}=await import('./payload-export.mjs');
   Object.assign(contents,await payloadExport(result,intent));calls.push('create_payload_qr');
  }
  const receipt={schema:'nft-studio.local-review.v1',status:'verified-intent-only',intentHash:intent.intentHash,bundleHash:intent.bundle.sha256,rawBytes:intent.bundle.bytes,reviewUrlCharacters:made.review.url.length,...(transfer?{mobile:{url:transfer.url,expiresAt:transfer.expiresAt,expiresAtIso:transfer.expiresAtIso,qr:'mobile-qr.png',terminalQr:'mobile-qr.txt',page:'mobile.html'}}:{}),files:Object.entries(contents).map(([name,content])=>({name,bytes:Buffer.byteLength(content),sha256:sha(content)})),mcpCalls:calls,walletConnected:false,signed:false,submitted:false};
  await mkdir(out,{mode:0o700});for(const [name,content] of Object.entries(contents))await writeFile(resolve(out,name),content,{flag:'wx',mode:0o600});await writeFile(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});complete=true;
  return {...receipt,outputDirectory:out,next:mobile?'In terminal/text clients, display mobile-qr.txt verbatim in an unwrapped fenced code block in the user-facing answer. Include the complete mobile link and expiry. PNG/SVG and mobile.html are also available. Keep mobile-transfer.private.json private; it contains the creator revocation token.':'Open review.html in your browser, or import intent.json in Studio. The full link is saved without copying it through model prose.'};
 }finally{
  if(transfer&&!complete)await call('revoke_mobile_handoff',transfer.endTransfer.arguments).catch(()=>{});
  await client.close();
 }
}
export async function main(argv=process.argv.slice(2),options={}){
 const usage='Usage: node mcp/create-review.mjs --request REQUEST.json --output NEW_DIRECTORY [--mobile | --payload-qr]';
 if(argv.length===1&&argv[0]==='--help'){console.log(usage+'\nReads explicit local files, creates and verifies an exact intent, and saves review.html, intent.json, review-url.txt and receipt.json. --mobile explicitly uploads encrypted content to the native 15-minute Studio relay, prints a scannable Unicode QR to stderr, and saves QR TXT/PNG/SVG, mobile.html, mobile-url.txt and a private revocation record. Stdout stays JSON; redirect stderr to silence the display. --payload-qr creates a public embedded payload QR with no upload or expiry and saves printable PNG/SVG and a complete link; small payloads only. No wallet, signing or submission. Existing outputs are never overwritten.');return;}
 if(![4,5].includes(argv.length)||argv[0]!=='--request'||argv[2]!=='--output'||(argv.length===5&&!['--mobile','--payload-qr'].includes(argv[4])))throw Error(usage);
 const result=await createReview(argv[1],argv[3],{...options,mobile:argv[4]==='--mobile',payloadQr:argv[4]==='--payload-qr'});
 console.log(JSON.stringify(result,null,2));
 if(result.mobile)process.stderr.write('\n'+mobileTerminalMessage({...result.mobile,qr:renderTerminalQr(result.mobile.url)},{markdown:false}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error instanceof assert.AssertionError?'MCP handoff integrity verification failed; no completed export was produced.':error.message);process.exitCode=1;});
