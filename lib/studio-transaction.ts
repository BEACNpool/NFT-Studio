import { verifyMintOptions, type MintOptions } from './studio-mint-options';
import type * as Cardano from '@emurgo/cardano-serialization-lib-browser-inlined';
import {
  errorText,
  inputRef,
  SizeError,
  STUDIO_TX_CAP,
  type CSL,
  type Protocol,
  type WalletState,
  type PreparedTransaction,
} from './cardano';
import {
  payloadHash,
  payloadMetadata,
  verifyPayloadBundle,
  type PayloadBundle,
  type PayloadMetadata,
} from './studio-payload';
import {
  MUSIC_RELEASE_PROFILE,
  musicReleaseMetadata,
  verifyMusicRelease,
  type MusicReleasePackage,
} from './music-release';

export type StudioTransaction = PreparedTransaction & {
  mode: 'nft' | 'data';
  name: string;
  bundle: PayloadBundle;
  metadata: PayloadMetadata;
  signedEstimate: number;
  metadataBytes: number;
  fee: string;
  minimumAda: string;
  address: string;
  policyId?: string;
  policyScript?: string;
  assetName?: string;
  expirySlot?: number;
  mintOptions?: MintOptions;
  quantity?: number;
};

export type MusicReleaseTransaction = StudioTransaction & {
  mode: 'nft';
  metadataProfile: typeof MUSIC_RELEASE_PROFILE;
  musicRelease: MusicReleasePackage;
};

/** Prepares a single transaction. Does not connect, sign, submit, or poll a wallet. */
export async function buildStudioTransaction(
  C: CSL,
  bundle: PayloadBundle,
  mode: 'nft' | 'data',
  wallet: WalletState,
  p: Protocol,
  options?: MintOptions,
): Promise<StudioTransaction> {
  return buildStudioTransactionCore(
    C,
    bundle,
    mode,
    wallet,
    p,
    undefined,
    options,
  );
}

/** Verifies a whole music package; the shared constructor supplies its metadata.
 * There is no caller-supplied metadata, policy, recipient, URL, or signing action.
 */
export async function buildMusicReleaseTransaction(
  C: CSL,
  packageInput: unknown,
  wallet: WalletState,
  p: Protocol,
): Promise<MusicReleaseTransaction> {
  const walletSnapshot = {
    changeHex: wallet.changeHex,
    utxos: [...wallet.utxos],
  };
  const protocolSnapshot = { ...p };
  const musicRelease = await verifyMusicRelease(packageInput);
  const prepared = await buildStudioTransactionCore(
    C,
    musicRelease.bundle,
    'nft',
    walletSnapshot,
    protocolSnapshot,
    musicRelease,
  );
  return {
    ...prepared,
    mode: 'nft',
    metadataProfile: MUSIC_RELEASE_PROFILE,
    musicRelease,
  };
}

/** Compare the current package with a trusted local preparation, before and
 * after the wallet prompt. This does not authenticate an imported preparation;
 * ordinary wallet/freshness/signature checks are still required.
 */
export async function assertMusicReleaseUnchanged(
  prepared: MusicReleaseTransaction,
  packageInput: unknown,
): Promise<void> {
  const music = await verifyMusicRelease(packageInput);
  const reviewed = await verifyMusicRelease(prepared.musicRelease);
  if (
    prepared.mode !== 'nft' ||
    prepared.metadataProfile !== MUSIC_RELEASE_PROFILE ||
    reviewed.packageHash !== music.packageHash ||
    prepared.bundle.sha256 !== music.bundle.sha256 ||
    !prepared.policyId ||
    !prepared.assetName
  )
    throw new Error(
      'Music files or credits changed. Prepare and review again.',
    );
  const expected = await musicReleaseMetadata(music, {
    policyId: prepared.policyId,
    assetName: prepared.assetName,
  });
  if (JSON.stringify(expected.metadata) !== JSON.stringify(prepared.metadata))
    throw new Error(
      'Prepared music metadata changed. Prepare and review again.',
    );
}

