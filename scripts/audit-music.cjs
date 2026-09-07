// Music browser audit. All wallets, signatures and chain responses are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const puppeteer = require(
  process.env.PUPPETEER_MODULE ||
    path.join(
      process.cwd(),
      'experiments/capsule-parameterizer/node_modules/puppeteer-core',
    ),
);
const C = require('@emurgo/cardano-serialization-lib-nodejs');
const { build } = require('esbuild');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:8982/';
const origin = new URL(url).origin;
// Snap Chromium has a private /tmp namespace; use a caller-visible temporary directory.
const auditRoot = process.env.LABS_TMPDIR || path.join(os.homedir(), 'tmp');
fs.mkdirSync(auditRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(auditRoot, 'beacn-music-audit-'));
const screenshotDir = process.env.LABS_SCREENSHOTS;
const bn = (n) => C.BigNum.from_str(String(n));
const key = C.PrivateKey.generate_ed25519();
const addr = C.EnterpriseAddress.new(
  1,
  C.Credential.from_keyhash(key.to_public().hash()),
).to_address();
const value = C.Value.new(bn(20000000)),
  tokens = C.MultiAsset.new(),
  assets = C.Assets.new();
const policy = C.ScriptHash.from_hex('ab'.repeat(28)),
  asset = C.AssetName.new(Buffer.from('KEEP'));
