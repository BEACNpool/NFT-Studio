import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createService } from '../dist/server.mjs';
import { createHttpService } from '../dist/http.mjs';
import { createUnsignedPreparers, createUnsignedPreparer, createPreparationGate, LIMITS } from '../dist/public-unsigned.mjs';
import { createPublicMcpHandler, protocolFixture } from './workerd-helper.mjs';
import { loadMusicToolFixture } from '../integration/verify-music-tools.mjs';
import { assertSyntheticMusicUnsigned, canonicalMusicJson } from '../integration/verify-music-unsigned.mjs';
import { syntheticNativeFixture, assertSyntheticUnsigned } from '../integration/verify-synthetic-native.mjs';
import { address, utxo } from './wallet-fixtures.mjs';
import { PUBLIC_TOOL_NAMES, NODE_TOOL_NAMES } from '../integration/tool-names.mjs';

const TOOL = 'prepare_unsigned_music_transaction';
const token = 'music-unsigned-local-test-token-00000000000000000000000';
const origin = 'https://music-unsigned.example.org';
const bn = n => C.BigNum.from_str(String(n));
const checked = raw => { assert.ok(!raw.isError, raw.content?.[0]?.text); return raw.structuredContent || JSON.parse(raw.content[0].text); };
const call = (client, name, args = {}) => client.callTool({ name, arguments: args });
const unwrapped = async (client, name, args) => checked(await call(client, name, args));
const parity = value => { const clone = structuredClone(value); delete clone.preparedAt; delete clone.protocol.fetchedAt; return clone; };
const parsedProtocol = quote => ({ epoch: quote.tip.epoch_no, slot: quote.tip.abs_slot, blockTime: quote.tip.block_time, fetchedAt: Date.now(), maxTx: quote.parameters.max_tx_size, maxValue: quote.parameters.max_val_size, feeA: quote.parameters.min_fee_a, feeB: quote.parameters.min_fee_b, coinsPerByte: String(quote.parameters.coins_per_utxo_size), keyDeposit: String(quote.parameters.key_deposit), poolDeposit: String(quote.parameters.pool_deposit) });
async function nodeContext(era = 'auto', options = {}) {
  const quote = protocolFixture(), reads = [];
  const service = createService({ protocol: () => { reads.push('ordinary'); return parsedProtocol(quote); }, musicProtocolProvider: signal => { assert.ok(signal instanceof AbortSignal); reads.push('music'); return structuredClone(quote); }, ...options });
  const http = createHttpService({ port: 0, token, service }), port = (await http.listen()).port;
  const client = new Client({ name: 'music-unsigned-node', version: '1.0.0' }, { versionNegotiation: { mode: era } });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers: { authorization: 'Bearer ' + token } } }));
  return { client, quote, reads, service, close: async () => { await client.close(); await http.close(); } };
}
async function workerContext(era = 'auto') {
  const handler = await createPublicMcpHandler({ publicOrigin: origin, endpointPath: '/api/mcp' });
  const client = new Client({ name: 'music-unsigned-worker', version: '1.0.0' }, { versionNegotiation: { mode: era } });
  await client.connect(new StreamableHTTPClientTransport(new URL(origin + '/api/mcp'), { fetch: (url, init) => handler.dispatchFetch(url, init) }));
  return { client, quote: handler.quote, handler, close: async () => { await client.close(); await handler.close(); } };
}
function assertFixedReads(calls) {
  assert.ok(calls.every(r => r.method === 'GET' && r.body === '' && r.authorization === null && [
    'https://koios.beacn.workers.dev/api/v1/tip', 'https://koios.beacn.workers.dev/api/v1/epoch_params?order=epoch_no.desc&limit=1',
  ].includes(r.url)), 'No wallet/package/credit bytes go to protocol or declared-link endpoints');
}
async function rejected(client, name, args, pattern) {
  const result = await call(client, name, args); assert.equal(result.isError, true, 'Unexpected accepted input');
  if (pattern) assert.match(result.content.map(c => c.text || '').join(' '), pattern); return result;
}
async function musicRequest(client, args = loadMusicToolFixture().args, wallet = syntheticNativeFixture('nft').wallet) {
  const packageResult = await unwrapped(client, 'create_music_release', args);
  return { packageResult, request: { packetJson: packageResult.packetJson, wallet }, fixture: { args, wallet } };
}
async function ordinaryRequest(client, mode = 'nft', wallet = syntheticNativeFixture('nft').wallet) {
  const fixture = syntheticNativeFixture(mode), packet = await unwrapped(client, 'create_mint_intent', fixture.args);
  return { intent: packet.intent, wallet };
}
function walletWithEmptyAndBinaryNames() {
  const wallet = syntheticNativeFixture('nft').wallet, original = C.TransactionUnspentOutput.from_hex(wallet.utxos[0]);
  const amount = original.output().amount(), multi = amount.multiasset(), policy = multi.keys().get(0), assets = multi.get(policy);
  assets.insert(C.AssetName.new(new Uint8Array()), bn(3)); assets.insert(C.AssetName.new(Uint8Array.from([255, 0, 254])), bn(5));
  multi.insert(policy, assets); amount.set_multiasset(multi);
  return { ...wallet, utxos: [C.TransactionUnspentOutput.new(original.input(), C.TransactionOutput.new(original.output().address(), amount)).to_hex()] };
}

