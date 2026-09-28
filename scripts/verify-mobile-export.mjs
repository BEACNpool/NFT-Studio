/** Browser QA for the exported phone page. Set STUDIO_MOBILE_HTML to a fresh export. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=await readFile(process.env.STUDIO_MOBILE_HTML,'utf8');
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const blocked of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.addInitScript(({blocked})=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(blocked)throw Error('Clipboard blocked');window.copiedUrl=value;}}}),{blocked});
   const page=await context.newPage();
   await page.goto(pathToFileURL(process.env.STUDIO_MOBILE_HTML).href);
   const url=await page.locator('#creation-url').inputValue();
   assert(url.includes('#transfer=v1.'));
   assert.equal(await page.getByRole('link',{name:'Open in wallet browser',exact:true}).getAttribute('href'),'web+cardano://browse/v1?uri='+encodeURIComponent(url));
   await page.getByRole('button',{name:'Copy URL',exact:true}).click();
   await page.waitForFunction(()=>document.getElementById('copy-status').textContent.length>0);
   if(blocked)assert.equal(await page.locator('#creation-url').evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd)),url);
   else assert.equal(await page.evaluate(()=>window.copiedUrl),url);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(process.env.STUDIO_CHECK_LIVE==='1'){
    await page.goto(url);
    await page.getByRole('button',{name:'Copy URL',exact:true}).waitFor({timeout:30000});
    await page.getByRole('button',{name:'Copy URL',exact:true}).click();
    if(!blocked)await page.waitForFunction(u=>window.copiedUrl===u,url);
    else assert.equal(await page.getByRole('textbox',{name:'Creation URL',exact:true}).inputValue(),url);
   }
   await context.close();
  }
 }finally{await browser.close();}
}
assert(html.includes('Paste this into a dApp browser'));
console.log('PASS: Chromium + WebKit phone layout, exact deep link, clipboard success/fallback'+(process.env.STUDIO_CHECK_LIVE==='1'?', live receiving page and repeat browser hops':''));
