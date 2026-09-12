import {registerWorkbenchTools,WORKBENCH_CAPABILITIES} from './workbench-tools.mjs';
import {jsonToolResult as jsonResult} from '../tool-result.mjs';
import {registerCreationOptionsTools,CREATION_OPTIONS_CAPABILITIES} from './creation-options-tools.mjs';
import {registerMobileTools,MOBILE_HANDOFF_CAPABILITIES} from './mobile-tools.mjs';
import {registerGuideTools,GUIDE_CAPABILITIES,GUIDE_INSTRUCTIONS} from './guide-tools.mjs';
import {registerCipSourceTools,CIP_SOURCE_CAPABILITIES} from './cip-source-tools.mjs';
import {registerCapsuleTools,CAPSULE_MCP_CAPABILITIES} from './capsule-tools.mjs';
import {IMPLEMENTATIONS_URI,implementationRegister,implementationLinks} from './implementation-knowledge.mjs';
import { registerProofTools, PROOF_MCP_CAPABILITIES } from './proof-tools.mjs';
import { registerMusicTools, MUSIC_MCP_CAPABILITIES } from './music-tools.mjs';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import * as z from 'zod/v4';
import catalog from '@knowledge/catalog.json';
import { searchKnowledge, getEntry, validateCatalog } from '@knowledge/lib.mjs';
import { preparePayloadBundle, payloadMetadata, PAYLOAD_TYPES, DATA_LABEL } from '@studio/studio-payload.ts';
import { createMintIntent, verifyMintIntent } from '@studio/studio-intent.ts';
import { createMintReviewUrl } from '@studio/studio-review-link.ts';
import { buildStudioTransaction } from '@studio/studio-transaction.ts';
import { assertWalletUnchanged, mergeAndCheckSignatures, inputRef } from '@studio/cardano.ts';
import { preflightCbor } from './cbor-preflight.mjs';
import { liveProtocol, readProtocolQuote } from './protocol.mjs';
import { createPreparationGate, createUnsignedPreparers } from './public-unsigned.mjs';
import { registerMusicUnsignedTool, MUSIC_UNSIGNED_CAPABILITIES } from './music-unsigned-tools.mjs';
import { empty, payloadSchema, intentSchema, prepareSchema, verifySignedSchema, decodeFiles, checkWalletBound, checkMetadata } from './schemas.mjs';
export const STUDIO_URL = 'https://beacnpool.github.io/NFT-Studio/';
export const STUDIO_REVIEW_URL = new URL('?view=labs&lab=agents', STUDIO_URL).href;
export const CAPABILITIES = Object.freeze({
  schema:'nft-studio.mcp.capabilities.v1', serverVersion:'0.5.0',
  transports:['stdio','streamable-http'], protocolEras:['2026-07-28','2025 legacy negotiation'],
  network:'Cardano mainnet', custody:'external signer only; no keys, signing or submission in this service',
  workbench:WORKBENCH_CAPABILITIES,
  creationOptions:CREATION_OPTIONS_CAPABILITIES,
  creativeGuide:GUIDE_CAPABILITIES,
    mobileHandoff:MOBILE_HANDOFF_CAPABILITIES,
    cipSources:CIP_SOURCE_CAPABILITIES,
    actions:['payload_qr','mint_options','utility_choices','mobile_handoff','mobile_handoff_revocation','interactive_guide','minted_inspiration','cip_source_search','cip_source_chunks','knowledge_search','knowledge_resources','payload_validation','ledger_metadata_validation','mint_intent','unsigned_transaction','witness_verification','proof_record','proof_verification','music_package','music_package_verification','unsigned_music_transaction','state_capsule_parameter_application'],
  proofOfExistence:PROOF_MCP_CAPABILITIES,
    musicReleases:MUSIC_MCP_CAPABILITIES,
    musicUnsignedPreparation:MUSIC_UNSIGNED_CAPABILITIES,
    stateCapsuleParameterization:CAPSULE_MCP_CAPABILITIES,
  formats:[
    ...['image','music','games','apps','motion','files'].map(id=>({id,status:'compact-payload preparation',path:'Provide exact supported file bytes; NFT mode requires an image cover.'})),
    {id:'scroll',status:'browser creator only',reason:'Scroll storage has separate scripts and locks ADA; this MCP does not build it.'},
    {id:'book',status:'browser creator only',reason:'Book issuance and entries use a separate protocol; this MCP does not build them.'},
  ],
  limits:{rawPayloadBytes:12000,files:8,intentJsonBytes:80000,signedTransactionBytes:16384,feeLovelace:'2000000',walletUtxos:128,walletCborBytes:131072,packetTtlSeconds:240,retainedPackets:64},
  mediaTypes:PAYLOAD_TYPES,
  policy:{kind:'signature plus expiry native script',quantityThisTransaction:'1–1000; defaults to 1',lifetimeSupplyCap:false,allowsAdditionalMintUntilExpiry:true,burnAfterExpiry:false},
  interoperability:[
    'CIP-25 v1 payload NFTs, CIP-30 compatible unsigned CBOR and witness sets; custom data metadata uses label '+DATA_LABEL+'.',
    'A fixed experimental CIP-68 State Capsule can be parameterized; this service does not build or evaluate its Plutus transactions. Native unsigned preparation remains separate.',
    'MIME signatures and hashes verify byte identity, not complete media validity or safe execution; imported code remains untrusted.',
    'Existing Studio catalogue programs above the 12KB new-package limit require their existing browser mint path.',
  ],
  networkReads:'The fixed public Studio protocol-parameter feed and, only for requested mobile transfers, the fixed encrypted Studio handoff relay. The service does not independently query chain UTxOs or confirmation.',
  publicEndpoint:null, studioReviewUrl:STUDIO_REVIEW_URL,
    reviewHandoff:{transport:'url-fragment',schema:'nft-studio.intent.v1',supportedSchemas:['nft-studio.intent.v1','nft-studio.intent.v2'],maxFragmentCharacters:106700,openingConnectsWallet:false},
    fees:{studioLovelace:'0',network:'Cardano network fees apply; minimum ADA stays in the user output.'},
});
const READ_ONLY = {readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const NETWORK_READ = {...READ_ONLY,openWorldHint:true};
const payload = args => preparePayloadBundle({...args,files:decodeFiles(args.files)});
function safeError(error) {
  // Never log arguments, CBOR, wallet addresses or headers. Shared validation errors are short.
  const text = error instanceof Error ? error.message : 'Invalid Cardano data or unsupported operation.';
  return {isError:true,content:[{type:'text',text:text.slice(0,500)}]};
}
function metadataMeasure(metadata) {
  const validation = checkMetadata(metadata);
  const general = C.GeneralTransactionMetadata.new();
  for (const [label,value] of Object.entries(metadata)) general.insert(C.BigNum.from_str(label),C.encode_json_str_to_metadatum(JSON.stringify(value),C.MetadataJsonSchema.NoConversions));
  const aux = C.AuxiliaryData.new(); aux.set_metadata(general);
  const bytes = aux.to_bytes().length;
  if (bytes >= 16384) throw new Error('Auxiliary metadata alone exceeds the Studio transaction limit.');
  return {...validation,auxiliaryBytes:bytes,auxiliaryDataHash:C.hash_auxiliary_data(aux).to_hex(),completeTransactionFit:'Requires wallet inputs, live parameters and complete signed-size review.'};
}
function snapshot(wallet) {
  checkWalletBound(wallet);
  const seen = new Set();
  for (const hex of wallet.utxos) {
    preflightCbor(hex);
    const u = C.TransactionUnspentOutput.from_hex(hex), ref = inputRef(u);
    if (seen.has(ref)) throw new Error('Duplicate wallet input references are not accepted.');
    seen.add(ref);
    if (u.to_hex() !== hex.toLowerCase()) throw new Error('Wallet output CBOR must use canonical encoding.');
  }
  return structuredClone(wallet);
}
export function createService(options={}) {
  validateCatalog(catalog);
  const protocol = options.protocol || liveProtocol;
  const packets = new Map(); let activeBuilds=0, activeCalls=0;
  const preparationGate=createPreparationGate();
  // Trusted operator injection for local tests; request schemas expose no provider/gate option.
  const {prepareMusic}=createUnsignedPreparers(C,{protocolProvider:options.musicProtocolProvider||readProtocolQuote,preparationGate});
  function sweep() { for (const [id,p] of packets) if (Date.now()-p.prepared.createdAt >= 240000) packets.delete(id); }
  const expiryTimer=setInterval(sweep,30000); expiryTimer.unref();
  const capabilities = () => ({...CAPABILITIES,knowledge:{asOf:catalog.asOf,entries:catalog.entries.length,sources:catalog.sources.length}});
  function factory() {
    const server = new McpServer({name:'beacn-nft-studio',version:'0.5.0'},{instructions:GUIDE_INSTRUCTIONS+'Use capabilities first. Knowledge includes standard facts, design interpretations and implementation maturity. Prepare an intent for visible Studio review or build unsigned CBOR using caller wallet data. The dedicated music tool is stateless and does not enter the retained ordinary packet cache or its witness verifier. No tool signs or submits; never infer ledger confirmation from preparation or witness verification.'});
    const register = (name,description,schema,action,annotations=READ_ONLY) => server.registerTool(name,{description,inputSchema:schema,annotations},async args=>{
      if(activeCalls>=8) return safeError(new Error('Service tool concurrency limit reached.'));
      activeCalls++;
      try { return jsonResult(await action(args)); } catch(error) { return safeError(error); } finally {activeCalls--;}
    });
    registerWorkbenchTools(server,register,'node');
    registerGuideTools(server);
    registerMobileTools(register);
    registerCreationOptionsTools(register);
    registerProofTools(register);
    registerMusicTools(register);
    registerMusicUnsignedTool(register,prepareMusic);
    registerCapsuleTools(register);
    registerCipSourceTools(register);
    register('studio_capabilities','Discover exact supported formats, operations, limits, native-policy semantics and browser-only boundaries.',empty,capabilities);
    register('search_knowledge','Search the pinned Cardano knowledge base. Returns cited facts, explicit design interpretations and implementation maturity; no network search.',z.strictObject({query:z.string().min(1).max(200),limit:z.number().int().min(1).max(10).default(5)}),({query,limit})=>({asOf:catalog.asOf,results:searchKnowledge(catalog,query,{limit})}));
    register('read_knowledge','Read one allowed knowledge entry plus its primary-source provenance. IDs come from search results or listed resources.',z.strictObject({id:z.string().min(1).max(100).regex(/^[a-z0-9-]+$/)}),({id})=>{
      const entry=getEntry(catalog,id); if(!entry) throw new Error('Unknown knowledge entry ID.');
      return {entry,sources:catalog.sources.filter(source=>entry.sourceIds.includes(source.id)),implementations:implementationLinks(entry.id)};
    });
    register('validate_payload','Validate exact embedded files using the actual Studio packager: UTF-8, MIME signatures, filenames, total bytes, content hashes and canonical data URIs. Does not execute files.',payloadSchema,async args=>{
      const bundle=await payload(args);return {bundle,dataMetadata:payloadMetadata(bundle),dataMeasurement:metadataMeasure(payloadMetadata(bundle))};
    });
    register('validate_metadata','Validate a canonical decimal-label map of ledger metadata. Rejects null, booleans, floats, oversized UTF-8 items, depth and size overflow; measures actual CSL auxiliary CBOR. This does not validate every CIP or build a transaction.',z.strictObject({metadata:z.record(z.string(),z.unknown())}),({metadata})=>({valid:true,...metadataMeasure(metadata)}));
    register('create_mint_intent','Create a deterministic, hashed NFT/data intent from exact base64 files. Open review.url for a direct content review in Studio; save packetJson as a fallback. No wallet, address, transaction or signing authority is included.',intentSchema,async ({mode,mintOptions,...args})=>{
      const intent=await createMintIntent(await payload(args),mode,mintOptions);
      return {intent,filename:`nft-studio-${intent.intentHash.slice(0,12)}.intent.json`,packetJson:JSON.stringify(intent,null,2),review:{url:await createMintReviewUrl(intent,STUDIO_REVIEW_URL),baseUrl:STUDIO_REVIEW_URL,transport:'url-fragment',mobile:{tool:'create_mobile_handoff',browserControl:'Continue on phone → Create QR code',expiresAfterSeconds:900,action:'When the user requests a phone QR, pass this exact intent to create_mobile_handoff and display its QR, complete link and expiry.'},action:'Open this exact review link, inspect the files, connect your wallet, review the network fee and destination, then approve signing. Opening the link never signs or submits.',privacy:'The link contains your content in its fragment. Treat it like the request file; share only with intended reviewers. Studio removes the fragment from browser history before inspecting it.'},status:'intent-only; no transaction prepared'};
    });
    register('verify_mint_intent','Rebuild and verify an intent using shared browser/server canonicalization. Rejects changed bytes, mismatched hashes, extra fields and oversized packets.',z.strictObject({intent:z.unknown()}),async ({intent})=>({valid:true,intent:await verifyMintIntent(intent)}));
    register('prepare_unsigned_transaction','Build an actual unsigned mainnet NFT or data transaction with the shared Studio builder and live bounded protocol feed. Caller supplies CIP-30 change address and UTxO CBOR, kept in RAM for four minutes. Inputs are caller assertions; chain unspent state is not independently verified. All outputs return to that wallet. Does not sign or submit.',prepareSchema,async ({intent,wallet})=>preparationGate.run(async ()=>{
      if(activeBuilds>=2) throw new Error('Two preparations are already running. Try again after one completes.');
      sweep(); if(packets.size+activeBuilds>=64) throw new Error('Preparation capacity reached. Wait for older packets to expire.');
      activeBuilds++;
      try {
        const verified=await verifyMintIntent(intent), w=snapshot(wallet), p=await protocol();
        const prepared=await buildStudioTransaction(C,verified.bundle,verified.mode,w,p,verified.mintOptions);
        const packetId=randomUUID();
        packets.set(packetId,{prepared,wallet:w,intentHash:verified.intentHash});
        return {
          schema:'nft-studio.unsigned.v1',packetId,intentHash:verified.intentHash,
          unsignedHex:prepared.unsignedHex,transactionHash:prepared.hash,
          networkId:1,mode:prepared.mode,recipient:prepared.address,inputRefs:prepared.inputRefs,requiredPaymentKeyHashes:prepared.requiredKeys,
          asset:prepared.mode==='nft'?{policyId:prepared.policyId,assetName:prepared.assetName,assetNameHex:Buffer.from(prepared.assetName).toString('hex'),quantity:String(prepared.quantity ?? 1),policyScriptHex:prepared.policyScript,policyExpirySlot:prepared.expirySlot}:null,
          fees:{lovelace:prepared.fee,nftOutputMinimumLovelace:prepared.minimumAda,estimatedSignedBytes:prepared.signedEstimate,metadataBytes:prepared.metadataBytes},
          validity:{validUntilSlot:prepared.validUntilSlot,preparedAt:new Date(prepared.createdAt).toISOString(),packetExpiresAt:new Date(prepared.createdAt+240000).toISOString()},
          protocol:prepared.protocol,metadata:prepared.metadata,policySemantics:{...CAPABILITIES.policy,quantityThisTransaction:prepared.quantity??1},
          checks:{sharedBuilder:true,auxiliaryCommitment:true,completeSignedSize:'estimated; exact after wallet witnesses',walletInputs:'caller-supplied snapshot; chain unspent state unverified',signed:false,submitted:false},
          next:'Independently inspect body, all outputs, fees and mint identity. Have the external wallet sign this exact CBOR with partialSign=true; send its witness-set CBOR and refreshed wallet snapshot to verify_signed_transaction before the packet expires.',
        };
      } finally {activeBuilds--;}
    }),{...NETWORK_READ,readOnlyHint:false,idempotentHint:false});
    register('verify_signed_transaction','Verify external CIP-30 witness-set signatures against a server-created preparation, recheck live parameters and the caller refreshed wallet snapshot, preserve the exact body/metadata, and check complete signed bytes/fee. Returns signed CBOR; never submits. Packet IDs expire after four minutes or a restart. Stateless music responses have no stored packetId and are not accepted by this verifier.',verifySignedSchema,async ({packetId,witnessSetHex,wallet})=>{
      sweep(); const stored=packets.get(packetId);if(!stored) throw new Error('Unknown or expired preparation. Prepare again before signing.');
      preflightCbor(witnessSetHex);
      const current=snapshot(wallet);
      assertWalletUnchanged(C,stored.prepared,current);
      const initial=new Map(stored.wallet.utxos.map(hex=>[inputRef(C.TransactionUnspentOutput.from_hex(hex)),hex.toLowerCase()]));
      const now=new Map(current.utxos.map(hex=>[inputRef(C.TransactionUnspentOutput.from_hex(hex)),hex.toLowerCase()]));
      for(const ref of stored.prepared.inputRefs) if(initial.get(ref)!==now.get(ref)) throw new Error('A selected wallet output changed. Prepare again.');
      const signed=mergeAndCheckSignatures(C,stored.prepared,witnessSetHex,await protocol());
      return {schema:'nft-studio.signed-candidate.v1',packetId,intentHash:stored.intentHash,signedHex:signed.hex,transactionHash:signed.hash,signedBytes:signed.bytes,feeLovelace:stored.prepared.fee,checks:{validPaymentSignatures:true,allRequiredKeys:true,bodyUnchanged:true,auxiliaryCommitment:true,completeSizeAndFee:true,liveProtocolParameters:true,walletInputs:'caller-supplied refreshed snapshot; chain unspent state unverified'},submitted:false,next:'Your separate wallet/client must independently confirm inputs are unspent and this transaction remains valid, record the intended hash before broadcast, submit at most once, resolve ambiguous responses by hash and verify chain inclusion. Do not treat this candidate as a mint receipt.'};
    },NETWORK_READ);
    const resource=(name,uri,data)=>server.registerResource(name,uri,{mimeType:'application/json'},async url=>({contents:[{uri:url.href,mimeType:'application/json',text:JSON.stringify(data)}]}));
    resource('Implementation evidence register',IMPLEMENTATIONS_URI,implementationRegister);
    resource('Studio capabilities','nft-studio://capabilities',capabilities());
    resource('Knowledge catalogue index','nft-studio://knowledge/index',{asOf:catalog.asOf,entries:catalog.entries.map(({id,title,kind,summary,maturity})=>({id,title,kind,summary,maturity,uri:`nft-studio://knowledge/${id}`}))});
    for(const entry of catalog.entries) resource(entry.title,`nft-studio://knowledge/${entry.id}`,{entry,sources:catalog.sources.filter(source=>entry.sourceIds.includes(source.id)),implementations:implementationLinks(entry.id)});
    return server;
  }
  return {factory,capabilities,close(){clearInterval(expiryTimer);packets.clear();},packetCount(){sweep();return packets.size;}};
}
