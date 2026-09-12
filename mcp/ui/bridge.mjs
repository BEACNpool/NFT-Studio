/** Minimal SEP-1865 bridge. Only the immediate parent can answer this view. */
export function createBridge(onEvent = () => {}) {
  let sequence = 0, origin, ready = false, stopped = false;
  const pending = new Map();
  const embedded = window.parent !== window;
  const send = message => window.parent.postMessage(message,origin && origin !== 'null' ? origin : '*');
  function request(method,params) {
    if (!embedded || stopped) return Promise.reject(Error('Open this tool inside a compatible MCP Apps host. The standalone workspace remains available.'));
    const id = `beacn-${++sequence}`;
    return new Promise((resolve,reject) => {
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('The host did not answer. Your local work is retained.'));},12000);
      pending.set(id,{resolve,reject,timer});send({jsonrpc:'2.0',id,method,params});
    });
  }
  function receive(event) {
    if(stopped || event.source!==window.parent || (origin!==undefined && event.origin!==origin))return;
    const m=event.data;
    if(!m || typeof m!=='object' || m.jsonrpc!=='2.0')return;
    const p=pending.get(m.id);
    if(p && (Object.hasOwn(m,'result') || Object.hasOwn(m,'error'))){
      if(origin===undefined)origin=event.origin;
      pending.delete(m.id);clearTimeout(p.timer);
      if(m.error)p.reject(Error(typeof m.error.message==='string'?m.error.message.slice(0,300):'The host declined this action.'));
      else p.resolve(m.result);
    }else if(ready && m.method==='ui/resource-teardown'){
      send({jsonrpc:'2.0',id:m.id,result:{}});close();onEvent('teardown',{});
    }else if(ready && typeof m.method==='string')onEvent(m.method,m.params);
  }
  function close(){stopped=true;ready=false;window.removeEventListener('message',receive);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('The view was closed.'));}pending.clear();}
  window.addEventListener('message',receive);
  return {request,close,get ready(){return ready;},async connect(){
    if(!embedded)return null;
    const result=await request('ui/initialize',{appInfo:{name:'BEACN Workbench',version:'0.5.0'},appCapabilities:{availableDisplayModes:['inline']},protocolVersion:'2026-01-26'});
    if(result?.protocolVersion!=='2026-01-26')throw Error('This host uses an unsupported MCP Apps version. Use the standalone workspace.');
    ready=true;send({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}});return result;
  }};
}
