import type * as Cardano from '@emurgo/cardano-serialization-lib-browser-inlined';
import type { Artwork } from './art';
import {
  ARCADE,
  arcadeMetadata,
  verifyArcade,
  type ArcadeMedia,
} from './arcade';
import {
  digestHex,
  onchainMetadata,
  prepareProgram,
  type OnchainImage,
  type OnchainProgram,
} from './onchain-art';
export type CSL = typeof Cardano;
let cslPromise: Promise<CSL> | undefined;
export const loadCSL = () =>
  (cslPromise ||= import('@emurgo/cardano-serialization-lib-browser-inlined'));
export const PROTOCOL_URL = 'https://koios.beacn.workers.dev/api/v1';
export const STUDIO_TX_CAP = 16384;
export const ada = (lovelace: string) =>
  (Number(lovelace) / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
export function errorText(error: unknown) {
  if (error && typeof error === 'object') {
    const e = error as { info?: string; message?: string };
    return String(e.info || e.message || JSON.stringify(error));
  }
  return String(error);
}
export type Protocol = {
  epoch: number;
  slot: number;
  blockTime: number;
  fetchedAt: number;
  maxTx: number;
  maxValue: number;
  feeA: number;
  feeB: number;
  coinsPerByte: string;
  keyDeposit: string;
  poolDeposit: string;
};
function integer(value: unknown, min: number, max: number, label: string) {
  const n = Number(value);
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    !Number.isSafeInteger(n) ||
    n < min ||
    n > max
  )
    throw new Error(
      `Invalid live network parameter: ${label}. Minting is paused.`,
    );
  return n;
}
export function parseProtocol(
  tip: Record<string, unknown>,
  p: Record<string, unknown>,
  now = Date.now(),
): Protocol {
  const epoch = integer(tip.epoch_no, 1, 100000, 'epoch');
  if (integer(p.epoch_no, 1, 100000, 'parameter epoch') !== epoch)
    throw new Error(
      'Network parameters are changing. Please prepare again in a moment.',
    );
  const blockTime = integer(
    tip.block_time,
    1,
    Number.MAX_SAFE_INTEGER,
    'block time',
  );
  if (now / 1000 - blockTime > 300 || blockTime - now / 1000 > 60)
    throw new Error(
      'The network feed is stale, or your device clock is incorrect. Minting is paused.',
    );
  return {
    epoch,
    blockTime,
    fetchedAt: now,
    slot: integer(tip.abs_slot, 1, Number.MAX_SAFE_INTEGER - 7200, 'slot'),
    maxTx: integer(p.max_tx_size, 1024, 65536, 'maximum transaction size'),
    maxValue: integer(p.max_val_size, 100, 32768, 'maximum value size'),
    feeA: integer(p.min_fee_a, 1, 1000, 'fee coefficient'),
    feeB: integer(p.min_fee_b, 1, 1000000, 'fee constant'),
    coinsPerByte: String(
      integer(p.coins_per_utxo_size, 1, 100000, 'minimum ADA per byte'),
    ),
    keyDeposit: String(integer(p.key_deposit, 0, 1000000000, 'key deposit')),
    poolDeposit: String(
      integer(p.pool_deposit, 0, 10000000000, 'pool deposit'),
    ),
  };
}
export async function fetchProtocol(): Promise<Protocol> {
  const read = async (path: string) => {
    const response = await fetch(PROTOCOL_URL + path, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        'The live Cardano network feed is unavailable. Please try again.',
      );
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0])
      throw new Error('The live Cardano network feed returned no data.');
    return rows[0];
  };
  const [tip, params] = await Promise.all([
    read('/tip'),
    read('/epoch_params?order=epoch_no.desc&limit=1'),
  ]);
  return parseProtocol(tip, params);
}
export type WalletAPI = {
  getNetworkId(): Promise<number>;
  getChangeAddress(): Promise<string>;
  getUtxos(): Promise<string[] | null>;
  signTx(hex: string, partialSign: boolean): Promise<string>;
  submitTx(hex: string): Promise<string>;
};
export type WalletProvider = {
  name: string;
  apiVersion: string;
  enable(): Promise<WalletAPI>;
};
export function findWallets(): { id: string; provider: WalletProvider }[] {
  const root = (
    window as unknown as { cardano?: Record<string, WalletProvider> }
  ).cardano;
  return Object.entries(root || {})
    .filter(
      ([, p]) =>
        p &&
        typeof p.enable === 'function' &&
        typeof p.name === 'string' &&
        typeof p.apiVersion === 'string',
    )
    .map(([id, provider]) => ({ id, provider }));
}
export type WalletState = { changeHex: string; utxos: string[] };
export async function readWallet(api: WalletAPI): Promise<WalletState> {
  if ((await api.getNetworkId()) !== 1)
    throw new Error(
      'Switch your wallet to Cardano mainnet, then connect again.',
    );
  const [changeHex, utxos] = await Promise.all([
    api.getChangeAddress(),
    api.getUtxos(),
  ]);
  if (!utxos?.length)
    throw new Error(
      'This wallet has no spendable outputs. Add ADA before preparing a mint.',
    );
  if (utxos.length > 10000)
    throw new Error(
      'This wallet has too many outputs for this browser session. Use a smaller account.',
    );
  return { changeHex, utxos };
}
export class SizeError extends Error {
  constructor(
    public bytes: number,
    public limit: number,
  ) {
    super(
      `The complete transaction needs ${bytes.toLocaleString()} bytes; the limit is ${limit.toLocaleString()}. Reduce the artwork or metadata.`,
    );
  }
}
export type PreparedMint = {
  artworkName: string;
  unsignedHex: string;
  hash: string;
  policyId: string;
  policyScript: string;
  assetName: string;
  signedEstimate: number;
  metadataBytes: number;
  fee: string;
  minimumAda: string;
  changeHex: string;
  address: string;
  inputRefs: string[];
  requiredKeys: string[];
  protocol: Protocol;
  expirySlot: number;
  validUntilSlot: number;
  createdAt: number;
  image: OnchainImage;
  program?: OnchainProgram;
  metadata:
    | ReturnType<typeof onchainMetadata>
    | ReturnType<typeof arcadeMetadata>;
};
export type PreparedTransaction = Pick<PreparedMint,
  'unsignedHex' | 'hash' | 'changeHex' | 'inputRefs' | 'requiredKeys' |
  'protocol' | 'validUntilSlot' | 'createdAt'>;

