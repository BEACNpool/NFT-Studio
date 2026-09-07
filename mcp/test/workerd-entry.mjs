// Test-only bridge for Workerd, never shipped as a public entrypoint.
import * as runtime from '../dist/worker.mjs';
const {createPublicMcpHandler}=runtime;
let handler;
export default {async fetch(request,env){
  try{handler ||= createPublicMcpHandler(JSON.parse(env.FIXTURE_CONFIG));}
  catch(error){return Response.json({configurationError:error.message},{status:500});}
  if(new URL(request.url).pathname==='/__fixture_memory__')return Response.json({linearBytes:runtime.__testWasmMemoryBytes?.()});
  if(new URL(request.url).pathname==='/__fixture_reset_handler__'){await handler.close();handler=undefined;return Response.json({resetHandlerOnly:true});}
  if(new URL(request.url).pathname==='/__fixture_init__')return Response.json({ready:true});
  return handler.fetch(request);
}};
