// Real CSL serialization/signature tests using only ephemeral synthetic keys and UTxOs.
// This script never connects a wallet, reads secrets, calls a network or submits a transaction.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import * as BrowserCSL from '@emurgo/cardano-serialization-lib-browser-inlined';
const temp = await mkdtemp(join(tmpdir(), 'prism-mint-verify-'));
try {
  await build({
    entryPoints: ['lib/cardano.ts', 'lib/art.ts', 'lib/onchain-art.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: temp,
    outExtension: { '.js': '.mjs' },
    external: ['@emurgo/cardano-serialization-lib-browser-inlined'],
    logLevel: 'error',
  });
  const core = await import(pathToFileURL(join(temp, 'cardano.mjs')));
  const { INITIAL } = await import(pathToFileURL(join(temp, 'art.mjs')));
  const { digestHex, onchainMetadata } = await import(
    pathToFileURL(join(temp, 'onchain-art.mjs'))
  );
  let count = 0;
  const test = async (name, fn) => {
    await fn();
    console.log('PASS', name);
    count++;
  };
  const bn = (x) => C.BigNum.from_str(String(x));
  const keyA = C.PrivateKey.generate_ed25519(),
    keyB = C.PrivateKey.generate_ed25519();
  const address = (key) =>
    C.EnterpriseAddress.new(
      1,
      C.Credential.from_keyhash(key.to_public().hash()),
    ).to_address();
  const addr = address(keyA),
    addrB = address(keyB);
  const params = {
    epoch_no: 653,
    min_fee_a: 44,
    min_fee_b: 155381,
    max_tx_size: 16384,
    max_val_size: 5000,
    coins_per_utxo_size: '4310',
    key_deposit: '2000000',
    pool_deposit: '500000000',
  };
  const live = () =>
    core.parseProtocol(
      {
        epoch_no: 653,
        abs_slot: 197042621,
        block_time: Math.floor(Date.now() / 1000) - 15,
      },
      params,
    );
  const policy = C.ScriptHash.from_hex('ab'.repeat(28)),
    oldAsset = C.AssetName.new(new TextEncoder().encode('EXISTING'));
  function utxo(n, coin, at = addr, tokens = false, datum = false) {
    const value = C.Value.new(bn(coin));
    if (tokens) {
      const ma = C.MultiAsset.new(),
        assets = C.Assets.new();
      assets.insert(oldAsset, bn(7));
      ma.insert(policy, assets);
      value.set_multiasset(ma);
    }
    const output = C.TransactionOutput.new(at, value);
    if (datum) output.set_data_hash(C.DataHash.from_hex('cd'.repeat(32)));
    return C.TransactionUnspentOutput.new(
      C.TransactionInput.new(
        C.TransactionHash.from_hex(n.toString(16).padStart(64, '0')),
        n,
      ),
      output,
    ).to_hex();
  }
  async function image(size = 8200) {
    const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 17) % 256);
    return {
      uri: 'data:image/webp;base64,' + Buffer.from(bytes).toString('base64'),
      bytes: size,
      width: 320,
      quality: 20,
      sha256: await digestHex(bytes),
    };
  }
  const wallet = { changeHex: addr.to_hex(), utxos: [utxo(1, 20000000)] };
  function signatures(prepared, keys = [keyA]) {
    const set = C.TransactionWitnessSet.new(),
      v = C.Vkeywitnesses.new(),
      hash = C.TransactionHash.from_hex(prepared.hash);
    for (const key of keys) v.add(C.make_vkey_witness(hash, key));
    set.set_vkeys(v);
    return set.to_hex();
  }
  let prepared;
  await test('Live parameters validate epoch, clock, field bounds and missing values', () => {
    assert.equal(live().maxTx, 16384);
    for (const patch of [
      { max_tx_size: NaN },
      { coins_per_utxo_size: null },
      { min_fee_a: 0 },
      { epoch_no: 654 },
    ])
      assert.throws(() =>
        core.parseProtocol(
          { epoch_no: 653, abs_slot: 100, block_time: (Date.now() / 1000) | 0 },
          { ...params, ...patch },
        ),
      );
    assert.throws(
      () =>
        core.parseProtocol(
          {
            epoch_no: 653,
            abs_slot: 100,
            block_time: Math.floor(Date.now() / 1000) - 301,
          },
          params,
        ),
      /stale/,
    );
  });
  await test('Native mint builds quantity one to own wallet with fee and full signed size', async () => {
    prepared = await core.buildMint(C, INITIAL, await image(), wallet, live());
    const tx = C.Transaction.from_hex(prepared.unsignedHex);
    assert.equal(
      tx
        .body()
        .mint()
        .get(C.ScriptHash.from_hex(prepared.policyId))
        .get(0)
        .get(C.AssetName.new(new TextEncoder().encode(prepared.assetName)))
        .to_str(),
      '1',
    );
    for (let i = 0; i < tx.body().outputs().len(); i++)
      assert.equal(
        tx.body().outputs().get(i).address().to_hex(),
        addr.to_hex(),
      );
    assert.ok(prepared.signedEstimate < 16384);
    assert.ok(prepared.metadataBytes > 8200);
    assert.ok(Buffer.byteLength(prepared.assetName) <= 32);
    const signed = core.mergeAndCheckSignatures(
      C,
      prepared,
      signatures(prepared),
      live(),
    );
    assert.equal(signed.bytes, prepared.signedEstimate);
    assert.equal(signed.hash, prepared.hash);
    const browserSigned = core.mergeAndCheckSignatures(
      BrowserCSL,
      prepared,
      signatures(prepared),
      live(),
    );
    assert.equal(browserSigned.hex, signed.hex);
    const browserBuilt = await core.buildMint(
      BrowserCSL,
      INITIAL,
      await image(),
      wallet,
      live(),
    );
    assert.equal(browserBuilt.signedEstimate, prepared.signedEstimate);
    assert.ok(BigInt(prepared.fee) >= BigInt(44 * signed.bytes + 155381));
    const fixed = C.FixedTransaction.from_hex(signed.hex);
    assert.equal(fixed.witness_set().native_scripts().len(), 1);
    const all = fixed
      .witness_set()
      .native_scripts()
      .get(0)
      .as_script_all()
      .native_scripts();
    assert.equal(all.len(), 2);
    assert.equal(
      all.get(0).as_script_pubkey().addr_keyhash().to_hex(),
      keyA.to_public().hash().to_hex(),
    );
    assert.equal(
      all.get(1).as_timelock_expiry().slot_bignum().to_str(),
      String(prepared.expirySlot),
    );
    assert.equal(
      fixed.body().ttl_bignum().to_str(),
      String(prepared.validUntilSlot),
    );
    assert.ok(prepared.expirySlot > prepared.validUntilSlot);
    console.log(
      'MEASURE default:',
      signed.bytes,
      'signed bytes;',
      prepared.metadataBytes,
      'metadata bytes;',
      prepared.fee,
      'lovelace fee',
    );
  });
  await test('CBOR metadata reconstructs exact image and preserves Unicode, decimals and complete utilities', async () => {
    const art = {
      ...INITIAL,
      name: '藝術😀',
      description: 'é東京😀'.repeat(70),
      hue: 12.5,
      utilities: [
        {
          id: 'membership',
          benefit: 'Access ' + '😀'.repeat(50),
          destination: 'https://example.com/holders',
          terms: 'Public terms '.repeat(40),
          eligibility: 'Current token holder',
          starts: '2026-10-01',
          ends: '',
        },
      ],
    };
    const img = await image(6500),
      p = await core.buildMint(C, art, img, wallet, live());
    const decoded = JSON.parse(
      C.decode_metadatum_to_json_str(
        C.Transaction.from_hex(p.unsignedHex)
          .auxiliary_data()
          .metadata()
          .get(bn(721)),
        C.MetadataJsonSchema.NoConversions,
      ),
    );
    const item = decoded[p.policyId][p.assetName],
      join = (x) => (Array.isArray(x) ? x.join('') : x);
    assert.equal(join(item.image), img.uri);
    assert.equal(join(item.description), art.description);
    assert.equal(
      join(item.utility_plan.benefits[0].terms),
      art.utilities[0].terms,
    );
    assert.equal(
      item.attributes.find((x) => x.trait_type === 'Spectrum').value,
      '12.5',
    );
    assert.equal(
      await digestHex(Buffer.from(join(item.image).split(',')[1], 'base64')),
      img.sha256,
    );
    function walk(v) {
      if (typeof v === 'string') assert.ok(Buffer.byteLength(v) <= 64);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          assert.ok(Buffer.byteLength(k) <= 64);
          walk(x);
        }
    }
    walk(decoded);
    assert.deepEqual(
      decoded,
      onchainMetadata(art, img, p.policyId, p.assetName)['721'],
    );
  });
  await test('Native-policy key is counted when inputs belong to a different wallet key', async () => {
    const p = await core.buildMint(
      C,
      INITIAL,
      await image(),
      { changeHex: addr.to_hex(), utxos: [utxo(2, 20000000, addrB)] },
      live(),
    );
    assert.equal(p.requiredKeys.length, 2);
    assert.throws(
      () => core.mergeAndCheckSignatures(C, p, signatures(p, [keyB]), live()),
      /all input/,
    );
    assert.equal(
      core.mergeAndCheckSignatures(C, p, signatures(p, [keyA, keyB]), live())
        .bytes,
      p.signedEstimate,
    );
  });
  await test('Token-bearing inputs preserve existing assets and ADA conservation', async () => {
    const w = {
        changeHex: addr.to_hex(),
        utxos: [utxo(3, 15000000, addr, true)],
      },
      p = await core.buildMint(C, INITIAL, await image(), w, live());
    const outs = C.Transaction.from_hex(p.unsignedHex).body().outputs();
    let old = BigInt(0),
      coins = BigInt(0);
    for (let i = 0; i < outs.len(); i++) {
      const value = outs.get(i).amount();
      coins += BigInt(value.coin().to_str());
      old += BigInt(
        value.multiasset()?.get(policy)?.get(oldAsset)?.to_str() || '0',
      );
    }
    assert.equal(old, BigInt(7));
    assert.equal(coins + BigInt(p.fee), BigInt(15000000));
  });
  await test('Small change is preserved by selecting another input instead of increasing the fee', async () => {
    const p = await core.buildMint(
      C,
      INITIAL,
      await image(6000),
      { changeHex: addr.to_hex(), utxos: [utxo(4, 2200000), utxo(5, 1800000)] },
      live(),
    );
    assert.equal(p.inputRefs.length, 2);
    assert.ok(Number(p.fee) < 700000);
  });
  await test('Oversized artwork or metadata cannot produce a signable review', async () => {
    await assert.rejects(
      core.buildMint(C, INITIAL, await image(12500), wallet, live()),
      core.SizeError,
    );
    await assert.rejects(
      core.buildMint(
        C,
        { ...INITIAL, description: 'x'.repeat(18000) },
        await image(100),
        wallet,
        live(),
      ),
      core.SizeError,
    );
  });
  await test('Actual signed transaction rejects additional signatures that exceed paid fee', () => {
    assert.throws(
      () =>
        core.mergeAndCheckSignatures(
          C,
          prepared,
          signatures(prepared, [keyA, keyB]),
          live(),
        ),
      /increased the fee/,
    );
  });
  await test('Actual signed bytes independently reject oversized witness sets', () => {
    const extra = Array.from({ length: 45 }, () =>
      C.PrivateKey.generate_ed25519(),
    );
    assert.throws(
      () =>
        core.mergeAndCheckSignatures(
          C,
          prepared,
          signatures(prepared, [keyA, ...extra]),
          live(),
        ),
      core.SizeError,
    );
  });
  await test('Wrong-body signatures, empty witnesses, stale review and changed params fail closed', () => {
    const wrong = { ...prepared, hash: 'ab'.repeat(32) };
    assert.throws(
      () =>
        core.mergeAndCheckSignatures(C, prepared, signatures(wrong), live()),
      /invalid signature/,
    );
    assert.throws(
      () =>
        core.mergeAndCheckSignatures(
          C,
          prepared,
          C.TransactionWitnessSet.new().to_hex(),
          live(),
        ),
      /no payment/,
    );
    assert.throws(
      () =>
        core.assertFreshReview(
          { ...prepared, createdAt: Date.now() - 241000 },
          live(),
        ),
      /expired/,
    );
    assert.throws(
      () => core.assertFreshReview(prepared, { ...live(), feeA: 45 }),
      /parameters changed/,
    );
    assert.throws(
      () =>
        core.assertFreshReview(
          { ...prepared, validUntilSlot: 197042700 },
          { ...live(), blockTime: Math.floor(Date.now() / 1000) - 200 },
        ),
      /expired/,
    );
  });
  await test('Changed wallet, spent inputs, testnet and datum outputs cannot mint', async () => {
    assert.throws(
      () =>
        core.assertWalletUnchanged(C, prepared, {
          changeHex: addrB.to_hex(),
          utxos: wallet.utxos,
        }),
      /account changed/,
    );
    assert.throws(
      () =>
        core.assertWalletUnchanged(C, prepared, {
          ...wallet,
          utxos: [utxo(9, 20000000)],
        }),
      /spent or changed/,
    );
    await assert.rejects(
      core.readWallet({ getNetworkId: async () => 0 }),
      /mainnet/,
    );
    await assert.rejects(
      core.buildMint(
        C,
        INITIAL,
        await image(),
        {
          changeHex: addr.to_hex(),
          utxos: [utxo(10, 20000000, addr, false, true)],
        },
        live(),
      ),
      /No regular/,
    );
  });
  await test('Full input reference and image hash change asset names', async () => {
    const a = await core.buildMint(
      C,
      INITIAL,
      await image(8000),
      wallet,
      live(),
    );
    const b = await core.buildMint(
      C,
      INITIAL,
      await image(8000),
      { ...wallet, utxos: [utxo(11, 20000000)] },
      live(),
    );
    assert.notEqual(a.assetName, b.assetName);
    assert.notEqual(a.assetName, prepared.assetName);
  });
  console.log(
    `${count} mint verification groups passed. No wallet or network used.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
