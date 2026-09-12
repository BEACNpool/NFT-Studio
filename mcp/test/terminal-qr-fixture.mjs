import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';

// Decode the displayed glyphs, never the encoder's module matrix.
export function decodeTerminalQr(text, inverted=false) {
  const rows=text.split('\n'), columns=rows[0].length, scale=6;
  assert(rows.every(row=>row.length===columns));
  const pixels=new PNG({width:columns*scale,height:rows.length*2*scale});
  const halves={' ':[0,0],'▀':[1,0],'▄':[0,1],'█':[1,1]};
  for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++){
    const glyph=rows[Math.floor(y/(scale*2))][Math.floor(x/scale)];
    assert(halves[glyph],`Unexpected terminal character ${JSON.stringify(glyph)}`);
    const ink=halves[glyph][Math.floor(y/scale)%2];
    const value=(inverted?!ink:ink)?255:0, at=(y*pixels.width+x)*4;
    pixels.data[at]=pixels.data[at+1]=pixels.data[at+2]=value;pixels.data[at+3]=255;
  }
  return jsQR(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data;
}