test('Stateless Music works in Node and Workerd in both SDK eras with direct metadata/asset/hash checks and exact parity', async () => {
  for (const era of ['auto', 'legacy']) {
    const worker = await workerContext(era), node = await nodeContext(era, { musicProtocolProvider: () => structuredClone(worker.quote) });
    try {
      assert.deepEqual((await node.client.listTools()).tools.map(t => t.name).sort(), NODE_TOOL_NAMES);
      assert.deepEqual((await worker.client.listTools()).tools.map(t => t.name).sort(), PUBLIC_TOOL_NAMES);
      const args = loadMusicToolFixture().args;
      args.tracks[0].song.artists[0].links = { site: 'https://credits.invalid/never-fetch' };
      args.tracks[0].song.authors = [{ name: 'Declared author A', share: '33.33%' }, { name: 'Declared author B', share: '66.67%' }];
      const { packageResult, request, fixture } = await musicRequest(node.client, args);
      const direct = createUnsignedPreparers(C, { protocolProvider: async () => structuredClone(worker.quote) });
      let firstWorker;
      // Use the same trusted quote to make Node adapter/Worker bytes comparable.
      for (const wallet of [fixture.wallet, { changeHex: address().to_hex(), utxos: [utxo(2, { coin: 1500000, tokens: 3 }), utxo(3, { coin: 1500000, key: 'cd' })] }, { changeHex: address().to_hex(), utxos: [utxo(4, { tokens: 512 })] }, walletWithEmptyAndBinaryNames()]) {
        const actual = await unwrapped(worker.client, TOOL, { ...request, wallet }), expected = await direct.prepareMusic({ ...request, wallet });
        assert.deepEqual(parity(actual), parity(expected));
        if (wallet === fixture.wallet) firstWorker = actual;
        assertSyntheticMusicUnsigned(actual, packageResult, { ...fixture, wallet });
      }
      const nodeResult = await unwrapped(node.client, TOOL, request);
      assert.deepEqual(parity(nodeResult), parity(firstWorker), 'Actual Node HTTP and Workerd SDK responses agree');
      assertSyntheticMusicUnsigned(nodeResult, packageResult, fixture);
      assert.equal(node.service.packetCount(), 0);
      const caps = await unwrapped(node.client, 'studio_capabilities');
      assert.equal(caps.musicUnsignedPreparation.serverState, 'none'); assert.equal(caps.musicUnsignedPreparation.limits.utxos, 32);
      assert.equal(caps.musicUnsignedPreparation.sharesOrdinaryPreparationConcurrency, true);
      assert.equal(caps.limits.walletUtxos, 128); assert.equal(caps.limits.packetTtlSeconds, 240);
      assert.equal(caps.musicReleases.transactionPreparation, false, 'Package-only tools keep their original contract');
      assert.equal(worker.handler.calls.length, 8); assertFixedReads(worker.handler.calls);
    } finally { await node.close(); await worker.close(); }
  }
});

