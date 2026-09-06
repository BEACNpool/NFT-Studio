// A synthetic CIP-30 provider can prepare reviews; signing/submission are disabled.
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  crypto = require('crypto');
const puppeteer = require(
  process.env.HOME + '/projects/webdev-toolkit/node_modules/puppeteer-core',
);
const url = process.argv[2] || 'http://127.0.0.1:8939/',
  out = process.argv[3] || '/tmp/bmkr-arcade-browser',
  catalog = JSON.parse(fs.readFileSync('lib/arcade-catalog.json')),
  wallet = JSON.parse(
    fs.readFileSync('/tmp/bmkr-arcade-check/browser-wallet.json'),
  );
fs.mkdirSync(out, { recursive: true });
const hash = (x) => crypto.createHash('sha256').update(x).digest('hex');
(async () => {
  const b = await puppeteer.launch({
    executablePath: '/snap/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const results = [],
    errors = [];
  try {
    for (const id of Object.keys(catalog)) {
      const page = await b.newPage();
      await page.setViewport({ width: 1440, height: 1100 });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.evaluateOnNewDocument((f) => {
        window.__qa = { enable: 0, sign: 0, submit: 0 };
        window.cardano = {
          qa: {
            name: 'QA wallet — signing disabled',
            apiVersion: '1',
            enable: async () => {
              window.__qa.enable++;
              return {
                getNetworkId: async () => 1,
                getChangeAddress: async () => f.wallet.changeHex,
                getUtxos: async () => f.wallet.utxos,
                signTx: async () => {
                  window.__qa.sign++;
                  throw Error('QA signing disabled');
                },
                submitTx: async () => {
                  window.__qa.submit++;
                  throw Error('QA submission disabled');
                },
              };
            },
          },
        };
      }, wallet.fixtures[id]);
      await page.setRequestInterception(true);
      page.on('request', (q) => {
        if (q.url().includes('koios.beacn.workers.dev/api/v1/')) {
          const data = q.url().endsWith('/tip')
            ? [
                {
                  epoch_no: 653,
                  abs_slot: 197151000,
                  block_time: Math.floor(Date.now() / 1000),
                },
              ]
            : [wallet.params];
          q.respond({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify(data),
          });
        } else q.continue();
      });
      await page.goto(url + '?game=' + id, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });
      await page.waitForSelector('#arcade-demo');
      const frame = await (await page.$('#arcade-demo')).contentFrame();
      if (id === 'starfall') await frame.waitForSelector('#seed');
      else if (id === 'ninefold')
        await frame.waitForFunction(
          () => window.NINEFOLD && !NINEFOLD.getState().busy,
        );
      else if (id === 'afterlight')
        await frame.waitForFunction(() => window.AFTERLIGHT);
      else {
        await frame.waitForFunction(() => window.ARCADE);
        assert.equal(await frame.evaluate(() => ARCADE.id), id);
      }
      assert.equal(
        hash(await page.$eval('#arcade-demo', (e) => e.srcdoc)),
        catalog[id].programSHA256,
      );
      const nav = await page.$$eval(
        'nav[aria-label="Main navigation"] button',
        (es) => es.map((e) => e.textContent),
      );
      assert.equal(nav[nav.indexOf('Utilities') + 1], 'Games');
      assert.equal(
        await page.$eval(
          'nav button[aria-current="page"]',
          (e) => e.textContent,
        ),
        'Games',
      );
      if (id === 'starfall') {
        await (await page.$('#arcade-demo')).scrollIntoView();
        await frame.click('[data-action="launch"]');
        await frame.click('[data-pick="0"]');
        await frame.click('#end');
        assert.equal(
          await frame.evaluate(() => document.body.dataset.turn),
          '2',
        );
      } else if (id === 'ninefold') {
        await (await page.$('#arcade-demo')).scrollIntoView();
        const before = await frame.evaluate(() => NINEFOLD.getState());
        const cell = before.givens.findIndex((v) => !v);
        await frame.click('#board button:nth-child(' + (cell + 1) + ')');
        await frame.click('#digits button:first-child');
        assert.equal(
          await frame.evaluate((i) => NINEFOLD.getState().board[i], cell),
          1,
        );
        await frame.click('#undo');
        assert.equal(
          await frame.evaluate((i) => NINEFOLD.getState().board[i], cell),
          0,
        );
      } else if (id === 'afterlight') {
        await (await page.$('#arcade-demo')).scrollIntoView();
        const before = await frame.evaluate(() => AFTERLIGHT.snapshot());
        await frame.click('[data-move="0,0"]');
        assert.equal(
          await frame.evaluate(() => AFTERLIGHT.snapshot().t.length),
          before.t.length + 1,
        );
        await frame.click('#undo');
        assert.deepEqual(
          await frame.evaluate(() => AFTERLIGHT.snapshot()),
          before,
        );
      } else if (id === 'prismwake') {
        await frame.click('[data-tile="3"]');
      } else if (id === 'tidelock' || id === 'lastember') {
        await frame.click(
          '[data-action="' + (id === 'tidelock' ? 0 : 4) + '"]',
        );
      } else if (id === 'chess') {
        await frame.click('[data-square="52"]');
        await frame.click('[data-square="36"]');
        await frame.waitForFunction(
          () => ARCADE.snapshot().moves >= 2 && !ARCADE.snapshot().busy,
        );
      } else if (id === 'checkers') {
        const move = await frame.evaluate(() => ARCADE.moves()[0]);
        for (const sq of move.split('.'))
          await frame.click('[data-square="' + sq + '"]');
        await frame.waitForFunction(
          () => ARCADE.snapshot().moves >= 2 && !ARCADE.snapshot().busy,
        );
      } else await frame.click('[data-draw]');
      if (!['starfall', 'ninefold', 'afterlight'].includes(id))
        assert(
          (await frame.evaluate(() => ARCADE.snapshot().moves)) > 0,
          'No playable move ' + id,
        );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: path.join(out, id + '-desktop.png'),
        fullPage: true,
      });
      for (const width of [320, 390, 768]) {
        await page.setViewport({ width, height: 1000 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'Page overflow ' + id + ' ' + width,
        );
        assert(
          await frame.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'Game overflow ' + id + ' ' + width,
        );
        if (width === 390) await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: path.join(out, id + '-' + width + '.png'),
          fullPage: true,
        });
      }
      await page.setViewport({ width: 1440, height: 1100 });
      assert.equal(
        await page.$eval('.arcade-about .mint-trigger', (e) => e.textContent),
        'Mint to my wallet',
      );
      await page.click('.arcade-about .mint-trigger');
      await page.waitForSelector('.mint-dialog');
      async function button(text) {
        const list = await page.$$('.mint-dialog button');
        for (const el of list)
          if ((await el.evaluate((e) => e.textContent)).includes(text)) {
            await page.waitForFunction((e) => !e.disabled, {}, el);
            await el.click();
            return;
          }
        throw Error('Button absent: ' + text);
      }
      await button('QA wallet');
      await button('Prepare on-chain preview');
      await page.waitForSelector('.mint-facts', { timeout: 30000 });
      assert.match(
        await page.$eval('.mint-dialog', (e) => e.textContent),
        new RegExp(wallet.fixtures[id].expectedSignedBytes.toLocaleString()),
      );
      await page.click('.mint-program summary');
      const exact = await page.$eval('.mint-program iframe', (e) => e.srcdoc);
      assert.equal(hash(exact), catalog[id].programSHA256);
      assert.deepEqual(await page.evaluate(() => window.__qa), {
        enable: 1,
        sign: 0,
        submit: 0,
      });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: path.join(out, id + '-mint-review.png'),
        fullPage: true,
      });
      results.push({
        id,
        gameSHA256: hash(exact),
        gamesBesideUtilities: true,
        playable: true,
        responsive: true,
        mintPrepared: true,
        estimatedSignedBytes: wallet.fixtures[id].expectedSignedBytes,
        signCalls: 0,
        submitCalls: 0,
      });
      await page.close();
    }
    const p = await b.newPage();
    await p.goto(url, { waitUntil: 'networkidle2' });
    await p.waitForSelector('.image-entry');
    const games = (await p.$$('nav button'))[3];
    await games.click();
    await p.waitForSelector('.pocket-arcade');
    assert.equal(
      await p.$$eval('[data-game]', (es) => es.length),
      Object.keys(catalog).length,
    );
    await p.click('[data-game="lastember"]');
    await p.waitForFunction(
      () =>
        document
          .querySelector('[data-game="lastember"]')
          .getAttribute('aria-pressed') === 'true',
    );
    const back = (await p.$$('nav button'))[0];
    await back.click();
    await p.waitForSelector('.image-entry');
    await p.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'result.json'),
      JSON.stringify({ passed: true, url, results, errors }, null, 2),
    );
    console.log(JSON.stringify({ passed: true, results, errors }, null, 2));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
