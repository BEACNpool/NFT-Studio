/** BEACN's creation recipes. Descriptions never grant contract or wallet authority. */
export const WORKBENCH_VERSION = '0.5.0';
export const STUDIO_HOME = 'https://beacnpool.github.io/NFT-Studio/';
export const WORKBENCH_URI = 'ui://nft-studio/workbench/v1';
export const REVIEWED_ON = '2026-09-12';
const cip = n => ({ id: `CIP-${String(n).padStart(4, '0')}`, url: `https://cips.cardano.org/cip/CIP-${String(n).padStart(4, '0')}` });
const recipe = (id, title, group, status, summary, cips, fields, steps, limits, tools, route, lifecycle) => ({
  id, title, group, status, summary, standards: cips.map(cip), fields, steps, limits, tools,
  url: new URL(route, STUDIO_HOME).href, lifecycle,
});
export const RECIPES = [
  recipe('traits', 'Traits & collectible identity', 'Create', 'Ready',
    'Give a creation clear, public attributes that wallets and readers can inspect.', [25, 14],
    ['Name and image cover', 'Up to 12 text traits', 'Exact policy ID + asset-name bytes after mint'],
    ['Package the exact cover and files with create_mint_intent.', 'Apply traits with configure_mint_options. Every key and value is at most 64 UTF-8 bytes.', 'Verify the new intent, preview the files, then review a fresh transaction in Studio.'],
    ['Traits describe the asset; they do not enforce rarity or benefits.', 'CIP-14 fingerprints help display identity; retain the full policy and exact name bytes.', 'Copies are units in this transaction, not a lifetime cap.'],
    ['create_mint_intent', 'configure_mint_options', 'inspect_mint_readiness'], '?view=labs&lab=agents',
    'Public metadata travels with the asset. Transfers remain possible after the native mint window closes.'),
  recipe('message', 'A message on the record', 'Create', 'Ready',
    'Attach a public dedication, event note or creation message to the mint transaction.', [20],
    ['Public message, at most 64 UTF-8 bytes in this Studio profile'],
    ['Prepare an ordinary NFT intent.', 'Set message with configure_mint_options; Studio writes the CIP-20 msg array under label 674.', 'Check the new request hash and visible message before wallet review.'],
    ['Messages are public and permanent after inclusion.', 'A message is transaction metadata; it is not a private note or a token permission.'],
    ['configure_mint_options', 'inspect_mint_readiness'], '?view=labs&lab=agents',
    'The message remains in the original transaction history when the token changes hands.'),
  recipe('interactive', 'A collectible that does something', 'Create', 'Ready',
    'Carry a small game, instrument, timer or useful program alongside its cover.', [25],
    ['Self-contained HTML or SVG program', 'Image cover', 'Controls and a documented use action'],
    ['Build and test the actual program, including touch and keyboard controls.', 'Package the exact program and cover; ordinary requests allow eight files and 12,000 total raw bytes.', 'Inspect the embedded rendering. Let the holder review and mint with their own wallet.'],
    ['The program is public: anyone with its bytes can use or copy it.', 'CIP-25 describes media; the embedded program supplies the behavior.', 'Larger existing Studio games use their dedicated browser creator.'],
    ['validate_payload', 'create_mint_intent', 'studio_inspiration'], '?create=utility',
    'The program can keep working without its creator if its dependencies are embedded. Browser saves are device-local.'),
  recipe('attachments', 'Exact files, carried together', 'Create', 'Ready',
    'Bundle instructions, a license text or small supporting files with an image cover.', [25],
    ['Exact files and MIME types', 'Image cover index', 'Public description of the contents'],
    ['Keep original file bytes; use the local-file helper for binary media.', 'Validate the complete bundle, then create and verify the mint intent.', 'Check the full signed transaction size in the wallet flow; payload size alone is not enough.'],
    ['Eight files and 12,000 total raw bytes for the ordinary packager.', 'A license text expresses terms; the token does not establish ownership of copyright.', 'Do not embed private files or secrets.'],
    ['validate_payload', 'create_mint_intent', 'verify_mint_intent'], '?create=data',
    'Exact bytes can be recovered from the recorded artifact. Copying a file does not transfer the token.'),
  recipe('music', 'Music with complete credits', 'Create', 'Lab',
    'Bind exact audio, cover and declared credits into one verifiable release package.', [60],
    ['Exact audio and cover', 'Artist, track and contributor credits', 'Declared identifiers and shares where supported'],
    ['Use create_music_release with the dedicated Music schema, not an ordinary file intent.', 'Verify the full package with verify_music_release; credits are part of its hash.', 'Open the Music release Lab and rebuild for fresh wallet review.'],
    ['CIP-60-aligned profile; exact embedded URIs and fields have documented strict-v3 interoperability limits.', 'Credits and declared shares do not prove rights or distribute payments.', 'Music packages cannot be combined with ordinary mint-options intents.'],
    ['create_music_release', 'verify_music_release', 'prepare_unsigned_music_transaction'], '?view=labs&lab=music',
    'A credit edit creates a different release identity and requires a new review. Original credits remain in prior records.'),
  recipe('proof', 'Proof of exact bytes', 'Verify', 'Lab',
    'Create a compact public hash record and later check a file against it.', [190],
    ['Exact files to hash', 'Supported digest algorithms', 'Separate evidence of ledger inclusion'],
    ['Create a bounded proof record with create_proof_record.', 'Retain the local sidecar and original files; the record contains digests, not the file contents.', 'Use verify_proof_record to compare a supplied file. Check inclusion separately.'],
    ['Studio implements a bounded public-hashes profile of proposed CIP-190.', 'A hash match proves neither authorship, truth, rights nor chain inclusion.', 'The tool creates a record; it does not submit it.'],
    ['create_proof_record', 'verify_proof_record'], '?view=labs&lab=proof',
    'Anyone with the original file can compare its bytes. Losing the file cannot be repaired from its digest.'),
  recipe('passport', 'A portable artifact passport', 'Verify', 'Lab',
    'Export a compact, independently inspectable identity record from an eligible receipt.', [],
    ['An exact-file NFT or data receipt', 'Canonical passport bytes', 'Optional original transaction bytes for separate checks'],
    ['Open Artifact passport or Activity → Export passport.', 'Import the canonical export and inspect each commitment.', 'Separate matching content and transaction structure from real ledger confirmation.'],
    ['A BEACN profile, not a numbered CIP.', 'The strict producer currently excludes advanced mint options and multi-copy receipts.', 'A receipt-reported confirmation is not independent chain evidence.'],
    ['verify_mint_intent'], '?view=labs&lab=passport',
    'The passport is portable evidence. It is not an ownership credential or transferable entitlement.'),
  recipe('registry', 'Inspect registry signatures', 'Verify', 'Lab',
    'Check supported metadata signatures while keeping key trust explicit.', [26],
    ['Original unmodified JSON', 'Explicit trusted subject/key rules', 'Prior sequence records if available'],
    ['Open Registry signatures with the original JSON text.', 'Select trust independently of the submitted record.', 'Inspect validity, trust and sequence comparison as separate results.'],
    ['The bounded scalar profile is not full CIP-26 conformance or registry enrollment.', 'No native-policy authentication or automatic key trust.', 'A valid signature can endorse false data.'],
    ['search_knowledge', 'read_knowledge'], '?view=labs&lab=registry',
    'Keep original text and prior sequences for future comparisons. The Lab does not operate a registry.'),
  recipe('evolving', 'An NFT that can evolve', 'Build', 'Experimental',
    'Design holder-authorized state changes using a reference NFT and user token.', [68, 67, 57],
    ['Update authority and exact token labels', 'Allowed state transitions', 'Freeze, transfer and recovery rules'],
    ['Explore the fixed State Capsule codec and its 100/222 token pair.', 'Apply only the trusted blueprint with apply_state_capsule_parameters.', 'Integrate and independently evaluate issuance, update and freeze transactions before a live release.'],
    ['Ordinary native minting does not create an evolving NFT.', 'The fixed capsule has no lost-key recovery or admin override.', 'Freeze permanently locks the reference state and ADA; local tests do not prove inclusion.'],
    ['apply_state_capsule_parameters', 'read_knowledge'], '?view=labs&lab=capsule',
    'Model issuance → holder transfer → authorized update → irreversible freeze, including failure and lost-key cases.'),
  recipe('holder-access', 'Holder access to a benefit', 'Build', 'Blueprint',
    'Plan a real ownership check for protected content, a service or a community space.', [8, 30],
    ['Exact qualifying policy and asset bytes', 'Origin-bound nonce and short expiry', 'Trusted holdings source and protected service'],
    ['Ask a compatible wallet to sign a purpose-bound challenge; verify COSE and address/key binding.', 'Consume the nonce atomically and recheck current holdings from a trusted source.', 'Serve the benefit from the protected backend; retest after transfer, expiry and replay.'],
    ['CIP-8/30 message signing alone does not prove current NFT ownership.', 'No deployed holder-auth service is supplied by this recipe.', 'Static Pages cannot protect a secret; downloaded content cannot be recalled.'],
    ['search_cip_sources', 'get_cip_source_chunk', 'search_knowledge'], '?view=labs&lab=knowledge',
    'Transfer should stop future authorized access. Define session expiry and issuer downtime behavior.'),
  recipe('redemption', 'A ticket or one-time claim', 'Build', 'Blueprint',
    'Design a benefit that can be consumed once, with an explicit issuer process.', [8, 30, 68],
    ['What is redeemed and who fulfills it', 'Atomic consumption record or contract state', 'Transfer, expiry and dispute rules'],
    ['Choose where the one-use state is enforced: trusted service or validated contract.', 'Bind the claimant, exact asset and action; reject replay and concurrent double claims.', 'Implement delivery and failure handling, then test transfer and expiry.'],
    ['Metadata and browser-local flags cannot consume a ticket.', 'A closed native policy also prevents later burning; do not promise burn-to-redeem after expiry.', 'Physical delivery depends on the issuer. No check-in service is deployed by this plan.'],
    ['search_knowledge', 'read_knowledge'], '?view=labs&lab=knowledge',
    'Issue → transfer if allowed → atomic claim → fulfillment or documented failure. Consumed claims must stay consumed.'),
  recipe('royalties', 'Creator royalties, honestly', 'Build', 'Blueprint',
    'Understand a royalty declaration and the marketplaces needed to honor it.', [27],
    ['Policy and royalty recipient', 'Declared rate', 'Marketplaces and their current support'],
    ['Read the original CIP-27 metadata and policy-association requirements.', 'Check each intended marketplace’s handling before choosing an implementation.', 'Implement and test the declaration separately; the ordinary options tool does not add CIP-27 royalty metadata.'],
    ['CIP-27 is a community declaration, not universal ledger-enforced resale payments.', 'A trait named royalty does not configure a royalty standard.', 'Studio does not collect or distribute royalty payments.'],
    ['search_cip_sources', 'get_cip_source_chunk'], '?view=labs&lab=knowledge',
    'Payment depends on each resale path and marketplace behavior; direct transfers need not honor the declaration.'),
];

