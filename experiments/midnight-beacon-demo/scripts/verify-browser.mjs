/** Local browser fixture only. Does not connect to the Studio service or a wallet. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
const home=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(resolve(process.argv[2],'package.json'));
const puppeteer=req('puppeteer-core');
const profile=await mkdtemp(resolve(homedir(),'tmp/midnight-beacon-browser-'));
const browser=await puppeteer.launch({executablePath:'/snap/bin/chromium',headless:'new',userDataDir:profile,args:['--no-sandbox','--disable-gpu']});
const rows=[],errors=[],requests=[];
try{
 for(const width of [390,1440]){
  const page=await browser.newPage();await page.setViewport({width,height:width===390?844:900,deviceScaleFactor:1});await page.setRequestInterception(true);
  page.on('request',r=>{const url=r.url();if(/^https?:/.test(url)){requests.push(url);if(new URL(url).origin!=='http://127.0.0.1:8926'){r.abort();return;}}r.continue();});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:8926/',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('#audio').readyState>=2&&document.querySelector('#cover').naturalWidth>0);
  const before=await page.evaluate(()=>({paused:audio.paused,currentTime:audio.currentTime,coverWidth:document.querySelector('#cover').naturalWidth,coverHeight:document.querySelector('#cover').naturalHeight,overflow:document.documentElement.scrollWidth>innerWidth,preview:window.preview,displayedPackageHash:document.querySelector('#hash').textContent.replace('PACKAGE SHA-256 / ','')}));
  assert.equal(before.paused,true);assert.equal(before.currentTime,0);assert.equal(before.preview.started,false);assert.equal(before.overflow,false);assert.equal(await page.$eval('#hash',el=>el.textContent),'PACKAGE SHA-256 / '+JSON.parse(await readFile(resolve(home,'midnight-beacon.music-release.json'),'utf8')).packageHash);
  await page.screenshot({path:resolve(home,`evidence/preview-${width}-initial.png`),fullPage:true});
  await page.click('#play');await page.waitForFunction(()=>window.preview.ended&&window.preview.decoder,{timeout:12000});
  const after=await page.evaluate(()=>({...window.preview,currentTime:audio.currentTime,mediaDuration:audio.duration,paused:audio.paused,readyState:audio.readyState,canPlayType:audio.canPlayType('audio/ogg; codecs="opus"'),overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(after.playClicks,1);assert.equal(after.started,true);assert.equal(after.ended,true);assert.equal(after.error,undefined);assert.equal(after.paused,true);assert.equal(after.overflow,false);
  assert.equal(after.decoder.duration,8);assert.ok(after.decoder.rms>.05);assert.equal(after.decoder.clipped,0);assert.ok(after.decoder.peak<1);assert.equal(after.decoder.channels,1);
  const downloads=await mkdtemp(resolve(homedir(),'tmp/midnight-beacon-download-'));const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await page.click('#download');let saved;for(let i=0;i<50;i++){try{saved=await readFile(resolve(downloads,'midnight-beacon.music-release.json'));break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(saved);assert.deepEqual(saved,await readFile(resolve(home,'midnight-beacon.music-release.json')));after.downloadedCanonicalPacketExact=true;after.downloadedPacketSha256=createHash('sha256').update(saved).digest('hex');
  rows.push({width,height:width===390?844:900,before,after});await page.close();
 }
 assert.equal(errors.length,0,errors.join('\n'));assert.ok(requests.every(url=>new URL(url).origin==='http://127.0.0.1:8926'));
 const report={schema:'beacn.original-music-browser-check.v1',status:'PASS',checkedAt:new Date().toISOString(),browser:await browser.version(),packageHash:JSON.parse(await readFile(resolve(home,'midnight-beacon.music-release.json'),'utf8')).packageHash,pageSha256:createHash('sha256').update(await readFile(resolve(home,'index.html'))).digest('hex'),viewports:rows,requests:requests.map(u=>new URL(u).pathname),externalNetworkRequests:0,pageErrors:errors,playback:'Actual HTMLAudioElement time advancement to ended after Puppeteer click; WebAudio decode and finite nonclipped PCM checked. Headless playback is not a human listening review.',limits:['Local preview tested in Chromium only, not all wallets/players/browsers.','No subjective listening judgment or confirmed NFT claim.']};
 await writeFile(resolve(home,'evidence/browser-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
