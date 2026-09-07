export interface CorpusPin { readonly commit:string; readonly indexSha256:string; readonly indexBytes:number; readonly documentCount:148; readonly totalBytes:3425888; }
export const CORPUS_PIN: CorpusPin;
export const CORPUS_LIMITS: Readonly<{indexBytes:number;documentBytes:number;documentCount:number;totalBytes:number;queryBytes:number;queryTokens:number;results:number;chunkBytes:number;minimumChunkBytes:number}>;
export interface SourceEntry {
 readonly id:string; readonly number:number; readonly title:string; readonly status:string;
 readonly license:'CC-BY-4.0'|'Apache-2.0'; readonly licenseUrl:string;
 readonly retainedLicenses:readonly string[]; readonly licenseNotes:readonly string[];
 readonly sourcePath:string; readonly sourceCommit:string; readonly sourceUrl:string; readonly rawUrl:string;
 readonly bytes:number; readonly sha256:string; readonly gitBlobSha1:string;
}
export interface IndexedSource extends SourceEntry {
 readonly localPath:string;
 readonly frontmatter:Readonly<{offsetBytes:number;endOffsetBytes:number;rawText:string;fields:readonly string[]}>;
 readonly attribution:Readonly<{authorsRawText:string;copyrightOffsetBytes:number;copyrightEndOffsetBytes:number;copyrightRawText:string}>;
}
export interface SourceIndex {
 readonly schema:'nft-studio.cip-source-index.v1'; readonly repository:string; readonly sourceCommit:string; readonly treeSha1:string;
 readonly scope:string; readonly documentCount:number; readonly totalBytes:number;
 readonly statusCounts:Readonly<Record<string,number>>; readonly declaredLicenseCounts:Readonly<Record<string,number>>;
 readonly entries:readonly IndexedSource[];
}
export interface SourceDocument extends SourceEntry { readonly offsetBytes:0; readonly endOffsetBytes:number; readonly totalBytes:number; readonly text:string; readonly complete:true; }
export interface SourceChunk extends SourceEntry { readonly offsetBytes:number; readonly endOffsetBytes:number; readonly nextOffsetBytes:number|null; readonly returnedBytes:number; readonly totalBytes:number; readonly text:string; readonly complete:boolean; }
export interface StandardsCorpus {
 readonly pin:CorpusPin; readonly index:SourceIndex;
 search(input?:{query?:string;status?:string;limit?:number}):Readonly<{sourceCommit:string;query:string;totalMatches:number;limit:number;results:readonly SourceEntry[]}>;
 getDocument(input:{id:string}):SourceDocument;
 getChunk(input:{id:string;offsetBytes?:number;limitBytes?:number}):SourceChunk;
}
/** Authenticate the exact pinned index JSON bytes and all original preloaded texts. No network loader is provided. */
export function createStandardsCorpus(input:{indexJson:string;documents:Record<string,string>}):Promise<StandardsCorpus>;
