// Fresh test browser only. Exercises the real UI against isolated Workerd/D1.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import jsQR from 'jsqr';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const base = process.env.STUDIO_URL || 'http://localhost:33921/';
const output = resolve(process.env.AUDIT_OUTPUT || 'work/handoff-browser');
if (!process.env.INTENT_FILE)
  throw Error('Set INTENT_FILE to an exact verified request JSON.');
const intent = JSON.parse(await readFile(process.env.INTENT_FILE, 'utf8'));
await mkdir(output, { recursive: true });
const built = await build({
  stdin: {
    contents:
      "import {handleHandoff} from './server/handoff.ts'; export default {fetch:handleHandoff};",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'browser',
  format: 'esm',
  write: false,
  logLevel: 'error',
});
const options = {
  compatibilityDate: '2026-09-01',
  modules: true,
  script: built.outputFiles[0].text,
  d1Databases: ['DB'],
  outboundService: () => {
    throw Error('Unexpected relay network call');
  },
};
const mf = new Miniflare(
  convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options,
);
const db = await mf.getD1Database('DB');
for (const sql of (await readFile('drizzle/0000_dear_alex_power.sql', 'utf8'))
  .split('--> statement-breakpoint')
  .filter((s) => s.trim()))
  await db.prepare(sql).run();
const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const calls = [],
  errors = [],
  observations = [];
async function page(width, height) {
  const context = await browser.createBrowserContext();
  await context.overridePermissions(new URL(base).origin, [
    'clipboard-read',
    'clipboard-write',
    'clipboard-sanitized-write',
  ]);
  const p = await context.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: 1 });
  p.on('pageerror', (error) => errors.push(error.message));
  await p.setRequestInterception(true);
  p.on('request', async (request) => {
    const url = new URL(request.url());
    if (url.origin === 'https://handoff.beacnpool.org') {
      calls.push({ method: request.method(), path: url.pathname });
      // The published-origin CORS policy is covered by the independent API suite.
      // Only this local browser harness substitutes its test origin.
      const headers = {
        ...request.headers(),
        origin: 'https://beacnpool.github.io',
      };
      delete headers.host;
      const result = await mf.dispatchFetch(request.url(), {
        method: request.method(),
        headers,
        ...(['GET', 'HEAD', 'OPTIONS'].includes(request.method())
          ? {}
          : { body: request.postData() }),
      });
      const responseHeaders = Object.fromEntries(result.headers);
      responseHeaders['access-control-allow-origin'] = new URL(base).origin;
      await request.respond({
        status: result.status,
        headers: responseHeaders,
        body: Buffer.from(await result.arrayBuffer()),
      });
    } else if (
      url.origin === new URL(base).origin ||
      ['data:', 'blob:', 'about:'].includes(url.protocol)
    )
      await request.continue();
    else {
      errors.push('Unexpected browser request: ' + url.origin + url.pathname);
      await request.abort();
    }
  });
  return p;
}
async function click(p, text) {
  await p.waitForFunction(
    (text) =>
      Array.from(document.querySelectorAll('button')).some(
        (b) => b.textContent.trim() === text && !b.disabled,
      ),
    {},
    text,
  );
  const button = await p.evaluateHandle(
    (text) =>
      Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent.trim() === text && !b.disabled,
      ),
    text,
  );
  await button.asElement().click();
}
async function loaded(p) {
  await p.waitForFunction(
    (hash) =>
      document
        .querySelector('.ns-payload-review .ns-hash code')
        ?.textContent.trim() === hash,
    { timeout: 30000 },
    intent.intentHash,
  );
  assert.equal(new URL(p.url()).hash, '');
}
function toLocal(url) {
  const source = new URL(url),
    target = new URL(base);
  target.search = source.search;
  target.hash = source.hash;
  return target.href;
}
try {
  const desktop = await page(1440, 1000);
  const review = new URL(base);
  review.search = '?view=labs&lab=agents';
  review.hash =
    'mint=v1.' + Buffer.from(JSON.stringify(intent)).toString('base64url');
  await desktop.goto(review.href);
  await loaded(desktop);
  assert.equal(calls.length, 0);
  await click(desktop, 'Continue on phone');
  await desktop.waitForSelector('.ns-phone-dialog');
  assert.equal(calls.length, 0);
  await desktop.screenshot({ path: output + '/desktop-before.png' });
  await click(desktop, 'Create QR code');
  await desktop.waitForSelector('.ns-phone-qr', { timeout: 30000 });
  await desktop.screenshot({ path: output + '/desktop-qr.png' });
  const src = await desktop.$eval('.ns-phone-qr', (img) => img.src),
    img = await loadImage(src),
    canvas = createCanvas(img.width, img.height),
    ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const link = jsQR(
    ctx.getImageData(0, 0, img.width, img.height).data,
    img.width,
    img.height,
  ).data;
  await click(desktop, 'Copy phone link');
  await desktop.waitForFunction(() =>
    Array.from(document.querySelectorAll('button')).some(
      (b) => b.textContent.trim() === 'Link copied',
    ),
  );
  assert.equal(
    await desktop.evaluate(() => navigator.clipboard.readText()),
    link,
  );
  const record = (await db.prepare('SELECT id FROM handoffs').first()).id;
  assert.ok(link.includes(record));
  observations.push(
    'Desktop requires explicit QR creation; independent camera decode and clipboard match',
  );
  const phone = await page(390, 844);
  await phone.goto(toLocal(link));
  await loaded(phone);
  await phone.waitForSelector('.ns-phone-received a');
  const walletLink = await phone.$eval('.ns-phone-received a', (a) => a.href);
  assert.equal(
    walletLink,
    'web+cardano://browse/v1?uri=' + encodeURIComponent(link),
  );
  await phone.$eval('.ns-phone-received', (element) =>
    element.scrollIntoView({ block: 'center' }),
  );
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await phone.screenshot({ path: output + '/phone-received.png' });
  await phone.reload();
  await loaded(phone);
  observations.push(
    'Independent phone context receives exact content; hash clears; reload re-verifies; wallet link preserves full capability',
  );
  // A third independent browser context models the VESPR WebView navigation,
  // without claiming to exercise a real wallet or Android intent resolver.
  const walletView = await page(390, 844);
  await walletView.goto(toLocal(new URL(walletLink).searchParams.get('uri')));
  await loaded(walletView);
  await click(walletView, 'Review with my wallet');
  await walletView.waitForSelector('.ns-browser-help a');
  assert.equal(
    await walletView.$eval('.ns-browser-help a', (a) => a.href),
    walletLink,
  );
  await walletView.screenshot({ path: output + '/wallet-help.png' });
  observations.push(
    'Separate wallet-browser context gets same intent; mint-dialog fallback preserves creation',
  );
  const clear = await phone.$('button[aria-label="Clear agent request"]');
  await clear.click();
  assert.equal(
    await phone.evaluate(() =>
      sessionStorage.getItem('nft-studio.phone-transfer.v1'),
    ),
    null,
  );
  await phone.reload();
  await phone.waitForSelector('#agent-request');
  assert.equal(await phone.$('.ns-payload-review .ns-hash'), null);
  observations.push(
    'Clear request removes tab capability and prevents reload from reopening it',
  );
  await click(desktop, 'End transfer');
  await desktop.waitForFunction(() => !document.querySelector('.ns-phone-qr'));
  const ended = await page(360, 800);
  await ended.goto(toLocal(link));
  await ended.waitForFunction(() =>
    document
      .querySelector('[role="alert"]')
      ?.textContent.includes('expired or was ended'),
  );
  assert.equal(await ended.$('.ns-payload-review .ns-hash'), null);
  assert.equal(await ended.$('.ns-mcp-connect'), null);
  await ended.screenshot({ path: output + '/phone-ended.png' });
  observations.push(
    'Revoked link shows a prominent recovery message and cannot reach wallet review',
  );
  assert.deepEqual(errors, []);
  const report = {
    status: 'pass',
    intentHash: intent.intentHash,
    browser: await browser.version(),
    observations,
    requests: calls,
    errors,
    realWallet: false,
    signing: false,
    submission: false,
    publicRelay: false,
  };
  await writeFile(
    output + '/report.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ errors, calls, message: String(error) }));
  for (const [index, p] of (await browser.pages()).entries()) {
    await p
      .screenshot({ path: output + `/failure-${index}.png` })
      .catch(() => {});
    console.error(
      (await p.evaluate(() => document.body.innerText)).slice(0, 1800),
    );
  }
  throw error;
} finally {
  await browser.close();
  await mf.dispose();
}
