import {RECIPES,TOOLBOX,STUDIO_HOME,workbenchCatalog,getRecipe,planUtility} from '../../lib/studio-workbench.mjs';
import {verifyMintIntent,createMintIntent} from '../../lib/studio-intent.ts';
import {verifyMintOptions,DEFAULT_MINT_OPTIONS} from '../../lib/studio-mint-options.ts';
import {createMintReviewUrl} from '../../lib/studio-review-link.ts';
import {createBridge} from './bridge.mjs';
const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tag=r=>`<span class="tag ${r.status.toLowerCase()}">${esc(r.status)}</span>`;
let view='recipes', query='', group='All', selected='traits', selectedTools=TOOLBOX, schemas=new Map(), toolName=null;
let choices=new Set(), projectName='My next creation', purpose='', currentPlan=null, intent=null, reviewUrl='', generation=0, noticeTimer;
function notice(message){$('notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',6000);}
const bridge=createBridge((method,params)=>{
  if(method==='teardown'){generation++;intent=null;reviewUrl='';}
  if(method==='ui/notifications/tool-result' && params?.structuredContent?.schema==='beacn.workbench.v1'){
    const names=new Set(params.structuredContent.tools?.map(t=>t.name));selectedTools=TOOLBOX.filter(t=>names.has(t.name));renderCount();
  }
  if(method==='ui/notifications/tool-input' && typeof params?.arguments?.query==='string'){
    query=params.arguments.query.slice(0,200);if(view==='recipes')render();
  }
});
const localTools={studio_workbench:workbenchCatalog,get_utility_recipe:({id})=>getRecipe(id),plan_nft_utility:planUtility,
  verify_mint_intent:async({intent})=>({valid:true,intent:await verifyMintIntent(intent)}),
  configure_mint_options:async({intent:value,...options})=>{const original=await verifyMintIntent(value);const next=await createMintIntent(original.bundle,original.mode,verifyMintOptions({...DEFAULT_MINT_OPTIONS,...original.mintOptions,...options}));return {intent:next,packetJson:JSON.stringify(next,null,2),review:{url:await createMintReviewUrl(next,STUDIO_HOME)},signed:false,submitted:false};},
};
async function call(name,args){
  if(bridge.ready){const result=await bridge.request('tools/call',{name,arguments:args});if(result.isError)throw Error(result.content?.find(c=>c.type==='text')?.text||'Tool rejected this request.');return result.structuredContent||JSON.parse(result.content.find(c=>c.type==='text').text);}
  if(localTools[name])return localTools[name](args);
  throw Error('This tool runs through the connected MCP. Open BEACN Workbench in an MCP Apps host, or use this tool in your chat.');
}
function renderCount(){$('tool-count').innerHTML=`${selectedTools.length}<span>MCP tools</span>`;$('plan-count').textContent=choices.size;}
const titles={recipes:['Utility library','Make it useful','Give your creation an action, a story, a life beyond the image.'],tools:['MCP toolbox','Tools for the whole journey','Plan, create, inspect, research and carry your work into a wallet review.'],review:['Mint review','Know what you’re carrying','Inspect an existing ordinary intent and commit your mint options to its exact content.'],plan:['Your build plan','Bring it together','Choose the capabilities. Keep the dependencies and next steps in view.']};
function changeView(next){clearTimeout(noticeTimer);$('notice').textContent='';view=next;toolName=null;generation++;render();$('workspace').focus({preventScroll:true});}
function render(){
  const [section,title,subtitle]=titles[view];$('section-label').textContent=section;$('title').innerHTML=esc(title)+'<span>.</span>';$('subtitle').textContent=subtitle;
  document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-current',el.dataset.view===view?'page':'false'));renderCount();
  if(view==='recipes')renderLibrary();else if(view==='tools')renderTools();else if(view==='plan')renderPlan();else renderReview();
}
function searchBar(filters=false){return `<div class="toolbar"><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="Search ${view==='tools'?'tools':'recipes or CIPs'}" placeholder="Search ${view==='tools'?'tools, actions…':'recipes, CIPs, possibilities…'}" maxlength="200" value="${esc(query)}"></label>${filters?`<div class="filters" aria-label="Recipe category">${['All','Create','Verify','Build'].map(g=>`<button data-group="${g}" aria-pressed="${g===group}">${g}</button>`).join('')}</div>`:''}</div>`;}
function renderLibrary(){
  const recipes=workbenchCatalog({query,group}).recipes;if(!recipes.some(r=>r.id===selected))selected=recipes[0]?.id;
  $('content').innerHTML=searchBar(true)+`<div class="library"><div class="recipe-list" aria-label="Utility recipes">${recipes.length?recipes.map(r=>`<button class="recipe-row" data-recipe="${r.id}" aria-pressed="${selected===r.id}"><span class="row-meta"><span>${r.standards.map(s=>s.id.replace('CIP-00','CIP-')).join(' · ')||'BEACN PROFILE'}</span>${tag(r)}</span><strong>${esc(r.title)}</strong><p>${esc(r.summary)}</p></button>`).join(''):'<p class="empty">No recipes match. Try “music”, “CIP-68” or clear the search.</p>'}</div><article class="detail" id="recipe-detail">${selected?recipeDetail(getRecipe(selected)):'<p class="empty">Choose another search to explore the library.</p>'}</article></div>`;
}
function recipeDetail(r){return `<div class="detail-head"><span class="overline">${esc(r.group.toUpperCase())} / RECIPE ${String(RECIPES.findIndex(x=>x.id===r.id)+1).padStart(2,'0')}</span>${tag(r)}</div><h2>${esc(r.title)}</h2><p>${esc(r.summary)}</p><div class="standards">${r.standards.map(s=>`<a href="${s.url}" data-open>${s.id.replace(/-0+/,'-')} ↗</a>`).join('')}</div><div class="actions"><button class="primary" data-add="${r.id}">${choices.has(r.id)?'Remove from plan':'Add to build plan'} <span aria-hidden="true">${choices.has(r.id)?'−':'+'}</span></button><a href="${r.url}" data-open>${['Blueprint','Experimental'].includes(r.status)?'Explore the Lab':'Open creator / Lab'} ↗</a></div><h3>What you’ll need</h3><ul class="field-list">${r.fields.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>How to add it</h3><ol class="steps">${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="limit"><h3>What this actually guarantees</h3>${r.limits.map(x=>`<p>${esc(x)}</p>`).join('')}</div><h3>After it changes hands</h3><p style="font-size:14px">${esc(r.lifecycle)}</p><details class="json-tools"><summary>Tools for this recipe</summary><div class="actions">${r.tools.map(t=>`<button data-tool="${t}">${esc(t)}</button>`).join('')}</div></details>`;}
function renderTools(){
  const matches=selectedTools.filter(t=>JSON.stringify(t).toLowerCase().includes(query.trim().toLowerCase()));
  $('content').innerHTML=searchBar()+`<div class="tool-grid">${matches.map(t=>`<article class="tool-card"><span class="tag">${t.group}</span><code>${t.name}</code><p>${esc(t.purpose)}</p><div class="actions"><button data-tool="${t.name}">Inspect & use <span aria-hidden="true">↗</span></button></div></article>`).join('')||'<p class="empty">No tools match this search.</p>'}</div>`;
}
const examples={studio_workbench:{},get_utility_recipe:{id:'traits'},plan_nft_utility:{name:'My next creation',recipeIds:['traits','message']},studio_inspiration:{},studio_capabilities:{},studio_utilities:{},search_knowledge:{query:'holder access',limit:5},search_cip_sources:{query:'CIP-0068',limit:5}};
function renderTool(name){
  const t=selectedTools.find(x=>x.name===name);if(!t)throw Error('This tool is unavailable on the connected server.');
  view='tools';toolName=name;renderCount();$('title').innerHTML='One tool. Clear inputs<span>.</span>';$('subtitle').textContent=t.purpose;
  $('content').innerHTML=`<button data-view="tools">← All tools</button><div class="split" style="margin-top:20px"><section class="panel"><span class="tag">${t.group}</span><h2 style="overflow-wrap:anywhere;margin-top:16px">${t.name}</h2><p>${esc(t.purpose)}</p><label>Arguments (JSON)<textarea id="tool-input" rows="9" spellcheck="false">${esc(JSON.stringify(examples[name]||{},null,2))}</textarea></label><div class="actions"><button class="primary" id="run-tool" ${bridge.ready||localTools[name]?'':'disabled'}>Run with these inputs</button><button id="copy-tool">Copy tool request</button></div><p style="font-size:14px;margin-top:16px">${bridge.ready?'Calls go through your MCP host. Review the exact inputs before running.':localTools[name]?'This content-only tool also works locally in this browser.':'Use this tool in your connected MCP chat. This standalone page has no wallet or network provider.'}</p></section><section class="panel"><h2>Schema & result</h2><details><summary>Input schema</summary><pre class="result">${esc(JSON.stringify(schemas.get(name)?.inputSchema||{note:'Connect through an MCP Apps host to inspect the live tool schema.'},null,2))}</pre></details><pre id="tool-output" class="result" style="margin-top:20px" aria-live="polite">No call made.</pre></section></div>`;
}
function renderPlan(){
  $('content').innerHTML=`<div class="split"><section class="panel"><h2>Your creation brief</h2><p>Combine up to eight recipes. A plan records the work to do; it does not enable the benefits.</p><div class="form"><label>Project name<input id="project-name" maxlength="80" value="${esc(projectName)}"></label><label>What should someone be able to do?<textarea id="purpose" maxlength="500" placeholder="Play a tiny instrument, inspect its credits, carry the sound…">${esc(purpose)}</textarea></label></div><div class="checks">${RECIPES.map(r=>`<label class="check"><input type="checkbox" data-check="${r.id}" ${choices.has(r.id)?'checked':''}><span>${esc(r.title)}</span></label>`).join('')}</div><div class="actions"><button class="primary" id="build-plan" ${choices.size?'':'disabled'}>Build my plan ↗</button><button data-view="recipes">Browse recipes</button></div></section><section class="panel"><h2>A plan you can carry</h2><p>Get prerequisites, implementation gaps, compatible routes and the tools to use next.</p><div id="plan-result">${currentPlan?planResult(currentPlan):'<p class="empty">Choose your recipes, then build the plan.</p>'}</div></section></div>`;
}
function planResult(plan){return `<div class="status-box ${plan.blockers.length||plan.requiresImplementation.length?'warn':''}"><strong>${plan.blockers.length?'Separate creation routes needed':plan.requiresImplementation.length?'Engineering required':'Ready to create the content'}</strong><p>${esc(plan.next)}</p></div>${plan.blockers.map(b=>`<p class="error-text" style="margin:12px 0">${esc(b)}</p>`).join('')}<div class="plan-summary">${plan.recipes.map(r=>`<div><h3>${esc(r.title)} · ${esc(r.status)}</h3><ol>${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`).join('')}</div><div class="actions"><button class="primary" id="export-plan">Download plan</button><button id="copy-plan">Copy build prompt</button>${bridge.ready?'<button id="context-plan">Use plan in chat</button>':''}</div>`;}
function invalidatePlan(){currentPlan=null;$('plan-result')&&($('plan-result').innerHTML='<p class="empty">Your brief changed. Build the plan again.</p>');}
function renderReview(){
  $('content').innerHTML=`<div class="split"><section class="panel"><h2>Bring your exact intent</h2><p>Open a saved ordinary .intent.json request from NFT-Studio. Music packages have their own creator.</p><label class="file-picker">Choose a creation request<input id="intent-file" type="file" accept=".json,application/json"></label><div id="intent-summary">${intent?intentSummary():''}</div></section><section class="panel"><h2>Add mint options</h2><p>These choices change the request hash. Review the updated creation before any wallet action.</p><div id="options">${intent?optionsForm():'<p class="empty">Load a verified intent to set copies, traits and a public message.</p>'}</div></section></div>`;
}
function intentSummary(){return `<div class="status-box"><strong>Exact content verified</strong><p>Full signed transaction fit and chain inclusion are still unchecked.</p></div><h3>${esc(intent.bundle.name)}</h3><p class="hash">${intent.intentHash}</p>${intent.bundle.files.map(f=>`<div class="review-file"><span>${esc(f.name)}</span><span>${f.bytes.toLocaleString()} B</span></div>`).join('')}<p style="margin-top:16px;font-size:14px">${intent.bundle.bytes.toLocaleString()} / 12,000 raw bytes · ${intent.bundle.files.length} / 8 files</p>`;}
function optionsForm(){const o=intent.mintOptions||DEFAULT_MINT_OPTIONS;return `<div class="form"><label>Copies in this transaction<input id="quantity" type="number" min="1" max="1000" step="1" value="${o.quantity}" ${intent.mode!=='nft'?'disabled':''}></label><label>Native mint window<select id="window" ${intent.mode!=='nft'?'disabled':''}>${[[1,'1 hour'],[24,'24 hours'],[168,'7 days'],[720,'30 days']].map(([v,t])=>`<option value="${v}" ${o.mintWindowHours===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Public CIP-25 traits (JSON text map)<textarea id="traits" rows="3" spellcheck="false" ${intent.mode!=='nft'?'disabled':''}>${esc(JSON.stringify(o.traits,null,2))}</textarea></label><label>Public CIP-20 message<input id="memo" value="${esc(o.message)}" ${intent.mode!=='nft'?'disabled':''}></label></div><div class="limit"><p>Quantity is not a lifetime supply cap. Further minting is possible until expiry; minting and burning stop afterward. Transfers continue.</p><p>Timing starts at fresh preparation. Traits and messages are public descriptions, not enforced benefits.</p></div><div class="actions"><button class="primary" id="apply-options" ${intent.mode!=='nft'?'disabled':''}>Verify updated request</button><button id="clear-intent">Clear</button></div>${intent.mode!=='nft'?'<p>Data intents have no NFT mint options. Open the original review in Studio.</p>':''}<div id="review-result"></div>`;}
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copy(text){try{await navigator.clipboard.writeText(text);notice('Copied.');}catch{throw Error('Clipboard access is unavailable. Use the JSON download or select the visible text.');}}
function buildPrompt(){return `Help me build ${currentPlan.name}. ${currentPlan.purpose}\nUse these NFT-Studio recipes: ${currentPlan.recipeIds.join(', ')}.\n${currentPlan.next}\n${currentPlan.blockers.join('\n')}\nExplain implementation requirements and show the exact content before wallet review. This plan is not signing or submission approval.`;}
document.addEventListener('input',event=>{
  const el=event.target;if(el.id==='search'){const caret=el.selectionStart;query=el.value;view==='recipes'?renderLibrary():renderTools();$('search').focus();try{$('search').setSelectionRange(caret,caret);}catch{}}
  if(el.id==='project-name'){projectName=el.value;generation++;invalidatePlan();}if(el.id==='purpose'){purpose=el.value;generation++;invalidatePlan();}
  if(el.id==='tool-input'){generation++;$('tool-output').textContent='Inputs changed. Run again for a fresh result.';}
  if(['quantity','window','traits','memo'].includes(el.id)){generation++;reviewUrl='';$('review-result').innerHTML='';}
});
document.addEventListener('change',async event=>{try{
  const el=event.target;if(el.dataset.check){if(el.checked&&choices.size>=8){el.checked=false;throw Error('Choose up to eight recipes in one plan.');}el.checked?choices.add(el.dataset.check):choices.delete(el.dataset.check);generation++;invalidatePlan();renderCount();$('build-plan').disabled=!choices.size;}
  if(el.id==='intent-file'){
    const file=el.files[0];if(!file)return;const run=++generation;intent=null;reviewUrl='';$('intent-summary').textContent='Verifying exact content…';$('options').innerHTML='';
    try{if(file.size>80000)throw Error('Intent files are limited to 80,000 bytes.');const next=await verifyMintIntent(JSON.parse(await file.text()));if(run!==generation)return;intent=next;renderReview();notice('Exact creation verified.');}catch(error){if(run===generation){$('intent-summary').textContent=error.message;renderReview();throw error;}}
  }
}catch(error){notice(error.message);}});
document.addEventListener('click',async event=>{
  const el=event.target.closest('button,a');if(!el)return;
  try{
    if(el.matches('[data-open]')&&bridge.ready){event.preventDefault();await bridge.request('ui/open-link',{url:el.href});return;}
    if(el.dataset.view){changeView(el.dataset.view);return;}
    if(el.dataset.group){group=el.dataset.group;renderLibrary();return;}
    if(el.dataset.recipe){selected=el.dataset.recipe;renderLibrary();document.querySelector(`[data-recipe="${selected}"]`)?.focus({preventScroll:true});return;}
    if(el.dataset.add){if(choices.has(el.dataset.add))choices.delete(el.dataset.add);else{if(choices.size>=8)throw Error('Choose up to eight recipes.');choices.add(el.dataset.add);}invalidatePlan();renderCount();$('recipe-detail').innerHTML=recipeDetail(getRecipe(selected));notice('Build plan updated.');return;}
    if(el.dataset.tool){generation++;view='tools';render();renderTool(el.dataset.tool);return;}
    if(el.id==='build-plan'){const run=++generation;el.disabled=true;try{const plan=await call('plan_nft_utility',{name:projectName,purpose,recipeIds:[...choices]});if(run!==generation)return;currentPlan=plan;$('plan-result').innerHTML=planResult(plan);}finally{if(el.isConnected)el.disabled=!choices.size;}return;}
    if(el.id==='export-plan'&&currentPlan)download('beacn-utility-plan.json',currentPlan);
    if(el.id==='copy-plan'&&currentPlan)await copy(buildPrompt());
    if(el.id==='context-plan'&&currentPlan){await bridge.request('ui/update-model-context',{structuredContent:currentPlan});notice('Plan added to this chat’s context.');}
    if(el.id==='clear-intent'){generation++;intent=null;reviewUrl='';renderReview();}
    if(el.id==='apply-options'){
      const run=++generation,original=intent;reviewUrl='';$('review-result').textContent='Checking the updated request…';el.disabled=true;
      try{const options=verifyMintOptions({quantity:Number($('quantity').value),mintWindowHours:Number($('window').value),traits:JSON.parse($('traits').value),message:$('memo').value});
        const next=await createMintIntent(original.bundle,original.mode,options);await verifyMintIntent(next);const url=await createMintReviewUrl(next,STUDIO_HOME);
        if(run!==generation)return;intent=next;reviewUrl=url;$('intent-summary').innerHTML=intentSummary();$('review-result').innerHTML=`<div class="status-box"><strong>Updated content verified</strong><p>Download it or open Studio to preview the exact files and create a fresh wallet review.</p></div><p class="hash">${next.intentHash}</p><div class="actions"><button id="download-intent">Download intent</button><a href="${esc(url)}" data-open>Preview in Studio ↗</a></div>`;
      }catch(error){if(run===generation)$('review-result').textContent=error.message;throw error;}finally{if(el.isConnected)el.disabled=false;}
    }
    if(el.id==='download-intent'&&intent&&reviewUrl)download('beacn-creation.intent.json',intent);
    if(el.id==='copy-tool')await copy(JSON.stringify({name:toolName,arguments:JSON.parse($('tool-input').value)},null,2));
    if(el.id==='run-tool'){
      const text=$('tool-input').value;if(text.length>200000)throw Error('Use at most 200,000 characters for a tool request.');const args=JSON.parse(text),name=toolName,run=++generation;
      if(!args||Array.isArray(args)||typeof args!=='object')throw Error('Tool arguments must be a JSON object.');el.disabled=true;$('tool-output').textContent='Running…';
      try{const result=await call(name,args);if(run===generation)$('tool-output').textContent=JSON.stringify(result,null,2);}catch(error){if(run===generation)$('tool-output').textContent=error.message;throw error;}finally{if(el.isConnected)el.disabled=false;}
    }
  }catch(error){notice(error.message||'The action could not be completed.');}
});
render();
bridge.connect().then(async result=>{
  if(!result)return;$('connection').textContent='MCP connected';
  try{const live=await bridge.request('tools/list',{});schemas=new Map(live.tools.map(t=>[t.name,t]));selectedTools=TOOLBOX.filter(t=>schemas.has(t.name));renderCount();if(view==='tools')toolName?renderTool(toolName):renderTools();}catch{notice('The host did not expose tool schemas. Recipes remain available.');}
}).catch(()=>{$('connection').textContent='Local workspace';});
window.addEventListener('pagehide',()=>{generation++;bridge.close();});