test('Node Music uses the actual fixed protocol reader without disclosing package, credits, addresses or inputs', async () => {
  const originalFetch = globalThis.fetch, quote = protocolFixture(), calls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://koios.beacn.workers.dev/')) {
      const request = new Request(url, init); calls.push({ url: request.url, method: request.method, authorization: request.headers.get('authorization'), body: await request.text() });
      assertFixedReads(calls); return Response.json([request.url.endsWith('/tip') ? quote.tip : quote.parameters]);
    }
    const destination = new URL(typeof url === 'string' || url instanceof URL ? url : url.url);
    assert.ok(destination.protocol === 'http:' && destination.hostname === '127.0.0.1', 'No external test fetch other than the intercepted fixed provider');
    return originalFetch(url, init);
  };
  let ctx;
  try {
    ctx = await nodeContext('auto', { musicProtocolProvider: undefined });
    const args = loadMusicToolFixture().args; args.tracks[0].song.artists[0].links = { site: 'https://private-credit.invalid/never-request' };
    const music = await musicRequest(ctx.client, args);
    assert.equal(calls.length, 0);
    const prepared = await unwrapped(ctx.client, TOOL, music.request);
    assertSyntheticMusicUnsigned(prepared, music.packageResult, music.fixture);
    assert.equal(calls.length, 2); assertFixedReads(calls); assert.equal(ctx.service.packetCount(), 0);
  } finally { if (ctx) await ctx.close(); globalThis.fetch = originalFetch; }
});

test('Four pinned ordinary public response baselines remain byte-identical including every output field', async () => {
  const baseline = JSON.parse(await readFile(new URL('./fixtures/ordinary-stateless-before-music.json', import.meta.url)));
  assert.equal(baseline.baselineModuleSha256, '8490f503e9480c2858bc9faf1292aebcb38017cc979cdc6afe0efbed458699af');
  assert.equal(baseline.cases.length, 4); const clock = Date.now;
  try {
    Date.now = () => baseline.fixedClockMs;
    const prepare = createUnsignedPreparer(C, { protocolProvider: () => structuredClone(baseline.quote) });
    for (const fixture of baseline.cases) {
      const result = await prepare(fixture.request);
      assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'), fixture.responseJsonSha256, fixture.name);
      assert.equal(createHash('sha256').update(Buffer.from(result.unsignedHex, 'hex')).digest('hex'), fixture.unsignedHexSha256, fixture.name);
      assert.equal(result.unsignedBytes, fixture.unsignedBytes);
    }
  } finally { Date.now = clock; }
});

