/** Fixed-resource release checks. Links are validated as inert data and are never fetched. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseImplementations,implementationsForEntry} from '../../knowledge/implementations.mjs';
export const IMPLEMENTATIONS_URI='nft-studio://implementations';
const catalogueUrl=new URL('../../knowledge/catalog.json',import.meta.url);
const unpack=raw=>{assert.ok(!raw.isError,JSON.stringify(raw));return raw.structuredContent||JSON.parse(raw.content[0].text);};
function resourceText(raw,uri){assert.equal(raw.contents.length,1);const item=raw.contents[0];assert.equal(item.uri,uri);assert.equal(item.mimeType,'application/json');assert.equal(typeof item.text,'string');return item.text;}
export function assertImplementationEnvelope(value,entry,catalog,register){
  assert.deepEqual(value,{
    entry,
    sources:catalog.sources.filter(source=>entry.sourceIds.includes(source.id)),
    implementations:{resourceUri:IMPLEMENTATIONS_URI,recordIds:implementationsForEntry(register,entry.id).map(record=>record.id)},
  },'Research entry/source objects must stay unchanged and implementation links must resolve exactly.');
}
export async function verifyImplementationResources(client,resources){
  const bytes=await readFile(catalogueUrl),catalog=JSON.parse(bytes),ids=catalog.entries.map(entry=>entry.id);
  assert.equal(resources.length,ids.length+3);assert.equal(new Set(resources.map(r=>r.uri)).size,ids.length+3);
  assert.deepEqual(new Set(resources.map(r=>r.uri)),new Set(['nft-studio://capabilities','nft-studio://knowledge/index',IMPLEMENTATIONS_URI,...ids.map(id=>'nft-studio://knowledge/'+id)]));
  const text=resourceText(await client.readResource({uri:IMPLEMENTATIONS_URI}),IMPLEMENTATIONS_URI);
  const register=parseImplementations(text,ids);
  const expected=parseImplementations(await readFile(new URL('../../knowledge/implementations.json',import.meta.url),'utf8'),ids);
  assert.deepEqual(register,expected,'Hosted implementation observations must match this release source.');
  assert.equal(register.sourceCatalog.sha256,createHash('sha256').update(bytes).digest('hex'),'Implementation observations must bind the exact local frozen research catalog.');
  const linkedIds=new Set(register.records.flatMap(record=>record.entryIds));
  const unlinked=catalog.entries.find(entry=>!linkedIds.has(entry.id));assert.ok(unlinked);linkedIds.add(unlinked.id);
  for(const id of linkedIds){
    const entry=catalog.entries.find(entry=>entry.id===id);assert.ok(entry);
    const tool=unpack(await client.callTool({name:'read_knowledge',arguments:{id}}));assertImplementationEnvelope(tool,entry,catalog,register);
    const uri='nft-studio://knowledge/'+id;
    const resource=JSON.parse(resourceText(await client.readResource({uri}),uri));assertImplementationEnvelope(resource,entry,catalog,register);
  }
  return {uri:IMPLEMENTATIONS_URI,records:register.records.length,asOf:register.asOf,relatedEntriesChecked:linkedIds.size-1,unrelatedEmptyLinkChecked:true,registerJsonValidated:true,registerMatchesLocalRelease:true,immutableEvidenceLinksValidated:true,sourceCatalogHashMatchesLocal:true,researchEntriesUnchanged:true,evidenceUrlsFetched:false};
}
