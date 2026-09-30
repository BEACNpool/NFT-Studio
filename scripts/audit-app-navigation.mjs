// Playwright equivalent of the retained Puppeteer navigation audit.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.STUDIO_URL||'http://127.0.0.1:41881/NFT-Studio/?view=create';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.goto(url,{waitUntil:'networkidle'});
 assert.equal(await page.locator('[data-slot^="sidebar"]').count(),0);assert.equal(await page.locator('.ns-mode').count(),8);assert.equal(await page.locator('.ns-app-nav button').count(),4);
 await page.locator('.ai-manual summary').click();await page.locator('.ns-mode-art').click();
 await page.getByRole('button',{name:/Start with a blank canvas/}).click();
 await page.locator('.ns-workbench-footer .ns-primary').click();const input=page.locator('.ns-detail-fields input:not([aria-hidden])');await input.fill('Keep this unsaved creation');
 for(const view of ['projects','showcase'])await page.locator(`.ns-app-nav [data-view="${view}"]`).click();
 await page.locator('.ns-help-button').click();await page.locator('.ns-guide').waitFor({state:'visible'});
 for(const selector of ['.ns-gallery','.ns-empty','.ns-detail-fields input:not([aria-hidden])']){await page.goBack();await page.locator(selector).waitFor({state:'visible'});}
 assert.equal(await input.inputValue(),'Keep this unsaved creation');await page.goForward();await page.locator('.ns-empty').waitFor({state:'visible'});
 await page.locator('.ns-app-nav [data-view="create"]').click();assert.equal(await input.inputValue(),'Keep this unsaved creation');assert.equal(new URL(page.url()).searchParams.get('create'),'art');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: static Back/Forward and tabs preserve unsaved artwork; no wallet used.');
}finally{await browser.close();}
