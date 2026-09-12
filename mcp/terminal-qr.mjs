/** Plain Unicode only: safe in MCP text, terminals and saved text files. */
import QRCode from 'qrcode/lib/core/qrcode.js';

export function renderTerminalQr(url) {
  const {modules} = QRCode.create(url, {errorCorrectionLevel:'M'});
  const margin = 4;
  const columns = modules.size + margin * 2;
  const light = (x, y) => x < margin || y < margin ||
    x >= columns - margin || y >= columns - margin ||
    !modules.get(y - margin, x - margin);
  const lines = [];
  // Light modules use foreground ink so a dark terminal has a white quiet zone.
  // Two square modules share one monospace cell; no ANSI or trailing spaces.
  const glyphs = [' ', '▄', '▀', '█'];
  for (let y = 0; y < columns; y += 2) {
    let line = '';
    for (let x = 0; x < columns; x++)
      line += glyphs[(light(x, y) ? 2 : 0) + (light(x, y + 1) ? 1 : 0)];
    lines.push(line);
  }
  return {terminalText:lines.join('\n'), terminalColumns:columns, terminalRows:lines.length};
}

export function mobileTerminalMessage(mobile, {markdown = true} = {}) {
  const qr = mobile.qr.terminalText;
  const block = markdown ? '```text\n' + qr + '\n```' : qr;
  return 'NFT-Studio — scan with your phone camera\n\n' + block +
    '\n\n' + mobile.url + '\nExpires: ' + mobile.expiresAtIso +
    '\nOn your phone: Open in wallet browser → VESPR → review the mint.' +
    '\nKeep the QR unwrapped in a monospace font (' + mobile.qr.terminalColumns +
    ' columns). PNG/SVG are also available. Wallet approval is still required.\n';
}
