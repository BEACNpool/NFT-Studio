#!/usr/bin/env node
/** Repo-local Codex setup. Default is a read-only preflight; --install explicitly adds one server. */
import {createCodexRunner} from './codex-launcher.mjs';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
export const SERVER_NAME='nft-studio';
export function assertSupportedNode(version){const [major,minor]=version.replace(/^v/,'').split('.').map(Number);if(!Number.isInteger(major)||!Number.isInteger(minor)||major<22||(major===22&&minor<13))throw new Error('Use Node.js 22.13 or newer.');}
export function installPlan(existing,node,entry){
 if(existing===null)return {action:'add',args:['mcp','add',SERVER_NAME,'--',node,entry]};
 const t=existing.transport;
 const cleanEnv=!t?.env||Object.keys(t.env).length===0;
 const cleanVars=!t?.env_vars||t.env_vars.length===0;
 const noFilter=existing.enabled_tools==null&&(!existing.disabled_tools||existing.disabled_tools.length===0);
 const same=existing.enabled!==false&&noFilter&&t?.type==='stdio'&&t.command===node&&JSON.stringify(t.args)==JSON.stringify([entry])&&cleanEnv&&cleanVars&&!t.cwd;
 if(!same)throw new Error('An existing nft-studio server has different settings. Nothing was changed. Review it in Codex before deliberately removing or replacing it.');
 return {action:'already-installed',args:[]};
}
export function readExisting(run){
 const r=run(['mcp','get',SERVER_NAME,'--json']);
 if(r.status===0){let v;try{v=JSON.parse(r.stdout);}catch{throw new Error('Codex returned invalid server configuration JSON. Nothing was changed.');}if(!v||typeof v!=='object'||v.name!==SERVER_NAME)throw new Error('Unexpected Codex server configuration. Nothing was changed.');return v;}
 if(r.status===1&&/^Error: No MCP server named ['"]?nft-studio['"]? found\.?\s*$/.test(r.stderr.trim()))return null;
 throw new Error('Could not establish whether nft-studio is already configured. Nothing was changed. Check codex mcp get nft-studio manually.');
}
export async function preflight(entry,node=process.execPath){
 assertSupportedNode(process.versions.node);
 await access(entry).catch(()=>{throw new Error('Build the local MCP first: npm --prefix mcp ci && npm --prefix mcp run build');});
 const transport=new StdioClientTransport({command:node,args:[entry],stderr:'pipe',env:{PATH:process.env.PATH}}),client=new Client({name:'nft-studio-codex-setup',version:'1.0.0'});
 let timer;
 try{return await Promise.race([(async()=>{await client.connect(transport);const tools=(await client.listTools()).tools,resources=(await client.listResources()).resources;for(const name of ['studio_capabilities','studio_guide','studio_inspiration','create_mint_intent','verify_mint_intent'])if(!tools.some(t=>t.name===name))throw new Error(`MCP does not expose required tool ${name}.`);return {tools:tools.length,resources:resources.length};})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Local MCP discovery timed out.')),20000);})]);}
 finally{clearTimeout(timer);await client.close();}
}
export async function main(argv=process.argv.slice(2)){
 if(argv.length>1||argv.some(a=>!['--check','--install','--help'].includes(a)))throw new Error('Usage: node mcp/install-codex.mjs [--check|--install]');
 if(argv[0]==='--help'){console.log('Default/--check: discover the built local MCP and print setup, without changing Codex. --install: add nft-studio to the current user’s Codex configuration; preserve existing different settings by refusing them. Open Codex in the repository to discover .agents/skills/nft-studio/SKILL.md. No skill is copied globally.');return;}
 const entry=fileURLToPath(new URL('./dist/cli.mjs',import.meta.url)),node=process.execPath;
 const counts=await preflight(entry,node);
 console.log(`Local MCP ready: ${counts.tools} tools, ${counts.resources} resources.`);
 const command=['codex','mcp','add',SERVER_NAME,'--',node,entry];
 if(argv[0]!=='--install'){console.log('No Codex configuration changed. Explicit install: node mcp/install-codex.mjs --install');console.log('Equivalent command arguments (JSON array; do not paste as a shell command): '+JSON.stringify(command));return;}
 const run=createCodexRunner();
 const plan=installPlan(readExisting(run),node,entry);
 if(plan.action==='already-installed'){console.log('The same local MCP is already installed. Nothing changed.');return;}
 const added=run(plan.args);if(added.status!==0)throw new Error('Codex did not confirm installation. Inspect codex mcp get nft-studio before retrying.');
 if(installPlan(readExisting(run),node,entry).action!=='already-installed')throw new Error('Codex configuration verification failed. Inspect codex mcp get nft-studio.');
 console.log('Installed and verified nft-studio in Codex. Start a new Codex session in this checkout; use $nft-studio. No wallet permission was granted. Undo with: codex mcp remove nft-studio');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(error=>{console.error(error.message);process.exitCode=1;});
