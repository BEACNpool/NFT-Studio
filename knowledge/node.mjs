import { readFileSync } from 'node:fs';
import { validateCatalog } from './lib.mjs';
/** Fixed package-relative data only. No caller-selected path or network. */
export function loadCatalog() {
  const bytes = readFileSync(new URL('./catalog.json', import.meta.url));
  if (bytes.byteLength > 1_000_000) throw new TypeError('Knowledge catalog too large');
  return validateCatalog(JSON.parse(bytes.toString('utf8')));
}
