/** Build/measure this original demo using caller-selected local Studio source.
 * No network, keys, signing, submission, dependency installation or root writes.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,symlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,relative,dirname} from 'node:path';
const home=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(process.argv[2]||'');
assert.ok(process.argv[2],'Pass the read-only Studio source checkout path.');
const req=createRequire(resolve(repo,'mcp/package.json'));
const {build}=req('esbuild'), C=req('@emurgo/cardano-serialization-lib-nodejs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const work=await mkdtemp(resolve(home,'.work-')); await symlink(resolve(repo,'mcp/node_modules'),resolve(work,'node_modules'));
const inputs=[['createMusicPackage','mcp/src/music-tools.mjs'],['createUnsignedPreparers','mcp/src/public-unsigned.mjs'],['recoverMusicRelease','lib/music-release.ts'],['buildMusicReleaseTransaction','lib/studio-transaction.ts']];
const built=await build({absWorkingDir:repo,stdin:{contents:inputs.map(([x,p])=>`export {${x}} from ${JSON.stringify(resolve(repo,p))};`).join('\n'),resolveDir:repo},outfile:resolve(work,'shared.mjs'),bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',metafile:true,logLevel:'warning',plugins:[{name:'studio',setup(b){b.onResolve({filter:/^@studio\//},a=>({path:resolve(repo,'lib',a.path.slice(8))}));b.onResolve({filter:/^@\/lib\//},a=>({path:resolve(repo,'lib',a.path.slice(6)+'.ts')}));}}]});
const shared=await import(pathToFileURL(resolve(work,'shared.mjs')));
const {syntheticNativeFixture}=await import(pathToFileURL(resolve(repo,'mcp/integration/verify-synthetic-native.mjs')));
const {assertSyntheticMusicUnsigned}=await import(pathToFileURL(resolve(repo,'mcp/integration/verify-music-unsigned.mjs')));
const files=await Promise.all([['cover.svg','image/svg+xml'],['midnight-beacon.ogg','audio/ogg']].map(async([name,mediaType])=>({name,mediaType,base64:(await readFile(resolve(home,'assets',name))).toString('base64')})));
const args={name:'Midnight Beacon',description:'Eight-second original AI-assisted BEACN Labs chiptune demo. Exact audio and SVG cover bytes; no mint or rights verification.',coverIndex:0,files,release:{release_type:'Single',release_title:'Midnight Beacon',visual_artist:'Codex-assisted SVG design',catalog_number:'BEACN-DEMO-001'},tracks:[{fileName:'midnight-beacon.ogg',song:{song_title:'Midnight Beacon',song_duration:'PT8S',track_number:1,artists:[{name:'BEACN Labs (AI-assisted demo)'}],copyright:{master:'Original AI-assisted demo; declaration only',composition:'Original AI-assisted demo; declaration only'},genres:['Chiptune','Electronic'],bpm:'120',bitrate:'7.2 kbit/s',producer:'Codex-assisted local synthesis',mood:'Nocturnal, hopeful, electric'}}]};
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw new Error('Network disabled in this synthetic demonstration verifier.');};
const packageResult=await shared.createMusicPackage(args);
const wallet=syntheticNativeFixture('nft').wallet;
const clock=Date.now; const fixedClockMs=Date.parse('2026-09-07T12:00:00Z'); Date.now=()=>fixedClockMs;
const quote={tip:{epoch_no:654,abs_slot:197151000,block_time:fixedClockMs/1000},parameters:{epoch_no:654,max_tx_size:16384,max_val_size:5000,min_fee_a:44,min_fee_b:155381,coins_per_utxo_size:4310,key_deposit:2000000,pool_deposit:500000000}};
let result,verified,recovered,direct;
try{
 const prepare=shared.createUnsignedPreparers(C,{protocolProvider:async()=>structuredClone(quote)});
 result=await prepare.prepareMusic({packetJson:packageResult.packetJson,wallet});
 verified=assertSyntheticMusicUnsigned(result,packageResult,{args,wallet});
 const tx=C.Transaction.from_hex(result.unsignedHex), actual={};
 const metadata=tx.auxiliary_data().metadata(),keys=metadata.keys();
 for(let i=0;i<keys.len();i++){const key=keys.get(i);actual[key.to_str()]=JSON.parse(C.decode_metadatum_to_json_str(metadata.get(key),C.MetadataJsonSchema.NoConversions));}
 recovered=await shared.recoverMusicRelease(actual,{policyId:result.asset.policyId,assetName:Buffer.from(result.asset.assetNameHex,'hex').toString('utf8')});
 assert.deepEqual(recovered,packageResult.musicRelease);
 const parsed={epoch:654,slot:197151000,blockTime:fixedClockMs/1000,fetchedAt:fixedClockMs,maxTx:16384,maxValue:5000,feeA:44,feeB:155381,coinsPerByte:'4310',keyDeposit:'2000000',poolDeposit:'500000000'};
 direct=await shared.buildMusicReleaseTransaction(C,packageResult.musicRelease,wallet,parsed);
 assert.equal(sha(Buffer.from(direct.unsignedHex,'hex')),sha(Buffer.from(result.unsignedHex,'hex')));
}finally{Date.now=clock;}
const source=[];
for(const path of [...new Set([...Object.keys(built.metafile.inputs).filter(p=>p!=='<stdin>'), ...['mcp/integration/verify-synthetic-native.mjs','mcp/integration/verify-music-unsigned.mjs','mcp/integration/verify-music-tools.mjs','mcp/src/cbor-preflight.mjs','mcp/package-lock.json']])].sort()){
 const bytes=await readFile(resolve(repo,path));source.push({path:relative(repo,resolve(repo,path)),bytes:bytes.length,sha256:sha(bytes)});
}
await writeFile(resolve(home,'midnight-beacon.music-release.json'),packageResult.packetJson);
await writeFile(resolve(home,'evidence/synthetic-prepared.json'),JSON.stringify(result,null,2)+'\n');
await writeFile(resolve(home,'evidence/source-inputs.json'),JSON.stringify(source,null,2)+'\n');
const report={schema:'beacn.original-music-demo-check.v1',status:'PASS',checkedAt:new Date().toISOString(),title:args.name,packageHash:packageResult.packageHash,rawFileBytes:packageResult.musicRelease.bundle.bytes,files:packageResult.musicRelease.bundle.files.map(({name,bytes,sha256,mediaType})=>({name,bytes,sha256,mediaType})),packageJsonBytes:packageResult.packageJsonBytes,metadataBudget:packageResult.budget,...verified,feeLovelace:result.feeLovelace,actualCborRecovery:{entirePackageEqual:true,exactFiles:true,exactCredits:true,sharedCodec:true},sharedStudioBuilderDirectByteParity:true,directBuilderRuntime:'Node with CSL17',syntheticClock:{fixedClockMs,quote,realChainFreshness:false},networkCalls,keys:0,signaturesCreated:0,submissions:0,limits:['Synthetic input references and protocol quote only. Never sign or submit this preparation.','Metadata recovery shares the Studio codec; direct assertions share CSL, not a separate ledger implementation.','AI-assisted original demonstration material and credit declarations; no rights/authorship certification.','Opus compressed audio is the exact encoded source in this package; it is not the larger synthesis WAV.']};
assert.equal(networkCalls,0);assert.ok(report.rawFileBytes<=9000);assert.ok(report.estimatedSignedBytes<16384);
await writeFile(resolve(home,'evidence/package-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
