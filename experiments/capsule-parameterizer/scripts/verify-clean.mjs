/** Source-only candidate installation; no Studio checkout/dependencies are copied. */
import assert from 'node:assert/strict';
import {cp,lstat,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),fixture=await mkdtemp(join(tmpdir(),'capsule-parameterizer-clean-'));
await cp(root,fixture,{recursive:true,filter:async path=>{if(['node_modules','dist','.git'].includes(basename(path)))return false;assert.equal((await lstat(path)).isSymbolicLink(),false);return true;}});
for(let path=dirname(fixture);;path=dirname(path)){await assert.rejects(lstat(join(path,'node_modules')),error=>error.code==='ENOENT');if(dirname(path)===path)break;}
const env={...process.env};for(const key of ['NODE_PATH','NODE_OPTIONS'])delete env[key];
for(const args of [['ci'],['run','build'],['test']]){const run=spawnSync('npm',args,{cwd:fixture,env,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,shell:false});assert.equal(run.status,0,run.error?.message||run.stderr||run.stdout);console.log(run.stdout.trim());}
const local=JSON.parse(await readFile(new URL('../evidence/browser-build.json',import.meta.url))),clean=JSON.parse(await readFile(join(fixture,'evidence/browser-build.json'),'utf8'));assert.equal(clean.sha256,local.sha256);
const receipt={schema:'beacn.capsule-parameter-clean.v1',status:'pass',checkedAt:new Date().toISOString(),fixture,studioCheckoutRequired:false,copiedDependencies:false,ancestorDependencies:false,commands:['npm ci','npm run build','npm test'],testGroups:6,browserArtifactSha256:clean.sha256,artifactMatchesCandidate:true};
await writeFile(new URL('../evidence/clean-install.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
