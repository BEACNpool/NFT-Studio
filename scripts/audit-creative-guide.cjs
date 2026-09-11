// Real static-subpath UI, controlled clipboard, no wallet or chain requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:8935/NFT-Studio/';
const output = process.env.AUDIT_OUTPUT || 'creative-guide-check';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH || '/snap/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const checks = [];
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (r) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()))
          requests.push({ method: r.method(), url: r.url() });
      });
      await page.setViewport({
        width,
        height: 900,
        isMobile: width < 500,
        hasTouch: width < 500,
      });
      await page.evaluateOnNewDocument(() => {
        window.__copied = '';
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.__copied = text;
            },
          },
        });
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: undefined,
        });
      });
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.waitForSelector('[data-guide-choice="new"]');
      assert.match(
        await page.$eval('#ai-title', (e) => e.textContent),
        /Make something/,
      );
      assert.equal(
        await page.$eval('.ai-main-actions>a', (e) => new URL(e.href).pathname),
        new URL(url).pathname + 'mcp/',
      );
      const tap = async (selector) => {
        const el = await page.waitForSelector(selector, { visible: true });
        await el.evaluate((e) =>
          e.scrollIntoView({ block: 'center', behavior: 'instant' }),
        );
        await page.locator(selector).click();
      };
      const click = async (choice) =>
        tap('[data-guide-choice="' + choice + '"]');
      await click('new');
      await click('music');
      await page.waitForSelector('#ai-idea', { visible: true });
      await page.type(
        '#ai-idea',
        'A moon garden that sings when I tap a flower.',
      );
      await tap('.ai-answer button');
      await click('quiet');
      await page.waitForSelector('#ai-prompt');
      assert.match(
        await page.$eval('#ai-prompt', (e) => e.value),
        /moon garden/,
      );
      await tap('.ai-brief-actions .ai-primary');
      await page.waitForFunction(() => window.__copied.includes('moon garden'));
      assert.match(
        await page.evaluate(() => window.__copied),
        /one question at a time/,
      );
      await tap('.ai-guide-controls button:first-child');
      await tap('.ai-guide-controls button:first-child');
      assert.equal(
        await page.$eval('#ai-idea', (e) => e.value),
        'A moon garden that sings when I tap a flower.',
      );
      await tap('.ai-guide-controls button:last-child');
      await page.waitForSelector('[data-guide-choice="new"]');
      await tap(
        '.ai-original:first-child .ai-original-actions button:first-child',
      );
      await page.waitForSelector('[data-guide-choice="bold"]');
      assert.match(
        await page.$eval('.ai-inspired', (e) => e.textContent),
        /Turing Garden/,
      );
      await click('bold');
      assert.match(
        await page.$eval('#ai-prompt', (e) => e.value),
        /inspire=turing-garden/,
      );
      await tap('.ai-original:first-child .ai-share');
      await page.waitForFunction(() =>
        window.__copied.includes('?inspire=turing-garden'),
      );
      assert.equal(
        new URL(await page.evaluate(() => window.__copied)).searchParams.size,
        1,
      );
      // Clipboard unavailable keeps a manually selectable exact prompt.
      await page.evaluate(() =>
        Object.defineProperty(navigator, 'clipboard', {
          value: undefined,
          configurable: true,
        }),
      );
      await tap('.ai-brief-actions .ai-primary');
      assert.match(
        await page.$eval('.ai-notice', (e) => e.textContent),
        /Clipboard unavailable/,
      );
      assert.equal(
        await page.$eval(
          '#ai-prompt',
          (e) => e.selectionEnd - e.selectionStart,
        ),
        await page.$eval('#ai-prompt', (e) => e.value.length),
      );
      await tap('.ai-more');
      assert.equal(await page.$$eval('.ai-original', (e) => e.length), 8);
      for (const img of await page.$$('.ai-original img')) {
        await img.evaluate((e) => e.scrollIntoView());
        await page.waitForFunction(
          (e) => e.complete && e.naturalWidth > 0,
          {},
          img,
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: path.join(output, 'home-' + width + '.png'),
        fullPage: true,
      });
      const links = await page.$$eval('.ai-original-art,.ai-copy-link', (els) =>
        els.map((e) => e.href),
      );
      for (const href of links) {
        const target = new URL(href);
        assert.equal(target.origin, new URL(url).origin);
        const response = await fetch(href, {
          signal: AbortSignal.timeout(10000),
        });
        assert.equal(response.status, 200, href);
        await response.arrayBuffer();
      }
      // Shared links restore only an allowlisted inspiration choice.
      await page.goto(url + '?inspire=fourier-forge', {
        waitUntil: 'networkidle2',
      });
      assert.match(
        await page.$eval('.ai-inspired', (e) => e.textContent),
        /Fourier Forge/,
      );
      await page.goto(url + '?inspire=unknown-value', {
        waitUntil: 'networkidle2',
      });
      assert.ok(await page.$('[data-guide-choice="new"]'));
      await page.goto(url + '?view=showcase&example=afterlight', {
        waitUntil: 'networkidle2',
      });
      await page.waitForSelector('[role="dialog"]');
      assert.match(
        await page.$eval('[role="dialog"]', (e) => e.textContent),
        /AFTERLIGHT/,
      );
      await page.goto(url + 'mcp/', { waitUntil: 'networkidle2' });
      assert.match(
        await page.$eval('#commands', (e) => e.textContent),
        /npm --prefix mcp run build/,
      );
      assert.match(
        await page.$eval('#update-commands', (e) => e.textContent),
        /git pull --ff-only/,
      );
      for (const id of [
        'commands',
        'codex-commands',
        'starter-prompt',
        'update-commands',
      ]) {
        await tap('[data-copy="' + id + '"]');
        await page.waitForFunction(
          (id) =>
            window.__copied.trim() ===
            document.getElementById(id).textContent.trim(),
          {},
          id,
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: path.join(output, 'setup-' + width + '.png'),
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      checks.push({
        width,
        journey: 'pass',
        clipboard: 'copy and fallback',
        examples: 8,
        setup: 'pass',
        errors: [],
        walletOrPostRequests: 0,
      });
      await page.close();
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 740 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: path.join(output, 'home-320.png') });
    await page.setViewport({ width: 820, height: 1180 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: path.join(output, 'home-820.png') });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.evaluate(
      () => (document.documentElement.style.fontSize = '200%'),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.setJavaScriptEnabled(false);
    await page.goto(url + 'mcp/', { waitUntil: 'networkidle2' });
    assert.match(
      await page.$eval('#commands', (e) => e.textContent),
      /git clone/,
    );
    const receipt = {
      status: 'pass',
      url,
      checks,
      narrow320: true,
      tablet820: true,
      text200percent: true,
      setupNoJavascript: true,
      realWallet: false,
    };
    fs.writeFileSync(
      path.join(output, 'receipt.json'),
      JSON.stringify(receipt, null, 2) + '\n',
    );
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
