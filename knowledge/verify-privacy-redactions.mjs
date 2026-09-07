// Admission-only normalization. Never imported by the browser or MCP runtime.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REDACTION_COMMIT = '98dea9e18d134241792b3ab5d0d443f37ce574d9';
const MAP_SHA256 =
  'fe88592d209c5e3b4dc54b7d52c71c0c0c93fdb8b9dca7598bf2629bfa552433';
const repository =
  process.env.NFT_STUDIO_TEST_ROOT ??
  fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlob = (commit, path) =>
  execFileSync('git', ['show', `${commit}:${path}`], {
    cwd: repository,
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const mapBytes = readFileSync(
  new URL('../docs/verification/redacted/REDACTION_MAP.json', import.meta.url),
);
assert.equal(hash(mapBytes), MAP_SHA256, 'Redaction map identity changed');
const map = JSON.parse(mapBytes);
assert.deepEqual(
  map.artifacts.map((item) => [item.recordId, item.evidenceId]),
  [
    ['agent-mint-contract', 'mcp-live'],
    ['agent-mint-contract', 'mcp-doc'],
    ['agent-mint-contract', 'agent-panel'],
    ['agent-mint-contract', 'mcp-initial-release'],
  ],
);
const binding = (artifact, commit = artifact.commit) => ({
  path: artifact.path,
  sha256: artifact.sha256,
  commit,
  url: `https://github.com/BEACNpool/NFT-Studio/blob/${commit}/${artifact.path}`,
});

// Authenticate the four published redactions and their exact original transform.
for (const item of map.artifacts) {
  const original = gitBlob(item.original.commit, item.original.path);
  const redacted = gitBlob(REDACTION_COMMIT, item.redacted.path);
  assert.equal(hash(original), item.original.sha256);
  assert.equal(original.length, item.original.bytes);
  assert.equal(hash(redacted), item.redacted.sha256);
  assert.equal(redacted.length, item.redacted.bytes);
  const source = original.toString('utf8');
  const hosts = source.match(/(?:[a-z0-9-]+\.){2,}chatgpt\.site/gi) ?? [];
  assert.equal(hosts.length, item.hostnameReplacements);
  assert.equal(
    new Set(hosts).size,
    1,
    'Expected one original hosting identity',
  );
  const transformed = source.replaceAll(hosts[0], 'redacted-host.invalid');
  const notice = {
    schema: 'nft-studio.privacy-redaction.v1',
    reason: 'Personally identifying deployment hostname removed.',
    replacementHost: 'redacted-host.invalid',
    hostnameReplacements: item.hostnameReplacements,
    originalArtifact: item.original,
    evidenceScope:
      'Historical observation or source snapshot. Original outcomes and dates are unchanged. The replacement hostname was not tested and is not a service endpoint.',
  };
  let expected;
  if (item.redacted.path.endsWith('.json')) {
    expected =
      '{\n  "privacyRedaction": ' +
      JSON.stringify(notice, null, 2).replaceAll('\n', '\n  ') +
      ',\n' +
      transformed.slice(2);
  } else {
    const prefix = item.original.path.endsWith('.md')
      ? `<!-- ${JSON.stringify(notice)} -->\n`
      : `/* ${JSON.stringify(notice)} */\n`;
    expected = prefix + transformed;
  }
  // Boolean comparison intentionally avoids printing the original host on failure.
  assert.ok(
    redacted.equals(Buffer.from(expected)),
    'Redaction altered more than its declared hostname and notice',
  );
}

export function historicalRegisterForPreservation(register) {
  const clone = structuredClone(register);
  for (const item of map.artifacts) {
    const record = clone.records.find((record) => record.id === item.recordId);
    const evidence = record?.evidence.find(
      (evidence) => evidence.id === item.evidenceId,
    );
    assert.ok(evidence, 'Mapped evidence missing');
    assert.deepEqual(
      evidence.artifact,
      binding(item.redacted, REDACTION_COMMIT),
    );
    evidence.artifact = binding(item.original);
  }
  return clone;
}