test('Malformed Music packages, overrides and wallet CBOR fail in both runtimes before provider reads', async () => {
  for (const connect of [nodeContext, workerContext]) {
    const ctx = await connect();
    try {
      const { request, packageResult } = await musicRequest(ctx.client), pkg = packageResult.musicRelease;
      const requests = [
        { ...request, packetJson: pkg }, { ...request, packetJson: packageResult.packetJson + '\n' },
        { ...request, packetJson: JSON.stringify(pkg, null, 2) },
        { ...request, packetJson: '{"packageHash":"bad",' + packageResult.packetJson.slice(1) },
        { ...request, packetJson: canonicalMusicJson({ ...pkg, packageHash: '00'.repeat(32) }) },
        { ...request, packetJson: canonicalMusicJson({ ...pkg, release: { ...pkg.release, release_title: 'Uncommitted changed credit' } }) },
        { ...request, packetJson: canonicalMusicJson({ ...pkg, extra: true }) },
        { ...request, packetJson: ' '.repeat(80001) },
        ...['policyId', 'assetName', 'protocol', 'provider', 'url', 'path', 'recipient', 'mintQuantity', 'intent', 'prepared'].map(name => ({ ...request, [name]: 'override' })),
        { ...request, wallet: { ...request.wallet, extra: 'no' } },
        { ...request, wallet: { ...request.wallet, utxos: [] } },
        { ...request, wallet: { ...request.wallet, utxos: Array.from({ length: 33 }, (_, i) => utxo(i + 10)) } },
        { ...request, wallet: { ...request.wallet, changeHex: address('ab', 0).to_hex() } },
        { ...request, wallet: { ...request.wallet, changeHex: address('ab', 1, true).to_hex() } },
        ...[{ network: 0 }, { script: true }, { special: 'datum' }, { special: 'inline' }, { special: 'reference' }].map(options => ({ ...request, wallet: { ...request.wallet, utxos: [utxo(4, options)] } })),
        { ...request, wallet: { ...request.wallet, utxos: [utxo(7), utxo(7, { coin: 21000000 })] } },
        ...['00', 'ff', '9bffffffffffffffff', '5a7fffffff', 'c0'.repeat(20) + '00', utxo(8) + '00', '9802' + utxo(8).slice(2), '00'.repeat(16385)].map(value => ({ ...request, wallet: { ...request.wallet, utxos: [value] } })),
        { ...request, wallet: { ...request.wallet, utxos: Array(3).fill('00'.repeat(15300)) } },
        { ...request, wallet: { ...request.wallet, utxos: Array.from({ length: 4 }, (_, i) => utxo(30 + i, { tokens: 1, policies: 127, assetBytes: 32 })) } },
        { ...request, wallet: { ...request.wallet, utxos: [utxo(50, { tokens: 513 })] } },
      ];
      for (const args of requests) await rejected(ctx.client, TOOL, args);
      assert.equal((ctx.reads || ctx.handler.calls).length, 0);
      const good = await unwrapped(ctx.client, TOOL, request); assert.equal(good.musicPackageHash, pkg.packageHash);
      if (ctx.handler) assertFixedReads(ctx.handler.calls); else assert.equal(ctx.service.packetCount(), 0);
    } finally { await ctx.close(); }
  }
});

test('Credit-only changes alter committed identity; Node ordinary cache and its verifier cannot be replaced by stateless Music', async () => {
  const ctx = await nodeContext();
  try {
    const original = await musicRequest(ctx.client), args = structuredClone(original.fixture.args);
    args.tracks[0].song.artists[0].name = 'Longer artist credit after review';
    const changed = await musicRequest(ctx.client, args);
    const first = await unwrapped(ctx.client, TOOL, original.request), second = await unwrapped(ctx.client, TOOL, changed.request);
    assert.equal(first.musicRelease.bundle.sha256, second.musicRelease.bundle.sha256);
    for (const key of ['musicPackageHash', 'transactionHash', 'auxiliaryDataHash', 'unsignedHex', 'feeLovelace']) assert.notEqual(first[key], second[key], key);
    assert.notEqual(first.asset.assetNameHex, second.asset.assetNameHex);
    assertSyntheticMusicUnsigned(first, original.packageResult, original.fixture); assertSyntheticMusicUnsigned(second, changed.packageResult, changed.fixture);
    assert.equal(ctx.service.packetCount(), 0); const reads = ctx.reads.length;
    for (const request of [first, { ...first, witnessSetHex: 'a0', wallet: original.request.wallet }, { packetId: first.transactionHash, witnessSetHex: 'a0', wallet: original.request.wallet }, { packetId: '00000000-0000-4000-8000-000000000001', witnessSetHex: 'a0', wallet: original.request.wallet }])
      await rejected(ctx.client, 'verify_signed_transaction', request);
    assert.equal(ctx.reads.length, reads, 'Stateless packets reject before provider reads');
    const ordinary = await ordinaryRequest(ctx.client, 'nft', { changeHex: address().to_hex(), utxos: Array.from({ length: 33 }, (_, i) => utxo(i + 100)) });
    const stored = await unwrapped(ctx.client, 'prepare_unsigned_transaction', ordinary);
    assert.equal(stored.schema, 'nft-studio.unsigned.v1'); assert.ok(stored.packetId); assert.equal(ctx.service.packetCount(), 1);
    await rejected(ctx.client, TOOL, { packetJson: original.request.packetJson, wallet: ordinary.wallet });
    await rejected(ctx.client, 'prepare_unsigned_transaction', { intent: original.packageResult.musicRelease, wallet: original.request.wallet });
    assert.equal(ctx.service.packetCount(), 1);
  } finally { await ctx.close(); }
});

