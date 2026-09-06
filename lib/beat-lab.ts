import { gzipSync, strToU8 } from 'fflate';
import template from './beat-lab-template.json';

export type BeatSpec = {
  version: 1;
  kind: 'beats';
  accent: string;
  bpm: number;
  pattern: number[];
};
const escape = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function beatHTML(s: BeatSpec, title: string) {
  const values: Record<string, string> = {
    __TITLE__: escape(title),
    __ACCENT__: s.accent,
    __BPM__: String(s.bpm),
    __PATTERN__: JSON.stringify(s.pattern),
  };
  const html = template.replace(
    /__(?:TITLE|ACCENT|BPM|PATTERN)__/g,
    (key) => values[key],
  );
  // Fixed gzip timestamp is essential: the preview and mint must hash identically.
  const encoded = btoa(
    String.fromCharCode(...gzipSync(strToU8(html), { level: 9, mtime: 0 })),
  );
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';connect-src 'none';form-action 'none';base-uri 'none'"><title>${escape(title)}</title><body style="background:#101114;color:#dfba6d;font:16px system-ui;padding:24px">Opening Beat Lab…<script>(async()=>{try{let s=await new Response(new Blob([Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();document.open();document.write(s);document.close()}catch{document.body.textContent='Open Beat Lab in a current browser with JavaScript and gzip decompression support.'}})()</script>`;
}
export function beatPoster(s: BeatSpec) {
  const cells = s.pattern
    .map((bits, row) =>
      Array.from(
        { length: 8 },
        (_, i) =>
          `<rect x="${64 + i * 112}" y="${405 + row * 102}" width="88" height="72" rx="12" fill="${bits & (1 << i) ? s.accent : '#30343b'}"/>`,
      ).join(''),
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#101114"/><g font-family="Arial,sans-serif" fill="#f8f0dc"><text x="64" y="98" fill="${s.accent}" font-size="28" letter-spacing="5">BMKR / INTERACTIVE NFT</text><text x="64" y="246" font-size="104" font-weight="700">Beat lab.</text><text x="64" y="319" font-size="32">${s.bpm} BPM · Your pattern. Your sound.</text>${cells}<text x="64" y="767" fill="${s.accent}" font-size="30">OPEN THE HTML APP</text><text x="64" y="829" font-size="34">Play. Edit the drums. Save a WAV.</text><path d="M64 892H960" stroke="${s.accent}"/><text x="64" y="952" font-size="24" letter-spacing="2">PUBLIC TOOL · REUSABLE · RUNS OFFLINE</text></g></svg>`;
}
