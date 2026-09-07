import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createService } from './server.mjs';
import { createHttpService } from './http.mjs';
import { REQUEST_LIMIT } from './schemas.mjs';
async function main() {
  const args=process.argv.slice(2);
  if(args.some(x=>x!=='--http')||args.length>1) throw new Error('Usage: node mcp/dist/cli.mjs [--http]');
  if(args.includes('--http')) {
    const http=createHttpService({
      host:process.env.MCP_BIND||'127.0.0.1',port:process.env.MCP_PORT===undefined?8787:Number(process.env.MCP_PORT),
      token:process.env.MCP_AUTH_TOKEN,
      allowedHosts:(process.env.MCP_ALLOWED_HOSTS||'').split(',').filter(Boolean),
      allowedOrigins:(process.env.MCP_ALLOWED_ORIGINS||'').split(',').filter(Boolean),
    });
    const address=await http.listen();
    console.error(`NFT Studio MCP listening on loopback port ${address.port}; bearer authentication required.`);
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void http.close().then(()=>process.exit(0)));
  } else {
    const service=createService();
    const transport=new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:REQUEST_LIMIT});
    const handle=serveStdio(service.factory,{transport,maxSubscriptions:0,onerror:()=>{}});
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{service.close();void handle.close().then(()=>process.exit(0));});
    process.stdin.once('end',()=>{service.close();void handle.close();});
  }
}
main().catch(()=>{console.error('NFT Studio MCP failed to start. Check the documented command and required HTTP settings.');process.exitCode=1;});
