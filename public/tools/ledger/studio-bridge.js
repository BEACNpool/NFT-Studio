/* Seed-only adapter for trusted NFT Studio pages. Wallet approvals remain in-page.
 * The message bridge accepts only this frame's same-origin parent, never another
 * frame, an opaque artwork origin, or an arbitrary external origin.
 */
(() => {
  'use strict';
  const protocol = 'nft-studio-ledger-v1';
  const kind = document.getElementById('draft-body') ? 'scroll' : document.getElementById('mname') ? 'book' : 'reader';
  const params = new URLSearchParams(location.search);
  const studio = params.get('studio') === '1';
  const embedded = window.parent !== window && studio;
  const emit = (type, detail) => {
    window.dispatchEvent(new CustomEvent('nftstudio:ledger:' + type, {detail}));
    if (embedded) parent.postMessage({protocol, type, detail}, location.origin);
  };
  function busy() {
    return kind === 'scroll' ? M.state === 'minting' || SGN.running || (SGN.done > 0 && M.state !== 'done') : kind === 'book' && (MW.locked || SIGNSTATE.submitted);
  }
  function state() {
    if (kind === 'scroll') return {kind, busy:busy(), prepared:!!S.encBytes, title:document.getElementById('b_title')?.value || document.getElementById('draft-title').value, file:S.name || '', sha256:S.sha || '', decodedBytes:S.raw || 0, encodedBytes:S.enc || 0, networkId:M.net, transactionId:M.txid || '', status:M.state, resumeAvailable:!!loadResume()};
    if (kind === 'book') return {kind, busy:busy(), title:document.getElementById('mname').value, networkId:ACTIVE_NET, transactionId:MW.result?.txid || '', bookKey:BOOK.keyHex || '', status:MW.result ? 'submitted' : 'draft'};
    return {kind, busy:false};
  }
  function set(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', {bubbles:true}));
  }
  function seed(config) {
    if (!config || typeof config !== 'object' || config.kind !== kind) throw Error('This workflow does not match the requested creation type');
    if (busy()) throw Error('Finish or recover the current transaction before starting another work');
    const title = typeof config.title === 'string' ? config.title : '';
    if (title.length > 120) throw Error('The title is too long');
    if (kind === 'book') {
      if (title && !/^[A-Za-z0-9 _-]{1,28}$/.test(title)) throw Error('Book names use 1–28 letters, digits, spaces, underscores or hyphens');
      landTab('mint');
      mwGo(1);
      if (title) set('mname', title);
      // Book starters change the suggested name only; entry permissions remain public.
    } else if (kind === 'scroll') {
      if (config.text !== undefined && (typeof config.text !== 'string' || new TextEncoder().encode(config.text).length > 2_000_000)) throw Error('The text draft exceeds the 2 MB handoff limit; choose it as a file instead');
      if (title) { set('draft-title', title); set('b_title', title); }
      if (config.text !== undefined) set('draft-body', config.text);
      if (config.text !== undefined || title) document.querySelector('.text-composer').open = true;
    } else throw Error('Use the reader URL to open a published work');
    emit('seeded', state());
    return state();
  }
  async function prepareFile(file) {
    if (kind !== 'scroll' || busy()) throw Error('Scroll preparation is unavailable during this workflow');
    // A File from the same-origin parent has a different constructor realm.
    // Native Blob brand checking accepts it while rejecting a plain object.
    try { File.prototype.slice.call(file,0,0); } catch (_) { throw Error('Choose a local file'); }
    if (typeof file.name !== 'string') throw Error('Choose a named local file');
    await analyzeFile(file);
    emit('prepared', state());
    return state();
  }
  window.NFTStudioLedger = Object.freeze({version:1, kind, seed, prepareFile, getState:state});
  window.addEventListener('message', event => {
    if (!embedded || event.origin !== location.origin || event.source !== parent || event.data?.protocol !== protocol) return;
    const {type, requestId, config} = event.data;
    try {
      if (type === 'seed') parent.postMessage({protocol,type:'response',requestId,result:seed(config)}, location.origin);
      else if (type === 'state') parent.postMessage({protocol,type:'response',requestId,result:state()}, location.origin);
    } catch (e) {
      parent.postMessage({protocol,type:'response',requestId,error:e.message}, location.origin);
    }
  });
  window.addEventListener('ledger:published', event => emit('published', event.detail));
  for (const id of ['mintnote','signnote','mintchecks']) {
    const el = document.getElementById(id);
    if (el) new MutationObserver(() => emit('status', {...state(), message:el.textContent.trim()})).observe(el,{childList:true,subtree:true,characterData:true});
  }
  if (studio) {
    document.documentElement.classList.add('nft-studio-embedded');
    const style = document.createElement('style');
    style.textContent = '.nft-studio-embedded .ls-nav,.nft-studio-embedded .ls-foot{display:none!important}';
    document.head.append(style);
  }
  const initialTitle = params.get('studioTitle');
  if (initialTitle && kind !== 'reader') {
    try { seed({kind,title:initialTitle}); } catch (e) { emit('error',{message:e.message}); }
  }
  emit('ready', state());
})();
