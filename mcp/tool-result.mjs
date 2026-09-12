import {mobileTerminalMessage} from './terminal-qr.mjs';

export function jsonToolResult(output) {
  // Keep the original first JSON block for existing clients and machine readers.
  const content = [{type:'text', text:JSON.stringify(output)}];
  if (output?.schema === 'nft-studio.mobile-handoff.v1')
    content.push({type:'text', text:mobileTerminalMessage(output)});
  return {content, structuredContent:output};
}