export const inputRef = (u: Cardano.TransactionUnspentOutput) =>
  `${u.input().transaction_id().to_hex()}#${u.input().index()}`;
export async function buildMint(
  C: CSL,
  art: Artwork,
  image: OnchainImage,
  wallet: WalletState,
  p: Protocol,
  arcade?: ArcadeMedia,
): Promise<PreparedMint> {
  if (Date.now() - p.fetchedAt > 120000)
    throw new Error('The network quote expired. Prepare the mint again.');
  const change = C.Address.from_hex(wallet.changeHex),
    key = change.payment_cred()?.to_keyhash();
  if (change.network_id() !== 1 || !key)
    throw new Error(
      'Choose a mainnet wallet with a regular payment key address.',
    );
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
      'No regular spendable wallet outputs were found. Outputs carrying datums or reference scripts are excluded.',
    );
  const bn = (n: string | number) => C.BigNum.from_str(String(n));
  const currentSlot =
    p.slot + Math.max(0, Math.floor(Date.now() / 1000) - p.blockTime);
  const expirySlot = currentSlot + 3600,
    validUntilSlot = currentSlot + 600;
  const scripts = C.NativeScripts.new();
  scripts.add(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(key)));
  scripts.add(
    C.NativeScript.new_timelock_expiry(
      C.TimelockExpiry.new_timelockexpiry(bn(expirySlot)),
    ),
  );
  const script = C.NativeScript.new_script_all(C.ScriptAll.new(scripts)),
    policyId = script.hash().to_hex();
  if (arcade) {
    await verifyArcade(arcade);
    const entry = ARCADE[arcade.id];
    if (
      image.uri !== arcade.image.uri ||
      image.sha256 !== arcade.image.sha256 ||
      image.bytes !== arcade.image.bytes ||
      image.mediaType !== arcade.image.mediaType ||
      image.width !== arcade.image.width ||
      art.name !== entry.title ||
      art.description !== entry.description ||
      art.interactive ||
      art.utilities.length ||
      art.traits.length
    )
      throw new Error(
        'The selected game and mint preview differ. Prepare again.',
      );
  }
  const program = arcade ? arcade.program : await prepareProgram(art);
  const identity = await digestHex(
    new TextEncoder().encode(
      inputRef(candidates[0]) +
        '|' +
        image.sha256 +
        (program ? '|' + program.sha256 : ''),
    ),
  );
  const assetName = arcade
    ? ARCADE[arcade.id].asset + '-' + identity.slice(0, 8)
    : 'PRISM' + identity.slice(0, 26);
  const asset = C.AssetName.new(new TextEncoder().encode(assetName));
  const metadata = arcade
    ? arcadeMetadata(arcade, policyId, assetName)
    : onchainMetadata(art, image, policyId, assetName, program);
  const general = C.GeneralTransactionMetadata.new();
  general.insert(
    bn(721),
    C.encode_json_str_to_metadatum(
      JSON.stringify(metadata['721']),
      C.MetadataJsonSchema.NoConversions,
    ),
  );
  const aux = C.AuxiliaryData.new();
  aux.set_metadata(general);
  const limit = Math.min(p.maxTx, STUDIO_TX_CAP);
  if (aux.to_bytes().length >= limit)
    throw new SizeError(aux.to_bytes().length + 600, limit);
  const ma = C.MultiAsset.new(),
    assets = C.Assets.new();
  assets.insert(asset, bn(1));
  ma.insert(script.hash(), assets);
  const output = C.TransactionOutputBuilder.new()
    .with_address(change)
    .next()
    .with_asset_and_min_required_coin_by_utxo_cost(
      ma,
      C.DataCost.new_coins_per_byte(bn(p.coinsPerByte)),
    )
    .build();
  let lastError = '';
  for (let count = 1; count <= candidates.length; count++) {
    const config = C.TransactionBuilderConfigBuilder.new()
      .fee_algo(C.LinearFee.new(bn(p.feeA), bn(p.feeB)))
      .pool_deposit(bn(p.poolDeposit))
      .key_deposit(bn(p.keyDeposit))
      .coins_per_utxo_byte(bn(p.coinsPerByte))
      .max_value_size(p.maxValue)
      .do_not_burn_extra_change(true)
      // Allow measuring an oversized candidate; our lower live limit gates every return.
      .max_tx_size(65536)
      .build();
    const builder = C.TransactionBuilder.new(config);
    const selected = candidates.slice(0, count),
      required = new Set<string>([key.to_hex()]);
    for (const u of selected) {
      const o = u.output();
      builder.add_regular_input(o.address(), u.input(), o.amount());
      required.add(o.address().payment_cred()!.to_keyhash()!.to_hex());
    }
    const mint = C.MintBuilder.new();
    mint.add_asset(
      C.MintWitness.new_native_script(C.NativeScriptSource.new(script)),
      asset,
      C.Int.new_i32(1),
    );
    builder.set_mint_builder(mint);
    builder.set_auxiliary_data(aux);
    builder.set_ttl_bignum(bn(validUntilSlot));
    builder.add_output(output);
    try {
      builder.add_change_if_needed(change);
    } catch (e) {
      lastError = errorText(e);
      continue;
    }
    const signedEstimate = builder.full_size();
    if (signedEstimate > limit) throw new SizeError(signedEstimate, limit);
    const tx = builder.build_tx(),
      fee = tx.body().fee().to_str();
    if (BigInt(fee) > BigInt(2000000))
      throw new Error(
        'This transaction would cost more than PRISM’s 2 ADA network-fee cap. Simplify it and prepare again.',
      );
    return {
      artworkName: art.name,
      unsignedHex: tx.to_hex(),
      hash: C.FixedTransaction.from_hex(tx.to_hex())
        .transaction_hash()
        .to_hex(),
      policyId,
      policyScript: script.to_hex(),
      assetName,
      signedEstimate,
      metadataBytes: aux.to_bytes().length,
      fee,
      minimumAda: output.amount().coin().to_str(),
      changeHex: wallet.changeHex,
      address: change.to_bech32(),
      inputRefs: selected.map(inputRef),
      requiredKeys: [...required],
      protocol: p,
      expirySlot,
      validUntilSlot,
      createdAt: Date.now(),
      image,
      program,
      metadata,
    };
  }
  throw new Error(
    'Unable to fund the NFT and its change outputs. Add ADA or consolidate regular wallet outputs. ' +
      lastError,
  );
}

