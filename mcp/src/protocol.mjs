import { PROTOCOL_URL, parseProtocol } from '@studio/cardano.ts';
/** Fixed public reads only: no caller paths, credentials, redirects or snapshot data. */
async function read(path, signal) {
  const response=await fetch(PROTOCOL_URL+path,{signal,redirect:'manual',headers:{accept:'application/json'}});
  if(!response.ok||!response.body){void response.body?.cancel().catch(()=>{});throw new Error('The public Cardano protocol feed is unavailable.');}
  if(response.headers.get('content-length')!==null && (!/^\d+$/.test(response.headers.get('content-length'))||Number(response.headers.get('content-length'))>65536)){void response.body.cancel().catch(()=>{});throw new Error('The public protocol feed exceeded its response bound.');}
  const reader=response.body.getReader(),chunks=[];let size=0,abort;
  const deadline=new Promise((_,reject)=>{abort=()=>reject(new Error('The public protocol feed timed out.'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
  try {
    while(true){const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;size+=value.length;if(size>65536)throw new Error('The public protocol feed exceeded its response bound.');chunks.push(value);}
  }finally {signal.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!Array.isArray(rows)||!rows[0]||typeof rows[0]!=='object'||Array.isArray(rows[0]))throw new Error('Malformed public protocol feed.');
  return rows[0];
}
export async function readProtocolQuote(signal) {
  const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  // Clear the actual timer on every completion. Pending timeout signals can retain
  // completed Fetch graphs under a sustained isolate workload.
  const timer=setTimeout(()=>controller.abort(new Error('The public protocol feed timed out.')),10000);
  try {
    const [tip,parameters]=await Promise.all([read('/tip',combined),read('/epoch_params?order=epoch_no.desc&limit=1',combined)]);
    return {tip,parameters};
  } finally {clearTimeout(timer);controller.abort();}
}
export async function liveProtocol(signal) {
  const {tip,parameters}=await readProtocolQuote(signal);
  return parseProtocol(tip,parameters);
}
