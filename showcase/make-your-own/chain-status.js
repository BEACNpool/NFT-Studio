// Read-only availability check. No wallet access, signing, or submission.
(async () => {
  const status = document.getElementById('chain-status');
  try {
    const base = 'https://koios.beacn.workers.dev/api/v1';
    const rows = await Promise.all(['/tip','/epoch_params?order=epoch_no.desc&limit=1'].map(async path => {
      const response = await fetch(base + path, {cache:'no-store',signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Unavailable');
      const values = await response.json();
      if (!Array.isArray(values) || !values[0]) throw new Error('Invalid response');
      return values[0];
    }));
    const [tip, params] = rows;
    const age = Date.now()/1000 - Number(tip.block_time);
    if (!Number.isFinite(age) || age > 300 || age < -60 || Number(tip.epoch_no) !== Number(params.epoch_no) || Number(params.max_tx_size) < 1024) throw new Error('Stale feed');
    status.textContent = 'Live chain connection available. Open NFT mint review, connect a compatible Cardano wallet, and review the fees before approving.';
    status.style.borderColor = '#70ccb0';
    status.style.color = '#b0ffe0';
  } catch {
    status.textContent = 'The chain connection could not be verified right now. You can preview or save the request; NFT-Studio will check again before preparing a mint. If your device clock is wrong, correct it and reload.';
  }
})();
