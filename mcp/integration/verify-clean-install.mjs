// Release smoke: copy source inputs, install only mcp/, build, and exercise the SDK.
// It deliberately leaves its isolated temporary fixture and receipt for inspection.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, lstat, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(process.env.NFT_STUDIO_ROOT || join(here, '..'));
const knowledge = resolve(process.env.NFT_STUDIO_KNOWLEDGE || join(root, 'knowledge'));
const fixture = await mkdtemp(join(tmpdir(), 'nft-studio-mcp-clean-'));
const environment = { ...process.env };
for (const key of ['NFT_STUDIO_ROOT', 'NFT_STUDIO_KNOWLEDGE', 'NODE_PATH', 'NODE_OPTIONS']) delete environment[key];

async function assertNoRootDependencies() {
  for (let path = fixture;; path = dirname(path)) {
    await assert.rejects(lstat(join(path, 'node_modules')), error => error.code === 'ENOENT',
      `Clean smoke requires no root or ancestor node_modules: ${path}`);
    if (dirname(path) === path) break;
  }
}

async function sourceOnly(from, to) {
  await cp(from, to, { recursive: true, filter: async path => {
    if (['node_modules', 'dist', '.git'].includes(basename(path))) return false;
    assert.equal((await lstat(path)).isSymbolicLink(), false, `Source fixture rejects symlinks: ${path}`);
    return true;
  } });
}

async function npm(args) {
  await new Promise((accept, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', 'mcp', ...args], {
      cwd: fixture, env: environment, stdio: 'inherit', shell: false,
    });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`npm ${args.join(' ')} timed out`)); }, 300_000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) accept(); else reject(new Error(`npm ${args.join(' ')} failed: ${code ?? signal}`));
    });
  });
}

console.log(`Source-only clean-install fixture: ${fixture}`);
await assertNoRootDependencies();
await sourceOnly(join(root, 'lib'), join(fixture, 'lib'));
await sourceOnly(knowledge, join(fixture, 'knowledge'));
await sourceOnly(join(root,'experiments/capsule-parameterizer'),join(fixture,'experiments/capsule-parameterizer'));
await sourceOnly(here, join(fixture, 'mcp'));
await npm(['ci']);
await assertNoRootDependencies();
await npm(['test']);
await assertNoRootDependencies();
const artifacts = {};
for (const name of ['cli.mjs', 'server.mjs', 'http.mjs', 'worker.mjs', 'public-unsigned.mjs', 'cardano_serialization_lib_bg.wasm']) {
  const bytes = await readFile(join(fixture, 'mcp', 'dist', name));
  artifacts[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const receipt = {
  schema: 'nft-studio.mcp-clean-install.v1', status: 'pass', node: process.version,
  fixture, rootDependenciesInstalled: false, ancestorDependenciesPresent: false,
  copiedDependencyDirectories: false,
  commands: ['npm --prefix mcp ci', 'npm --prefix mcp test (includes npm run build)'],
  artifacts,
};
const receiptPath = join(fixture, 'mcp-clean-install-check.json');
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Clean-install verification PASS: ${receiptPath}`);
