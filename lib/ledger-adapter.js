/* Import this module from the Studio shell; base is the copied ledger directory. */
export function ledgerUrl(
  base,
  {
    kind = 'scroll',
    title = '',
    embedded = false,
    book = '',
    network = 'mainnet',
  } = {},
) {
  const root = new URL(base.replace(/\/?$/, '/'), location.href);
  if (root.origin !== location.origin)
    throw Error('Ledger integration must use the Studio origin');
  const file =
    kind === 'book'
      ? 'ledger-book.html'
      : kind === 'reader'
        ? 'index.html'
        : kind === 'scroll'
          ? 'calculator.html'
          : null;
  if (!file) throw Error('Unknown Ledger workflow');
  const url = new URL(file, root);
  if (kind === 'book')
    url.searchParams.set(book ? 'book' : 'create', book || '1');
  if (title) url.searchParams.set('studioTitle', title);
  if (embedded) url.searchParams.set('studio', '1');
  if (network === 'preview') url.searchParams.set('network', 'preview');
  return url.href;
}
export function mountLedger(
  container,
  { base, seed, kind = seed?.kind || 'scroll', onEvent = (_event) => {} },
) {
  if (!(container instanceof Element))
    throw Error('Choose an editor container');
  const frame = document.createElement('iframe');
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Callers may use only events; still make load failures available to ready/prepareFile.
  ready.catch(() => {});
  frame.title =
    kind === 'book'
      ? 'Ledger Book creator'
      : kind === 'reader'
        ? 'Ledger Scrolls reader'
        : 'Ledger Scroll creator';
  frame.src = ledgerUrl(base, { kind, embedded: true });
  frame.style.cssText = 'width:100%;height:100%;min-height:760px;border:0';
  const receive = (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== frame.contentWindow ||
      event.data?.protocol !== 'nft-studio-ledger-v1'
    )
      return;
    if (event.data.type === 'ready') {
      try {
        if (seed) frame.contentWindow.NFTStudioLedger.seed(seed);
        resolveReady(frame.contentWindow.NFTStudioLedger);
      } catch (error) {
        rejectReady(error);
        onEvent({ type: 'error', detail: { message: error.message } });
      }
    }
    onEvent(event.data);
  };
  frame.addEventListener('load', () => {
    try {
      if (frame.contentWindow.NFTStudioLedger) return;
    } catch {}
    const error = new Error(
      'The embedded creator could not load. Use the full-page creator link.',
    );
    rejectReady(error);
    onEvent({ type: 'error', detail: { message: error.message } });
  });
  window.addEventListener('message', receive);
  container.append(frame);
  return {
    frame,
    ready,
    topLevelUrl: ledgerUrl(base, { kind, title: seed?.title }),
    async prepareFile(file) {
      const api = await ready;
      return api.prepareFile(file);
    },
    destroy() {
      window.removeEventListener('message', receive);
      frame.remove();
    },
  };
}
