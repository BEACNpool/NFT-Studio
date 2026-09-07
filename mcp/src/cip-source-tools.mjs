import * as z from 'zod/v4';
import {getBundledCorpus} from '@knowledge/standards/bundled.mjs';
import {CORPUS_PIN} from '@knowledge/standards/pin.mjs';
export const CIP_SOURCE_CAPABILITIES=Object.freeze({
  kind:'pinned original CIP README source inventory',sourceCommit:CORPUS_PIN.commit,indexSha256:CORPUS_PIN.indexSha256,
  documents:CORPUS_PIN.documentCount,totalSourceBytes:CORPUS_PIN.totalBytes,
  curatedResearch:false,scope:'Exactly 148 CIP-####/README.md originals; excludes annexes, CPS and off-repository links.',
  limits:{queryUtf8Bytes:256,queryTokens:12,searchResults:10,chunkUtf8Bytes:16384,minimumChunkBytes:4},
  offsets:'UTF-8 bytes; start inside a code point rejects, end retreats to a complete boundary; use nextOffsetBytes.',
  sourceText:'Inert plain text with original authorship and license; no execution, automatic links, chain or adoption claims.',
  networkRequests:false,
});
const status=z.enum(['Active','Proposed','Inactive (abandoned for lack of interest)','Inactive (superseded by CIP-0121 and CIP-0122)','Inactive (incorporated into candidate CIP-0113)']);
const query=z.strictObject({query:z.string().max(256).default(''),status:status.optional(),limit:z.number().int().min(1).max(10).default(5)});
const chunk=z.strictObject({id:z.string().regex(/^CIP-[0-9]{4}$/).length(8),offsetBytes:z.number().int().min(0).max(524288).default(0),limitBytes:z.number().int().min(4).max(16384).default(8192)});
export function registerCipSourceTools(register){
  register('search_cip_sources','Search id, exact title and declared status in 148 original CIP README documents at the fixed commit. Separate from curated research. No body/full-text search, network, adoption or Studio support claim; at most ten source descriptors.',query,async args=>(await getBundledCorpus()).search(args));
  register('get_cip_source_chunk','Read at most 16 KiB of one original CIP README as inert text. Canonical CIP-#### id and UTF-8 byte offsets only. Returns exact offsets, next offset, total bytes, whole-document hash and pinned attribution. Rejects starts inside code points; never executes examples or follows links. Annexes/CPS are outside the snapshot.',chunk,async args=>{
    const corpus=await getBundledCorpus(),result=corpus.getChunk(args),entry=corpus.index.entries.find(e=>e.id===args.id);
    return {...result,attribution:{authorsRawText:entry.attribution.authorsRawText,license:entry.license,retainedLicenses:entry.retainedLicenses,licenseNotes:entry.licenseNotes,originalSource:entry.sourceUrl},scope:'Original source text, not curated research or implementation evidence.'};
  });
}
