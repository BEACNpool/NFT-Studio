// Run against the static Pages export as well as the development server.
// Uses a fresh browser, no wallet, and no blockchain requests.
const assert = require('node:assert/strict');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:8924/';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(url, { waitUntil: 'networkidle2' });
    assert.equal(
      await page.$$eval('[data-slot^="sidebar"]', (els) => els.length),
      0,
    );
    assert.equal(await page.$$eval('.ns-mode', (els) => els.length), 8);
    assert.equal(
      await page.$$eval('.ns-app-nav button', (els) => els.length),
      4,
    );
    await page.locator('.ai-manual summary').click();
    await page.$eval('.ns-mode-art', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.locator('.ns-mode-art').click();
    await page.locator('::-p-text(Start with a blank canvas)').click();
    await page.locator('.ns-workbench-footer .ns-primary').click();
    const input = '.ns-detail-fields input';
    await page.waitForSelector(input);
    await page.focus(input);
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.type(input, 'Keep this unsaved creation');
    for (const view of ['projects', 'showcase']) {
      await page.locator('.ns-app-nav [data-view="' + view + '"]').click();
    }
    await page.locator('.ns-help-button').click();
    await page.waitForSelector('.ns-guide');
    for (const selector of ['.ns-gallery', '.ns-empty', input]) {
      await page.goBack();
      await page.waitForSelector(selector, { visible: true });
    }
    assert.equal(
      await page.$eval(input, (el) => el.value),
      'Keep this unsaved creation',
    );
    await page.goForward();
    await page.waitForSelector('.ns-empty', { visible: true });
    await page.locator('.ns-app-nav [data-view="create"]').click();
    assert.equal(
      await page.$eval(input, (el) => el.value),
      'Keep this unsaved creation',
    );
    assert.equal(new URL(page.url()).searchParams.get('create'), 'art');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS static app navigation: no sidebar, eight formats, four tabs, browser Back/Forward and tab switching preserve unsaved artwork. No wallet used.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
