import { beatHTML, beatPoster, type BeatSpec } from './beat-lab';
// Fixed, versioned programs. Creators configure data; they never inject code.
export type InteractiveSpec =
  | BeatSpec
  | { version: 1; kind: 'focus'; work: number; rest: number; accent: string }
  | { version: 1; kind: 'decision'; choices: string[]; accent: string };

export const INTERACTIVE_TEMPLATES = [
  {
    kind: 'beats' as const,
    name: 'Beat lab',
    verb: 'Your art has a rhythm.',
    detail:
      'Build a drum groove, set its tempo and export four bars as a WAV. The whole beat machine lives with your art.',
    steps: [
      'Open the interactive file',
      'Press Play and edit the drum steps',
      'Save four bars as a WAV',
    ],
    accent: '#dfba6d',
  },
  {
    kind: 'focus' as const,
    name: 'Focus capsule',
    verb: 'A little room for deep work.',
    detail:
      'Your own focus and break timer. Set the rhythm, press start, and keep the program with the art.',
    steps: [
      'Open the interactive file',
      'Choose focus or a break',
      'Start, pause, and reset',
    ],
    accent: '#a5f3c4',
  },
  {
    kind: 'decision' as const,
    name: 'Decision deck',
    verb: 'Turn a creative block into a next move.',
    detail:
      'Write a handful of ideas, prompts, or everyday choices. Your collectible picks one when you need a nudge.',
    steps: [
      'Open the interactive file',
      'Press Pick one',
      'Use the prompt or pick again',
    ],
    accent: '#c1b4ff',
  },
];
export function interactiveDefault(
  kind: InteractiveSpec['kind'],
): InteractiveSpec {
  if (kind === 'beats')
    return {
      version: 1,
      kind,
      accent: '#dfba6d',
      bpm: 92,
      pattern: [137, 16, 255],
    };
  return kind === 'focus'
    ? { version: 1, kind, work: 25, rest: 5, accent: '#a5f3c4' }
    : {
        version: 1,
        kind,
        choices: [
          'Make something',
          'Learn something',
          'Go outside',
          'Call a friend',
        ],
        accent: '#c1b4ff',
      };
}
export function validateInteractive(value: unknown): InteractiveSpec {
  if (!value || typeof value !== 'object')
    throw new Error('Choose a supported interactive utility.');
  const s = value as Record<string, unknown>;
  if (
    s.version !== 1 ||
    typeof s.accent !== 'string' ||
    !/^#[0-9a-fA-F]{6}$/.test(s.accent)
  )
    throw new Error(
      'This interactive utility has an unsupported version or color.',
    );
  if (s.kind === 'beats') {
    if (
      !Number.isInteger(s.bpm) ||
      Number(s.bpm) < 60 ||
      Number(s.bpm) > 160 ||
      !Array.isArray(s.pattern) ||
      s.pattern.length !== 3 ||
      s.pattern.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    )
      throw new Error('Choose 60–160 BPM and three eight-step drum patterns.');
    return {
      version: 1,
      kind: 'beats',
      accent: s.accent,
      bpm: s.bpm as number,
      pattern: [...s.pattern],
    };
  }
  if (s.kind === 'focus') {
    if (
      ![s.work, s.rest].every(
        (n) =>
          typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 90,
      )
    )
      throw new Error(
        'Focus and break lengths must be whole minutes from 1 to 90.',
      );
    return {
      version: 1,
      kind: s.kind,
      work: s.work as number,
      rest: s.rest as number,
      accent: s.accent,
    };
  }
  if (s.kind === 'decision') {
    if (
      !Array.isArray(s.choices) ||
      s.choices.length < 2 ||
      s.choices.length > 8 ||
      s.choices.some(
        (c) =>
          typeof c !== 'string' ||
          !c.trim() ||
          new TextEncoder().encode(c).length > 64,
      )
    )
      throw new Error('Add 2–8 choices, each containing 1–64 UTF-8 bytes.');
    const choices = s.choices.map((c) => (c as string).trim());
    if (new Set(choices).size !== choices.length)
      throw new Error('Give each choice different wording.');
    return { version: 1, kind: s.kind, choices, accent: s.accent };
  }
  throw new Error('This interactive utility is not supported.');
}
const escape = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const scriptData = (v: unknown) =>
  JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export function interactiveHTML(value: InteractiveSpec, title: string): string {
  const s = validateInteractive(value);
  if (!title.trim() || new TextEncoder().encode(title).length > 64)
    throw new Error('Give this NFT a title of 1–64 UTF-8 bytes.');
  if (s.kind === 'beats') {
    const html = beatHTML(s, title);
    if (new TextEncoder().encode(html).length > 6000)
      throw new Error('Beat Lab exceeds its embedded program budget.');
    return html;
  }
  const focus = s.kind === 'focus';
  const body = focus
    ? '<div class="modes"><button id="focus" aria-pressed="true">Focus</button><button id="break" aria-pressed="false">Break</button></div><div class="orb"><span id="clock" role="timer">00:00</span></div><p id="status" role="status">One thing at a time.</p><div class="actions"><button id="start" class="primary">Start</button><button id="reset">Reset</button></div>'
    : '<div class="orb deck"><span id="answer" aria-live="polite">What comes next?</span></div><p id="status" role="status">Pick a little possibility.</p><div class="actions"><button id="pick" class="primary">Pick one</button></div><details><summary>Your choices</summary><ol id="choices"></ol></details>';
  const script = focus
    ? `let mode='work',left=C.work*60,running=false,deadline=0;const clock=$('clock'),start=$('start'),status=$('status');function draw(){if(running){left=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(!left){running=false;start.textContent='Start again';status.textContent=mode==='work'?'Focus complete. Take a break.':'Break complete. Ready when you are.'}}clock.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0')}function reset(){running=false;left=C[mode]*60;start.textContent='Start';status.textContent=mode==='work'?'One thing at a time.':'Give yourself a little space.';draw()}start.onclick=()=>{if(running){draw();running=false;start.textContent='Resume';status.textContent='Paused.'}else{if(!left)left=C[mode]*60;deadline=Date.now()+left*1000;running=true;start.textContent='Pause';status.textContent=mode==='work'?'Your time. Your attention.':'Rest is part of the work.'}draw()};$('reset').onclick=reset;for(const [id,value] of [['focus','work'],['break','rest']])$(id).onclick=()=>{mode=value;for(const key of ['focus','break'])$(key).setAttribute('aria-pressed',String(key===id));reset()};setInterval(draw,200);document.addEventListener('visibilitychange',draw);draw();`
    : `let count=0;for(const text of C.choices){const li=document.createElement('li');li.textContent=text;$('choices').append(li)}$('pick').onclick=()=>{if(!globalThis.crypto?.getRandomValues){$('status').textContent='Open in a current browser to pick a choice.';return}const limit=4294967296-4294967296%C.choices.length,a=new Uint32Array(1);do{crypto.getRandomValues(a)}while(a[0]>=limit);$('answer').textContent=C.choices[a[0]%C.choices.length];$('status').textContent='Pick '+(++count)+' · You choose what to do with it.';$('pick').textContent='Pick again'};`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';img-src data:;connect-src 'none';form-action 'none';base-uri 'none'"><title>${escape(title)}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;background:#101314;color:#f1f2ed;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;padding:24px}main{width:min(100%,440px);text-align:center;--a:${s.accent}}header{letter-spacing:.18em;font-size:11px;color:var(--a)}h1{font-size:clamp(24px,6vw,36px);line-height:1.15;overflow-wrap:anywhere;margin:18px 0 28px}button,summary{font:inherit;cursor:pointer}button{border:1px solid #46514a;background:transparent;color:inherit;border-radius:30px;min-height:48px;padding:10px 24px}button:focus-visible,summary:focus-visible{outline:3px solid #fff;outline-offset:4px}.modes,.actions{display:flex;justify-content:center;gap:8px}.modes button{font-size:14px;min-height:44px;padding:8px 22px}.modes [aria-pressed=true],.primary{background:var(--a);border-color:var(--a);color:#101314}.orb{width:240px;height:240px;margin:28px auto;border:1px solid var(--a);border-radius:50%;display:grid;place-items:center;box-shadow:0 0 0 10px #ffffff04,0 0 0 30px #ffffff02}.orb span{font-size:54px;font-variant-numeric:tabular-nums;letter-spacing:-.04em}.deck{border-radius:32px;transform:rotate(-3deg);padding:24px}.deck span{font-size:28px;line-height:1.15;letter-spacing:-.02em;transform:rotate(3deg);overflow-wrap:anywhere;max-width:100%}#status{color:#c8cdc5;font-size:14px;min-height:42px;margin:0 0 12px}details{margin:24px 0;text-align:left;font-size:14px}summary{color:var(--a)}li{padding:4px;overflow-wrap:anywhere}footer{color:#a7afa7;font-size:11px;margin-top:30px}footer p{margin:5px 0}@media(max-width:340px){body{padding:16px}.orb{width:220px;height:220px}}</style></head><body><main><header>BMKR / ${focus ? 'FOCUS CAPSULE' : 'DECISION DECK'}</header><h1>${escape(title)}</h1>${body}<footer><p>PUBLIC · REUSABLE · RUNS OFFLINE</p><p>${focus ? 'Keep this page open. Device suspension may delay the display.' : 'For everyday inspiration. No prizes, voting, or secure draws.'}</p><p>Session resets on reload. No wallet or network access.</p></footer></main><script>'use strict';const C=${scriptData(s)},$=id=>document.getElementById(id);${script}</script></body></html>`;
  if (new TextEncoder().encode(html).length > 6000)
    throw new Error('This program is too large. Shorten the title or choices.');
  return html;
}
export function interactiveURI(html: string) {
  return (
    'data:text/html;base64,' +
    btoa(
      Array.from(new TextEncoder().encode(html), (b) =>
        String.fromCharCode(b),
      ).join(''),
    )
  );
}
export function interactiveGuide(s: InteractiveSpec, title: string) {
  const t = INTERACTIVE_TEMPLATES.find((t) => t.kind === s.kind)!;
  return `${title}\n${t.name} · BMKR interactive utility v1\n\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nThe HTML program is embedded in the mint transaction alongside the image. Open the interactive attachment in a viewer that supports HTML, or download interactive.html and open it in a current browser. Some wallets show only the cover. The standalone file works offline.\n\nThis is a public, reusable tool, not holder-only access. Anyone with a copy can run it. Session state resets on reload. The program does not access a wallet, send transactions, or fetch external data. ${s.kind === 'beats' ? 'Choose a groove, edit any step, set 60–160 BPM, and export four bars as a mono WAV. Edits restart the bar. Playback stops when hidden; downloads depend on viewer permissions. Open the HTML file directly if the viewer blocks audio or downloads.' : s.kind === 'focus' ? 'Keep the page open; device suspension can delay its display. It is not an alarm service.' : 'The picker is for everyday choices, not prizes, voting, or secure draws.'}\n\nYour title and configuration are public and fixed in the minted program. Transferring the token transfers the collectible, not exclusive use of its public code. The mint policy expiry does not stop the program running.\n`;
}

