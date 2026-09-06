// Native renderer checks. No wallet, network, browser automation or real secrets.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createCanvas, Image } from '@napi-rs/canvas';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const temp = await mkdtemp(join(tmpdir(), 'beacn-prism-design-'));
try {
  await build({
    entryPoints: [
      'lib/art.ts',
      'lib/design.ts',
      'lib/remix.ts',
      'lib/onchain-art.ts',
      'lib/export.ts',
    ],
    outdir: temp,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'error',
  });
  const {
    INITIAL,
    SOURCES,
    renderArtwork,
    validateArtwork,
    canExportSVG,
    artSVG,
  } = await import(pathToFileURL(join(temp, 'art.mjs')));
  const { DEFAULT_DESIGN, normalizeDesign } = await import(
    pathToFileURL(join(temp, 'design.mjs'))
  );
  const { remixLink, readRemix } = await import(
    pathToFileURL(join(temp, 'remix.mjs'))
  );
  const { fitOnchainImage, onchainMetadata } = await import(
    pathToFileURL(join(temp, 'onchain-art.mjs'))
  );
  const { packageArtworks } = await import(
    pathToFileURL(join(temp, 'export.mjs'))
  );
  class BrowserImage extends Image {
    set src(value) {
      if (typeof value !== 'string') {
        super.src = value;
        return;
      }
      if (value.startsWith('/'))
        readFile(resolve('public') + value)
          .then((b) => {
            super.src = b;
          })
          .catch((e) => this.onerror?.(e));
      else
        fetch(value)
          .then((r) => r.arrayBuffer())
          .then((b) => {
            super.src = new Uint8Array(b);
          })
          .catch((e) => this.onerror?.(e));
    }
  }
  globalThis.Image = BrowserImage;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = createCanvas(1, 1);
      canvas.toBlob = (callback, type = 'image/png', quality) =>
        callback(
          new Blob(
            [
              canvas.toBuffer(
                type,
                type === 'image/webp' ? Math.round(quality * 100) : undefined,
              ),
            ],
            { type },
          ),
        );
      return canvas;
    },
  };
  const hash = (c) =>
    createHash('sha256').update(c.toBuffer('image/png')).digest('hex');
  let passed = 0;
  async function test(name, fn) {
    await fn();
    passed++;
    console.log('PASS', name);
  }
  const stroke = {
    tool: 'pen',
    color: '#ff0066',
    width: 40,
    opacity: 100,
    symmetry: 1,
    points: [
      [300, 512],
      [724, 512],
    ],
  };
  const designed = {
    ...INITIAL,
    source: 'blank',
    name: '藝術 / CURIOUS',
    description: 'Private story',
    traits: [{ trait_type: 'Private', value: 'Do not share' }],
    utilities: [
      {
        id: 'membership',
        benefit: 'Private draft',
        destination: 'https://example.com/private',
        terms: 'Private terms',
        eligibility: 'holders',
        starts: '',
        ends: '',
      },
    ],
    design: {
      ...DEFAULT_DESIGN,
      backdrop: 'radial',
      accent: '#102d3a',
      frame: 'corners',
      texts: [
        {
          id: 'text-0',
          text: 'STAY\nCURIOUS.',
          x: 512,
          y: 200,
          size: 70,
          color: '#ffffff',
          font: 'sans',
          rotation: 0,
          align: 'center',
        },
      ],
      strokes: [stroke],
    },
  };
  await test('Legacy recipes retain legacy defaults and new designs round-trip completely', () => {
    assert.equal(validateArtwork(INITIAL).design, undefined);
    assert.deepEqual(
      validateArtwork(JSON.parse(JSON.stringify(designed))).design,
      normalizeDesign(designed.design),
    );
    assert.equal(validateArtwork(designed).source, 'blank');
    assert.ok(canExportSVG({ ...INITIAL, source: 'orbit' }));
    assert.ok(!canExportSVG({ ...designed, source: 'orbit' }));
    assert.throws(
      () => artSVG({ ...designed, source: 'orbit' }),
      /Personalized layers/,
    );
  });
  await test('Malformed and over-budget drawing geometry is rejected', () => {
    for (const points of [
      [[NaN, 2]],
      [[Infinity, 3]],
      [[-1, 2]],
      [[1025, 2]],
      [[1]],
    ])
      assert.throws(() =>
        normalizeDesign({ strokes: [{ ...stroke, points }] }),
      );
    assert.throws(() =>
      normalizeDesign({ strokes: Array.from({ length: 101 }, () => stroke) }),
    );
    assert.throws(() =>
      normalizeDesign({
        texts: Array.from({ length: 7 }, () => designed.design.texts[0]),
      }),
    );
    assert.throws(() =>
      normalizeDesign({
        strokes: [
          { ...stroke, points: Array.from({ length: 601 }, () => [1, 2]) },
        ],
      }),
    );
    assert.equal(
      normalizeDesign({
        frameColor: 'url(https://invalid)',
        contrast: Infinity,
      }).frameColor,
      DEFAULT_DESIGN.frameColor,
    );
  });
  await test('Neutral composition preserves sculpture backdrops and mathematical art', async () => {
    for (const source of SOURCES.map((s) => s.id)) {
      const a = { ...INITIAL, source, background: '#b5ccd6' };
      const old = await renderArtwork(a),
        next = await renderArtwork({ ...a, design: DEFAULT_DESIGN });
      const p = (c) =>
        Array.from(c.getContext('2d').getImageData(150, 150, 1, 1).data);
      assert.deepEqual(p(next), p(old), source);
    }
  });
  await test('Blank-canvas signatures render before and after personalization', async () => {
    const blank = await renderArtwork({ ...INITIAL, source: 'blank' });
    for (const design of [undefined, DEFAULT_DESIGN]) {
      const signed = await renderArtwork({
        ...INITIAL,
        source: 'blank',
        signature: true,
        design,
      });
      assert.notEqual(hash(signed), hash(blank));
    }
  });
  await test('Palette, copies, frames, text, drawing and transforms each change exported pixels', async () => {
    const a = { ...INITIAL, design: DEFAULT_DESIGN },
      base = hash(await renderArtwork(a, 512));
    for (const patch of [
      { backdrop: 'grid' },
      { backdrop: 'linear' },
      { copies: 4 },
      { flipX: true },
      { offsetX: 200 },
      { contrast: 170 },
      { saturation: 0 },
      { frame: 'double' },
      { texts: designed.design.texts },
      { strokes: [stroke] },
    ])
      assert.notEqual(
        hash(
          await renderArtwork(
            { ...a, design: { ...DEFAULT_DESIGN, ...patch } },
            512,
          ),
        ),
        base,
        JSON.stringify(patch),
      );
  });
  await test('Eraser affects drawing layer and leaves the underlying backdrop intact', async () => {
    const art = {
      ...INITIAL,
      source: 'blank',
      background: '#102030',
      design: {
        ...DEFAULT_DESIGN,
        strokes: [
          stroke,
          {
            ...stroke,
            tool: 'eraser',
            width: 80,
            points: [
              [512, 400],
              [512, 600],
            ],
          },
        ],
      },
    };
    const c = await renderArtwork(art),
      ctx = c.getContext('2d');
    assert.deepEqual(
      Array.from(ctx.getImageData(512, 512, 1, 1).data),
      [16, 32, 48, 255],
    );
    assert.deepEqual(
      Array.from(ctx.getImageData(350, 512, 1, 1).data),
      [255, 0, 102, 255],
    );
  });
  await test('Remix links preserve visual layers but omit story, traits, benefit terms and license', () => {
    const link = remixLink(designed, 'https://example.com', '/ABCDE/prism/'),
      art = readRemix(new URL(link).hash);
    assert.deepEqual(art.design, normalizeDesign(designed.design));
    assert.equal(art.name, designed.name);
    assert.equal(art.description, '');
    assert.deepEqual(art.traits, []);
    assert.deepEqual(art.utilities, []);
    assert.equal(art.license, INITIAL.license);
    assert.throws(() =>
      remixLink({ ...INITIAL, source: 'custom' }, 'https://example.com', '/'),
    );
    assert.throws(() => readRemix('#remix=' + 'a'.repeat(16000)));
    assert.throws(() => readRemix('#remix=@@@'));
  });
  await test('Personalized on-chain preview preserves encoded image and stays within image budget', async () => {
    const image = await fitOnchainImage(designed);
    assert.ok(image.bytes <= 8200);
    const bytes = Buffer.from(image.uri.split(',')[1], 'base64');
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      image.sha256,
    );
    const meta = onchainMetadata(designed, image, 'ab'.repeat(28), 'PRISM001')[
      '721'
    ]['ab'.repeat(28)].PRISM001;
    assert.equal(
      Array.isArray(meta.image) ? meta.image.join('') : meta.image,
      image.uri,
    );
    assert.equal(meta.origin, 'Hand-composed original canvas');
    console.log(
      'MEASURE personalized:',
      image.width,
      'px;',
      image.bytes,
      'WebP bytes',
    );
  });
  await test('Personalized ZIP includes complete v2 project and omits incomplete SVG', async () => {
    const { unzipSync, strFromU8 } = await import('fflate');
    const art = { ...designed, source: 'orbit' },
      blob = await packageArtworks([art], 256, () => {}),
      files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const path = Object.keys(files).find((k) =>
      k.endsWith('/project.prism.json'),
    );
    assert.ok(path);
    const project = JSON.parse(strFromU8(files[path]));
    assert.equal(project.schema, 'prism.artwork.v2');
    assert.deepEqual(project.artwork.design, art.design);
    assert.ok(Object.keys(files).some((k) => k.endsWith('/artwork.png')));
    assert.ok(!Object.keys(files).some((k) => k.endsWith('.svg')));
  });
  console.log(
    `${passed} design verification groups passed. No browser UI test or wallet used.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
