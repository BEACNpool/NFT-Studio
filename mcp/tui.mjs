#!/usr/bin/env node
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {emitKeypressEvents} from 'node:readline';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {RECIPES,TOOLBOX,workbenchCatalog,planUtility} from '../lib/studio-workbench.mjs';

export const safeText=value=>String(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,' ');
const cut=(s,width)=>Array.from(safeText(s)).slice(0,Math.max(0,width)).join('');
const pad=(s,width)=>cut(s,width).padEnd(width);
const wrap=(value,width)=>{
  const result=[];for(const paragraph of String(value).split('\n')){
    let line='';for(const word of safeText(paragraph).split(' ')){
      if(line && Array.from(line+' '+word).length>width){result.push(line);line='';}
      const chars=Array.from(word);while(chars.length>width){if(line){result.push(line);line='';}result.push(chars.splice(0,width).join(''));}
      const rest=chars.join('');line+=(line?' ':'')+rest;
    }result.push(line);
  }return result;
};
export function filteredItems(state){
  const source=state.tab==='tools'?TOOLBOX:RECIPES;
  const normalize=s=>s.toLowerCase().replace(/cip[- ]?0*(\d+)/g,'cip-$1');
  return source.filter(item=>normalize(JSON.stringify(item)).includes(normalize(state.query||'')));
}
export function terminalFrame(state,{width=100,height=32,color=true}={}){
  width=Math.max(24,Math.min(160,width));height=Math.max(10,Math.min(80,height));
  const cyan=s=>color?'\x1b[38;2;180;243;206m'+s+'\x1b[0m':s;
  const dim=s=>color?'\x1b[38;2;169;190;193m'+s+'\x1b[0m':s;
  const lines=[cyan(cut('  B E A C N   /   NFT-STUDIO WORKBENCH',width)),dim(cut('  Create something worth carrying.                         v0.5.0',width)),dim('─'.repeat(width)),
    cut(`  [1] Recipes${state.tab==='recipes'?' *':''}   [2] Tools${state.tab==='tools'?' *':''}   [3] Review${state.tab==='review'?' *':''}   [p] Plan (${state.choices.size})`,width),dim('─'.repeat(width))];
  let body=[];
  if(state.prompt)body=[`  ${state.prompt.label}`,'',...wrap('> '+state.input,width-4).map(x=>'  '+x),'','  Enter continues · Esc cancels'];
  else if(state.busy)body=['','  Working through the local MCP…','  Your current selection is retained.'];
  else if(state.panel){
    const content=state.panel.split('\n').flatMap(s=>wrap(s,width-4));
    body=content.slice(state.scroll,state.scroll+height-10).map(s=>'  '+s);
  }else if(state.tab==='review'){
    body=state.intent?['  '+state.intent.bundle.name,'',...wrap('  Hash: '+state.intent.intentHash,width-4),'',...state.intent.bundle.files.map(f=>`  ${f.name} · ${f.bytes} B`),'','  [o] Apply options from JSON     [v] Inspect readiness','  [m] Create phone QR             [e] Export intent','  [l] Load another intent','', '  Options change the hash. Wallet review is separate.']:['','  Bring an existing ordinary .intent.json request.','','  [l] Load & verify an intent','', '  Music uses its dedicated Studio creator.'];
  }else{
    body.push('  Search: '+(state.query||'all')+'    / to search');
    const items=filteredItems(state),size=Math.max(2,height-12),start=Math.floor(state.index/size)*size;
    if(!items.length)body.push('','  No matches. Press / to change your search.');
    items.slice(start,start+size).forEach((item,offset)=>{
      const active=start+offset===state.index,chosen=state.choices.has(item.id);
      const label=state.tab==='tools'?item.name:item.title;
      const suffix=state.tab==='tools'?item.group:item.status;
      const available=Math.max(8,width-22);
      const row=' '+(active?'›':' ')+' '+(chosen?'●':' ')+' '+pad(label,available)+' '+suffix;
      body.push(active?cyan(cut(row,width)):cut(row,width));
    });
    body.push('',dim(cut(`  ${items.length} ${state.tab} · ${state.tab==='recipes'?'Space adds to plan':'Enter shows schema · x runs from a JSON file'}`,width)));
  }
  while(body.length<height-9)body.push('');
  lines.push(...body.slice(0,height-9),dim('─'.repeat(width)),cut('  '+(state.status||'Arrows/j/k move · Enter inspect · / search · b back · q quit'),width),dim(cut('  p plan · e export · PgUp/PgDn scroll · No signing or submission',width)));
  return lines.join('\n');
}
async function boundedJson(path,max=200000){const at=resolve(path),info=await stat(at);if(!info.isFile()||info.size>max)throw Error(`Choose a JSON file no larger than ${max} bytes.`);const data=await readFile(at);if(data.length>max)throw Error('The file grew beyond the limit.');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}
async function exportJson(value,directory=process.cwd()){
  const name=`beacn-${value?.schema?.includes('intent')?'creation':value?.schema?.includes('plan')?'plan':'result'}-${Date.now()}-${randomUUID().slice(0,8)}.json`;
  const path=resolve(directory,name);await writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});return path;
}
function argumentsFor(argv){
  const options={};for(let i=0;i<argv.length;i++){
    const name=argv[i];if(['--help','--plain','--json'].includes(name)){options[name.slice(2)]=true;continue;}
    if(!['--intent','--plan','--name','--purpose','--output'].includes(name)||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('See --help for the supported arguments.');
    options[name.slice(2)]=argv[++i];
  }return options;
}
export async function main(argv=process.argv.slice(2)){
  const opts=argumentsFor(argv);
  if(opts.help){process.stdout.write('BEACN Workbench\n\n  npm --prefix mcp run tui\n  node mcp/tui.mjs --intent creation.intent.json\n  node mcp/tui.mjs --plain\n  node mcp/tui.mjs --json\n  node mcp/tui.mjs --plan traits,message --name "My creation" [--output NEW.json]\n\nArrows/j/k navigate; 1/2/3 switch views; / search; Space selects a recipe;\np composes a plan; Enter inspects; x runs a tool from an explicit JSON file;\nl loads an intent; o applies an options JSON; m creates a temporary phone QR;\ne exports privately without overwriting; b goes back; q quits.\n\nNo command signs or submits. Non-TTY runs print the catalog and exit.\n');return;}
  if(opts.plan){const plan=planUtility({name:opts.name||'My next creation',purpose:opts.purpose||'',recipeIds:opts.plan.split(',')});if(opts.output){await writeFile(resolve(opts.output),JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});process.stdout.write(`Saved ${safeText(resolve(opts.output))}\n`);}else process.stdout.write(JSON.stringify(plan,null,2)+'\n');return;}
  if(opts.json){process.stdout.write(JSON.stringify(workbenchCatalog(),null,2)+'\n');return;}
  const state={tab:'recipes',query:'',index:0,choices:new Set(),panel:null,scroll:0,prompt:null,input:'',busy:false,status:'',intent:null,result:null};
  if(opts.plain||!process.stdin.isTTY||!process.stdout.isTTY){if(opts.intent)throw Error('--intent needs an interactive terminal. Use inspect_mint_readiness through MCP for automated inspection.');process.stdout.write(terminalFrame(state,{width:100,height:32,color:false})+'\n\nLaunch from an interactive terminal for keyboard controls.\nBrowser: https://beacnpool.github.io/NFT-Studio/workbench/\n');return;}
  const client=new Client({name:'beacn-workbench-tui',version:'0.5.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('dist/cli.mjs',import.meta.url))],stderr:'pipe'});
  const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});if(r.isError)throw Error(r.content.find(c=>c.type==='text')?.text||'The tool rejected the request.');return r.structuredContent||JSON.parse(r.content.find(c=>c.type==='text').text);};
  let closed=false,alternate=false,qrWait=false,queuedPrompt;
  const draw=()=>{if(!closed&&!qrWait)process.stdout.write('\x1b[H\x1b[2J'+terminalFrame(state,{width:process.stdout.columns,height:process.stdout.rows,color:!process.env.NO_COLOR}));};
  const exitScreen=()=>{if(alternate){process.stdout.write('\x1b[?25h\x1b[?1049l');alternate=false;}};
  async function close(){if(closed)return;closed=true;exitScreen();process.stdin.setRawMode(false);process.stdin.removeListener('keypress',key);process.stdout.removeListener('resize',draw);process.removeListener('SIGTERM',close);process.removeListener('SIGINT',close);process.stdin.pause();await client.close();}
  const prompt=(label,done,initial='')=>{state.prompt={label,done};state.input=initial;};
  const show=value=>{state.result=value;state.panel=JSON.stringify(value,null,2);state.scroll=0;};
  async function task(action){state.busy=true;state.status='';draw();try{await action();}catch(e){state.status=safeText(e.message);}finally{state.busy=false;draw();}}
  async function load(path){const result=await call('verify_mint_intent',{intent:await boundedJson(path,80000)});state.intent=result.intent;state.tab='review';state.panel=null;state.result=null;state.status='Exact content verified. No wallet action.';}
  async function key(text,k={}){
    if((k.ctrl&&k.name==='c')||(!state.prompt&&k.name==='q')){await close();return;}
    if(state.busy)return;
    if(qrWait){qrWait=false;process.stdout.write('\x1b[?1049h\x1b[?25l');alternate=true;draw();return;}
    if(state.prompt){
      if(k.name==='escape'){state.prompt=null;state.input='';draw();return;}
      if(k.name==='return'){const {done}=state.prompt,value=state.input;state.prompt=null;await task(()=>done(value));return;}
      if(k.name==='backspace')state.input=Array.from(state.input).slice(0,-1).join('');
      else if(text&&!k.ctrl&&!k.meta)state.input=(state.input+safeText(text)).slice(0,500);
      draw();return;
    }
    if(['1','2','3'].includes(text)){state.tab=({1:'recipes',2:'tools',3:'review'})[text];state.panel=null;state.query='';state.index=0;state.result=null;}
    else if(k.name==='b'||k.name==='escape'){state.panel=null;state.result=null;state.scroll=0;}
    else if(text==='/')prompt('Search recipes, CIP numbers or tools',q=>{state.query=q;state.index=0;state.panel=null;},state.query);
    else if(k.name==='down'||k.name==='j'){if(state.panel)state.scroll++;else state.index=Math.min(filteredItems(state).length-1,state.index+1);}
    else if(k.name==='up'||k.name==='k'){if(state.panel)state.scroll=Math.max(0,state.scroll-1);else state.index=Math.max(0,state.index-1);}
    else if(k.name==='pagedown')state.scroll+=10;
    else if(k.name==='pageup')state.scroll=Math.max(0,state.scroll-10);
    else if(k.name==='space'&&state.tab==='recipes'){
      const r=filteredItems(state)[state.index];if(r){if(state.choices.has(r.id))state.choices.delete(r.id);else if(state.choices.size<8)state.choices.add(r.id);else state.status='Choose up to eight recipes.';}
    }else if(k.name==='return'&&state.tab!=='review'){
      const item=filteredItems(state)[state.index];if(item)await task(async()=>{
        if(state.tab==='recipes'){const r=await call('get_utility_recipe',{id:item.id});state.result=r;state.panel=[r.title+' ['+r.status+']',r.summary,'','WHAT YOU NEED',...r.fields.map(x=>'• '+x),'','HOW TO ADD IT',...r.steps.map((x,i)=>`${i+1}. ${x}`),'','BOUNDARIES',...r.limits.map(x=>'• '+x),'','AFTER TRANSFER',r.lifecycle,'','TOOLS',...r.tools,'','SOURCES',...r.standards.map(x=>x.url),'',r.url].join('\n');state.scroll=0;}
        else{const tools=(await client.listTools()).tools;show(tools.find(t=>t.name===item.name));}
      });
    }else if(k.name==='p'){
      if(!state.choices.size){state.status='Select recipes with Space first.';}else prompt('Project name',name=>{queuedPrompt=name;prompt('What should the creation let someone do?',async purpose=>show(await call('plan_nft_utility',{name:queuedPrompt,purpose,recipeIds:[...state.choices]})));});
    }else if(k.name==='l')prompt('Path to an ordinary .intent.json file',load);
    else if(k.name==='v'&&state.intent)await task(async()=>show(await call('inspect_mint_readiness',{intent:state.intent})));
    else if(k.name==='o'&&state.intent)prompt('Options JSON path (quantity, mintWindowHours, traits, message)',async path=>{
      const options=await boundedJson(path,20000);if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['quantity','mintWindowHours','traits','message'].includes(k)))throw Error('Use only documented mint-option fields.');
      const result=await call('configure_mint_options',{intent:state.intent,...options});state.intent=result.intent;state.panel=null;state.result=null;state.tab='review';state.status='New request hash verified. Export for fresh wallet review.';
    });
    else if(k.name==='x'&&state.tab==='tools'){
      const item=filteredItems(state)[state.index];if(item)prompt(`Arguments JSON file for ${item.name}`,async path=>show(await call(item.name,await boundedJson(path))));
    }else if(k.name==='e')await task(async()=>{const value=state.result||state.intent;if(!value)throw Error('Inspect an item, build a plan or load an intent first.');state.status='Saved privately: '+await exportJson(value);});
    else if(k.name==='m'&&state.intent)await task(async()=>{
      const result=await call('create_mobile_handoff',{intent:state.intent});state.result=result;
      // Full-height primary-screen output preserves every QR row and quiet-zone space.
      exitScreen();qrWait=true;process.stdout.write('\nBEACN · Continue on phone\n'+result.qr.terminalText+'\n'+safeText(result.phoneUrl||result.url||result.handoff?.phoneUrl||'')+'\n'+safeText(result.expiresAtIso||result.expiresAt||result.handoff?.expiresAt||'')+'\nPress any key to return. Export the result privately with e if needed.\n');
    });
    draw();
  }
  try{await client.connect(transport);if(opts.intent)await load(opts.intent);process.stdout.write('\x1b[?1049h\x1b[?25l');alternate=true;emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('keypress',key);process.stdout.on('resize',draw);process.once('SIGTERM',close);process.once('SIGINT',close);draw();}
  catch(e){await close();throw e;}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{process.stderr.write('BEACN Workbench: '+safeText(e.message)+'\n');process.exitCode=1;});
