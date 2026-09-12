import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTerminalQr,mobileTerminalMessage} from '../terminal-qr.mjs';
import {jsonToolResult} from '../tool-result.mjs';
import {unpackResponse} from '../create-review.mjs';
import {decodeTerminalQr} from './terminal-qr-fixture.mjs';

const base='https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents#transfer=v1.';
test('terminal glyphs independently decode the complete native link on light and dark backgrounds',()=>{
  const synthetic=length=>Buffer.from(Array.from({length},(_,i)=>(i*71+19)%256)).toString('base64url');
  for(const suffix of ['A'.repeat(22)+'.'+'A'.repeat(43), synthetic(16)+'.'+synthetic(32)]){
    const url=base+suffix, qr=renderTerminalQr(url), rows=qr.terminalText.split('\n');
    assert(qr.terminalColumns<=80);assert.equal(rows.length,qr.terminalRows);
    assert(rows.every(row=>row.length===qr.terminalColumns&&!row.endsWith(' ')));
    assert.match(qr.terminalText,/^[ █▀▄\n]+$/);
    assert.equal(rows[0],'█'.repeat(qr.terminalColumns));
    assert(rows.every(row=>row.startsWith('████')&&row.endsWith('████')));
    assert.equal(decodeTerminalQr(qr.terminalText),url);
    assert.equal(decodeTerminalQr(qr.terminalText,true),url);
  }
});
test('MCP adds an unescaped terminal display without changing its first JSON block; mismatched display rejects',()=>{
  const url=base+'A'.repeat(22)+'.'+'A'.repeat(43);
  const mobile={schema:'nft-studio.mobile-handoff.v1',url,expiresAtIso:'2026-09-12T06:00:00.000Z',qr:renderTerminalQr(url)};
  const result=jsonToolResult(mobile);
  assert.equal(result.content.length,2);assert.deepEqual(JSON.parse(result.content[0].text),mobile);
  assert.equal(result.content[1].text,mobileTerminalMessage(mobile));
  assert(result.content[1].text.includes('```text\n'+mobile.qr.terminalText+'\n```'));
  assert.deepEqual(unpackResponse(result),mobile);
  const bad=structuredClone(result);bad.content[1].text+='Wrong link';assert.throws(()=>unpackResponse(bad));
  const wrong=structuredClone(mobile);wrong.qr.terminalText='bad';assert.throws(()=>unpackResponse(jsonToolResult(wrong)));
  assert.deepEqual(jsonToolResult({ok:true}),{content:[{type:'text',text:'{"ok":true}'}],structuredContent:{ok:true}});
});