// A code-native instructional cover, also exported as an editable SVG.
export function interactivePoster(
  value: InteractiveSpec['kind'] | InteractiveSpec,
): string {
  const spec =
    typeof value === 'string'
      ? interactiveDefault(value)
      : validateInteractive(value);
  if (spec.kind === 'beats') return beatPoster(spec);
  const focus = spec.kind === 'focus';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#101314"/><g fill="none" stroke="${spec.accent}"><circle cx="800" cy="180" r="250" opacity=".08"/><circle cx="800" cy="180" r="300" opacity=".05"/><path d="M64 140H960M64 876H960" opacity=".3"/></g><g font-family="Arial,sans-serif" fill="#f1f2ed"><text x="64" y="99" font-size="28" letter-spacing="6" fill="${spec.accent}">BMKR / INTERACTIVE NFT</text><text x="64" y="236" font-size="78" font-weight="700">${focus ? 'Focus' : 'Decision'}</text><text x="64" y="325" font-size="78" font-weight="700">${focus ? 'capsule.' : 'deck.'}</text><g transform="translate(735 440)"><${focus ? 'circle cx="0" cy="0" r="142"' : 'rect x="-142" y="-142" width="284" height="284" rx="32" transform="rotate(-8)"'} fill="${spec.accent}"/><text x="0" y="20" text-anchor="middle" font-size="${focus ? '54' : '38'}" fill="#101314" font-weight="700">${spec.kind === 'focus' ? String(spec.work).padStart(2, '0') + ':00' : 'WHAT IF?'}</text></g><text x="64" y="435" font-size="30" fill="#c8cdc5">${focus ? 'Make time for your next idea.' : 'Your next move, on a card.'}</text><text x="64" y="655" font-size="27" fill="${spec.accent}">HOW TO USE YOUR NFT</text><g font-size="30"><text x="64" y="716">01   Open its interactive file</text><text x="64" y="772">02   ${focus ? 'Choose focus or a break' : 'Press Pick one'}</text><text x="64" y="828">03   ${focus ? 'Start. Pause. Make something.' : 'Try the prompt. Pick again.'}</text></g><text x="64" y="944" font-size="24" letter-spacing="2" fill="#c8cdc5">PUBLIC TOOL · REUSABLE · RUNS OFFLINE</text></g></svg>`;
}
