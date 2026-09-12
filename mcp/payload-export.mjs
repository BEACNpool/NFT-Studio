import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { reviewHtml } from './create-review.mjs';
export async function payloadExport(result, intent) {
  assert.equal(result.schema, 'nft-studio.payload-qr.v1');
  assert.equal(result.intentHash, intent.intentHash);
  assert.equal(result.expiresAt, null);
  assert.equal(result.uploads, false);
  assert.equal(result.encrypted, false);
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://beacnpool.github.io');
  assert.equal(url.pathname, '/NFT-Studio/');
  assert(url.hash.startsWith('#payload=v1.'));
  assert(Buffer.byteLength(result.url) <= 2331);
  const { inflateRawSync } = await import('node:zlib');
  const packed = url.hash.slice('#payload=v1.'.length),
    compressed = Buffer.from(packed, 'base64url');
  assert.equal(compressed.toString('base64url'), packed);
  const raw = inflateRawSync(compressed, { maxOutputLength: 80000 });
  assert.deepEqual(JSON.parse(raw.toString('utf8')), intent);
  const segments = [{ data: result.url, mode: 'byte' }],
    code = QRCode.create(segments, { errorCorrectionLevel: 'M' });
  const size = (code.modules.size + 8) * 6,
    rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 6) - 4,
        col = Math.floor(x / 6) - 4;
      if (
        row >= 0 &&
        col >= 0 &&
        row < code.modules.size &&
        col < code.modules.size &&
        code.modules.get(row, col)
      ) {
        const i = (y * size + x) * 4;
        rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
      }
    }
  assert.equal(jsQR(rgba, size, size)?.data, result.url);
  const opts = {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  };
  const svg = await QRCode.toString(segments, { ...opts, type: 'svg' }),
    png = await QRCode.toBuffer(segments, { ...opts, type: 'png' });
  return {
    'payload-qr.svg': svg,
    'payload-qr.png': png,
    'payload-url.txt': result.url + '\n',
    'payload.html': reviewHtml(intent.bundle.name, result.url),
    'payload-info.json':
      JSON.stringify(
        {
          ...result,
          qr: { ...result.qr, svg: undefined },
          independentQrDecode: true,
        },
        null,
        2,
      ) + '\n',
  };
}
