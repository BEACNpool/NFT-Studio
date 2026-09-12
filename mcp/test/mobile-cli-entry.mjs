import {fileURLToPath} from 'node:url';
import {main} from '../create-review.mjs';
await main(process.argv.slice(2),{entry:fileURLToPath(new URL('./mobile-stdio-entry.mjs',import.meta.url))});
