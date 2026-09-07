import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const compiled = await build({
  stdin: {
    contents:
      "export * from './lib/studio-review-link.ts'; export * from './lib/studio-intent.ts'; export * from './lib/studio-payload.ts';",
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const {
  createMintIntent,
  preparePayloadBundle,
  createMintReviewUrl,
  parseMintReviewFragment,
  MAX_MINT_REVIEW_FRAGMENT_CHARS,
} = await import(
  'data:text/javascript;base64,' +
    Buffer.from(compiled.outputFiles[0].text).toString('base64')
);
const reviewBase =
  'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents';
const fragment = (text) =>
  '#mint=v1.' + Buffer.from(text).toString('base64url');
const make = async (mode = 'nft', large = false) =>
  createMintIntent(
    await preparePayloadBundle({
      name: 'Orbit 🛠️',
      description: 'Exact agent content',
      coverIndex: mode === 'nft' ? 0 : undefined,
      files: large
        ? [
            {
              name: 'bytes.bin',
              mediaType: 'application/octet-stream',
              bytes: Uint8Array.from({ length: 12000 }, (_, i) => i % 256),
            },
          ]
        : [
            {
              name: 'cover.svg',
              mediaType: 'image/svg+xml',
              bytes: new TextEncoder().encode(
                '\ufeff<svg xmlns="http://www.w3.org/2000/svg"><text>星</text></svg>',
              ),
            },
          ],
    }),
    mode,
  );

test('Review links preserve exact Unicode/BOM content and maximum compact payload without putting content in the HTTP URL', async () => {
  for (const intent of [await make(), await make('data', true)]) {
    const link = new URL(await createMintReviewUrl(intent, reviewBase));
    assert.equal(link.origin + link.pathname + link.search, reviewBase);
    assert.equal(link.hash, fragment(JSON.stringify(intent)));
    assert.deepEqual(await parseMintReviewFragment(link.hash), intent);
    assert.equal(link.username + link.password, '');
    assert.ok(link.hash.length <= MAX_MINT_REVIEW_FRAGMENT_CHARS);
    link.hash = '';
    assert.equal(link.href, reviewBase);
  }
});

test('Review decoding rejects malformed, oversized, noncanonical and tampered links', async () => {
  const intent = await make();
  const valid = fragment(JSON.stringify(intent));
  const modified = {
    ...intent,
    bundle: { ...intent.bundle, name: 'Altered title' },
  };
  const invalid = [
    '#mint=v2.abc',
    '#mint=v1.',
    '#mint=v1.a',
    valid + '=',
    '#mint=v1.%41',
    '#mint=v1.' + 'A'.repeat(MAX_MINT_REVIEW_FRAGMENT_CHARS),
    fragment(JSON.stringify(modified)),
    fragment(JSON.stringify({ ...intent, extra: true })),
    fragment(JSON.stringify(intent, null, 2)),
    fragment(
      JSON.stringify({
        intentHash: intent.intentHash,
        mode: intent.mode,
        schema: intent.schema,
        bundle: intent.bundle,
      }),
    ),
    '#mint=v1.' + Buffer.from([0xff]).toString('base64url'),
    '#mint=v1.' + Buffer.alloc(80001).toString('base64url'),
    '#mint=v1.Zh', // Nonzero unused base64 bits must not be silently normalized.
  ];
  for (const hash of invalid)
    await assert.rejects(parseMintReviewFragment(hash));
  for (const unrelated of ['', '#about', '#music=v1.abc'])
    assert.equal(await parseMintReviewFragment(unrelated), null);
  for (const base of [
    'http://example.org/',
    'https://name:password@example.org/',
    reviewBase + '#existing',
  ])
    await assert.rejects(createMintReviewUrl(intent, base));
});
