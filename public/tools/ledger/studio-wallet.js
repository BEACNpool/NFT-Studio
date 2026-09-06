/* Only trusted, same-origin Studio creator frames may discover the parent wallet.
   Opaque artwork previews never load this file or receive wallet providers.
   Discovery does not enable a wallet, sign a transaction, or broadcast anything. */
function studioWalletProviders() {
  const local = window.cardano || {};
  try {
    if (new URLSearchParams(location.search).get('studio') === '1' &&
        window.parent !== window && window.parent.location.origin === location.origin) {
      return Object.assign({}, window.parent.cardano || {}, local);
    }
  } catch (_) { /* Cross-origin parents are deliberately unavailable. */ }
  return local;
}
