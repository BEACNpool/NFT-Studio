export type InkTool = 'pen' | 'eraser' | 'line' | 'circle' | 'rectangle';
export type InkStroke = {
  tool: InkTool;
  color: string;
  width: number;
  opacity: number;
  symmetry: number;
  points: [number, number][];
};
export type TextLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  font: 'sans' | 'serif' | 'mono';
  rotation: number;
  align: 'left' | 'center' | 'right';
};
export type Design = {
  backdrop: 'solid' | 'radial' | 'linear' | 'grid';
  accent: string;
  offsetX: number;
  offsetY: number;
  flipX: boolean;
  flipY: boolean;
  copies: number;
  opacity: number;
  contrast: number;
  saturation: number;
  frame: 'none' | 'line' | 'double' | 'corners';
  frameColor: string;
  frameWidth: number;
  texts: TextLayer[];
  strokes: InkStroke[];
};
export const DEFAULT_DESIGN: Design = {
  backdrop: 'solid',
  accent: '#254143',
  offsetX: 0,
  offsetY: 0,
  flipX: false,
  flipY: false,
  copies: 1,
  opacity: 100,
  contrast: 100,
  saturation: 100,
  frame: 'none',
  frameColor: '#d8ef82',
  frameWidth: 3,
  texts: [],
  strokes: [],
};
export const MAX_STROKES = 100,
  MAX_POINTS = 12000;
