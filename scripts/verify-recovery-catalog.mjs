// Exercises the real RecoveryPanel parser against every frozen catalog file.
// No network, wallet or transaction submission. The component source is read only.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.env.STUDIO_TEST_ROOT||'.');
// Keep external package resolution inside the invoking checkout/node_modules tree.
const temp=await mkdtemp(join(process.cwd(),'.recovery-regression-'));
try{
 await build({absWorkingDir:root,entryPoints:['lib/studio-payload.ts','lib/arcade.ts','components/recovery-panel.tsx'],outdir:temp,
  outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error',
  define:{'process.env.NEXT_PUBLIC_BASE_PATH':'""'},
  plugins:[{name:'test-recovery-parser',setup(b){b.onLoad({filter:/[/\\]components[/\\]recovery-panel\.tsx$/},async({path})=>({contents:await readFile(path,'utf8')+'\nexport { recoverEmbedded };\n',loader:'tsx'}));}}]});
 const payload=await import(pathToFileURL(join(temp,'lib/studio-payload.mjs'))),arcade=await import(pathToFileURL(join(temp,'lib/arcade.mjs')));
 const {recoverEmbedded}=await import(pathToFileURL(join(temp,'components/recovery-panel.mjs')));
 const catalog=JSON.parse(await readFile(join(root,'lib/arcade-catalog.json'),'utf8'));
 const chunks=s=>s.match(/.{1,64}/g),results=[];let sample;
 for(const [id,entry] of Object.entries(catalog)){
  const html=await readFile(join(root,'public/arcade',id,'game.html'),'utf8'),cover=await readFile(join(root,'public/arcade',id,'cover.svg'));
  const media={id,image:{uri:'data:image/svg+xml;base64,'+cover.toString('base64'),mediaType:'image/svg+xml',bytes:cover.length,width:640,quality:100,sha256:entry.coverSHA256},program:{html,uri:arcade.arcadeURI(html),bytes:Buffer.byteLength(html),sha256:entry.programSHA256,kind:'pocket-arcade'}};
  await arcade.verifyArcade(media);
  const identity={policyId:entry.original.policy,assetName:Buffer.from(entry.original.assetHex,'hex').toString('utf8')};
  const metadata=arcade.arcadeMetadata(media,identity.policyId,identity.assetName),recovered=await recoverEmbedded(metadata);
  assert.equal(recovered.length,2,id+' file count');
  const recoveredCover=payload.decodePayloadURI(recovered[0].file.uri,recovered[0].file.mediaType),recoveredHTML=payload.decodePayloadURI(recovered[1].file.uri,recovered[1].file.mediaType);
  assert.deepEqual(Buffer.from(recoveredCover),cover,id+' exact cover');assert.equal(Buffer.from(recoveredHTML).toString('utf8'),html,id+' exact HTML');
  assert.equal(recovered[0].file.sha256,entry.coverSHA256);assert.equal(recovered[1].file.sha256,entry.programSHA256);assert.equal(recovered[1].verified,true);
  results.push({id,coverBytes:cover.length,programBytes:Buffer.byteLength(html)});sample={metadata,identity,html};
 }
 const {metadata,identity,html}=sample;
 const changed=structuredClone(metadata);changed['721'][identity.policyId][identity.assetName].files[0].src=chunks(arcade.arcadeURI(html+' '));
 await assert.rejects(recoverEmbedded(changed),/does not match its metadata hash/);
 const hashChanged=structuredClone(metadata);hashChanged['721'][identity.policyId][identity.assetName].sha256='0'.repeat(64);await assert.rejects(recoverEmbedded(hashChanged),/does not match its metadata hash/);
 for(const uri of ['data:text/html;charset=latin1,x','data:text/html;charset=utf-8;extra=1,x','data:text/html;charset=utf-8;charset=utf-8,x','data:text/html;charset=utf-8,%ZZ','data:text/html;charset=utf-8;base64,Y===','https://example.com/file.html'])assert.throws(()=>payload.decodePayloadURI(uri,'text/html'),undefined,uri);
 assert.equal(Buffer.from(payload.decodePayloadURI('data:text/html;charset=utf-8;base64,PGI+aGk8L2I+','text/html')).toString(),'<b>hi</b>');
 assert.throws(()=>payload.decodePayloadURI('data:text/plain,'+'a'.repeat(16385),'text/plain'),/bound/);
 await assert.rejects(payload.preparePayloadBundle({name:'Too large input',files:[{name:'x.txt',mediaType:'text/plain',bytes:new Uint8Array(12001)}]}),/exceed/);
 const ordinary=await payload.preparePayloadBundle({name:'Still canonical',files:[{name:'x.txt',mediaType:'text/plain',bytes:new TextEncoder().encode('hello 🦾')}]});await payload.verifyPayloadBundle(ordinary);
 console.log(JSON.stringify(results));
 console.log('PASS all 9 catalog programs and covers recovered byte-identically through actual RecoveryPanel parser; metadata tamper/invalid URI params/oversize reject; 12 KB creation bound unchanged');
}finally{await rm(temp,{recursive:true,force:true});}
