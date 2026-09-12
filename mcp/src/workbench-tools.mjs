import * as z from 'zod/v4';
import {workbenchCatalog, getRecipe, planUtility, WORKBENCH_URI, WORKBENCH_VERSION} from '@studio/studio-workbench.mjs';
import {verifyMintIntent} from '@studio/studio-intent.ts';
import {DEFAULT_MINT_OPTIONS} from '@studio/studio-mint-options.ts';
import {createMintReviewUrl} from '@studio/studio-review-link.ts';
import html from '../dist/workbench-ui.mjs';
import {jsonToolResult} from '../tool-result.mjs';
const readOnly = {readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false};
export const WORKBENCH_CAPABILITIES = {
  version:WORKBENCH_VERSION, tool:'studio_workbench', uri:WORKBENCH_URI,
  browser:'https://beacnpool.github.io/NFT-Studio/workbench/',
  terminal:'npm --prefix mcp run tui', recipes:12,
  rendering:'MCP Apps in supporting hosts; structured text and standalone browser fallback elsewhere',
};
export function registerWorkbenchTools(server, register, runtime = 'node') {
  const meta = {ui:{resourceUri:WORKBENCH_URI, visibility:['model','app']}};
  server.registerTool('studio_workbench', {
    title:'BEACN Workbench', description:'Open the BEACN visual workbench: searchable tools, sourced CIP utility recipes, a build-plan composer and exact-intent review. Supporting MCP Apps hosts show an interactive app; other clients receive the same catalog and a browser link. No wallet activity.',
    inputSchema:z.strictObject({query:z.string().max(200).default(''),group:z.enum(['All','Create','Verify','Build']).default('All')}),
    annotations:readOnly, _meta:meta,
  }, async args => jsonToolResult(workbenchCatalog(args,runtime)));
  server.registerResource('BEACN Workbench', WORKBENCH_URI, {
    mimeType:'text/html;profile=mcp-app', description:'Self-contained BEACN creation workspace; no external assets or network connections.'
  }, async uri => ({contents:[{uri:uri.href,mimeType:'text/html;profile=mcp-app',text:html,
    _meta:{ui:{csp:{connectDomains:[],resourceDomains:[],frameDomains:[]},prefersBorder:true}}}]}));
  register('get_utility_recipe','Read a practical CIP utility recipe, configuration inputs, tool sequence, lifecycle and precise implementation boundary. IDs come from studio_workbench. This does not install or enable a utility.',z.strictObject({id:z.string().min(1).max(40)}),({id})=>getRecipe(id));
  register('plan_nft_utility','Compose one to eight utility recipes into an exportable creation plan. Reports incompatible artifact routes and enforcement that must still be built. Does not create metadata, contracts, signatures or a mint.',z.strictObject({name:z.string().min(1).max(80),purpose:z.string().max(500).default(''),recipeIds:z.array(z.string().min(1).max(40)).min(1).max(8)}),planUtility);
  register('inspect_mint_readiness','Verify an ordinary exact-content mint intent and report files, raw size, committed options and a fresh Studio review link. Full signed transaction fit, wallet ownership and chain inclusion remain unverified.',z.strictObject({intent:z.unknown()}),async({intent:value})=>{
    const intent=await verifyMintIntent(value),options=intent.mintOptions||DEFAULT_MINT_OPTIONS;
    return {schema:'beacn.mint-readiness.v1',status:'content-verified',intentHash:intent.intentHash,mode:intent.mode,
      name:intent.bundle.name,files:intent.bundle.files.map(file=>({name:file.name,mediaType:file.mediaType,bytes:file.bytes,sha256:file.sha256})),
      mintOptions:options,reviewUrl:await createMintReviewUrl(intent,'https://beacnpool.github.io/NFT-Studio/'),
      checks:{content:true,completeSignedSize:false,liveWalletInputs:false,chainInclusion:false},
      passportEligible:intent.schema==='nft-studio.intent.v1',
      next:'Preview these exact files, then build afresh in the wallet review. Native policy permits further minting until expiry and no mint/burn after expiry.',signed:false,submitted:false};
  });
}