test('Node ordinary and Music share two preparation slots without changing ordinary packet capacity or expiry', async () => {
  let release, started = 0; const held = new Promise(resolve => { release = resolve; }), quote = protocolFixture();
  const ctx = await nodeContext('auto', {
    protocol: async () => { started++; await held; return parsedProtocol(quote); },
    musicProtocolProvider: async () => { started++; await held; return structuredClone(quote); },
  });
  try {
    const music = await musicRequest(ctx.client), ordinary = await ordinaryRequest(ctx.client);
    const a = unwrapped(ctx.client, TOOL, music.request), b = unwrapped(ctx.client, 'prepare_unsigned_transaction', ordinary);
    for (let i = 0; started < 2 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(started, 2);
    await rejected(ctx.client, TOOL, music.request, /concurrency/i);
    await rejected(ctx.client, 'prepare_unsigned_transaction', ordinary, /concurrency/i);
    assert.equal(started, 2); release(); await Promise.all([a, b]); assert.equal(ctx.service.packetCount(), 1);
    // Music never occupies or evicts one of the 64 ordinary retained packets.
    for (let i = 1; i < 64; i++) await unwrapped(ctx.client, 'prepare_unsigned_transaction', ordinary);
    assert.equal(ctx.service.packetCount(), 64);
    await unwrapped(ctx.client, TOOL, music.request); assert.equal(ctx.service.packetCount(), 64);
    const before = started; await rejected(ctx.client, 'prepare_unsigned_transaction', ordinary, /capacity/i); assert.equal(started, before);
    const clock = Date.now; try { Date.now = () => clock() + 241000; assert.equal(ctx.service.packetCount(), 0); } finally { Date.now = clock; }
    await unwrapped(ctx.client, TOOL, music.request); assert.equal(ctx.service.packetCount(), 0);
  } finally { release(); await ctx.close(); }
});

test('Workerd ordinary and Music share one two-slot limit and release it after errors and completion', async () => {
  const ctx = await workerContext();
  try {
    const music = await musicRequest(ctx.client), ordinary = await ordinaryRequest(ctx.client);
    ctx.handler.setScenario('delay');
    const a = unwrapped(ctx.client, TOOL, music.request), b = unwrapped(ctx.client, 'prepare_unsigned_transaction', ordinary);
    for (let i = 0; ctx.handler.calls.length < 4 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(ctx.handler.calls.length, 4);
    await rejected(ctx.client, TOOL, music.request, /concurrency/i);
    await rejected(ctx.client, 'prepare_unsigned_transaction', ordinary, /concurrency/i);
    assert.equal(ctx.handler.calls.length, 4); await Promise.all([a, b]);
    ctx.handler.setScenario('malformed'); await rejected(ctx.client, TOOL, music.request, /Malformed/);
    ctx.handler.setScenario('normal'); await unwrapped(ctx.client, TOOL, music.request);
    assertFixedReads(ctx.handler.calls);
  } finally { await ctx.close(); }
});

function largeMusicArgs() {
  const args = loadMusicToolFixture().args, samples = 8500, wav = Buffer.alloc(44 + samples);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(samples, 24); wav.writeUInt32LE(samples, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(samples, 40); wav.fill(128, 44);
  args.files[1] = { name: 'silence.wav', mediaType: 'audio/wav', base64: wav.toString('base64') }; args.tracks[0].fileName = 'silence.wav'; return args;
}
test('Music uses metadata and complete transaction limits separately and rejects stale/malformed fixed protocol responses', async () => {
  const ctx = await workerContext();
  try {
    const music = await musicRequest(ctx.client);
    for (const scenario of ['stale', 'epoch', 'invalid-parameter', 'low-max-tx', 'high-fee', 'unavailable', 'redirect', 'oversize', 'declared-oversize', 'invalid-utf8', 'malformed']) {
      ctx.handler.setScenario(scenario); await rejected(ctx.client, TOOL, music.request);
    }
    ctx.handler.setScenario('normal');
    const large = await musicRequest(ctx.client, largeMusicArgs());
    assert.ok(large.packageResult.budget.metadataBytesAt32ByteAssetName < 14000);
    const compact = await unwrapped(ctx.client, TOOL, large.request); assertSyntheticMusicUnsigned(compact, large.packageResult, large.fixture);
    const fragmented = { changeHex: address().to_hex(), utxos: Array.from({ length: 32 }, (_, i) => utxo(100 + i, { coin: 100000, key: (i + 1).toString(16).padStart(2, '0') })) };
    await rejected(ctx.client, TOOL, { ...large.request, wallet: fragmented }, /size|limit|16,384/i);
    await rejected(ctx.client, TOOL, { ...music.request, wallet: { ...music.request.wallet, utxos: [utxo(200, { coin: 500000 })] } }, /fund|ADA|change/i);
    assertFixedReads(ctx.handler.calls);
  } finally { await ctx.close(); }
});

test('Pure Music entry snapshots inert inputs before awaits, shares the ordinary gate, and releases timed-out slots', async () => {
  const ctx = await nodeContext();
  try {
    const music = await musicRequest(ctx.client), ordinary = await ordinaryRequest(ctx.client);
    const quote = protocolFixture(); let reads = 0, callbacks = 0;
    const gate = createPreparationGate(), preparers = createUnsignedPreparers(C, { preparationGate: gate, protocolProvider: signal => { reads++; assert.ok(signal instanceof AbortSignal); return quote; } });
    for (const value of [Object.defineProperty({}, 'packetJson', { enumerable: true, get() { callbacks++; return music.request.packetJson; } }), { ...music.request, wallet: Object.create(music.request.wallet) }, { ...music.request, wallet: { ...music.request.wallet, utxos: Object.assign([...music.request.wallet.utxos], { extra: true }) } }])
      await assert.rejects(preparers.prepareMusic(value));
    assert.equal(callbacks, 0); assert.equal(reads, 0);
    const mutable = structuredClone(music.request), pending = preparers.prepareMusic(mutable);
    mutable.packetJson = '{}'; mutable.wallet.changeHex = address('cd').to_hex(); mutable.wallet.utxos[0] = '00';
    const actual = await pending; assertSyntheticMusicUnsigned(actual, music.packageResult, music.fixture);
    const compatibility = createUnsignedPreparer(C, { protocolProvider: () => quote });
    const first = await compatibility(ordinary), second = await preparers.prepareOrdinary(ordinary);
    assert.deepEqual(parity(first), parity(second)); assertSyntheticUnsigned(first, ordinary.intent, syntheticNativeFixture('nft'));
    const timeout = createUnsignedPreparers(C, { preparationGate: gate, protocolProvider: () => new Promise(() => {}) });
    const began = Date.now(); await assert.rejects(timeout.prepareMusic(music.request), /timed out/);
    assert.ok(Date.now() - began >= LIMITS.providerTimeoutMs - 50); assert.ok(Date.now() - began < LIMITS.providerTimeoutMs + 3000);
    assert.equal((await preparers.prepareMusic(music.request)).musicPackageHash, music.packageResult.packageHash);
  } finally { await ctx.close(); }
});

test('Independent Music assertions reject altered identity, credits, values and recomputed auxiliary/body claims', async () => {
  const ctx = await nodeContext();
  try {
    const music = await musicRequest(ctx.client), valid = await unwrapped(ctx.client, TOOL, music.request);
    assertSyntheticMusicUnsigned(valid, music.packageResult, music.fixture);
    for (const change of [v => v.musicPackageHash = '00'.repeat(32), v => v.musicRelease.release.release_title = 'Changed', v => v.metadata['721'][v.asset.policyId][Buffer.from(v.asset.assetNameHex, 'hex').toString()].release.release_title = 'Changed', v => v.outputs[0].lovelace = '0', v => v.requiredPaymentKeyHashes = [], v => v.asset.quantity = '2', v => v.packetId = '00000000-0000-4000-8000-000000000001']) {
      const altered = structuredClone(valid); change(altered); assert.throws(() => assertSyntheticMusicUnsigned(altered, music.packageResult, music.fixture));
    }
    for (const kind of ['metadata', 'fee', 'asset']) {
      const altered = structuredClone(valid), tx = C.Transaction.from_hex(valid.unsignedHex), original = tx.body(), outputs = C.TransactionOutputs.new();
      for (let i = 0; i < original.outputs().len(); i++) {
        const old = original.outputs().get(i), amount = old.amount();
        if (kind === 'asset' && amount.multiasset()?.get(C.ScriptHash.from_hex('cd'.repeat(28)))) {
          const multi = amount.multiasset(), policy = C.ScriptHash.from_hex('cd'.repeat(28)), assets = multi.get(policy), name = C.AssetName.new(Buffer.from('KEEP'));
          assets.insert(name, bn(6)); multi.insert(policy, assets); amount.set_multiasset(multi);
        }
        const out = C.TransactionOutput.new(old.address(), amount); outputs.add(out);
        altered.outputs[i].valueCborHex = amount.to_hex(); altered.outputs[i].lovelace = amount.coin().to_str();
        altered.outputs[i].minimumLovelace = C.min_ada_for_output(out, C.DataCost.new_coins_per_byte(bn(valid.protocol.coinsPerByte))).to_str();
      }
      const body = C.TransactionBody.new_tx_body(original.inputs(), outputs, bn(BigInt(original.fee().to_str()) + (kind === 'fee' ? 1n : 0n)));
      body.set_ttl(original.ttl_bignum()); body.set_mint(original.mint());
      let aux = tx.auxiliary_data();
      if (kind === 'metadata') {
        const row = altered.metadata['721'][altered.asset.policyId][Buffer.from(altered.asset.assetNameHex, 'hex').toString()]; row.release.release_title = 'Altered actual credit';
        const metadata = C.GeneralTransactionMetadata.new(); metadata.insert(bn(721), C.encode_json_str_to_metadatum(JSON.stringify(altered.metadata['721']), C.MetadataJsonSchema.NoConversions)); aux = C.AuxiliaryData.new(); aux.set_metadata(metadata);
      }
      body.set_auxiliary_data_hash(C.hash_auxiliary_data(aux)); const packet = C.Transaction.new(body, tx.witness_set(), aux);
      altered.unsignedHex = packet.to_hex(); altered.unsignedBytes = packet.to_bytes().length; altered.bodyHex = body.to_hex(); altered.transactionHash = C.FixedTransaction.from_hex(packet.to_hex()).transaction_hash().to_hex(); altered.auxiliaryDataHash = packet.body().auxiliary_data_hash().to_hex(); altered.feeLovelace = body.fee().to_str();
      assert.throws(() => assertSyntheticMusicUnsigned(altered, music.packageResult, music.fixture), undefined, kind);
    }
  } finally { await ctx.close(); }
});
