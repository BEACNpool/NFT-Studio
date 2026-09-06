import {
  normalizeDesign,
  drawBackdrop,
  drawStroke,
  drawForeground,
  type Design,
} from './design';
import { assetPath } from './paths';
import { validateInteractive, type InteractiveSpec } from './interactive';
export type Utility = {
  id: string;
  benefit: string;
  destination: string;
  terms: string;
  eligibility: string;
  starts: string;
  ends: string;
};
export type Artwork = {
  name: string;
  description: string;
  source: string;
  customImage?: string;
  seed: number;
  hue: number;
  detail: number;
  scale: number;
  rotation: number;
  background: string;
  signature: boolean;
  traits: { trait_type: string; value: string }[];
  utilities: Utility[];
  license: string;
  design?: Design;
  interactive?: InteractiveSpec;
};
export type SavedArtwork = {
  id: string;
  createdAt: string;
  art: Artwork;
  thumbnail: string;
};
export const SOURCES = [
  {
    id: 'chroma',
    name: 'Chroma organism',
    tag: 'Glass / organic',
    image: assetPath('/art/chroma.webp'),
    description:
      'Opalescent glass folds around a luminous heart. A small universe, caught in the act of becoming.',
  },
  {
    id: 'solar',
    name: 'Solar relic',
    tag: 'Metal / magnetic',
    image: assetPath('/art/solar.webp'),
    description:
      'A magnetic storm held perfectly still. Thousands of golden filaments tracing the shape of an impossible sun.',
  },
  {
    id: 'tidal',
    name: 'Tidal memory',
    tag: 'Glass / oceanic',
    image: assetPath('/art/tidal.webp'),
    description:
      'The ocean remembers in spirals. Cobalt glass and icy fins, shaped by an imagined tide.',
  },
  {
    id: 'interference',
    name: 'Interference',
    tag: 'Math / waves',
    image: '',
    description:
      'Layered polar curves drift through one another, revealing order in the space between waves.',
  },
  {
    id: 'orbit',
    name: 'Orbital',
    tag: 'Math / motion',
    image: '',
    description:
      'A constellation of looping trajectories. Geometry finding its own gravity.',
  },
  {
    id: 'terrain',
    name: 'Resonance',
    tag: 'Math / fields',
    image: '',
    description:
      'A topography of overlapping sine waves, rendered as luminous contour lines.',
  },
];
export const INITIAL: Artwork = {
  name: 'Chroma organism no. 001',
  description: SOURCES[0].description,
  source: 'chroma',
  seed: 4281,
  hue: 0,
  detail: 0,
  scale: 87,
  rotation: 0,
  background: '#080a0b',
  signature: false,
  traits: [],
  utilities: [],
  license: 'No license specified',
};
export function byteTruncate(value: string, max: number) {
  let s = '';
  for (const c of value) {
    if (new TextEncoder().encode(s + c).length > max) break;
    s += c;
  }
  return s;
}
export const isGenerative = (source: string) =>
  ['interference', 'orbit', 'terrain'].includes(source);
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function escapeXML(s: string) {
  return s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
}
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
export function colorHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs((((h % 360) / 60) % 2) - 1)),
    m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    '#' +
    [r, g, b]
      .map((v) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export const canExportSVG = (a: Artwork) => isGenerative(a.source) && !a.design;
export function artSVG(a: Artwork) {
  if (a.design)
    throw new Error(
      'Personalized layers are included in PNG, mint and project exports. SVG is available for mathematical artwork without Design Lab layers.',
    );
  return mathSVG(a);
}
function mathSVG(a: Artwork, transparent = false) {
  if (!isGenerative(a.source))
    throw new Error('Vector export is available for mathematical artwork.');
  const rnd = random(a.seed),
    phase = rnd() * Math.PI * 2,
    arms = 3 + Math.floor(rnd() * 5),
    lines = 35 + Math.floor(a.detail * 1.1),
    paths = [];
  for (let j = 0; j < lines; j++) {
    const f = j / lines,
      points = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * Math.PI * 2;
      let x: number, y: number;
      if (a.source === 'orbit') {
        const r = 260 + 40 * Math.cos(t * arms + phase);
        x = 512 + Math.cos(t + f * 2.8) * r;
        y = 512 + Math.sin(t - f * 2.8) * r * 0.85;
      } else if (a.source === 'terrain') {
        x = 112 + (i / 300) * 800;
        const nx = (i / 300) * 7;
        y =
          200 +
          f * 620 -
          90 * Math.sin(nx + f * 4 + phase) * Math.sin(nx * 0.8 - f * 3) -
          40 * Math.cos(nx * 2 + f * 6);
      } else {
        const r =
          245 +
          76 * Math.sin(t * arms + phase + f * 3.2) +
          32 * Math.cos(t * 3 - f * 5);
        x = 512 + Math.cos(t) * r * (0.58 + f * 0.48);
        y = 512 + Math.sin(t) * r * (0.7 + f * 0.4);
      }
      points.push(`${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    const hue = (a.hue + 140 + f * 180) % 360;
    paths.push(
      `<path d="${points.join('')}${a.source === 'terrain' ? '' : 'Z'}" fill="none" stroke="${colorHex(hue, 85, 56 + f * 25)}" stroke-width="${0.65 + f * 0.85}" opacity="${0.25 + f * 0.65}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><title>${escapeXML(a.name)}</title>${transparent ? '' : `<rect width="1024" height="1024" fill="${a.background}"/>`}<g transform="translate(512 512) rotate(${a.rotation}) scale(${a.scale / 100}) translate(-512 -512)">${paths.join('')}</g>${a.signature ? `<text x="64" y="952" font-size="20" font-family="monospace" fill="#ddd">${escapeXML(a.name.slice(0, 45))} / ${a.seed}</text>` : ''}</svg>`;
}
const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) return imageCache.get(url)!;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(url);
      reject(new Error('The artwork could not load. Please try again.'));
    };
    img.src = url;
  });
  if (!url.startsWith('blob:')) {
    imageCache.set(url, promise);
    const custom = [...imageCache.keys()].filter((key) =>
      key.startsWith('data:'),
    );
    while (custom.length > 2) imageCache.delete(custom.shift()!);
  }
  return promise;
}
async function renderBaseArtwork(
  a: Artwork,
  size = 1024,
  transparent = false,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser does not support canvas export.');
  if (isGenerative(a.source)) {
    const url = URL.createObjectURL(
      new Blob([mathSVG(a, transparent)], { type: 'image/svg+xml' }),
    );
    try {
      ctx.drawImage(await loadImage(url), 0, 0, size, size);
    } finally {
      URL.revokeObjectURL(url);
    }
    return canvas;
  }
  if (a.source === 'blank') {
    if (!transparent) {
      ctx.fillStyle = a.background;
      ctx.fillRect(0, 0, size, size);
    }
    if (a.signature) {
      ctx.font = `${size * 0.019}px monospace`;
      ctx.fillStyle = '#ddd';
      ctx.fillText(
        `${a.name.slice(0, 45)} / ${a.seed}`,
        size * 0.06,
        size * 0.93,
        size * 0.86,
      );
    }
    return canvas;
  }
  const source =
    a.source === 'custom'
      ? a.customImage
      : SOURCES.find((s) => s.id === a.source)?.image;
  if (!source) throw new Error('Choose an artwork first.');
  const img = await loadImage(source);
  if (!transparent) {
    ctx.fillStyle = a.background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate((a.rotation * Math.PI) / 180);
  const scale =
    ((a.scale / 100) * size) / Math.max(img.naturalWidth, img.naturalHeight);
  ctx.filter = `hue-rotate(${a.hue}deg)`;
  ctx.globalCompositeOperation =
    a.source === 'custom' ? 'source-over' : 'screen';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    (-img.naturalWidth * scale) / 2,
    (-img.naturalHeight * scale) / 2,
    img.naturalWidth * scale,
    img.naturalHeight * scale,
  );
  ctx.restore();
  if (a.detail > 0) {
    const rnd = random(a.seed);
    for (let i = 0; i < a.detail * 3; i++) {
      const x = rnd() * size,
        y = rnd() * size,
        r = ((0.2 + rnd() * 1.1) * size) / 1024;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${140 + a.hue + rnd() * 150},75%,85%,${0.1 + rnd() * 0.45})`;
      ctx.fill();
    }
  }
  if (a.signature) {
    ctx.font = `${size * 0.019}px monospace`;
    ctx.fillStyle = '#ddd';
    ctx.fillText(
      `${a.name.slice(0, 45)} / ${a.seed}`,
      size * 0.06,
      size * 0.93,
      size * 0.86,
    );
  }
  return canvas;
}
export async function renderArtwork(
  a: Artwork,
  size = 1024,
): Promise<HTMLCanvasElement> {
  if (!a.design) return renderBaseArtwork(a, size);
  const d = normalizeDesign(a.design),
    base = await renderBaseArtwork({ ...a, signature: false }, size, true);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser does not support canvas export.');
  ctx.scale(size / 1024, size / 1024);
  drawBackdrop(ctx, a.background, d);
  ctx.save();
  ctx.globalAlpha = d.opacity / 100;
  ctx.globalCompositeOperation = SOURCES.some(
    (s) => s.id === a.source && s.image,
  )
    ? 'screen'
    : 'source-over';
  ctx.filter = `contrast(${d.contrast}%) saturate(${d.saturation}%)`;
  for (let i = 0; i < d.copies; i++) {
    ctx.save();
    ctx.translate(512 + d.offsetX, 512 + d.offsetY);
    ctx.rotate((i * Math.PI * 2) / d.copies);
    ctx.scale(d.flipX ? -1 : 1, d.flipY ? -1 : 1);
    if (d.copies > 1) {
      ctx.translate(0, -210);
      ctx.scale(0.48, 0.48);
    }
    ctx.drawImage(base, -512, -512, 1024, 1024);
    ctx.restore();
  }
  ctx.restore();
  const ink = document.createElement('canvas');
  ink.width = ink.height = size;
  const inkCtx = ink.getContext('2d')!;
  inkCtx.scale(size / 1024, size / 1024);
  d.strokes.forEach((s) => drawStroke(inkCtx, s));
  ctx.drawImage(ink, 0, 0, 1024, 1024);
  drawForeground(ctx, d);
  if (a.signature) {
    ctx.font = '20px monospace';
    ctx.fillStyle = '#ddd';
    ctx.fillText(`${a.name.slice(0, 45)} / ${a.seed}`, 64, 952, 880);
  }
  return canvas;
}
export const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Image export failed.')),
      'image/png',
    ),
  );
export function newVariation(a: Artwork, index: number): Artwork {
  const rnd = random(a.seed + index * 7919);
  return {
    ...structuredClone(a),
    name: `${byteTruncate(a.name.replace(/\s+(?:no\.|#)\s*\d+$/i, ''), 56)} #${String(index + 1).padStart(3, '0')}`,
    seed: Math.floor(rnd() * 999999),
    hue: Math.floor(rnd() * 360),
    rotation: Math.floor(rnd() * 360),
    detail: isGenerative(a.source)
      ? 35 + Math.floor(rnd() * 65)
      : Math.max(a.detail, 10),
    scale: isGenerative(a.source) ? 90 : 78 + Math.floor(rnd() * 18),
  };
}
export function validateArtwork(value: unknown): Artwork {
  if (!value || typeof value !== 'object')
    throw new Error('This is not a PRISM project.');
  const a = value as Record<string, unknown>;
  if (
    typeof a.name !== 'string' ||
    new TextEncoder().encode(a.name).length > 64 ||
    !a.name.trim() ||
    typeof a.source !== 'string' ||
    (!SOURCES.some((s) => s.id === a.source) &&
      !['custom', 'blank'].includes(a.source))
  )
    throw new Error('The artwork title or source is invalid.');
  if (
    a.source === 'custom' &&
    (typeof a.customImage !== 'string' ||
      !/^data:image\/(png|jpeg|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(
        a.customImage,
      ) ||
      a.customImage.length > 6000000)
  )
    throw new Error('The uploaded image is invalid.');
  const string = (v: unknown, max: number) =>
    typeof v === 'string' ? v.slice(0, max) : '';
  const num = (v: unknown, min: number, max: number) =>
    clamp(Number(v), min, max);
  return {
    name: a.name,
    source: a.source,
    customImage: a.source === 'custom' ? String(a.customImage) : undefined,
    description: string(a.description, 2000),
    seed: Math.floor(num(a.seed, 0, 999999999)),
    hue: num(a.hue, 0, 360),
    detail: num(a.detail, 0, 100),
    scale: num(a.scale, 40, 140),
    rotation: num(a.rotation, 0, 360),
    background:
      typeof a.background === 'string' && /^#[0-9a-fA-F]{6}$/.test(a.background)
        ? a.background
        : INITIAL.background,
    signature: a.signature === true,
    license: string(a.license, 100) || INITIAL.license,
    ...(a.design ? { design: normalizeDesign(a.design) } : {}),
    ...(a.interactive
      ? { interactive: validateInteractive(a.interactive) }
      : {}),
    traits: Array.isArray(a.traits)
      ? a.traits.slice(0, 24).map((t) => ({
          trait_type: string(t?.trait_type, 64),
          value: string(t?.value, 256),
        }))
      : [],
    utilities: Array.isArray(a.utilities)
      ? a.utilities
          .slice(0, 8)
          .filter((u) => u && typeof u.id === 'string')
          .map((u) => ({
            id: string(u.id, 30),
            benefit: string(u.benefit, 300),
            destination: string(u.destination, 500),
            terms: string(u.terms, 1500),
            eligibility: string(u.eligibility, 120),
            starts: string(u.starts, 30),
            ends: string(u.ends, 30),
          }))
      : [],
  };
}
