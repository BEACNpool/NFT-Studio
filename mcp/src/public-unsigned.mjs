import { canonicalPassportJson } from '@studio/artifact-passport.ts';
import { parseMusicRelease, recoverMusicRelease, MUSIC_RELEASE_PROFILE } from '@studio/music-release.ts';
import { MUSIC_REVIEW_URL } from './music-tools.mjs';
/** Bounded, stateless adapter for the shared Studio ordinary/music native builders. No transport or network. */
import { buildStudioTransaction, buildMusicReleaseTransaction, assertMusicReleaseUnchanged } from '@studio/studio-transaction.ts';
import { verifyMintIntent } from '@studio/studio-intent.ts';
import {preflightCbor} from './cbor-preflight.mjs';
export {preflightCbor} from './cbor-preflight.mjs';
import { parseProtocol, inputRef } from '@studio/cardano.ts';
export const LIMITS = Object.freeze({argumentBytes:90112,utxos:32,utxoBytes:16384,walletBytes:32768,cborNodes:4096,cborDepth:16,nativeAssets:512,activePreparations:2,providerTimeoutMs:10000,transactionBytes:16384,feeLovelace:'2000000'});
const enc = new TextEncoder();
const fail = message => { throw new Error(message); };
function object(value, fields, label) {
  if(!value || typeof value!=='object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail(`Invalid ${label}.`);
  if(Object.keys(value).length!==fields.length || fields.some(key=>!Object.hasOwn(value,key)) || Object.keys(value).some(key=>!fields.includes(key))) fail(`Unexpected or missing ${label} fields.`);
}
function hex(value,max,label) {
  if(typeof value!=='string' || value.length<2 || value.length>max*2 || !/^(?:[a-fA-F0-9]{2})+$/.test(value)) fail(`Invalid ${label} hex.`);
  return value.toLowerCase();
}
function walletSnapshot(C, wallet) {
  object(wallet,['changeHex','utxos'],'wallet snapshot');
  const changeHex=hex(wallet.changeHex,128,'change address');
  const change=C.Address.from_hex(changeHex);
  if(change.to_hex()!==changeHex || change.network_id()!==1 || !change.payment_cred()?.to_keyhash()) fail('Use a canonical mainnet key payment change address.');
  if(!Array.isArray(wallet.utxos)||wallet.utxos.length<1||wallet.utxos.length>LIMITS.utxos)fail('Supply 1–32 ordinary wallet outputs.');
  let bytes=0,assetCount=0;const refs=new Map(),utxos=[];
  for(const raw of wallet.utxos){
    const value=hex(raw,LIMITS.utxoBytes,'wallet output');bytes+=value.length/2;
    if(bytes>LIMITS.walletBytes)fail('Wallet CBOR exceeds 32 KiB.');
    preflightCbor(value);
    const utxo=C.TransactionUnspentOutput.from_hex(value),output=utxo.output(),address=output.address(),ref=inputRef(utxo);
    if(utxo.to_hex()!==value)fail('Wallet output CBOR must be canonical.');
    if(refs.has(ref))fail('Duplicate wallet input reference.');
    if(address.network_id()!==1||!address.payment_cred()?.to_keyhash()||output.has_data_hash()||output.has_plutus_data()||output.has_script_ref())fail('Only mainnet key outputs without datum or reference scripts are accepted.');
    const multi=output.amount().multiasset();
    if(multi){const policies=multi.keys();for(let i=0;i<policies.len();i++)assetCount+=multi.get(policies.get(i)).len();}
    if(assetCount>LIMITS.nativeAssets)fail('Wallet native-asset count exceeds 512.');
    refs.set(ref,utxo);utxos.push(value);
  }
  return {wallet:{changeHex,utxos},refs};
}
function transactionEvidence(C, prepared, snapshot) {
  const transaction=C.Transaction.from_hex(prepared.unsignedHex),body=transaction.body(),witnesses=transaction.witness_set();
  if(witnesses.vkeys()?.len()||witnesses.bootstraps()?.len()||witnesses.plutus_scripts()?.len()||witnesses.redeemers())fail('Unsigned native preparation contains unexpected witnesses.');
  if(C.FixedTransaction.from_hex(prepared.unsignedHex).transaction_hash().to_hex()!==prepared.hash)fail('Transaction hash mismatch.');
  if(!body.auxiliary_data_hash()||!transaction.auxiliary_data()||body.auxiliary_data_hash().to_hex()!==C.hash_auxiliary_data(transaction.auxiliary_data()).to_hex())fail('Auxiliary-data commitment mismatch.');
  let available=C.Value.zero();
  const actualRefs=[];
  for(let i=0;i<body.inputs().len();i++){
    const input=body.inputs().get(i),ref=input.transaction_id().to_hex()+'#'+input.index();
    const original=snapshot.refs.get(ref);if(!original)fail('Builder selected an input outside the supplied snapshot.');
    actualRefs.push(ref);available=available.checked_add(original.output().amount());
  }
  if(actualRefs.length!==prepared.inputRefs.length||actualRefs.some(ref=>!prepared.inputRefs.includes(ref)))fail('Selected input report mismatch.');
  if(prepared.mode==='nft'){
    const mint=body.mint();if(!mint||mint.keys().len()!==1||mint.keys().get(0).to_hex()!==prepared.policyId)fail('Unexpected minted policy.');
    const groups=mint.get(mint.keys().get(0));if(groups.len()!==1)fail('Duplicate mint policy groups.');const assets=groups.get(0);if(assets.len()!==1||encHex(assets.keys().get(0).name())!==encHex(enc.encode(prepared.assetName))||assets.get(assets.keys().get(0)).to_str()!=='1')fail('Unexpected minted asset or quantity.');
    const minted=C.Value.new(C.BigNum.from_str('0'));minted.set_multiasset(mint.as_positive_multiasset());available=available.checked_add(minted);
    if(witnesses.native_scripts()?.len()!==1||witnesses.native_scripts().get(0).to_hex()!==prepared.policyScript)fail('Native policy witness mismatch.');
  } else if(body.mint()||witnesses.native_scripts()?.len())fail('Data mode must not mint a token.');
  let accounted=C.Value.new(body.fee());const outputs=[];
  for(let i=0;i<body.outputs().len();i++){
    const output=body.outputs().get(i);if(output.address().to_hex()!==snapshot.wallet.changeHex)fail('Unexpected destination.');
    if(output.has_data_hash()||output.has_plutus_data()||output.has_script_ref())fail('Unexpected output script data.');
    const minimum=C.min_ada_for_output(output,C.DataCost.new_coins_per_byte(C.BigNum.from_str(prepared.protocol.coinsPerByte)));
    if(BigInt(output.amount().coin().to_str())<BigInt(minimum.to_str()))fail('Output is below current minimum ADA.');
    accounted=accounted.checked_add(output.amount());outputs.push({index:i,address:output.address().to_bech32(),valueCborHex:output.amount().to_hex(),lovelace:output.amount().coin().to_str(),minimumLovelace:minimum.to_str()});
  }
  if(available.to_hex()!==accounted.to_hex())fail('Input/mint/output/fee conservation failed.');
  if(BigInt(body.fee().to_str())>BigInt(LIMITS.feeLovelace)||prepared.signedEstimate>Math.min(prepared.protocol.maxTx,LIMITS.transactionBytes))fail('Fee or signed-size estimate exceeds the service limit.');
  return {bodyHex:body.to_hex(),outputs,auxiliaryDataHash:body.auxiliary_data_hash().to_hex(),unsignedBytes:prepared.unsignedHex.length/2};
}
const encHex=bytes=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
/** One trusted service-wide gate. The ordinary Node cache keeps its own accounting. */
export function createPreparationGate() {
  let active = 0;
  return Object.freeze({
    async run(operation) {
      if (active >= LIMITS.activePreparations) fail('Preparation concurrency limit reached.');
      active++;
      try { return await operation(); } finally { active--; }
    },
  });
}

function requestSnapshot(value, music) {
  let json;
  try { json = canonicalPassportJson(value, LIMITS.argumentBytes); }
  catch (error) {
    if (/byte limit|oversized JSON text/.test(error.message)) fail('Preparation arguments exceed 88 KiB.');
    throw error;
  }
  const args = JSON.parse(json);
  object(args, music ? ['packetJson', 'wallet'] : ['intent', 'wallet'], 'unsigned preparation request');
  return args;
}
async function quotedProtocol(protocolProvider) {
  const controller = new AbortController(); let timer;
  const quote = await Promise.race([
    Promise.resolve().then(() => protocolProvider(controller.signal)),
    new Promise((_, reject) => { timer = setTimeout(() => {
      controller.abort(); reject(new Error('Protocol provider timed out.'));
    }, LIMITS.providerTimeoutMs); }),
  ]).finally(() => clearTimeout(timer));
  object(quote, ['tip', 'parameters'], 'server protocol quote');
  return parseProtocol(quote.tip, quote.parameters);
}
async function musicTransactionContent(C, prepared, original, packetJson) {
  await assertMusicReleaseUnchanged(prepared, original);
  const transaction = C.Transaction.from_hex(prepared.unsignedHex);
  const general = transaction.auxiliary_data()?.metadata();
  if (!general) fail('Music preparation has no actual transaction metadata.');
  const metadata = {}, labels = general.keys();
  for (let i = 0; i < labels.len(); i++) {
    const label = labels.get(i);
    metadata[label.to_str()] = JSON.parse(C.decode_metadatum_to_json_str(general.get(label), C.MetadataJsonSchema.NoConversions));
  }
  if (canonicalPassportJson(metadata) !== canonicalPassportJson(prepared.metadata)) fail('Actual music metadata differs from preparation metadata.');
  // A second path through actual CBOR and the shared recovery codec; this is not
  // an independent implementation or evidence of ledger/signature validity.
  const recovered = await recoverMusicRelease(metadata, { policyId: prepared.policyId, assetName: prepared.assetName });
  if (recovered.packageHash !== original.packageHash || canonicalPassportJson(recovered) !== packetJson)
    fail('Actual music transaction does not preserve the complete package.');
  return recovered;
}

/** Trusted provider/gate options are operator configuration, never request arguments. */
export function createUnsignedPreparers(C, {
  protocolProvider,
  reviewUrl = 'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents',
  preparationGate = createPreparationGate(),
} = {}) {
  if (typeof protocolProvider !== 'function') throw new Error('A trusted server-side protocol provider is required.');
  if (!preparationGate || typeof preparationGate.run !== 'function') throw new Error('A trusted preparation gate is required.');
  async function prepare(value, music) {
    return preparationGate.run(async () => {
      const args = requestSnapshot(value, music);
      const content = music ? await parseMusicRelease(args.packetJson) : await verifyMintIntent(args.intent);
      const snapshot = walletSnapshot(C, args.wallet);
      const protocol = await quotedProtocol(protocolProvider);
      const prepared = music
        ? await buildMusicReleaseTransaction(C, content, snapshot.wallet, protocol)
        : await buildStudioTransaction(C, content.bundle, content.mode, snapshot.wallet, protocol);
      const evidence = transactionEvidence(C, prepared, snapshot);
      const musicRelease = music ? await musicTransactionContent(C, prepared, content, args.packetJson) : null;
      return {
        schema: music ? 'nft-studio.stateless-unsigned-music.v1' : 'nft-studio.stateless-unsigned.v1',
        ...(music ? { musicPackageHash: musicRelease.packageHash, metadataProfile: MUSIC_RELEASE_PROFILE, musicRelease, packetJson: args.packetJson } : { intentHash: content.intentHash }),
        mode: prepared.mode, networkId: 1,
        unsignedHex: prepared.unsignedHex, transactionHash: prepared.hash, bodyHex: evidence.bodyHex,
        selectedInputRefs: prepared.inputRefs, requiredPaymentKeyHashes: prepared.requiredKeys, recipient: prepared.address, outputs: evidence.outputs,
        asset: prepared.mode === 'nft' ? { policyId: prepared.policyId, assetNameHex: encHex(enc.encode(prepared.assetName)), quantity: '1', nativeScriptHex: prepared.policyScript, policyExpirySlot: prepared.expirySlot } : null,
        feeLovelace: prepared.fee, unsignedBytes: evidence.unsignedBytes, estimatedSignedBytes: prepared.signedEstimate, metadata: prepared.metadata, auxiliaryDataHash: evidence.auxiliaryDataHash,
        protocol, validUntilSlot: prepared.validUntilSlot, preparedAt: prepared.createdAt,
        reviewUrl: music ? MUSIC_REVIEW_URL : reviewUrl,
        ...(music ? {
          review: { url: MUSIC_REVIEW_URL, action: 'Save packetJson exactly as a .music-release.json file. Open the Music Lab, review every file and credit, then explicitly start fresh browser wallet preparation. This unsigned response is not imported as signing authority.' },
          witnessVerification: { nodeStoredVerifierAcceptsThisPacket: false, reason: 'Stateless music preparation has no packetId and is not stored. The separate Node verifier only accepts its own retained ordinary preparations.' },
        } : {}),
        checks: {
          sharedBuilder: true, exactBodyHash: true, auxiliaryCommitment: true, conservation: true, outputsToSuppliedChangeAddress: true, minimumAda: true,
          walletInputs: 'caller assertions; unspent chain state and ownership unverified',
          signedSize: 'estimate; exact witnesses and fee still require external verification',
          ...(music ? { exactFilesAndCredits: true, actualMetadataRecoveredThroughSharedCodec: true, musicPackageHashBound: true, rightsVerified: false, paymentSignaturesVerified: false, chainInclusionVerified: false } : {}),
        },
        privacy: music
          ? 'The service receives the supplied music package and authorized wallet snapshot. This adapter does not persist or log them; its fixed provider receives no package, credit, address or UTxO data. Provider infrastructure may retain operational metadata.'
          : 'The service receives the supplied intent and wallet snapshot. This adapter does not persist or log them. Provider infrastructure may retain operational metadata.',
        policySemantics: { quantityThisTransaction: prepared.mode === 'nft' ? 1 : 0, lifetimeSupplyCap: false, burnAfterExpiry: false },
        signed: false, submitted: false,
      };
    });
  }
  return Object.freeze({ prepareOrdinary: value => prepare(value, false), prepareMusic: value => prepare(value, true) });
}

/** Compatibility entry point: ordinary request/response contract remains unchanged. */
export function createUnsignedPreparer(C, options) {
  return createUnsignedPreparers(C, options).prepareOrdinary;
}
