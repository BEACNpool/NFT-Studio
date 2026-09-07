/** Preflight every caller-supplied CBOR value before handing it to CSL/WASM. */
export const CBOR_LIMITS=Object.freeze({nodes:4096,depth:16,bytes:65536});
const fail=message=>{throw new Error(message);};
/** A size cap alone does not bound malicious CBOR declared collections before WASM decoding. */
export function preflightCbor(value) {
  if(typeof value!=='string'||!value.length||value.length>131072||value.length%2||!/^[a-fA-F0-9]+$/.test(value)) fail('Invalid or oversized CBOR hex.');
  const bytes=Uint8Array.from(value.match(/../g),pair=>parseInt(pair,16));
  let offset=0,nodes=0;
  function walk(depth, allowBreak=false) {
    if(++nodes>CBOR_LIMITS.nodes || depth>CBOR_LIMITS.depth || offset>=bytes.length) fail('CBOR structure exceeds the resource bound.');
    const first=bytes[offset++],major=first>>>5,additional=first&31;
    if(first===255){if(allowBreak)return false;fail('Unexpected CBOR break.');}
    let length;
    if(additional<24)length=BigInt(additional);
    else if(additional<=27){const count=2**(additional-24);if(offset+count>bytes.length)fail('Truncated CBOR argument.');length=0n;for(let i=0;i<count;i++)length=(length<<8n)|BigInt(bytes[offset++]);}
    else if(additional!==31)fail('Invalid CBOR additional information.');
    if(major<=1){if(length===undefined)fail('Invalid CBOR integer.');return true;}
    if(major===2||major===3){
      if(length===undefined)fail('Indefinite byte/text strings are not accepted in CBOR.');
      if(length>BigInt(bytes.length-offset))fail('Truncated CBOR string.');offset+=Number(length);return true;
    }
    if(major===4||major===5){
      if(length===undefined){let count=0;while(walk(depth+1,true)){count++;if(count>CBOR_LIMITS.nodes)fail('CBOR collection exceeds the resource bound.');}if(major===5&&count%2)fail('Incomplete CBOR map pair.');}
      else {const count=length*BigInt(major===5?2:1);if(count>BigInt(CBOR_LIMITS.nodes-nodes)||count>BigInt(bytes.length-offset))fail('CBOR declared collection exceeds the resource bound.');for(let i=0;i<Number(count);i++)walk(depth+1);}
      return true;
    }
    if(major===6){if(length===undefined)fail('Invalid CBOR tag.');walk(depth+1);return true;}
    if(major===7&&length!==undefined)return true;
    fail('Unsupported CBOR structure.');
  }
  walk(0);if(offset!==bytes.length)fail('Trailing bytes in CBOR.');
}
