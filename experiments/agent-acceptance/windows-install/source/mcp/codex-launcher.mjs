/** Resolve only native Codex or the standard npm launcher; never send arguments to a shell. */
import {spawnSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {win32} from 'node:path';
const fileExists=path=>{try{return statSync(path).isFile();}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return false;throw error;}};
const manifestAt=path=>{const stat=statSync(path);if(!stat.isFile()||stat.size>65536)throw new Error('Unsupported Codex npm package manifest.');return JSON.parse(readFileSync(path,'utf8'));};
export function resolveCodexLaunch({platform=process.platform,env=process.env,node=process.execPath,isFile=fileExists,readManifest=manifestAt}={}){
 if(platform!=='win32')return {command:'codex',prefix:[]};
 const pathKey=Object.keys(env).sort().find(key=>key.toLowerCase()==='path');
 for(let directory of (env[pathKey]||'').split(';')){
  if(directory.startsWith('"')&&directory.endsWith('"'))directory=directory.slice(1,-1);
  if(!win32.isAbsolute(directory))continue;
  const native=win32.join(directory,'codex.exe');
  if(isFile(native))return {command:native,prefix:[]};
  if(!isFile(win32.join(directory,'codex.cmd')))continue;
  // npm's generated .cmd cannot be spawned without cmd.exe. Invoke its verified package entry with Node instead.
  const root=win32.join(directory,'node_modules','@openai','codex'),entry=win32.join(root,'bin','codex.js');
  let pkg;try{pkg=readManifest(win32.join(root,'package.json'));}catch{throw new Error('Unsupported Windows Codex shim. Use the official native codex.exe or standard npm @openai/codex installation. Nothing was changed.');}
  if(pkg?.name!=='@openai/codex'||pkg?.bin?.codex!=='bin/codex.js'||!isFile(entry))throw new Error('Unsupported Windows Codex shim. Use the official native codex.exe or standard npm @openai/codex installation. Nothing was changed.');
  return {command:node,prefix:[entry]};
 }
 throw new Error('Codex was not found on Windows PATH. Install the official Codex CLI, reopen your terminal, and retry. Nothing was changed.');
}
export function createCodexRunner(options={},spawn=spawnSync){
 const launch=resolveCodexLaunch(options);
 return args=>spawn(launch.command,[...launch.prefix,...args],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024,windowsHide:true});
}
