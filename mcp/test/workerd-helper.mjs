/** Actual Workerd test harness. All protocol requests are intercepted locally. */
import {readFile} from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
export function protocolFixture(){return {tip:{epoch_no:654,abs_slot:197151000,block_time:Math.floor(Date.now()/1000)+45},parameters:{epoch_no:654,max_tx_size:16384,max_val_size:5000,min_fee_a:44,min_fee_b:155381,coins_per_utxo_size:4310,key_deposit:2000000,pool_deposit:500000000}};}
export async function createPublicMcpHandler(config,{memoryProbe=false}={}) {
  const calls=[],quote=protocolFixture();let scenario='normal';
  let probeContents;
  if(memoryProbe){const code=await readFile(join(root,'dist/worker.mjs'),'utf8'),name=code.match(/var (\w+) = new WebAssembly.Instance/)[1];probeContents=code+'\nexport const __testWasmMemoryBytes=()=>'+name+'.memory.buffer.byteLength;\n';}
  const mf=new Miniflare({...(memoryProbe?{inspectorPort:0}:{}),compatibilityDate:'2026-05-15',compatibilityFlags:[],modulesRoot:root,bindings:{FIXTURE_CONFIG:JSON.stringify(config)},
    modules:[{type:'ESModule',path:join(root,'test/workerd-entry.mjs')},{type:'ESModule',path:join(root,'dist/worker.mjs'),...(probeContents?{contents:probeContents}:{})},{type:'CompiledWasm',path:join(root,'dist/cardano_serialization_lib_bg.wasm')}],
    outboundService:async request=>{
      const url=new URL(request.url),tip=url.pathname.endsWith('/tip');
      calls.push({url:request.url,method:request.method,authorization:request.headers.get('authorization'),body:await request.text()});
      if(!['https://koios.beacn.workers.dev/api/v1/tip','https://koios.beacn.workers.dev/api/v1/epoch_params?order=epoch_no.desc&limit=1'].includes(request.url)||request.method!=='GET')throw new Error('Unexpected network access from candidate Worker');
      if(scenario==='delay')await new Promise(resolve=>setTimeout(resolve,250));
      if(scenario==='unavailable')return new Response('Unavailable',{status:503});
      if(scenario==='redirect')return new Response(null,{status:302,headers:{location:'https://attacker.invalid/steal'}});
      if(scenario==='oversize')return new Response(' '.repeat(65537));
      if(scenario==='declared-oversize')return new Response('[]',{headers:{'content-length':'65537'}});
      if(scenario==='invalid-utf8')return new Response(new Uint8Array([255]));
      if(scenario==='malformed')return Response.json({invalid:'not an array'});
      if(scenario==='timeout')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('['));}}));
      const data=structuredClone(tip?quote.tip:quote.parameters);
      if(scenario==='stale'&&tip)data.block_time=Math.floor(Date.now()/1000)-301;
      if(scenario==='epoch'&&!tip)data.epoch_no++;
      if(scenario==='invalid-parameter'&&!tip)data.min_fee_a=0;
      if(scenario==='low-max-tx'&&!tip)data.max_tx_size=1024;
      if(scenario==='high-fee'&&!tip){data.min_fee_a=1000;data.min_fee_b=1000000;}
      return Response.json([data]);
    },
  });
  try {
    const initial=await mf.dispatchFetch('https://test.invalid/__fixture_init__');
    if(initial.status!==200)throw new Error((await initial.json()).configurationError||'Worker initialization failed');
  }catch(error){await mf.dispose();throw error;}
  return {quote,calls,getInspectorURL:()=>mf.getInspectorURL(),setScenario:value=>{scenario=value;},
    fetch:async request=>mf.dispatchFetch(request.url,{method:request.method,headers:request.headers,...(['GET','HEAD'].includes(request.method)?{}:{body:await request.arrayBuffer()})}),
    dispatchFetch:(...args)=>mf.dispatchFetch(...args),close:()=>mf.dispose()};
}
