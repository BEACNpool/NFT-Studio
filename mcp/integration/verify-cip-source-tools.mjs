import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const standards=new URL('../../knowledge/standards/',import.meta.url);
const index=JSON.parse(await readFile(new URL('index.json',standards)));
const unpack=raw=>{assert.equal(raw.isError,undefined,JSON.stringify(raw));return raw.structuredContent??JSON.parse(raw.content[0].text)};
const reject=async(client,name,args)=>{let r;try{r=await client.callTool({name,arguments:args})}catch{return}assert.equal(r.isError,true,JSON.stringify(r));};
export async function verifyCipSourceTools(client){
  const tools=(await client.listTools()).tools;
  for(const name of ['search_cip_sources','get_cip_source_chunk']){const tool=tools.find(t=>t.name===name);assert.ok(tool);assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.annotations.openWorldHint,false);}
  const caps=unpack(await client.callTool({name:'studio_capabilities',arguments:{}}));assert.equal(caps.cipSources.documents,148);assert.equal(caps.cipSources.curatedResearch,false);
  const all=unpack(await client.callTool({name:'search_cip_sources',arguments:{query:'',limit:10}}));assert.equal(all.totalMatches,148);assert.equal(all.results.length,10);
  for(const query of ['CIP188','CIP-0162','music']){const search=unpack(await client.callTool({name:'search_cip_sources',arguments:{query}}));assert.equal(search.results[0].id,query==='CIP188'?'CIP-0188':query==='music'?'CIP-0060':'CIP-0162');}
  const active=unpack(await client.callTool({name:'search_cip_sources',arguments:{status:'Active'}}));assert.equal(active.totalMatches,62);
  let cases=0;
  for(const id of ['CIP-0026','CIP-0121','CIP-0190']){
    const entry=index.entries.find(e=>e.id===id),bytes=await readFile(new URL(entry.localPath,standards));
    const first=bytes.findIndex(b=>(b&0xc0)===0x80);let start=first;while(start>0&&(bytes[start]&0xc0)===0x80)start--;
    for(const offsetBytes of [0,Math.max(0,start),bytes.length]){
      const raw=await client.callTool({name:'get_cip_source_chunk',arguments:{id,offsetBytes,limitBytes:16384}});assert.ok(Buffer.byteLength(JSON.stringify(raw))<80000);
      const chunk=unpack(raw);assert.equal(chunk.offsetBytes,offsetBytes);assert.equal(chunk.totalBytes,bytes.length);assert.equal(chunk.sha256,createHash('sha256').update(bytes).digest('hex'));
      assert.deepEqual(Buffer.from(chunk.text),bytes.subarray(offsetBytes,chunk.endOffsetBytes));assert.ok(chunk.returnedBytes<=16384);assert.equal(chunk.attribution.originalSource,entry.sourceUrl);assert.equal(chunk.attribution.authorsRawText,entry.attribution.authorsRawText);
      assert.equal(chunk.nextOffsetBytes,chunk.endOffsetBytes===bytes.length?null:chunk.endOffsetBytes);cases++;
    }
    if(first>=0)await reject(client,'get_cip_source_chunk',{id,offsetBytes:first});
  }
  const ambiguous=unpack(await client.callTool({name:'get_cip_source_chunk',arguments:{id:'CIP-0121'}}));assert.deepEqual(ambiguous.attribution.retainedLicenses,['CC-BY-4.0','Apache-2.0']);
  for(const args of [{id:'../README.md'},{id:'CIP-26'},{id:'CIP-0000'},{id:'CIP-0026',offsetBytes:-1},{id:'CIP-0026',offsetBytes:1.5},{id:'CIP-0026',offsetBytes:524288},{id:'CIP-0026',limitBytes:3},{id:'CIP-0026',limitBytes:16385},{id:'CIP-0026',url:'https://example.com'},{id:'CIP-0026',offsetBytes:'0'}])await reject(client,'get_cip_source_chunk',args);
  for(const args of [{query:'é'.repeat(129)},{query:'\ud800'},{query:'\u0000'},{query:'x '.repeat(13)},{limit:11},{status:'Inactive'},{path:'/etc/passwd'}])await reject(client,'search_cip_sources',args);
  assert.equal((await client.listResources()).resources.length,61);
  return{documents:148,chunkComparisons:cases,resources:61,noNewResources:true};
}

export async function verifyCipSourceRelease(client){
  const search=unpack(await client.callTool({name:'search_cip_sources',arguments:{query:'CIP188',limit:1}}));assert.equal(search.results[0].id,'CIP-0188');
  for(const id of ['CIP-0190','CIP-0121']){const entry=index.entries.find(e=>e.id===id),bytes=await readFile(new URL(entry.localPath,standards));const chunk=unpack(await client.callTool({name:'get_cip_source_chunk',arguments:{id,limitBytes:1024}}));assert.deepEqual(Buffer.from(chunk.text),bytes.subarray(0,chunk.endOffsetBytes));assert.equal(chunk.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(chunk.totalBytes,bytes.length);if(id==='CIP-0121')assert.deepEqual(chunk.attribution.retainedLicenses,['CC-BY-4.0','Apache-2.0']);}
  return{documents:148,sourceCommit:index.sourceCommit,indexedMissingRootTableEntry:true,independentChunkChecks:2,wholeDocumentHashVerified:true,curatedResearch:false};
}
