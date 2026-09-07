// Generate fixed raw imports; never caller-selected file paths.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CORPUS_PIN} from '../pin.mjs';
const base=new URL('../',import.meta.url),bytes=await readFile(new URL('index.json',base));
if(createHash('sha256').update(bytes).digest('hex')!==CORPUS_PIN.indexSha256)throw Error('Index pin mismatch.');
const index=JSON.parse(bytes);
const licenses=(await Promise.all(['UPSTREAM-LICENSE.source.txt','APACHE-2.0.source.txt'].map(name=>readFile(new URL(name,base),'utf8')))).join('\n\n');
const notice='/*! Unchanged CIP documents by their original authors and contributors. Pinned cardano-foundation/CIPs commit '+CORPUS_PIN.commit+'. Individual author and copyright notices remain in the original document data. Per-file licensing and the CIP-0121 conflicting declarations remain recorded in the index; neither is silently resolved. Retained license texts:\n'+licenses.replaceAll('*/','* /')+' */';
const generated=[notice,"// Generated fixed source imports. Original authorship/licenses remain in ATTRIBUTION.md.\nimport indexJson from './index.json?raw';\nimport {createStandardsCorpus} from './lib.mjs';"];
for(const [i,e]of index.entries.entries())generated.push(`import doc${i} from './${e.localPath}?raw';`);
generated.push('export const SOURCE_LICENSE_TEXTS=Object.freeze('+JSON.stringify({'CC-BY-4.0':await readFile(new URL('UPSTREAM-LICENSE.source.txt',base),'utf8'),'Apache-2.0':await readFile(new URL('APACHE-2.0.source.txt',base),'utf8')})+');');
generated.push('const documents = Object.freeze({'+index.entries.map((e,i)=>JSON.stringify(e.id)+':doc'+i).join(',')+'});');
generated.push('let pending;\n/** Authenticate once; immutable data, no network or caller paths. */\nexport function getBundledCorpus(){return pending??=(createStandardsCorpus({indexJson,documents}));}\n');
const text=generated.join('\n');
if(process.argv.slice(2).length>1||process.argv[2]&&process.argv[2]!=='--check')throw Error('Use only --check or no arguments.');
if(process.argv[2]==='--check'){if(await readFile(new URL('bundled.mjs',base),'utf8')!==text)throw Error('Generated corpus imports differ.');}
else await writeFile(new URL('bundled.mjs',base),text);
console.log('Fixed corpus import module verified: '+index.entries.length+' original documents.');
