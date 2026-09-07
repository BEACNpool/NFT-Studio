// Load before the framework runtime. Studio tabs are screens within one static
// page, so traversing their history must not fetch/remount a server route.
window.NFTStudioNavigation = { onTraverse: null };
window.addEventListener(
  'popstate',
  function (event) {
    var state = event.state && event.state.nftStudio;
    var handler = window.NFTStudioNavigation.onTraverse;
    if (!state || state.path !== location.pathname || !handler) return;
    event.stopImmediatePropagation();
    handler(state);
  },
  true,
);
