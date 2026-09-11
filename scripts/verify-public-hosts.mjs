// Check the publishable source tree without printing identifying hostnames.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const files = execFileSync('git', [
  'ls-files',
  '-co',
  '--exclude-standard',
  '-z',
])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const personalHostingNamespace = /(?:[a-z0-9-]+\.){2,}chatgpt\.site/gi;
const failures = [];
for (const file of new Set(files)) {
  if (!statSync(file).isFile()) continue;
  const text = readFileSync(file).toString('utf8');
  // Large exact-content review links can contain long base64 runs. Skip the
  // hostname regex when its mandatory suffix is absent, avoiding quadratic
  // backtracking over embedded media while preserving every actual match.
  if (!text.toLowerCase().includes('.chatgpt.site')) continue;
  personalHostingNamespace.lastIndex = 0;
  if (personalHostingNamespace.test(text)) failures.push(file);
}
if (failures.length) {
  console.error(
    'Personal hosting namespace found in publishable files:\n' +
      failures.join('\n'),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Privacy check passed for ${new Set(files).size} publishable files.`,
  );
}