const toolGroup = (group, names) => names.map(([name, purpose]) => ({name, group, purpose}));
export const TOOLBOX = [
  ...toolGroup('Plan', [['studio_workbench','Open this visual workspace and browse utility recipes.'],['get_utility_recipe','Read a sourced recipe, prerequisites and complete use path.'],['plan_nft_utility','Compose a bounded build plan; flag incompatible mint routes.'],['studio_guide','Guide the creative conversation one question at a time.'],['studio_inspiration','Explore recorded originals and supported creator-copy routes.'],['studio_utilities','Read available utility choices and mint-option limits.'],['studio_capabilities','Discover this server’s actual capabilities and limits.']]),
  ...toolGroup('Create', [['validate_payload','Check exact files, hashes, MIME types and byte limits.'],['create_mint_intent','Package supplied files for fresh browser wallet review.'],['configure_mint_options','Apply copies, policy duration, traits and a public memo.'],['create_music_release','Package exact audio, cover and declared credits.'],['create_proof_record','Build a public hash record from supplied files.'],['apply_state_capsule_parameters','Parameterize the fixed experimental capsule blueprint.']]),
  ...toolGroup('Verify', [['inspect_mint_readiness','Inspect a verified ordinary intent before wallet review.'],['verify_mint_intent','Check the canonical request and all file hashes.'],['verify_music_release','Check exact music-package and credit identity.'],['verify_proof_record','Compare supplied bytes against a proof record.'],['validate_metadata','Measure ledger metadata structure and CBOR (Node only).'],['verify_signed_transaction','Inspect witnesses against a retained ordinary preparation (Node only).']]),
  ...toolGroup('Share', [['create_mobile_handoff','Create an encrypted 15-minute phone continuation.'],['revoke_mobile_handoff','End a phone continuation using its private revocation data.'],['create_payload_qr','Encode a small public creation into a printable QR.']]),
  ...toolGroup('Research', [['search_knowledge','Search the curated, sourced knowledge catalog.'],['read_knowledge','Read an allowlisted entry and implementation evidence.'],['search_cip_sources','Search the pinned original CIP README index.'],['get_cip_source_chunk','Read exact original source using UTF-8 byte offsets.']]),
  ...toolGroup('Prepare', [['prepare_unsigned_transaction','Prepare ordinary unsigned CBOR from authorized wallet inputs.'],['prepare_unsigned_music_transaction','Prepare dedicated music CBOR from authorized wallet inputs.']]),
];
export function workbenchCatalog({query = '', group = 'All'} = {}, runtime = 'node') {
  if (typeof query !== 'string' || query.length > 200 || !['All','Create','Verify','Build'].includes(group)) throw Error('Use a query up to 200 characters and a listed recipe group.');
  const normalize = value => value.toLowerCase().replace(/cip[- ]?0*(\d+)/g,'cip-$1');
  const q = normalize(query.trim());
  return {
    schema:'beacn.workbench.v1', version:WORKBENCH_VERSION, reviewedOn:REVIEWED_ON,
    title:'BEACN Workbench', url:STUDIO_HOME+'workbench/', uiResource:WORKBENCH_URI,
    recipes:RECIPES.filter(r => (group === 'All' || r.group === group) && normalize(JSON.stringify(r)).includes(q)),
    tools:TOOLBOX.filter(t => runtime === 'node' || !['validate_metadata','verify_signed_transaction'].includes(t.name)),
    boundary:'Plans describe work. Only supported tools transform supplied content; wallet approval and ledger confirmation are separate.',
  };
}
export function getRecipe(id) {
  const found = RECIPES.find(r => r.id === id);
  if (!found) throw Error('Unknown recipe. Choose an ID from studio_workbench.');
  return structuredClone(found);
}
export function planUtility({name, recipeIds, purpose = ''}) {
  for (const [label, value, max] of [['Name',name,80],['Purpose',purpose,500]]) {
    if (typeof value !== 'string' || value.length > max || Array.from(value).some(c => { const n=c.codePointAt(0); return n<32 || (n>=127&&n<=159) || (n>=0x202a&&n<=0x202e) || (n>=0x2066&&n<=0x2069); }) || new TextDecoder().decode(new TextEncoder().encode(value)) !== value) throw Error(`${label} must be ordinary text, at most ${max} characters.`);
  }
  if (!name.trim()) throw Error('Give the project a name.');
  if (!Array.isArray(recipeIds) || recipeIds.length < 1 || recipeIds.length > 8 || new Set(recipeIds).size !== recipeIds.length) throw Error('Choose one to eight distinct recipes.');
  const recipes = recipeIds.map(getRecipe);
  const blockers = [];
  const ordinary = recipeIds.some(id => ['traits','message','interactive','attachments'].includes(id));
  if (recipeIds.includes('music') && ordinary) blockers.push('Music uses its own package. Ordinary files, traits and mint options cannot be applied to that package; prepare separate artifacts.');
  if (recipeIds.includes('evolving') && (ordinary || recipeIds.includes('music'))) blockers.push('Evolving state needs its dedicated Plutus path; the ordinary and Music native builders cannot issue it.');
  if (recipeIds.includes('passport') && recipeIds.some(id => ['traits','message','music','evolving'].includes(id))) blockers.push('The strict Passport producer does not accept these advanced/dedicated profiles. Keep full receipts and use their dedicated recovery paths.');
  const engineering = recipes.filter(r => ['Experimental','Blueprint'].includes(r.status)).map(r=>r.id);
  return {
    schema:'beacn.utility-plan.v1', name:name.trim(), purpose:purpose.trim(), reviewedOn:REVIEWED_ON,
    recipeIds:[...recipeIds], status:'plan-only', compatible:!blockers.length, blockers,
    requiresImplementation:engineering, recipes,
    next: blockers.length ? 'Resolve the separate artifact routes before creating an intent.' : engineering.length ? 'Implement and verify the listed enforcement before promising the benefit.' : 'Create the exact content and follow the dedicated recipe tools. Preview before wallet review.',
    checks:['Show the actual files and usable action.', 'Verify exact identity, limits and a fresh content hash.', 'Review with the user’s wallet; no plan grants signing or submission approval.', 'Confirm inclusion and recover exact bytes before reporting a completed mint.'],
    signed:false, submitted:false,
  };
}
