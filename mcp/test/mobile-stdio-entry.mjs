// Test-only local relay. The shipped CLI never loads this file.
import {mobileRelayFixture} from './mobile-relay-fixture.mjs';
globalThis.fetch=mobileRelayFixture().fetch;
await import('../dist/cli.mjs');