assets.insert(asset, bn(7));
tokens.insert(policy, assets);
value.set_multiasset(tokens);
const utxo = C.TransactionUnspentOutput.new(
  C.TransactionInput.new(C.TransactionHash.from_hex('01'.repeat(32)), 0),
  C.TransactionOutput.new(addr, value),
);
const params = {
  epoch_no: 654,
  min_fee_a: 44,
  min_fee_b: 155381,
  max_tx_size: 16384,
  max_val_size: 5000,
  coins_per_utxo_size: '4310',
  key_deposit: '2000000',
  pool_deposit: '500000000',
};
const results = [];
async function click(page, text) {
  await page
    .waitForFunction(
      (t) =>
        [...document.querySelectorAll('button')].some(
          (b) =>
            (b.textContent.includes(t) ||
              b.getAttribute('aria-label')?.includes(t)) &&
            !b.disabled &&
            b.getClientRects().length,
        ),
      { timeout: 20000 },
      text,
    )
    .catch(async (error) => {
      console.error(
        'Missing visible button:',
        text,
        await page.evaluate(() => document.body.innerText),
      );
      throw error;
    });
  for (const button of await page.$$('button'))
    if (
      await button.evaluate(
        (b, t) =>
          (b.textContent.includes(t) ||
            b.getAttribute('aria-label')?.includes(t)) &&
          !b.disabled &&
          b.getClientRects().length,
        text,
      )
    ) {
      await button.evaluate((b) =>
        b.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      await button.click();
      return;
    }
}
const has = (page, text) =>
  page
    .waitForFunction(
      (t) => document.body.innerText.includes(t),
      { timeout: 20000 },
      text,
    )
    .catch(async (error) => {
      console.error(
        'Missing visible text:',
        text,
        await page.evaluate(() => document.body.innerText),
      );
      throw error;
    });
const fill = (page, selector, text) =>
  page.$eval(
    selector,
    (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        'value',
      ).set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    text,
  );
(async () => {
  await build({
    stdin: {
      contents: "export * from './lib/music-release.ts';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(tmp, 'music.mjs'),
  });
  const M = await import(pathToFileURL(path.join(tmp, 'music.mjs')).href);
  const fixture = await M.parseMusicRelease(
    fs.readFileSync('public/labs/music-demo.package.json', 'utf8'),
  );
  let expected = fixture;
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH || '/snap/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage(),
      errors = [],
      external = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.exposeFunction('__fixtureSign', (hex) => {
      const ws = C.TransactionWitnessSet.new(),
        witnesses = C.Vkeywitnesses.new();
      witnesses.add(
        C.make_vkey_witness(
          C.FixedTransaction.from_hex(hex).transaction_hash(),
          key,
        ),
      );
      ws.set_vkeys(witnesses);
      return ws.to_hex();
    });
    await page.exposeFunction('__fixtureSubmit', async (hex) => {
      try {
        const tx = C.Transaction.from_hex(hex),
          body = tx.body(),
          mint = body.mint(),
          policies = mint.keys();
        assert.equal(policies.len(), 1);
        const p = policies.get(0),
          groups = mint.get(p);
        assert.equal(groups.len(), 1);
        const quantities = groups.get(0),
          names = quantities.keys();
        assert.equal(names.len(), 1);
        assert.equal(quantities.get(names.get(0)).to_str(), '1');
        const identity = {
          policyId: p.to_hex(),
          assetName: new TextDecoder('utf-8', { fatal: true }).decode(
            names.get(0).name(),
          ),
        };
        const general = tx.auxiliary_data().metadata(),
          labels = general.keys(),
          metadata = {};
        for (let i = 0; i < labels.len(); i++) {
          const label = labels.get(i);
          metadata[label.to_str()] = JSON.parse(
            C.decode_metadatum_to_json_str(
              general.get(label),
              C.MetadataJsonSchema.NoConversions,
            ),
          );
        }
        const recovered = await M.recoverMusicRelease(metadata, identity);
        assert.deepEqual(recovered, expected);
        let coin = 0n,
          kept = 0n,
          minted = 0n;
        for (let i = 0; i < body.outputs().len(); i++) {
          const output = body.outputs().get(i),
            value = output.amount();
          assert.equal(output.address().to_hex(), addr.to_hex());
          coin += BigInt(value.coin().to_str());
          kept += BigInt(
            value.multiasset()?.get(policy)?.get(asset)?.to_str() || '0',
          );
          minted += BigInt(
            value.multiasset()?.get(p)?.get(names.get(0))?.to_str() || '0',
          );
        }
        assert.equal(coin + BigInt(body.fee().to_str()), 20000000n);
        assert.equal(kept, 7n);
        assert.equal(minted, 1n);
        assert.equal(
          C.hash_auxiliary_data(tx.auxiliary_data()).to_hex(),
          body.auxiliary_data_hash().to_hex(),
        );
        assert.ok(hex.length / 2 <= 16384);
        return {
          hash: C.FixedTransaction.from_hex(hex).transaction_hash().to_hex(),
          packageHash: recovered.packageHash,
          bytes: hex.length / 2,
        };
      } catch (error) {
        console.error('Synthetic submission validation failed:', error);
        throw error;
      }
    });
    await page.evaluateOnNewDocument(
      (wallet) => {
        window.__qa = {
          enable: 0,
          sign: 0,
          submit: 0,
          receiptWrites: 0,
          delay: false,
          storageFailure: false,
          ambiguous: false,
        };
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (
            window.__qa.storageFailure &&
            k.startsWith('nft-studio:receipt:v1:')
          )
            throw new Error('Synthetic storage failure');
          if (k.startsWith('nft-studio:receipt:v1:'))
            window.__qa.receiptWrites++;
          return setItem.call(this, k, v);
        };
        window.cardano = {
          qa: {
            name: 'Synthetic music wallet',
            apiVersion: '1',
            enable: async () => {
              window.__qa.enable++;
              return {
                getNetworkId: async () => 1,
                getChangeAddress: async () => wallet.address,
                getUtxos: async () => [wallet.utxo],
                signTx: async (hex) => {
                  window.__qa.sign++;
                  if (window.__qa.delay)
                    await new Promise((resolve) => {
                      window.__qa.release = resolve;
                    });
                  return window.__fixtureSign(hex);
                },
                submitTx: async (hex) => {
                  window.__qa.submit++;
                  const result = await window.__fixtureSubmit(hex);
                  window.__qa.last = result;
                  const receipt = JSON.parse(
                    localStorage.getItem(
                      'nft-studio:receipt:v1:' + result.hash,
                    ),
                  );
                  window.__qa.receiptBeforeSubmit =
                    receipt.signedHex === hex &&
                    receipt.musicPackageHash === result.packageHash &&
                    receipt.metadataProfile === 'cip60-v3-studio-exact-files';
                  if (window.__qa.ambiguous)
                    throw new Error('Synthetic uncertain submission response');
                  return result.hash;
                },
              };
            },
          },
        };
      },
      { address: addr.to_hex(), utxo: utxo.to_hex() },
    );
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.url().includes('koios.beacn.workers.dev/api/v1/')) {
        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        };
        if (r.method() === 'OPTIONS')
          return r.respond({ status: 204, headers });
        const body = r.url().endsWith('/tip')
          ? [
              {
                epoch_no: 654,
                abs_slot: 197151000,
                block_time: Math.floor(Date.now() / 1000),
              },
            ]
          : r.url().includes('/epoch_params')
            ? [params]
            : [];
        return r.respond({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify(body),
        });
      }
      if (
        !r.url().startsWith(origin) &&
        !r.url().startsWith('data:') &&
        !r.url().startsWith('blob:')
      ) {
        external.push(r.url());
        return r.abort();
      }
      return r.continue();
    });
    const entry = new URL(url);
    entry.search = '?view=labs&lab=music';
    async function fresh() {
      await page.goto(entry.href, { waitUntil: 'networkidle0' });
      await has(page, 'The recording. The credits.');
    }
    async function demo() {
      await click(page, 'Try a one-second original');
      await page.waitForSelector('[data-music-hash]');
    }
    async function walletReview() {
      await click(page, 'Review with my wallet');
      await click(page, 'Synthetic music wallet');
      await click(page, 'Build the review');
      await has(page, 'Music credits in this transaction');
      await page.waitForSelector('.ns-file-mint .ns-check input');
    }
    const cdp = await page.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: tmp,
    });
    async function exported(name) {
      const file = path.join(tmp, name);
      for (let i = 0; i < 80 && !fs.existsSync(file); i++)
        await new Promise((resolve) => setTimeout(resolve, 100));
      return file;
    }
    await fresh();
    await demo();
    assert.equal(
      await page.$eval('[data-music-hash]', (e) => e.textContent),
      fixture.packageHash,
    );
    await click(page, 'Build music package');
    await page.waitForSelector('[data-music-hash]');
    assert.equal(
      await page.$eval('[data-music-hash]', (e) => e.textContent),
      fixture.packageHash,
      'Rebuilding unchanged imported content must preserve its exact package',
    );
    assert.equal(await page.evaluate(() => window.__qa.enable), 0);
    await click(page, 'Knowledge');
    await page.waitForSelector('#knowledge-query', { visible: true });
    await click(page, 'Music release');
    await page.waitForSelector('[data-music-hash]', { visible: true });
    assert.equal(
      await page.$eval('[data-music-hash]', (e) => e.textContent),
      fixture.packageHash,
    );
    assert.equal(
      await page.$eval('#music-artist-0-0', (e) => e.value),
      fixture.tracks[0].song.artists[0].name,
    );
    assert.equal(await page.evaluate(() => window.__qa.enable), 0);
    results.push('Music files, credits and package survive visiting another Lab without wallet access');
    await click(page, 'Export music package');
    const packageFile = await exported('Signal-One.music-release.json');
    assert.deepEqual(
      await M.parseMusicRelease(fs.readFileSync(packageFile, 'utf8')),
      fixture,
    );
    assert.deepEqual(
      Buffer.from(fs.readFileSync(packageFile)),
      Buffer.from(await M.musicReleaseBytes(fixture)),
    );
    const audioButton = (await page.$$('.ns-music-select button'))[1];
    await audioButton.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await audioButton.click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('iframe')].some(
        (e) => e.title === 'Exact file preview',
      ),
    );
    results.push(
      'Original audio/cover package opens without wallet calls and exports canonical exact bytes',
    );
    const malformed = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    malformed.tracks[0].song.artists[0].name = 'Changed without checksum';
    const badFile = path.join(tmp, 'bad.music.json');
    fs.writeFileSync(badFile, JSON.stringify(malformed));
    await (await page.$('[data-music-import]')).uploadFile(badFile);
    await page.waitForSelector('[data-music-release] [role=alert]');
    assert.equal(await page.$('[data-music-hash]'), null);
    await (await page.$('[data-music-import]')).uploadFile(packageFile);
    await page.waitForSelector('[data-music-hash]');
    await fill(page, '#music-artist-0-0', 'BEACN Browser Audit');
    assert.equal(await page.$('[data-music-hash]'), null);
    await click(page, 'Build music package');
    await page.waitForSelector('[data-music-hash]');
    assert.notEqual(
      await page.$eval('[data-music-hash]', (e) => e.textContent),
      fixture.packageHash,
    );
    // Export under a unique title so an existing download cannot mask a stale result.
    await fill(page, '#music-title', 'Browser Credit Revision');
    await click(page, 'Build music package');
    await page.waitForSelector('[data-music-hash]');
    await click(page, 'Export music package');
    expected = await M.parseMusicRelease(
      fs.readFileSync(
        await exported('Browser-Credit-Revision.music-release.json'),
        'utf8',
      ),
    );
    assert.equal(
      expected.tracks[0].song.artists[0].name,
      'BEACN Browser Audit',
    );
    results.push(
      'Changed credits invalidate the previous package; malformed replacements clear previous success',
    );
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(screenshotDir, 'music-desktop.png'),
        fullPage: true,
      });
      await page.setViewport({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: path.join(screenshotDir, 'music-mobile.png'),
        fullPage: true,
      });
      await page.setViewport({ width: 1440, height: 1000 });
    }
    await walletReview();
    assert.ok(
      (await page.$eval('.ns-file-mint', (e) => e.innerText)).includes(
        'BEACN Browser Audit',
      ),
    );
    await (await page.$('.ns-file-mint .ns-check input')).click();
    await click(page, 'Sign & submit');
    await has(page, 'Submitted · awaiting inclusion');
    const successful = await page.evaluate(() => ({
      ...window.__qa,
      receipts: Object.entries(localStorage)
        .filter(([k]) => k.startsWith('nft-studio:receipt:v1:'))
        .map(([, v]) => JSON.parse(v)),
    }));
    assert.equal(successful.sign, 1);
    assert.equal(successful.submit, 1);
    assert.equal(successful.receiptBeforeSubmit, true);
    const receipt = successful.receipts.find(
      (r) => r.hash === successful.last.hash,
    );
    assert.equal(receipt.musicPackageHash, expected.packageHash);
    fs.writeFileSync(
      path.join(tmp, 'music-browser.receipt.json'),
      JSON.stringify(receipt, null, 2),
    );
    results.push(
      'Actual synthetic signed metadata recovers all credits/files and conserves ADA, unrelated assets and one minted token; receipt exists before submission',
    );
    await page.keyboard.press('Escape');
    await click(page, 'Activity');
    async function recoverFile(name, data) {
      const file = path.join(tmp, name);
      fs.writeFileSync(
        file,
        typeof data === 'string' ? data : JSON.stringify(data),
      );
      await (await page.$('[data-recovery-import]')).uploadFile(file);
    }
    await recoverFile('reported-confirmed.receipt.json', {
      ...receipt,
      state: 'confirmed',
      checkedAt: Date.now(),
      blocksAfterInclusion: 12,
    });
    await page.waitForSelector('[data-music-recovery]');
    assert.match(
      await page.$eval('[data-music-receipt-state]', (e) => e.textContent),
      /Receipt reports: confirmed/,
    );
    assert.equal(
      await page.$('.ns-recovery-grid > section:first-child > .ns-notice'),
      null,
      'Imported status cannot create chain confirmation UI',
    );
    assert.ok(
      (
        await page.$eval('[data-music-recovery]', (e) => e.textContent)
      ).includes(expected.packageHash),
    );
    if (screenshotDir) {
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: width === 390 ? 844 : 1000 });
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.screenshot({
          path: path.join(screenshotDir, `music-receipt-${width}.png`),
          fullPage: true,
        });
      }
      await page.setViewport({ width: 1440, height: 1000 });
    }
    const recoveredDirectory = path.join(tmp, 'recovered');
    fs.mkdirSync(recoveredDirectory);
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: recoveredDirectory,
    });
    await click(page, 'Export music package');
    const recoveredExport = path.join(
      recoveredDirectory,
      'Browser-Credit-Revision.music-release.json',
    );
    for (let i = 0; i < 80 && !fs.existsSync(recoveredExport); i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(
      await M.parseMusicRelease(fs.readFileSync(recoveredExport, 'utf8')),
      expected,
    );
    const stripped = { ...receipt };
    for (const field of [
      'metadataProfile',
      'musicPackageHash',
      'metadata',
      'prepared',
    ])
      delete stripped[field];
    await recoverFile('stripped.receipt.json', stripped);
    await page.waitForSelector('[data-music-recovery]');
    assert.ok(
      (
        await page.$eval('[data-music-recovery]', (e) => e.textContent)
      ).includes(expected.packageHash),
    );
    await recoverFile('unsigned.review.json', {
      schema: 'nft-studio.review.v1',
      ...receipt.prepared,
    });
    await page.waitForSelector('[data-music-recovery]');
    const changedReceipt = JSON.parse(JSON.stringify(receipt));
    changedReceipt.prepared.musicRelease.tracks[0].song.artists[0].name =
      'False receipt artist';
    await recoverFile('changed-credits.receipt.json', changedReceipt);
    await page.waitForSelector('.ns-recovery-grid [role=alert]');
    assert.equal(await page.$('[data-music-recovery]'), null);
    const duplicate =
      JSON.stringify(receipt).slice(0, -1) +
      ',"hash":' +
      JSON.stringify(receipt.hash) +
      '}';
    await recoverFile('duplicate.receipt.json', duplicate);
    await page.waitForSelector('.ns-recovery-grid [role=alert]');
    assert.equal(await page.$('[data-music-recovery]'), null);
    await recoverFile(
      'standalone.music.json',
      new TextDecoder().decode(await M.musicReleaseBytes(expected)),
    );
    await page.waitForSelector('[data-music-recovery]');
    assert.match(
      await page.$eval('[data-music-recovery]', (e) => e.textContent),
      /Transaction binding was not checked/,
    );
    const ordinary = JSON.parse(
      fs.readFileSync('public/labs/signal-demo.receipt.json', 'utf8'),
    );
    ordinary.largeOrdinarySidecar = 'x'.repeat(600000);
    await recoverFile('large-ordinary.receipt.json', ordinary);
    await has(page, 'Recovered from an imported file.');
    assert.equal(await page.$('[data-music-recovery]'), null);
    assert.equal(await page.$('.ns-recovery-grid [role=alert]'), null);
    results.push(
      'Activity checks actual signed/unsigned music CBOR, detects stripped sidecars, rejects altered credits and duplicate JSON, keeps reported confirmation separate, and preserves large ordinary imports',
    );
    await fresh();
    await demo();
    await walletReview();
    await page.evaluate(() => {
      window.__qa.delay = true;
    });
    await (await page.$('.ns-file-mint .ns-check input')).click();
    await click(page, 'Sign & submit');
    await page.waitForFunction(() => typeof window.__qa.release === 'function');
    // Simulate a component revision during an outstanding wallet Promise.
    await fill(page, '#music-artist-0-0', 'Changed during wallet prompt');
    await page.evaluate(() => {
      window.__qa.release();
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await page.evaluate(() => window.__qa.submit), 0);
    assert.equal(await page.$('[data-music-hash]'), null);
    results.push(
      'A credit revision during the outstanding wallet prompt unmounts its review and prevents submission',
    );
    await fresh();
    await demo();
    await walletReview();
    await page.evaluate(() => { window.__qa.delay = true; });
    await (await page.$('.ns-file-mint .ns-check input')).click();
    await click(page, 'Sign & submit');
    await page.waitForFunction(() => typeof window.__qa.release === 'function');
    // Exercise a parent tab change while an external wallet Promise is pending.
    await page.evaluate(() => {
      [...document.querySelectorAll('.ns-lab-tablist [role="tab"]')]
        .find((tab) => tab.textContent === 'Knowledge').click();
    });
    await page.waitForSelector('#knowledge-query', { visible: true });
    await page.waitForSelector('.ns-file-mint', { hidden: true });
    await page.evaluate(() => { window.__qa.release(); });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await page.evaluate(() => window.__qa.submit), 0);
    assert.equal(await page.evaluate(() => window.__qa.receiptWrites), 0);
    await click(page, 'Music release');
    await page.waitForSelector('[data-music-hash]', { visible: true });
    assert.equal(
      await page.$eval('[data-music-hash]', (e) => e.textContent),
      fixture.packageHash,
    );
    results.push('Leaving Music cancels an outstanding wallet review while preserving the exact draft for return');
    await fresh();
    await demo();
    await walletReview();
    await page.evaluate(() => {
      window.__qa.storageFailure = true;
    });
    await (await page.$('.ns-file-mint .ns-check input')).click();
    await click(page, 'Sign & submit');
    await has(page, 'Synthetic storage failure');
    assert.equal(await page.evaluate(() => window.__qa.submit), 0);
    results.push(
      'A receipt storage failure stops before the submission attempt',
    );
    expected = fixture;
    await fresh();
    await demo();
    await walletReview();
    await page.evaluate(() => {
      window.__qa.ambiguous = true;
    });
    await (await page.$('.ns-file-mint .ns-check input')).click();
    await click(page, 'Sign & submit');
    await has(page, 'Submission response unclear');
    assert.equal(await page.evaluate(() => window.__qa.submit), 1);
    assert.equal(
      await page.evaluate(() => window.__qa.receiptBeforeSubmit),
      true,
    );
    results.push(
      'An uncertain submission response stays unknown and is attempted once',
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      JSON.stringify(
        {
          status: 'pass',
          results,
          pageErrors: errors,
          externalRequests: external,
          fixtureDirectory: tmp,
          realWallet: false,
          realSubmission: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