export function assertFreshReview(prepared: PreparedTransaction, live: Protocol) {
  const p = prepared.protocol;
  const currentSlot =
    live.slot + Math.max(0, Math.floor(Date.now() / 1000) - live.blockTime);
  if (
    Date.now() - live.fetchedAt > 60000 ||
    Date.now() - prepared.createdAt > 240000 ||
    currentSlot >= prepared.validUntilSlot - 60
  )
    throw new Error(
      'This review expired. Prepare again for a fresh fee and validity window.',
    );
  for (const field of [
    'epoch',
    'maxTx',
    'maxValue',
    'feeA',
    'feeB',
    'coinsPerByte',
    'keyDeposit',
    'poolDeposit',
  ] as const)
    if (p[field] !== live[field])
      throw new Error(
        'The network parameters changed. Prepare the mint again.',
      );
}
export function assertWalletUnchanged(
  C: CSL,
  prepared: PreparedTransaction,
  wallet: WalletState,
) {
  if (wallet.changeHex.toLowerCase() !== prepared.changeHex.toLowerCase())
    throw new Error(
      'Your wallet account changed. Prepare again with the intended account.',
    );
  const refs = new Set(
    wallet.utxos.map((hex) =>
      inputRef(C.TransactionUnspentOutput.from_hex(hex)),
    ),
  );
  if (prepared.inputRefs.some((ref) => !refs.has(ref)))
    throw new Error(
      'A selected wallet output was spent or changed. Prepare again.',
    );
}
export function mergeAndCheckSignatures(
  C: CSL,
  prepared: PreparedTransaction,
  witnessHex: string,
  live: Protocol,
) {
  assertFreshReview(prepared, live);
  if (witnessHex.length > 131072)
    throw new Error('The wallet returned an unexpectedly large witness set.');
  const fixed = C.FixedTransaction.from_hex(prepared.unsignedHex),
    witnesses = C.TransactionWitnessSet.from_hex(witnessHex),
    vkeys = witnesses.vkeys();
  if (!vkeys?.len())
    throw new Error('The wallet returned no payment signatures.');
  const hash = fixed.transaction_hash(),
    signed = new Set<string>();
  for (let i = 0; i < vkeys.len(); i++) {
    const witness = vkeys.get(i),
      publicKey = witness.vkey().public_key(),
      key = publicKey.hash().to_hex();
    if (!publicKey.verify(hash.to_bytes(), witness.signature()))
      throw new Error(
        'The wallet returned an invalid signature. Nothing was submitted.',
      );
    if (signed.has(key)) continue;
    fixed.add_vkey_witness(witness);
    signed.add(key);
  }
  if (prepared.requiredKeys.some((key) => !signed.has(key)))
    throw new Error(
      'The wallet did not sign for all input and minting-policy keys. Nothing was submitted.',
    );
  // Native script and auxiliary data stay in the original fixed transaction.
  if (fixed.transaction_hash().to_hex() !== prepared.hash)
    throw new Error(
      'Transaction integrity check failed. Nothing was submitted.',
    );
  const auxiliary = fixed.auxiliary_data(), committedAuxiliary = fixed.body().auxiliary_data_hash();
  if (!auxiliary || !committedAuxiliary ||
      C.hash_auxiliary_data(auxiliary).to_hex() !== committedAuxiliary.to_hex())
    throw new Error('Transaction metadata integrity check failed. Nothing was submitted.');
  const bytes = fixed.to_bytes(),
    limit = Math.min(live.maxTx, STUDIO_TX_CAP);
  if (bytes.length > limit) throw new SizeError(bytes.length, limit);
  const fee = BigInt(fixed.body().fee().to_str()),
    requiredFee = BigInt(live.feeA) * BigInt(bytes.length) + BigInt(live.feeB);
  if (fee < requiredFee)
    throw new Error(
      'Additional wallet signatures increased the fee. Nothing was submitted. Prepare again with a wallet that signs only the required keys.',
    );
  return {
    hex: fixed.to_hex(),
    bytes: bytes.length,
    hash: fixed.transaction_hash().to_hex(),
  };
}
