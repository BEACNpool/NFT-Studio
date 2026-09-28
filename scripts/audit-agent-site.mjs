// Run against the prefixed static export. No wallet connection or signing.
// PLAYWRIGHT_MODULE may point at an existing installation's index.mjs.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium, firefox, webkit } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const base = process.env.STUDIO_URL || 'http://127.0.0.1:42805/NFT-Studio/';
const output = process.env.QA_OUTPUT || 'tmp/agent-site-qa';
await mkdir(output, { recursive: true });
const results = [];
for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await type.launch({ headless: true });
  try {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1440, 900],
      [1366, 768],
      [844, 390],
      [1024, 600],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      assert.equal(
        (await page.goto(base, { waitUntil: 'networkidle' })).status(),
        200,
      );
      await page.locator('.al-copy').waitFor();
      assert.equal(await page.locator('.ns-app').count(), 0);
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      }));
      assert(size.width <= width, JSON.stringify(size));
      assert(size.height <= height, JSON.stringify(size));
      assert.equal(await page.locator('.al-features li').count(), 5);
      await page.evaluate(() => {
        window.__copied = '';
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.__copied = text;
            },
          },
        });
      });
      await page
        .getByRole('button', { name: 'Copy install directions' })
        .click();
      assert.match(
        await page.evaluate(() => window.__copied),
        /Clone https:\/\/github.com\/BEACNpool\/NFT-Studio and follow START_HERE.md/,
      );
      assert.match(await page.locator('.al-copy').innerText(), /Copied/);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      );
      await page.screenshot({
        path: `${output}/${name}-${width}.png`,
        fullPage: true,
      });
      await page.evaluate(() =>
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async () => {
              throw Error('blocked');
            },
          },
        }),
      );
      await page.locator('.al-copy').click();
      const fallback = page.locator('#al-prompt');
      assert.match(
        await fallback.inputValue(),
        /set up the NFT-Studio skill for this agent/,
      );
      await page.waitForFunction(() => {
        const el = document.querySelector('#al-prompt');
        return el && el.selectionEnd - el.selectionStart === el.value.length;
      });
      assert.equal(
        await fallback.evaluate((el) => el.selectionEnd - el.selectionStart),
        (await fallback.inputValue()).length,
      );
      assert.deepEqual(errors, []);
      results.push({
        browser: name,
        width,
        height,
        oneScreen: true,
        clipboard: true,
        clipboardFallback: true,
        pageErrors: 0,
      });
      await context.close();
    }
    const context = await browser.newContext(),
      page = await context.newPage();
    await page.goto(base + 'mcp/', { waitUntil: 'networkidle' });
    await page.waitForURL((u) => u.hash === '#install');
    assert(await page.locator('#install').isVisible());
    await page.goto(base + '?view=labs&lab=agents', {
      waitUntil: 'networkidle',
    });
    await page.locator('.ns-app').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('.agent-landing').count(), 0);
    // Verify a real existing exact-content review survives the new front door.
    const intent = JSON.parse(
      await readFile('public/showcase/make-your-own/intent.json', 'utf8'),
    );
    const fragment =
      '#mint=v1.' + Buffer.from(JSON.stringify(intent)).toString('base64url');
    await page.goto(base + '?view=labs&lab=agents' + fragment, {
      waitUntil: 'networkidle',
    });
    await page.locator('.ns-app').waitFor();
    await page
      .getByText(intent.bundle.name, { exact: true })
      .first()
      .waitFor({ timeout: 15000 });
    assert(!page.url().includes('#mint='));
    if (name === 'chromium') {
      await page.goto(base + '?view=create', { waitUntil: 'networkidle' });
      await page.locator('.ai-manual summary').click();
      await page.locator('.ns-mode-art').click();
      await page
        .getByText('Start with a blank canvas', { exact: true })
        .click();
      await page.locator('.ns-workbench-footer .ns-primary').click();
      const input = page.locator('.ns-detail-fields input').first();
      await input.fill('Keep this unsaved creation');
      for (const view of ['projects', 'showcase'])
        await page.locator('.ns-app-nav [data-view="' + view + '"]').click();
      await page.locator('.ns-help-button').click();
      await page.locator('.ns-guide').waitFor();
      for (const selector of [
        '.ns-gallery',
        '.ns-empty',
        '.ns-detail-fields input',
      ]) {
        await page.goBack();
        await page.locator(selector).first().waitFor({ state: 'visible' });
      }
      assert.equal(await input.inputValue(), 'Keep this unsaved creation');
      await page.goForward();
      await page.locator('.ns-empty').waitFor();
      await page.locator('.ns-app-nav [data-view="create"]').click();
      assert.equal(await input.inputValue(), 'Keep this unsaved creation');
      results.push({ browser: name, legacyUnsavedBackForward: true });
    }
    results.push({
      browser: name,
      setupAlias: true,
      legacyReview: true,
      exactIntentPreview: true,
    });
    await context.close();
  } finally {
    await browser.close();
  }
}
await writeFile(
  output + '/results.json',
  JSON.stringify({ base, results }, null, 2),
);
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
