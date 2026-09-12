import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import { createPublicMcpHandler } from './workerd-helper.mjs';
import { address, utxo, payload } from './wallet-fixtures.mjs';
import { createReview } from '../create-review.mjs';
import { payloadExport } from '../payload-export.mjs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
const unpack = (r) => {
  assert(!r.isError, JSON.stringify(r));
  return r.structuredContent;
};
const opts = {
  quantity: 37,
  mintWindowHours: 168,
  traits: { Colour: 'Blue', Symbol: '🦾' },
  message: 'Meet me at the show',
};
for (const runtime of ['stdio', 'workerd'])
  test(`${runtime}: bound mint options, public payload QR and copy-forward`, async () => {
    const origin = 'https://options-test.example.org',
      worker =
        runtime === 'workerd'
          ? await createPublicMcpHandler({ publicOrigin: origin })
          : null;
    const client = new Client({ name: 'options-test', version: '1.0.0' });
    try {
      await client.connect(
        worker
          ? new StreamableHTTPClientTransport(new URL(origin + '/mcp'), {
              fetch: (u, i) => worker.dispatchFetch(u, i),
            })
          : new StdioClientTransport({
              command: process.execPath,
              args: [
                fileURLToPath(new URL('../dist/cli.mjs', import.meta.url)),
              ],
              stderr: 'pipe',
            }),
      );
      const call = async (name, args = {}) =>
        unpack(await client.callTool({ name, arguments: args }));
      const original = (
        await call('create_mint_intent', { ...payload, mode: 'nft' })
      ).intent;
      assert.equal(original.schema, 'nft-studio.intent.v1');
      const configured = (
        await call('configure_mint_options', { intent: original, ...opts })
      ).intent;
      assert.equal(configured.schema, 'nft-studio.intent.v2');
      assert.deepEqual(configured.mintOptions, opts);
      assert.notEqual(configured.intentHash, original.intentHash);
      const direct = (
        await call('create_mint_intent', {
          ...payload,
          mode: 'nft',
          mintOptions: opts,
        })
      ).intent;
      assert.deepEqual(direct, configured);
      const revised = (
        await call('configure_mint_options', {
          intent: configured,
          quantity: 1000,
        })
      ).intent;
      assert.deepEqual(revised.mintOptions, { ...opts, quantity: 1000 });
      assert.equal(
        (await call('verify_mint_intent', { intent: configured })).valid,
        true,
      );
      assert(
        (
          await client.callTool({
            name: 'verify_mint_intent',
            arguments: {
              intent: { ...configured, mintOptions: { ...opts, quantity: 38 } },
            },
          })
        ).isError,
      );
      for (const bad of [
        { quantity: 0 },
        { quantity: 1001 },
        { quantity: 1.5 },
        { mintWindowHours: 2 },
        { message: '🦾'.repeat(17) },
        { traits: { x: true } },
      ]) {
        let rejected = false;
        try {
          rejected = !!(
            await client.callTool({
              name: 'configure_mint_options',
              arguments: { intent: original, ...bad },
            })
          ).isError;
        } catch {
          rejected = true;
        }
        assert(rejected, JSON.stringify(bad));
      }
      const qr = await call('create_payload_qr', { intent: configured });
      assert.equal(qr.expiresAt, null);
      assert.equal(qr.uploads, false);
      assert.equal(qr.encrypted, false);
      const exported = await payloadExport(qr, configured),
        png = PNG.sync.read(exported['payload-qr.png']);
      assert.equal(
        jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
        qr.url,
      );
      assert.deepEqual(
        (await call('create_payload_qr', { intent: configured })).url,
        qr.url,
      );
      if (worker) {
        assert.equal(worker.calls.length, 0);
        const prepared = await call('prepare_unsigned_transaction', {
          intent: configured,
          wallet: {
            changeHex: address().to_hex(),
            utxos: [utxo(1, { tokens: 3 })],
          },
        });
        assert.equal(prepared.asset.quantity, '37');
        assert.equal(prepared.policySemantics.quantityThisTransaction, 37);
        assert.equal(
          prepared.asset.policyExpirySlot - prepared.validUntilSlot,
          168 * 3600 - 600,
        );
        const tx = C.Transaction.from_hex(prepared.unsignedHex),
          mint = tx.body().mint(),
          assets = mint.get(mint.keys().get(0)).get(0);
        assert.equal(assets.get(assets.keys().get(0)).to_str(), '37');
        assert.deepEqual(prepared.metadata['674'], { msg: [opts.message] });
        assert.deepEqual(
          prepared.metadata['721'][prepared.asset.policyId][
            Buffer.from(prepared.asset.assetNameHex, 'hex').toString()
          ].traits,
          opts.traits,
        );
        assert.equal(prepared.checks.conservation, true);
        assert.equal(prepared.signed, false);
        assert.equal(prepared.submitted, false);
      }
    } finally {
      await client.close();
      await worker?.close();
    }
  });
test('local-file helper preserves v2 options and exports independently decoded printable QR', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-payload-export-'));
  await writeFile(
    join(dir, 'cover.svg'),
    Buffer.from(payload.files[0].base64, 'base64'),
  );
  await writeFile(
    join(dir, 'request.json'),
    JSON.stringify({
      mode: 'nft',
      name: 'Print fixture',
      coverIndex: 0,
      mintOptions: opts,
      files: [
        { path: 'cover.svg', name: 'cover.svg', mediaType: 'image/svg+xml' },
      ],
    }),
  );
  const receipt = await createReview(
    join(dir, 'request.json'),
    join(dir, 'out'),
    { payloadQr: true },
  );
  assert(receipt.mcpCalls.includes('create_payload_qr'));
  const intent = JSON.parse(
    await readFile(join(dir, 'out/intent.json'), 'utf8'),
  );
  assert.deepEqual(intent.mintOptions, opts);
  assert.equal(intent.schema, 'nft-studio.intent.v2');
});
