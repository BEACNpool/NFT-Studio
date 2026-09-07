import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createService } from './server.mjs';
import { REQUEST_LIMIT } from './schemas.mjs';
const fingerprint = value => createHash('sha256').update(value).digest();
function fail(res,status,message) {
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...(status===401?{'www-authenticate':'Bearer realm="nft-studio-mcp"'}:{}),...(status===429?{'retry-after':'60'}:{})});
  res.end(JSON.stringify({error:message}));
}
export function validateHttpOptions(options) {
  const host=options.host||'127.0.0.1', port=options.port??8787;
  if(!['127.0.0.1','::1'].includes(host)) throw new Error('MCP binds loopback only. Use a TLS reverse proxy for remote service.');
  if(!Number.isInteger(port)||port<0||port>65535) throw new Error('Invalid MCP port.');
  if(typeof options.token!=='string'||options.token.length<32||options.token.length>256||!/^[A-Za-z0-9_-]+$/.test(options.token)) throw new Error('HTTP requires MCP_AUTH_TOKEN: 32–256 URL-safe characters from your secret manager.');
  const allowedHosts=new Set(['127.0.0.1','localhost','[::1]',...(options.allowedHosts||[])]);
  for(const name of allowedHosts) if(!/^(?:[a-zA-Z0-9.-]+|\[::1\])$/.test(name)||name.includes('*')) throw new Error('Allowed hosts must be exact hostnames, without wildcards or ports.');
  const allowedOrigins=new Set(options.allowedOrigins||[]);
  for(const origin of allowedOrigins) {
    const url=new URL(origin);
    if(url.origin!==origin||url.username||url.password||!['http:','https:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Origins must be exact HTTPS origins (HTTP only for loopback).');
  }
  return {host,port,allowedHosts,allowedOrigins};
}
/** Remote clients terminate TLS at an operator-managed proxy forwarding to loopback. */
export function createHttpService(options) {
  const config=validateHttpOptions(options), service=options.service||createService();
  const expected=fingerprint(options.token), maximum=options.rateLimit??120;
  if(!Number.isInteger(maximum)||maximum<1||maximum>1000) throw new Error('Invalid service rate limit.');
  let windowStart=Date.now(), requests=0, active=0;
  const handler=createMcpHandler(service.factory,{legacy:'stateless',responseMode:'auto',maxSubscriptions:0,onerror:()=>{}});
  const adapter=toNodeHandler(handler,{onerror:()=>{}});
  const server=createServer({maxHeaderSize:8192},async (req,res)=>{
    res.setHeader('cache-control','no-store'); res.setHeader('x-content-type-options','nosniff');
    const now=Date.now();if(now-windowStart>=60000){windowStart=now;requests=0;}
    if(++requests>maximum) return fail(res,429,'Service request limit reached.');
    let host;
    try {const parsed=new URL('http://'+req.headers.host);if(parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.host!==req.headers.host?.toLowerCase())return fail(res,403,'Host is not allowed.');host=parsed.hostname;}catch{return fail(res,403,'Host is not allowed.');}
    if(!req.headers.host||!config.allowedHosts.has(host)) return fail(res,403,'Host is not allowed.');
    const origin=req.headers.origin;
    if(origin!==undefined&&(typeof origin!=='string'||!config.allowedOrigins.has(origin))) return fail(res,403,'Origin is not allowed.');
    if(req.url!=='/mcp') return fail(res,404,'Not found.');
    if(origin){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');res.setHeader('access-control-expose-headers','MCP-Protocol-Version');}
    if(req.method==='OPTIONS') {
      res.writeHead(204,{'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Authorization, Content-Type, Accept, MCP-Protocol-Version','access-control-max-age':'600'});return res.end();
    }
    const authorization=req.headers.authorization;
    if(typeof authorization!=='string'||!authorization.startsWith('Bearer ')||!timingSafeEqual(expected,fingerprint(authorization.slice(7)))) return fail(res,401,'Bearer authentication is required.');
    if(req.method!=='POST'){res.setHeader('allow','POST, OPTIONS');return fail(res,405,'Only MCP POST requests are supported.');}
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')) return fail(res,415,'Use application/json.');
    if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity') return fail(res,415,'Compressed request bodies are not accepted.');
    const declared=req.headers['content-length'];
    if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>REQUEST_LIMIT)) return fail(res,413,'Request body is too large.');
    if(active>=8) return fail(res,503,'Service concurrency limit reached.');
    active++;
    try {
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>REQUEST_LIMIT){fail(res,413,'Request body is too large.');return;}chunks.push(chunk);}
      let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{return fail(res,400,'Invalid UTF-8 JSON request.');}
      if(!body||typeof body!=='object'||Array.isArray(body)) return fail(res,400,'A single JSON-RPC object is required.');
      await adapter(req,res,body);
    } catch {if(!res.headersSent) fail(res,500,'MCP request failed.');else res.end();}
    finally {active--;}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.timeout=30000;server.keepAliveTimeout=5000;
  server.maxConnections=32;
  return {server,config,service,
    async listen(){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{server.removeListener('error',reject);resolve();});});return server.address();},
    async close(){await handler.close();service.close();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));},
  };
}