export const FONTS = {
  sans: 'Arial, sans-serif',
  serif: 'Georgia, serif',
  mono: 'monospace',
};
export const PALETTES = [
  {
    name: 'BEACN signal',
    base: '#080d12',
    accent: '#164558',
    ink: '#e0f4ff',
    hue: 175,
    frame: '#69deef',
  },
  {
    name: 'Acid bloom',
    base: '#080c09',
    accent: '#344323',
    ink: '#d8ef82',
    hue: 0,
    frame: '#d8ef82',
  },
  {
    name: 'After hours',
    base: '#170b22',
    accent: '#4e245c',
    ink: '#ffb4e5',
    hue: 90,
    frame: '#d3a0fc',
  },
  {
    name: 'Ember',
    base: '#180e09',
    accent: '#743522',
    ink: '#ffe0ac',
    hue: 255,
    frame: '#efa45e',
  },
  {
    name: 'Glacier',
    base: '#071719',
    accent: '#174a55',
    ink: '#c9fbff',
    hue: 35,
    frame: '#83e5ea',
  },
  {
    name: 'Monochrome',
    base: '#111111',
    accent: '#393939',
    ink: '#f3f3ed',
    hue: 0,
    frame: '#f3f3ed',
  },
];
const bounded = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : fallback;
const color = (v: unknown, fallback: string) =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
const choice = <T extends string>(
  v: unknown,
  options: readonly T[],
  fallback: T,
): T => (options.includes(v as T) ? (v as T) : fallback);
export function normalizeDesign(value: unknown): Design {
  const v =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const texts: TextLayer[] = [],
    strokes: InkStroke[] = [];
  if (Array.isArray(v.texts)) {
    if (v.texts.length > 6)
      throw new Error('A design can contain up to six text layers.');
    v.texts.forEach((t, i) => {
      if (
        !t ||
        typeof t !== 'object' ||
        typeof t.text !== 'string' ||
        t.text.length > 160
      )
        throw new Error(
          'A text layer is invalid or longer than 160 characters.',
        );
      texts.push({
        id: 'text-' + i,
        text: t.text,
        x: bounded(t.x, 512, 0, 1024),
        y: bounded(t.y, 850, 0, 1024),
        size: bounded(t.size, 52, 12, 200),
        color: color(t.color, '#ffffff'),
        font: choice(t.font, ['sans', 'serif', 'mono'], 'sans'),
        rotation: bounded(t.rotation, 0, -180, 180),
        align: choice(t.align, ['left', 'center', 'right'], 'center'),
      });
    });
  }
  if (Array.isArray(v.strokes)) {
    if (v.strokes.length > MAX_STROKES)
      throw new Error(
        `A design can contain up to ${MAX_STROKES} drawing strokes.`,
      );
    let total = 0;
    v.strokes.forEach((s) => {
      if (
        !s ||
        !Array.isArray(s.points) ||
        !s.points.length ||
        s.points.length > 600 ||
        (total += s.points.length) > MAX_POINTS
      )
        throw new Error(
          'The drawing has too many points or an invalid stroke.',
        );
      const points = s.points.map((p: unknown) => {
        if (
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some(
            (n) =>
              typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1024,
          )
        )
          throw new Error(
            'Drawing coordinates must be finite and inside the canvas.',
          );
        return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10] as [
          number,
          number,
        ];
      });
      strokes.push({
        tool: choice(
          s.tool,
          ['pen', 'eraser', 'line', 'circle', 'rectangle'],
          'pen',
        ),
        color: color(s.color, '#d8ef82'),
        width: bounded(s.width, 8, 1, 80),
        opacity: bounded(s.opacity, 100, 10, 100),
        symmetry: [1, 2, 4, 8].includes(s.symmetry) ? s.symmetry : 1,
        points,
      });
    });
  }
  return {
    backdrop: choice(
      v.backdrop,
      ['solid', 'radial', 'linear', 'grid'],
      'solid',
    ),
    accent: color(v.accent, DEFAULT_DESIGN.accent),
    offsetX: bounded(v.offsetX, 0, -400, 400),
    offsetY: bounded(v.offsetY, 0, -400, 400),
    flipX: v.flipX === true,
    flipY: v.flipY === true,
    copies: [1, 2, 4, 6].includes(v.copies as number)
      ? (v.copies as number)
      : 1,
    opacity: bounded(v.opacity, 100, 0, 100),
    contrast: bounded(v.contrast, 100, 30, 200),
    saturation: bounded(v.saturation, 100, 0, 200),
    frame: choice(v.frame, ['none', 'line', 'double', 'corners'], 'none'),
    frameColor: color(v.frameColor, DEFAULT_DESIGN.frameColor),
    frameWidth: bounded(v.frameWidth, 3, 1, 20),
    texts,
    strokes,
  };
}
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  base: string,
  d: Design,
) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 1024);
  if (d.backdrop === 'radial' || d.backdrop === 'linear') {
    const g =
      d.backdrop === 'radial'
        ? ctx.createRadialGradient(512, 420, 0, 512, 512, 750)
        : ctx.createLinearGradient(0, 0, 1024, 1024);
    g.addColorStop(0, d.accent);
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
  } else if (d.backdrop === 'grid') {
    ctx.strokeStyle = d.accent;
    ctx.lineWidth = 1;
    for (let n = 32; n < 1024; n += 48) {
      ctx.beginPath();
      ctx.moveTo(n, 0);
      ctx.lineTo(n, 1024);
      ctx.moveTo(0, n);
      ctx.lineTo(1024, n);
      ctx.stroke();
    }
  }
}
export function drawStroke(ctx: CanvasRenderingContext2D, s: InkStroke) {
  if (!s.points.length) return;
  ctx.save();
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = s.opacity / 100;
  ctx.strokeStyle = ctx.fillStyle = s.color;
  ctx.globalCompositeOperation =
    s.tool === 'eraser' ? 'destination-out' : 'source-over';
  for (let copy = 0; copy < s.symmetry; copy++) {
    ctx.save();
    ctx.translate(512, 512);
    ctx.rotate((copy * Math.PI * 2) / s.symmetry);
    ctx.translate(-512, -512);
    const [first, last] = [s.points[0], s.points[s.points.length - 1]];
    ctx.beginPath();
    if (s.tool === 'circle') {
      ctx.ellipse(
        (first[0] + last[0]) / 2,
        (first[1] + last[1]) / 2,
        Math.abs(last[0] - first[0]) / 2,
        Math.abs(last[1] - first[1]) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (s.tool === 'rectangle')
      ctx.strokeRect(
        first[0],
        first[1],
        last[0] - first[0],
        last[1] - first[1],
      );
    else if (s.points.length === 1) {
      ctx.arc(first[0], first[1], s.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(...first);
      if (s.tool === 'line') ctx.lineTo(...last);
      else s.points.slice(1).forEach((p) => ctx.lineTo(...p));
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
export function drawForeground(ctx: CanvasRenderingContext2D, d: Design) {
  for (const t of d.texts) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.font = `600 ${t.size}px ${FONTS[t.font]}`;
    ctx.textAlign = t.align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = t.color;
    t.text
      .split('\n')
      .forEach((line, i) => ctx.fillText(line, 0, i * t.size * 1.2, 960));
    ctx.restore();
  }
  if (d.frame !== 'none') {
    ctx.save();
    ctx.strokeStyle = d.frameColor;
    ctx.lineWidth = d.frameWidth;
    if (d.frame === 'corners')
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(512, 512);
        ctx.rotate((i * Math.PI) / 2);
        ctx.translate(-512, -512);
        ctx.beginPath();
        ctx.moveTo(40, 170);
        ctx.lineTo(40, 40);
        ctx.lineTo(170, 40);
        ctx.stroke();
        ctx.restore();
      }
    else {
      ctx.strokeRect(40, 40, 944, 944);
      if (d.frame === 'double') ctx.strokeRect(56, 56, 912, 912);
    }
    ctx.restore();
  }
}
