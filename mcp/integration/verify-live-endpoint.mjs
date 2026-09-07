/** Explicit, read-only public MCP release check; only synthetic content is sent. */
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const endpoint = new URL(process.argv[2] || '');
if (endpoint.protocol !== 'https:' || !['/mcp', '/api/mcp'].includes(endpoint.pathname) || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
  throw new Error('Pass the exact public HTTPS /mcp or /api/mcp endpoint.');
}
const checked = result => {
  assert.ok(!result.isError, JSON.stringify(result));
  return result.structuredContent || JSON.parse(result.content[0].text);
};
const checks = [];
const boundedFetch = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
for (const mode of ['auto', 'legacy']) {
  const client = new Client({ name: 'nft-studio-public-release-check', version: '1.0.0' }, { versionNegotiation: { mode } });
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint, { fetch: boundedFetch }));
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 8);
    for (const forbidden of ['prepare_unsigned_transaction', 'verify_signed_transaction', 'sign_transaction', 'submit_transaction']) {
      assert.ok(!tools.some(tool => tool.name === forbidden));
    }
    const resources = (await client.listResources()).resources;
    assert.equal(resources.length, 55);
    const caps = checked(await client.callTool({ name: 'studio_capabilities', arguments: {} }));
    assert.equal(caps.publicEndpoint, endpoint.href);
    const search = checked(await client.callTool({ name: 'search_knowledge', arguments: { query: 'CIP-68', limit: 2 } }));
    assert.ok(search.results.length > 0);
    const read = checked(await client.callTool({ name: 'read_knowledge', arguments: { id: search.results[0].id } }));
    assert.ok(read.sources.length > 0);
    const args = { mode: 'data', name: 'Public MCP check', files: [{ name: 'hello.txt', mediaType: 'text/plain', base64: 'SGVsbG8sIENhcmRhbm8h' }] };
    const intent = checked(await client.callTool({ name: 'create_mint_intent', arguments: args }));
    const verified = checked(await client.callTool({ name: 'verify_mint_intent', arguments: { intent: intent.intent } }));
    assert.equal(verified.intent.intentHash, intent.intent.intentHash);
    assert.equal(intent.review.url, 'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents');
    const file = { name: 'hello.txt', base64: args.files[0].base64 };
    const proof = checked(await client.callTool({ name: 'create_proof_record', arguments: { files: [file] } }));
    const match = checked(await client.callTool({ name: 'verify_proof_record', arguments: { recordCborHex: proof.artifact.recordCborHex, file } }));
    assert.equal(match.verification.status, 'match');
    assert.equal(match.chainInclusionChecked, false);
    const changed = checked(await client.callTool({ name: 'verify_proof_record', arguments: { recordCborHex: proof.artifact.recordCborHex, file: { ...file, base64: 'Q2hhbmdlZA==' } } }));
    assert.equal(changed.verification.status, 'mismatch');
    const poisoned = structuredClone(intent.intent);
    poisoned.intentHash = '00'.repeat(32);
    assert.equal((await client.callTool({ name: 'verify_mint_intent', arguments: { intent: poisoned } })).isError, true);
    checks.push({ protocolEra: client.getProtocolEra(), tools: tools.map(tool => tool.name), resources: resources.length, knowledge: 'pass', intentRoundtrip: 'pass', proofMatchAndMismatch: 'pass', changedIntentRejected: true });
  } finally {
    await client.close();
  }
}
const preflight = await boundedFetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://beacnpool.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,mcp-protocol-version' } });
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://beacnpool.github.io');
const denied = await boundedFetch(endpoint, { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' });
assert.equal(denied.status, 403);
console.log(JSON.stringify({ schema: 'nft-studio.public-mcp-check.v1', checkedAt: new Date().toISOString(), endpoint: endpoint.href, status: 'pass', checks, browserPreflight: 'pass', foreignOriginRejected: true, walletAccess: false, chainSubmission: false }, null, 2));
