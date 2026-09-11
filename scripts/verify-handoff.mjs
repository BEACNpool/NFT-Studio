// Synthetic artwork only. Real Workerd/D1; no wallet, signing or chain requests.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { loadImage, createCanvas } from '@napi-rs/canvas';
const temp = await mkdtemp(join(tmpdir(), 'studio-handoff-'));
let runtime;
try {
  await build({
    entryPoints: [
      'lib/studio-handoff.ts',
      'lib/studio-payload.ts',
      'lib/studio-intent.ts',
    ],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: temp,
    logLevel: 'error',
  });
  const H = await import(pathToFileURL(join(temp, 'studio-handoff.js')));
  const P = await import(pathToFileURL(join(temp, 'studio-payload.js')));
  const I = await import(pathToFileURL(join(temp, 'studio-intent.js')));
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#baaaff"/></svg>';
  const bundle = await P.preparePayloadBundle({
    name: 'Robot at the ATM',
    description: 'Synthetic transfer fixture.',
    files: [
      {
        name: 'robot.svg',
        mediaType: 'image/svg+xml',
        bytes: new TextEncoder().encode(svg),
      },
    ],
    coverIndex: 0,
  });
  const intent = await I.createMintIntent(bundle, 'nft');
  const { sealed, key } = await H.sealIntent(intent);
  assert.deepEqual(await H.unsealIntent(sealed, key), intent);
  const second = await H.sealIntent(intent);
  assert.notEqual(second.key, key);
  assert.notEqual(second.sealed.iv, sealed.iv);
  assert.ok(!JSON.stringify(sealed).includes('Robot'));
  console.log(
    'PASS exact canonical creation survives encryption; fresh keys and nonces',
  );
  await assert.rejects(H.unsealIntent(sealed, second.key), /verified/);
  const bad = H.decode64(sealed.ciphertext);
  bad[3] ^= 1;
  await assert.rejects(
    H.unsealIntent({ ...sealed, ciphertext: H.encode64(bad) }, key),
    /verified/,
  );
  assert.throws(() => H.verifySealedIntent({ ...sealed, extra: true }));
  assert.throws(() =>
    H.verifySealedIntent({ ...sealed, ciphertext: 'A'.repeat(108000) }),
  );
  assert.throws(() => H.decode64(key + '='));
  console.log(
    'PASS wrong key, changed ciphertext, extra fields, oversize and noncanonical encoding reject',
  );
  const id = H.encode64(crypto.getRandomValues(new Uint8Array(16)));
  const link = H.phoneTransferUrl(id, key);
  assert.ok(link.length < 180);
  assert.equal(new URL(link).searchParams.get('lab'), 'agents');
  assert.deepEqual(H.parsePhoneTransferFragment(new URL(link).hash), {
    id,
    key,
  });
  for (const hash of [
    '#transfer=v1.nope',
    new URL(link).hash + 'x',
    '#transfer=v2.' + id + '.' + key,
  ])
    assert.throws(() => H.parsePhoneTransferFragment(hash));
  assert.throws(() => H.phoneTransferUrl(id, key, 'http://unsafe.example'));
  const png = await QRCode.toDataURL(link, {
    errorCorrectionLevel: 'M',
    width: 528,
    margin: 4,
  });
  const img = await loadImage(png),
    canvas = createCanvas(528, 528),
    ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  assert.equal(
    jsQR(ctx.getImageData(0, 0, 528, 528).data, 528, 528)?.data,
    link,
  );
  console.log(
    'PASS short HTTPS link, strict versioned parser and independent QR decoder',
  );
  const worker = await build({
    stdin: {
      contents:
        "import {handleHandoff} from './server/handoff.ts'; export default {fetch: handleHandoff};",
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
    script: worker.outputFiles[0].text,
    d1Databases: ['DB'],
    outboundService: () => {
      throw Error('Unexpected external call.');
    },
  };
  runtime = new Miniflare(
    convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options,
  );
  const db = await runtime.getD1Database('DB');
  const sql = await readFile('drizzle/0000_dear_alex_power.sql', 'utf8');
  for (const statement of sql
    .split('--> statement-breakpoint')
    .filter((s) => s.trim()))
    await db.prepare(statement).run();
  const base = 'https://handoff.beacnpool.org/api/handoffs';
  const create = () =>
    runtime.dispatchFetch(base, {
      method: 'POST',
      headers: {
        Origin: 'https://beacnpool.github.io',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sealed),
    });
  const created = await create();
  assert.equal(created.status, 201);
  assert.equal(
    created.headers.get('Access-Control-Allow-Origin'),
    'https://beacnpool.github.io',
  );
  assert.equal(created.headers.get('cache-control'), 'no-store');
  const record = await created.json();
  assert.match(record.revokeToken, /^[A-Za-z0-9_-]{43}$/);
  const url = base + '/' + record.id;
  for (let n = 0; n < 3; n++) {
    const opened = await runtime.dispatchFetch(url);
    assert.equal(opened.status, 200);
    const data = await opened.json();
    assert.deepEqual(await H.unsealIntent(data.sealed, key), intent);
    assert.ok(!('revokeToken' in data));
    assert.ok(!('clientHash' in data));
  }
  const stored = await db
    .prepare('SELECT * FROM handoffs WHERE id = ?')
    .bind(record.id)
    .first();
  assert.ok(!JSON.stringify(stored).includes(key));
  assert.ok(!JSON.stringify(stored).includes(record.revokeToken));
  console.log(
    'PASS real Workerd/D1 create, repeat camera-to-wallet reads, no-store and secrets excluded',
  );
  assert.equal(
    (await runtime.dispatchFetch(url, { method: 'DELETE' })).status,
    401,
  );
  assert.equal(
    (
      await runtime.dispatchFetch(url, {
        method: 'DELETE',
        headers: {
          Authorization:
            'Bearer ' + H.encode64(crypto.getRandomValues(new Uint8Array(32))),
        },
      })
    ).status,
    404,
  );
  assert.equal((await runtime.dispatchFetch(url)).status, 200);
  assert.equal(
    (
      await runtime.dispatchFetch(url, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + record.revokeToken },
      })
    ).status,
    204,
  );
  assert.equal((await runtime.dispatchFetch(url)).status, 404);
  console.log(
    'PASS only creator can revoke; revocation immediately ends access',
  );
  const expiring = await (await create()).json();
  await db
    .prepare('UPDATE handoffs SET expires_at = ? WHERE id = ?')
    .bind(Date.now() - 1, expiring.id)
    .run();
  assert.equal(
    (await runtime.dispatchFetch(base + '/' + expiring.id)).status,
    404,
  );
  assert.equal((await runtime.dispatchFetch(base + '/unknown')).status, 404);
  assert.equal(
    (
      await runtime.dispatchFetch(base, {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sealed),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await runtime.dispatchFetch(base, {
        method: 'POST',
        body: 'x'.repeat(108000),
      })
    ).status,
    400,
  );
  assert.equal(
    (await runtime.dispatchFetch(base, { method: 'PUT' })).status,
    405,
  );
  const optionsResponse = await runtime.dispatchFetch(base, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://beacnpool.github.io',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(optionsResponse.status, 204);
  assert.ok(
    optionsResponse.headers
      .get('Access-Control-Allow-Headers')
      .includes('Authorization'),
  );
  console.log(
    'PASS expiry, invalid paths, hostile origins, body cap, methods and CORS preflight',
  );
  const controllers = [];
  try {
    const pending = Array.from({ length: 8 }, () => {
      const controller = new AbortController();
      controllers.push(controller);
      return runtime.dispatchFetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: new ReadableStream({
          start(stream) {
            stream.enqueue(new TextEncoder().encode('{'));
          },
        }),
        duplex: 'half',
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal((await create()).status, 429);
    assert.ok(
      (await Promise.all(pending)).every((response) => response.status === 400),
    );
    assert.equal((await create()).status, 201);
  } finally {
    for (const controller of controllers) controller.abort();
  }
  console.log(
    'PASS eight slow bodies time out and release capacity without a database write',
  );
  const requests = [];
  for (let wave = 0; wave < 4; wave++)
    requests.push(...(await Promise.all(Array.from({ length: 8 }, create))));
  assert.ok(requests.some((r) => r.status === 429));
  assert.equal(
    (await db.prepare('SELECT COUNT(*) AS count FROM handoffs').first()).count,
    20,
  );
  assert.equal(
    await db
      .prepare('SELECT id FROM handoffs WHERE id = ?')
      .bind(expiring.id)
      .first(),
    null,
  );
  console.log(
    'PASS concurrent D1 admission cap; expired rows purged and revocation cannot bypass rate limit',
  );
  console.log('HANDOFF VERIFIED: no signing, no submission, no public uploads');
} finally {
  if (runtime) await runtime.dispose();
  await rm(temp, { recursive: true, force: true });
}
