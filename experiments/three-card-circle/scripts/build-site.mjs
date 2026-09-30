// Run from the repository root. Card SVGs are the exact NFT metadata artwork.
import {build} from 'esbuild';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const dir='experiments/three-card-circle/archive/showcase';
const deployment=JSON.parse(readFileSync(`${dir}/deployment.json`,'utf8'));
const active=deployment.status==='active'&&deployment.deployment?.network==='Mainnet';
for (const [query,family] of [['Arial','Arial'],['Arial:style=Bold','Arial'],['Georgia','Georgia'],['Georgia:style=Italic','Georgia'],['monospace','monospace']]) {
  const path=execFileSync('fc-match',['--format=%{file}',query],{encoding:'utf8'}).trim();
  if (!GlobalFonts.registerFromPath(path,family)) throw Error(`Could not load ${family}`);
}
await build({entryPoints:['experiments/three-card-circle/scripts/chain-reader.mjs'],outfile:`${dir}/chain-reader.js`,bundle:true,format:'esm',minify:true,platform:'browser',target:'es2022',legalComments:'inline'});
const canvas=createCanvas(1200,630),ctx=canvas.getContext('2d');
ctx.fillStyle='#121413';ctx.fillRect(0,0,1200,630);
ctx.fillStyle='#f4f4ed';ctx.font='bold 30px Arial';ctx.fillText('NFT-STUDIO',64,70);
ctx.fillStyle='#b8c1b4';ctx.font='16px monospace';ctx.fillText('BY BEACN · THE THREE-CARD CIRCLE',64,101);
ctx.fillStyle='#f4f4ed';ctx.font='bold 79px Arial';ctx.fillText('Three cards.',58,238);ctx.fillText('One small',58,322);
ctx.fillStyle='#d8ff70';ctx.font='italic 89px Georgia';ctx.fillText('circle.',58,409);
ctx.font='23px Arial';ctx.fillStyle='#b8c1b4';ctx.fillText('Collect the circle. Then open it.',64,468);
for(const [i,x,y,angle] of [[1,633,186,-10],[2,798,148,1],[3,960,190,10]]){
 const img=await loadImage(readFileSync(`${dir}/card-0${i}.svg`));
 ctx.save();ctx.translate(x+100,y+140);ctx.rotate(angle*Math.PI/180);
 ctx.shadowColor='#0008';ctx.shadowBlur=25;ctx.shadowOffsetY=12;
 ctx.drawImage(img,-100,-140,200,280);ctx.restore();
}
ctx.strokeStyle='#394134';ctx.beginPath();ctx.moveTo(64,531);ctx.lineTo(1136,531);ctx.stroke();
ctx.fillStyle='#d8ff70';ctx.font='17px monospace';ctx.fillText(active?'CARDANO · LIVE ON MAINNET':'CARDANO · MAINNET ACTIVATION PENDING',64,574);
ctx.fillStyle='#b8c1b4';ctx.textAlign='right';ctx.font='17px Arial';ctx.fillText('beacnpool.github.io/NFT-Studio',1136,574);
writeFileSync(`${dir}/social.png`,canvas.toBuffer('image/png'));
console.log('Built the read-only chain reader and 1200 × 630 sharing image.');
