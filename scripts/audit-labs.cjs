// Browser integration audit. All wallet state, signatures and chain responses are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const C = require('@emurgo/cardano-serialization-lib-nodejs');
const { build } = require('esbuild');
const url = process.env.STUDIO_URL || 'http://127.0.0.1:8982/';
const origin = new URL(url).origin;
// Snap Chromium has a private /tmp namespace; use a caller-visible temporary directory.
const auditRoot = process.env.LABS_TMPDIR || path.join(os.homedir(), 'tmp');
fs.mkdirSync(auditRoot, { recursive: true });
const tmp = fs.mkdtempSync(path.join(auditRoot, 'beacn-labs-audit-'));
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
      contents:
        "export {createMintIntent} from './lib/studio-intent.ts'; export {preparePayloadBundle} from './lib/studio-payload.ts'; export {canonicalPassportJson} from './lib/artifact-passport.ts';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(tmp, 'fixtures.mjs'),
  });
  const { createMintIntent, preparePayloadBundle, canonicalPassportJson } =
    await import(pathToFileURL(path.join(tmp, 'fixtures.mjs')).href);
  const bundle = await preparePayloadBundle({
    name: 'Agent exact-byte test',
    description: 'Synthetic browser audit',
    files: [
      {
        name: 'message.txt',
        mediaType: 'text/plain',
        bytes: Buffer.from('\ufeffExact bytes 🦾'),
      },
    ],
  });
  const intent = await createMintIntent(bundle, 'data');
  const intentFile = path.join(tmp, 'request.json');
  fs.writeFileSync(intentFile, JSON.stringify(intent));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
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
    await page.exposeFunction('__fixtureSubmit', (hex) => {
      const fixed = C.FixedTransaction.from_hex(hex),
        tx = C.Transaction.from_hex(hex),
        body = tx.body();
      assert.equal(body.mint(), undefined);
      let ada = 0n,
        quantity = 0n;
      for (let i = 0; i < body.outputs().len(); i++) {
        const o = body.outputs().get(i);
        assert.equal(o.address().to_hex(), addr.to_hex());
        ada += BigInt(o.amount().coin().to_str());
        quantity += BigInt(
          o.amount().multiasset()?.get(policy)?.get(asset)?.to_str() || '0',
        );
      }
      assert.equal(ada + BigInt(body.fee().to_str()), 20000000n);
      assert.equal(quantity, 7n);
      assert.equal(
        C.hash_auxiliary_data(tx.auxiliary_data()).to_hex(),
        body.auxiliary_data_hash().to_hex(),
      );
      assert.ok(fixed.to_bytes().length < 16384);
      return {
        hash: fixed.transaction_hash().to_hex(),
        bytes: fixed.to_bytes().length,
        fee: body.fee().to_str(),
      };
    });
    await page.evaluateOnNewDocument(
      (wallet) => {
        window.__qa = {
          enable: 0,
          sign: 0,
          submit: 0,
          delay: false,
          afterSign: false,
        };
        window.cardano = {
          qa: {
            name: 'Synthetic Labs wallet',
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
                    await new Promise((r) => (window.__qa.release = r));
                  const result = await window.__fixtureSign(hex);
                  window.__qa.afterSign = true;
                  return result;
                },
                submitTx: async (hex) => {
                  window.__qa.submit++;
                  const result = await window.__fixtureSubmit(hex);
                  window.__qa.last = result;
                  window.__qa.receiptBeforeSubmit =
                    JSON.parse(
                      localStorage.getItem(
                        'nft-studio:receipt:v1:' + result.hash,
                      ),
                    ).signedHex === hex;
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
    page.on('request', (request) => {
      if (request.url().includes('koios.beacn.workers.dev/api/v1/')) {
        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        };
        if (request.method() === 'OPTIONS')
          return request.respond({ status: 204, headers });
        let body;
        if (request.url().endsWith('/tip'))
          body = [
            {
              epoch_no: 654,
              abs_slot: 197151000,
              block_time: Math.floor(Date.now() / 1000),
            },
          ];
        else if (request.url().includes('/epoch_params')) body = [params];
        else if (request.url().endsWith('/tx_status')) body = [];
        else return request.abort();
        return request.respond({
          status: 200,
          contentType: 'application/json',
          headers,
          body: JSON.stringify(body),
        });
      }
      if (
        !request.url().startsWith(origin) &&
        !request.url().startsWith('data:') &&
        !request.url().startsWith('blob:')
      )
        return request.abort();
      return request.continue();
    });
    const entry = new URL(url);
    entry.search = '?view=labs';
    await page.goto(entry.href, { waitUntil: 'networkidle0' });
    await has(page, 'A collectible that can evolve');
    const genesisHash = await page.$eval(
      '.ns-capsule-art .ns-hash code',
      (e) => e.textContent,
    );
    await fill(page, '#capsule-name', 'Recorded signal');
    await click(page, 'Record evolution');
    await has(page, 'Revision 1');
    assert.notEqual(
      await page.$eval('.ns-capsule-art .ns-hash code', (e) => e.textContent),
      genesisHash,
    );
    await click(page, 'Knowledge');
    await fill(page, '#knowledge-query', 'CIP188');
    await page.waitForFunction(
      () => document.querySelectorAll('.ns-kb-card').length === 2,
    );
    await page.click('.ns-kb-card');
    await has(page, 'Where enforcement happens');
    await has(page, 'Primary sources');
    assert.match(
      await page.$eval('.ns-kb-dialog', (e) => e.innerText),
      /Proposed/,
    );
    assert.ok(
      await page.$$eval('.ns-kb-dialog a', (links) =>
        links.some((a) => a.href.includes('/CIP-0188/')),
      ),
    );
    await page.keyboard.press('Escape');
    await page.waitForSelector('.ns-kb-dialog', { hidden: true });
    await fill(page, '#knowledge-query', 'CIP68');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.ns-kb-card')].some((card) =>
        card.textContent.includes('CIP-0068'),
      ),
    );
    await click(page, 'CIP-0068');
    await has(page, 'Built at BEACN');
    assert.ok(await page.$('[data-implementation="living-artifact"]'));
    await has(page, 'Independent node evaluation');
    assert.match(
      await page.$eval('.ns-kb-dialog', (e) => e.innerText),
      /This is a research entry/,
    );
    const evidenceSummary = await page.$(
      '[data-implementation="living-artifact"] summary',
    );
    await evidenceSummary.evaluate((e) =>
      e.scrollIntoView({ block: 'center' }),
    );
    await evidenceSummary.click();
    const pinned = await page.$$eval(
      '[data-implementation="living-artifact"] a',
      (links) => links.map((a) => a.href),
    );
    assert.ok(
      pinned.length > 0 &&
        pinned.every((url) =>
          /^https:\/\/github\.com\/BEACNpool\/NFT-Studio\/blob\/[0-9a-f]{40}\//.test(
            url,
          ),
        ),
    );
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({
        path: path.join(screenshotDir, 'knowledge-implementation-desktop.png'),
      });
      await page.setViewport({ width: 390, height: 844 });
      await page.$eval('.ns-kb-dialog', (e) => e.scrollTo({ top: 0 }));
      assert.ok(
        await page.$eval(
          '.ns-kb-dialog',
          (e) => e.scrollWidth <= e.clientWidth + 1,
        ),
      );
      await page.screenshot({
        path: path.join(screenshotDir, 'knowledge-implementation-mobile.png'),
      });
      await page.setViewport({ width: 1440, height: 1000 });
    }
    await page.keyboard.press('Escape');
    await page.waitForSelector('.ns-kb-dialog', { hidden: true });
    results.push(
      'Knowledge keeps research status separate from scoped BEACN implementation evidence and immutable source links',
    );
    await click(page, 'State capsule');
    await has(page, 'Revision 1');
    assert.equal(
      await page.$eval('#capsule-name', (e) => e.value),
      'Recorded signal',
    );
    await click(page, 'Freeze current state');
    await has(page, 'This history is sealed.');
    assert.equal(await page.$('button::-p-text(Record evolution)'), null);
    const cdp = await page.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: tmp,
    });
    await click(page, 'Export history');
    const exported = path.join(tmp, 'beacn-capsule-history.json');
    await page.waitForFunction(() => true);
    for (let i = 0; i < 40 && !fs.existsSync(exported); i++)
      await new Promise((r) => setTimeout(r, 100));
    const history = JSON.parse(fs.readFileSync(exported));
    assert.equal(history.states.length, 3);
    assert.equal(history.states[2].frozen, true);
    await (
      await page.$('.ns-capsule-verify input[type=file]')
    ).uploadFile(exported);
    await has(page, '3 revisions verified');
    history.states[1].metadata.name = 'Changed';
    const tampered = path.join(tmp, 'tampered.json');
    fs.writeFileSync(tampered, JSON.stringify(history));
    await (
      await page.$('.ns-capsule-verify input[type=file]')
    ).uploadFile(tampered);
    await page.waitForSelector('.ns-capsule-verify [role=alert]');
    results.push(
      'Capsule evolves, survives tab changes, freezes, exports and detects changed history; knowledge search and evidence dialog work',
    );
    await click(page, 'Proof of existence');
    const original = path.join(tmp, 'original.txt');
    fs.writeFileSync(original, 'Exact proof bytes. 🦾');
    await (await page.$('.ns-proof-lab input[multiple]')).uploadFile(original);
    await has(page, 'Digests computed locally');
    await click(page, 'Export proof JSON');
    const proofPath = path.join(tmp, 'beacn-proof-record.json');
    for (let i = 0; i < 40 && !fs.existsSync(proofPath); i++)
      await new Promise((r) => setTimeout(r, 100));
    const proof = JSON.parse(fs.readFileSync(proofPath));
    const general = C.GeneralTransactionMetadata.from_hex(
      proof.metadataCborHex,
    );
    assert.equal(general.keys().len(), 1);
    assert.equal(general.keys().get(0).to_str(), '309');
    assert.equal(general.get(bn(309)).as_list().len(), 2);
    await (await page.$('[data-proof-original]')).uploadFile(original);
    await has(
      page,
      'Every declared digest matches these exact local file bytes',
    );
    const changed = path.join(tmp, 'changed.txt');
    fs.writeFileSync(changed, 'Changed proof bytes. 🦾');
    await (await page.$('[data-proof-original]')).uploadFile(changed);
    await has(page, 'does not match every declared digest');
    await (await page.$('[data-proof-record]')).uploadFile(proofPath);
    await has(page, 'Record loaded');
    await (await page.$('[data-proof-original]')).uploadFile(original);
    await has(
      page,
      'Every declared digest matches these exact local file bytes',
    );
    assert.deepEqual(
      await page.evaluate(() => [__qa.enable, __qa.sign, __qa.submit]),
      [0, 0, 0],
    );
    results.push(
      'Proof composer exports exact raw-byte label 309; original/re-import matches and changed bytes reject without wallet access',
    );
    await click(page, 'Asset inspector');
    await page.click('form .ns-lab-details summary');
    await click(page, 'Load example');
    await click(page, 'Inspect identity');
    await has(page, 'verified label 222');
    await has(page, '000643b043415053554c45');
    await fill(page, '#asset-name', 'fffe');
    await click(page, 'Inspect identity');
    await has(page, 'Not valid UTF-8');
    results.push(
      'CIP-67 counterpart derivation and binary asset names render correctly',
    );
    await click(page, 'Agent minting');
    await (
      await page.$('.ns-lab-agent input[type=file]')
    ).uploadFile(intentFile);
    await has(page, 'Content hashes verified');
    assert.deepEqual(
      await page.evaluate(() => [__qa.enable, __qa.sign, __qa.submit]),
      [0, 0, 0],
    );
    await click(page, 'Review with my wallet');
    await click(page, 'Synthetic Labs wallet');
    await click(page, 'Build the review');
    await has(page, 'I reviewed the exact files');
    await page.$eval('.ns-check input', (e) => e.click());
    await click(page, 'Sign & submit');
    await has(page, 'awaiting inclusion');
    const qa = await page.evaluate(() => __qa);
    assert.deepEqual(
      [qa.enable, qa.sign, qa.submit, qa.receiptBeforeSubmit],
      [1, 1, 1, true],
    );
    results.push({
      agentMint:
        'Synthetic external wallet roundtrip passed with existing tokens retained',
      bytes: qa.last.bytes,
      fee: qa.last.fee,
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.ns-file-mint'));
    await click(page, 'Clear agent request');
    const broken = { ...intent, intentHash: '00'.repeat(32) };
    await fill(page, '#agent-request', JSON.stringify(broken));
    await click(page, 'Inspect request');
    await has(page, 'request hash does not match');
    assert.equal(await page.$('.ns-payload-review .ns-lab-status'), null);
    // A pending external signature must not submit after its owning panel unmounts.
    await (
      await page.$('.ns-lab-agent input[type=file]')
    ).uploadFile(intentFile);
    await has(page, 'Content hashes verified');
    await click(page, 'Review with my wallet');
    await click(page, 'Synthetic Labs wallet');
    await click(page, 'Build the review');
    await has(page, 'I reviewed the exact files');
    await page.$eval('.ns-check input', (e) => e.click());
    await page.evaluate(() => {
      __qa.delay = true;
      __qa.afterSign = false;
    });
    await click(page, 'Sign & submit');
    await page.waitForFunction(() => typeof __qa.release === 'function');
    await page.evaluate(() =>
      [...document.querySelectorAll('[role=tab]')]
        .find((e) => e.textContent === 'Knowledge')
        .click(),
    );
    await page.waitForFunction(() => !document.querySelector('.ns-lab-agent'));
    await page.evaluate(() => __qa.release());
    await page.waitForFunction(() => __qa.afterSign);
    await page.waitForNetworkIdle({ idleTime: 500 });
    assert.equal(await page.evaluate(() => __qa.submit), 1);
    results.push(
      'Changed requests reject; leaving the agent panel cancels pending-signature submission',
    );
    const beforePassport = await page.evaluate(() => [
      __qa.enable,
      __qa.sign,
      __qa.submit,
    ]);
    const receipt = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((key) =>
        key.startsWith('nft-studio:receipt:v1:'),
      );
      return JSON.parse(localStorage.getItem(key));
    });
    assert.equal(receipt.kind, 'data');
    const receiptPath = path.join(tmp, 'synthetic.receipt.json');
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    await click(page, 'Artifact passport');
    await click(page, 'Try an unminted example');
    await has(page, 'BEACN Signal — unminted demo');
    await has(page, 'never signed, submitted or confirmed');
    assert.equal(
      await page.$eval(
        '[data-passport-check="transaction-binding"]',
        (e) => e.dataset.status,
      ),
      'not-checked',
    );
    assert.equal(
      await page.$eval(
        '[data-passport-check="receipt-observation"]',
        (e) => e.dataset.status,
      ),
      'unverified',
    );
    assert.ok(
      await page.$(
        '[data-passport-demo] a[download="signal-demo.receipt.json"]',
      ),
    );
    if (screenshotDir) {
      await page.screenshot({
        path: path.join(screenshotDir, 'passport-signal-demo.png'),
        fullPage: true,
      });
    }
    await click(page, 'Clear passport');
    await (await page.$('[data-passport-receipt]')).uploadFile(receiptPath);
    await has(page, 'Local content verified');
    await page.waitForSelector(
      '[data-passport-check="transaction-binding"][data-status="match"]',
    );
    await page.waitForSelector(
      '[data-passport-check="receipt-observation"][data-status="unverified"]',
    );
    await click(page, 'Export passport');
    const passportPath = path.join(tmp, 'Agent-exact-byte-test.passport.json');
    for (let i = 0; i < 40 && !fs.existsSync(passportPath); i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    const passportText = fs.readFileSync(passportPath, 'utf8');
    const passport = JSON.parse(passportText);
    assert.equal(passportText, canonicalPassportJson(passport));
    assert.equal(passport.schema, 'beacn.artifact-passport.v1');
    assert.equal('prepared' in passport, false);
    assert.equal(passportText.includes(receipt.signedHex), false);
    await (await page.$('[data-passport-file]')).uploadFile(passportPath);
    await page.waitForSelector(
      '[data-passport-check="transaction-binding"][data-status="not-checked"]',
    );
    await (await page.$('[data-passport-transaction]')).uploadFile(receiptPath);
    await page.waitForSelector(
      '[data-passport-check="transaction-binding"][data-status="match"]',
    );
    const originalTx = C.Transaction.from_hex(receipt.signedHex);
    const wrongBody = C.TransactionBody.new_tx_body(
      originalTx.body().inputs(),
      originalTx.body().outputs(),
      bn(100),
    );
    wrongBody.set_auxiliary_data_hash(originalTx.body().auxiliary_data_hash());
    const wrongReceiptPath = path.join(tmp, 'different.receipt.json');
    fs.writeFileSync(
      wrongReceiptPath,
      JSON.stringify({
        ...receipt,
        signedHex: C.Transaction.new(
          wrongBody,
          originalTx.witness_set(),
          originalTx.auxiliary_data(),
        ).to_hex(),
      }),
    );
    await (
      await page.$('[data-passport-transaction]')
    ).uploadFile(wrongReceiptPath);
    await page.waitForSelector('.ns-passport-lab [role=alert]');
    assert.equal(
      await page.$(
        '[data-passport-check="transaction-binding"][data-status="match"]',
      ),
      null,
    );
    await (await page.$('[data-passport-transaction]')).uploadFile(receiptPath);
    await page.waitForSelector(
      '[data-passport-check="transaction-binding"][data-status="match"]',
    );
    await click(page, 'Knowledge');
    await click(page, 'Artifact passport');
    await has(page, 'Local content verified');
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({
        path: path.join(screenshotDir, 'passport-populated.png'),
        fullPage: true,
      });
    }
    const changedPassportPath = path.join(tmp, 'changed.passport.json');
    fs.writeFileSync(
      changedPassportPath,
      canonicalPassportJson({
        ...passport,
        bundle: { ...passport.bundle, name: 'Changed' },
      }),
    );
    await (
      await page.$('[data-passport-file]')
    ).uploadFile(changedPassportPath);
    await has(page, 'passport checksum differs');
    assert.equal(
      await page.$('.ns-passport-lab .ns-payload-review .ns-lab-status'),
      null,
    );
    await click(page, 'Activity');
    fs.unlinkSync(passportPath);
    await click(page, 'Export passport');
    for (let i = 0; i < 40 && !fs.existsSync(passportPath); i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(fs.readFileSync(passportPath, 'utf8'), passportText);
    await (
      await page.$('.ns-recovery-grid input[type=file]')
    ).uploadFile(passportPath);
    await has(page, 'Passport files and metadata match locally');
    await (
      await page.$('.ns-recovery-grid input[type=file]')
    ).uploadFile(changedPassportPath);
    await has(page, 'passport checksum differs');
    assert.deepEqual(
      await page.evaluate(() => [__qa.enable, __qa.sign, __qa.submit]),
      beforePassport,
    );
    results.push(
      'Passport creation, canonical export, offline re-import, optional transaction binding, stale/tampered evidence rejection and Activity export/import pass without wallet access',
    );
    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(entry.href, { waitUntil: 'networkidle0' });
      await has(page, 'A collectible that can evolve');
      for (const tab of [
        'State capsule',
        'Proof of existence',
        'Artifact passport',
        'Knowledge',
        'Asset inspector',
        'Agent minting',
      ]) {
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: 'instant' }),
        );
        await click(page, tab);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
          `Horizontal overflow at ${width}: ${tab}`,
        );
        if (screenshotDir) {
          fs.mkdirSync(screenshotDir, { recursive: true });
          await page.screenshot({
            path: path.join(
              screenshotDir,
              `${width}-${tab.replaceAll(' ', '-')}.png`,
            ),
            fullPage: true,
          });
        }
      }
    }
    assert.deepEqual(errors, []);
    results.push(
      '390px and 1440px layouts have no horizontal overflow; no browser page errors',
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(tmp, { recursive: true, force: true }));