// One native builder owns coin selection, minting, change and size/fee checks.
// Only the two exported entry points can select its trusted metadata profile.
async function buildStudioTransactionCore(
  C: CSL,
  bundle: PayloadBundle,
  mode: 'nft' | 'data',
  wallet: WalletState,
  p: Protocol,
  musicRelease?: MusicReleasePackage,
  options?: MintOptions,
): Promise<StudioTransaction> {
  if (mode !== 'nft' && mode !== 'data')
    throw new Error('Choose NFT or data record.');
  if (options && (mode !== 'nft' || musicRelease))
    throw Error('These mint options apply only to ordinary NFTs.');
  const mintOptions = options ? verifyMintOptions(options) : undefined;
  const quantity = mintOptions?.quantity ?? 1;
  await verifyPayloadBundle(bundle);
  if (mode === 'nft' && !bundle.cover)
    throw new Error('Choose an image cover before preparing an NFT.');
  if (Date.now() - p.fetchedAt > 120000 || p.fetchedAt > Date.now() + 60000)
    throw new Error('The network quote expired. Prepare again.');
  if (!wallet.utxos.length || wallet.utxos.length > 10000)
    throw new Error('Invalid wallet output count.');
  const change = C.Address.from_hex(wallet.changeHex),
    key = change.payment_cred()?.to_keyhash();
  if (change.network_id() !== 1 || !key)
    throw new Error('Choose a regular Cardano mainnet payment address.');
  const seen = new Set<string>();
  const candidates = wallet.utxos
    .map((hex) => C.TransactionUnspentOutput.from_hex(hex))
    .filter((u) => {
      const o = u.output(),
        ref = inputRef(u);
      if (seen.has(ref)) return false;
      seen.add(ref);
      return (
        o.address().network_id() === 1 &&
        !!o.address().payment_cred()?.to_keyhash() &&
        !o.has_data_hash() &&
        !o.has_plutus_data() &&
        !o.has_script_ref()
      );
    })
    .sort((a, b) => {
      const at = !!a.output().amount().multiasset()?.len(),
        bt = !!b.output().amount().multiasset()?.len();
      if (at !== bt) return at ? 1 : -1;
      const av = BigInt(a.output().amount().coin().to_str()),
        bv = BigInt(b.output().amount().coin().to_str());
      return av > bv
        ? -1
        : av < bv
          ? 1
          : inputRef(a).localeCompare(inputRef(b));
    })
    .slice(0, 32);
  if (!candidates.length)
    throw new Error(
      'No regular wallet outputs are available. Datum and reference-script outputs are excluded.',
    );
  const bn = (n: string | number) => C.BigNum.from_str(String(n));
  const currentSlot =
    p.slot + Math.max(0, Math.floor(Date.now() / 1000) - p.blockTime);
  const validUntilSlot = currentSlot + 600,
    expirySlot =
      mode === 'nft'
        ? currentSlot + (mintOptions?.mintWindowHours ?? 1) * 3600
        : undefined;
  let script: Cardano.NativeScript | undefined,
    asset: Cardano.AssetName | undefined;
  let policyId: string | undefined,
    assetName: string | undefined,
    output: Cardano.TransactionOutput | undefined;
  if (mode === 'nft') {
    const scripts = C.NativeScripts.new();
    scripts.add(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(key)));
    scripts.add(
      C.NativeScript.new_timelock_expiry(
        C.TimelockExpiry.new_timelockexpiry(bn(expirySlot!)),
      ),
    );
    script = C.NativeScript.new_script_all(C.ScriptAll.new(scripts));
    policyId = script.hash().to_hex();
    const identity = await payloadHash(
      new TextEncoder().encode(
        inputRef(candidates[0]) +
          '|' +
          (musicRelease?.packageHash ?? bundle.sha256),
      ),
    );
    assetName = 'NFTS' + identity.slice(0, 28);
    asset = C.AssetName.new(new TextEncoder().encode(assetName));
    const ma = C.MultiAsset.new(),
      assets = C.Assets.new();
    assets.insert(asset, bn(quantity));
    ma.insert(script.hash(), assets);
    output = C.TransactionOutputBuilder.new()
      .with_address(change)
      .next()
      .with_asset_and_min_required_coin_by_utxo_cost(
        ma,
        C.DataCost.new_coins_per_byte(bn(p.coinsPerByte)),
      )
      .build();
  }
  const metadata = musicRelease
    ? (await musicReleaseMetadata(musicRelease, { policyId, assetName }))
        .metadata
    : payloadMetadata(
        bundle,
        policyId && assetName ? { policyId, assetName } : undefined,
      );
  if (mintOptions) {
    const entry = (metadata['721'] as Record<string, Record<string, unknown>>)[
      policyId!
    ][assetName!] as Record<string, unknown>;
    if (Object.keys(mintOptions.traits).length)
      entry.traits = mintOptions.traits;
    if (mintOptions.message) metadata['674'] = { msg: [mintOptions.message] };
  }
  const general = C.GeneralTransactionMetadata.new();
  for (const [label, value] of Object.entries(metadata))
    general.insert(
      bn(label),
      C.encode_json_str_to_metadatum(
        JSON.stringify(value),
        C.MetadataJsonSchema.NoConversions,
      ),
    );
  const aux = C.AuxiliaryData.new();
  aux.set_metadata(general);
  const limit = Math.min(p.maxTx, STUDIO_TX_CAP);
  if (aux.to_bytes().length >= limit)
    throw new SizeError(aux.to_bytes().length + 600, limit);
  let lastError = '';
  for (let count = 1; count <= candidates.length; count++) {
    const config = C.TransactionBuilderConfigBuilder.new()
      .fee_algo(C.LinearFee.new(bn(p.feeA), bn(p.feeB)))
      .pool_deposit(bn(p.poolDeposit))
      .key_deposit(bn(p.keyDeposit))
      .coins_per_utxo_byte(bn(p.coinsPerByte))
      .max_value_size(p.maxValue)
      .do_not_burn_extra_change(true)
      .max_tx_size(65536)
      .build();
    const builder = C.TransactionBuilder.new(config);
    const selected = candidates.slice(0, count),
      required = new Set<string>(mode === 'nft' ? [key.to_hex()] : []);
    for (const u of selected) {
      const o = u.output();
      builder.add_regular_input(o.address(), u.input(), o.amount());
      required.add(o.address().payment_cred()!.to_keyhash()!.to_hex());
    }
    if (script && asset) {
      const mint = C.MintBuilder.new();
      mint.add_asset(
        C.MintWitness.new_native_script(C.NativeScriptSource.new(script)),
        asset,
        C.Int.new_i32(quantity),
      );
      builder.set_mint_builder(mint);
    }
    builder.set_auxiliary_data(aux);
    builder.set_ttl_bignum(bn(validUntilSlot));
    if (output) builder.add_output(output);
    try {
      builder.add_change_if_needed(change);
    } catch (error) {
      lastError = errorText(error);
      continue;
    }
    const signedEstimate = builder.full_size();
    if (signedEstimate > limit) throw new SizeError(signedEstimate, limit);
    const tx = builder.build_tx(),
      fee = tx.body().fee().to_str();
    if (!tx.body().outputs().len())
      throw new Error(
        'The transaction would leave no wallet output. Add ADA and prepare again.',
      );
    if (BigInt(fee) > BigInt(2000000))
      throw new Error('This transaction exceeds the 2 ADA network fee cap.');
    return {
      mode,
      name: bundle.name,
      bundle,
      metadata,
      unsignedHex: tx.to_hex(),
      hash: C.FixedTransaction.from_hex(tx.to_hex())
        .transaction_hash()
        .to_hex(),
      policyId,
      policyScript: script?.to_hex(),
      assetName,
      expirySlot,
      ...(mintOptions ? { mintOptions, quantity } : {}),
      signedEstimate,
      metadataBytes: aux.to_bytes().length,
      fee,
      minimumAda: output?.amount().coin().to_str() || '0',
      changeHex: wallet.changeHex,
      address: change.to_bech32(),
      inputRefs: selected.map(inputRef),
      requiredKeys: [...required],
      protocol: p,
      validUntilSlot,
      createdAt: Date.now(),
    };
  }
  throw new Error(
    'Unable to fund the transaction and preserve wallet change. Add ADA or consolidate ordinary outputs. ' +
      lastError,
  );
}
