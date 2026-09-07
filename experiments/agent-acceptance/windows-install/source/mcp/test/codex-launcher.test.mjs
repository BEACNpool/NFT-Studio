import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveCodexLaunch,createCodexRunner} from '../codex-launcher.mjs';
const node='C:\\Program Files\\nodejs\\node.exe';
const dir="C:\\Users\\O'Brian & Co\\100%real!\\npm";
const cli=dir+'\\node_modules\\@openai\\codex\\bin\\codex.js';
const pkg={name:'@openai/codex',bin:{codex:'bin/codex.js'}};
function options(overrides={}){return {platform:'win32',node,env:{Path:dir},isFile:path=>[dir+'\\codex.cmd',cli].includes(path),readManifest:path=>{assert.equal(path,dir+'\\node_modules\\@openai\\codex\\package.json');return pkg;},...overrides};}
test('Linux and macOS retain literal codex command and unchanged argument array/options',()=>{
 for(const platform of ['linux','darwin']){const args=['mcp','add','nft-studio','--','/spaces & %/node',"/O'Brian/Studio/mcp/dist/cli.mjs"],calls=[];const run=createCodexRunner({platform},(...v)=>{calls.push(v);return {status:0};});assert.deepEqual(run(args),{status:0});assert.deepEqual(calls, [['codex',args,{encoding:'utf8',timeout:20000,maxBuffer:1048576,windowsHide:true}]]);}
});
test('Windows native executable is used shell-free',()=>{assert.deepEqual(resolveCodexLaunch(options({env:{PATH:'C:\\Native;'+dir},isFile:path=>path==='C:\\Native\\codex.exe'})),{command:'C:\\Native\\codex.exe',prefix:[]});});
test('standard npm shim resolves verified JavaScript entry with Node; shell characters remain literal',()=>{
 const calls=[],run=createCodexRunner(options(),(...v)=>{calls.push(v);return {status:0};});const args=['mcp','add','nft-studio','--',node,"C:\\quote' & %PATH%!\\mcp\\dist\\cli.mjs"];run(args);assert.equal(calls[0][0],node);assert.deepEqual(calls[0][1],[cli,...args]);assert.equal(calls[0][2].shell,undefined);assert.equal(calls[0][2].windowsVerbatimArguments,undefined);
});
test('first supported PATH directory wins; quoted absolute entries work; relative and empty entries never search cwd',()=>{
 const visited=[];const out=resolveCodexLaunch(options({env:{Path:'.;;relative;"'+dir+'";C:\\Other'},isFile:path=>{visited.push(path);return path===dir+'\\codex.cmd'||path===cli;}}));assert.equal(out.prefix[0],cli);assert.ok(visited.every(path=>path.startsWith(dir+'\\')));
});
test('a malformed first shim does not fall through to another installation',()=>{
 for(const readManifest of [()=>{throw new Error('bad JSON');},()=>null,()=>({name:'other',bin:pkg.bin}),()=>({name:pkg.name,bin:{codex:'../../anything.js'}}),()=>({name:pkg.name,bin:'bin/codex.js'})])assert.throws(()=>resolveCodexLaunch(options({readManifest})),/Unsupported Windows Codex shim/);
 assert.throws(()=>resolveCodexLaunch(options({isFile:path=>path===dir+'\\codex.cmd'})),/Unsupported Windows Codex shim/);
});
test('missing Windows launcher refuses before spawning or changing any configuration',()=>{let count=0;assert.throws(()=>createCodexRunner(options({isFile:()=>false}),()=>{count++;}),/Codex was not found/);assert.equal(count,0);});
