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
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: 'reduce',
        }),
        page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const r = await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(r.status(), 200);
      await page.locator('.al-agent-tabs').waitFor();
      assert.equal(await page.locator('.ns-app').count(), 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert(
        await page
          .locator('.al-sculpture img')
          .evaluate((i) => i.complete && i.naturalWidth === 1024),
      );
      await page
        .getByRole('button', { name: 'Claude Code', exact: true })
        .click();
      assert.match(await page.locator('.al-step pre').innerText(), /\nclaude$/);
      await page
        .getByRole('button', { name: 'Other agents', exact: true })
        .click();
      assert.doesNotMatch(
        await page.locator('.al-step pre').innerText(),
        /\n(?:codex|claude)$/,
      );
      await page.getByRole('button', { name: 'Codex', exact: true }).click();
      assert.match(await page.locator('.al-step pre').innerText(), /\ncodex$/);
      for (const [label, expected] of [
        ['Games', 'Something you can actually play.'],
        ['Music', 'An idea with a sound of its own.'],
        ['Useful things', 'A collectible that does something.'],
        ['Art', 'A world only you could imagine.'],
      ]) {
        await page.getByRole('button', { name: label, exact: true }).click();
        assert.equal(
          await page.locator('.al-example-copy h3').innerText(),
          expected,
        );
      }
      // Exercise clipboard success deterministically without changing the user's clipboard.
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
        .getByRole('button', { name: 'Copy commands', exact: true })
        .click();
      assert.match(
        await page.evaluate(() => window.__copied),
        /^git clone https:\/\/github.com\/BEACNpool\/NFT-Studio.git\ncd NFT-Studio\ncodex$/,
      );
      await page
        .getByRole('button', { name: 'Copy first prompt', exact: true })
        .click();
      assert.match(
        await page.evaluate(() => window.__copied),
        /^Read START_HERE.md/,
      );
      await page.locator('.al-questions summary').first().click();
      assert(
        (await page
          .locator('.al-questions details')
          .first()
          .getAttribute('open')) !== null,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${output}/${name}-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      results.push({
        browser: name,
        width,
        landing: true,
        agentTabs: true,
        prompts: true,
        clipboard: true,
        overflow: false,
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
