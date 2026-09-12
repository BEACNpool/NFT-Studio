import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createPublicMcpHandler } from './workerd-helper.mjs';
const unpack = (result) => {
  assert.ok(!result.isError, JSON.stringify(result));
  return result.structuredContent;
};
async function local(era, capabilities = {}) {
  const client = new Client(
    { name: 'guide-acceptance', version: '1.0.0' },
    { versionNegotiation: { mode: era }, capabilities },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../dist/cli.mjs', import.meta.url))],
    stderr: 'pipe',
  });
  await client.connect(transport);
  return client;
}
for (const era of ['auto', 'legacy'])
  test(`Actual ${era} stdio guides a creation, revision, pause/resume and wallet handoff`, async () => {
    const client = await local(era);
    try {
      const call = async (args) =>
        unpack(
          await client.callTool({
            name: 'studio_guide',
            arguments: { interaction: 'chat', ...args },
          }),
        );
      let r = await call({});
      assert.equal(r.state.stage, 'start');
      assert.equal(r.options.length, 3);
      r = await call({ state: r.state, choice: '1' });
      assert.equal(r.state.stage, 'format');
      r = await call({ state: r.state, choice: 'game' });
      assert.equal(r.state.stage, 'idea');
      r = await call({ state: r.state, answer: 'A tiny moon puzzle.' });
      assert.equal(r.state.idea, 'A tiny moon puzzle.');
      r = await call({ state: r.state, choice: 'playful' });
      assert.equal(r.state.stage, 'brief');
      assert.ok(r.prompt.includes('moon puzzle'));
      assert.match(r.note, /Nothing has been generated or minted/);
      const brief = r.state;
      r = await call({ state: r.state, choice: 'create' });
      assert.equal(r.state.stage, 'creating');
      let invalid = await client.callTool({
        name: 'studio_guide',
        arguments: { state: r.state, choice: 'prepare' },
      });
      assert.equal(invalid.isError, true);
      r = await call({ state: r.state, event: 'preview_ready' });
      assert.equal(r.state.stage, 'feedback');
      assert.equal(r.options[2].id,'keep');
      assert.equal(r.options[3].id,'mobile');
      r = await call({ state: r.state, choice: 'revise' });
      assert.equal(r.state.stage, 'revision');
      r = await call({
        state: r.state,
        answer: 'Make the moon blue and keep the rules.',
      });
      assert.equal(r.state.stage, 'creating');
      assert.match(r.state.revision, /blue/);
      r = await call({ state: r.state, event: 'preview_ready' });
      r = await call({ state: r.state, choice: 'keep' });
      assert.equal(r.state.paused, true);
      r = await call({ state: r.state, choice: 'resume' });
      assert.equal(r.state.paused, undefined);
      r = await call({ state: r.state, choice: 'prepare' });
      assert.equal(r.state.stage, 'handoff');
      assert.match(r.custody, /no wallet access/);
      assert.equal(r.intent, undefined);
      r = await call({state:r.state,choice:'mobile'});
      assert.equal(r.state.handoffTarget,'mobile');
      assert.match(r.agentAction,/create_mobile_handoff/);
      assert.match(r.agentAction,/--mobile/);
      assert.equal(r.intent,undefined);
      r = await call({ state: brief, choice: 'back' });
      assert.equal(r.state.stage, 'direction');
      r = await call({ state: r.state, choice: 'start_over' });
      assert.equal(r.state.stage, 'start');
      assert.equal(r.state.idea, undefined);
      const prompts = await client.listPrompts();
      assert.ok(prompts.prompts.some((p) => p.name === 'nft-studio'));
      const prompt = await client.getPrompt({
        name: 'nft-studio',
        arguments: { idea: 'A blue moon.' },
      });
      assert.match(prompt.messages[0].content.text, /A blue moon/);
      for (const args of [
        { state: { ...brief, wallet: 'forbidden' } },
        { state: { ...brief, stage: 'invalid' } },
        { state: { ...brief, handoffTarget:'invalid' } },
        { state: { schema: 'nft-studio.guide.v1', stage: 'handoff' } },
        { state: brief, answer: 'x', choice: 'create' },
        { state: brief, event: 'preview_ready' },
        { answer: 'x'.repeat(601) },
      ]) {
        invalid = await client.callTool({
          name: 'studio_guide',
          arguments: args,
        });
        assert.equal(invalid.isError, true);
      }
    } finally {
      await client.close();
    }
  });
for (const era of ['auto', 'legacy'])
  for (const action of ['accept', 'decline', 'cancel'])
    test(`Actual ${era} native question form handles ${action} without mint authority`, async () => {
      const client = await local(era, { elicitation: { form: {} } });
      let asks = 0;
      client.setRequestHandler('elicitation/create', async (request) => {
        asks++;
        assert.equal(request.params.mode, 'form');
        assert.match(request.params.message, /Where would you like to begin/);
        assert.deepEqual(
          request.params.requestedSchema.properties.choice.enum,
          ['new', 'inspire', 'existing', 'pause'],
        );
        return action === 'accept'
          ? { action, content: { choice: 'new' } }
          : { action };
      });
      try {
        const r = unpack(
          await client.callTool({ name: 'studio_guide', arguments: {} }),
        );
        assert.equal(asks, 1);
        assert.equal(r.state.stage, action === 'accept' ? 'format' : 'start');
        assert.equal(
          r.interactionStatus,
          action === 'accept' ? 'answered' : action,
        );
        if (action !== 'accept') assert.match(r.agentAction, /Stop asking/);
      } finally {
        await client.close();
      }
    });
test('Client with only URL elicitation gets a readable chat menu, never a form', async () => {
  const client = await local('auto', { elicitation: { url: {} } });
  let asks = 0;
  client.setRequestHandler('elicitation/create', async () => {
    asks++;
    return { action: 'cancel' };
  });
  try {
    const r = unpack(
      await client.callTool({ name: 'studio_guide', arguments: {} }),
    );
    assert.equal(asks, 0);
    assert.equal(r.interactionStatus, 'chat');
  } finally {
    await client.close();
  }
});
test('Native responses are checked against the current menu', async () => {
  const client = await local('auto', { elicitation: { form: {} } });
  client.setRequestHandler('elicitation/create', async () => ({
    action: 'accept',
    content: { choice: 'prepare', walletApproved: true },
  }));
  try {
    const r = await client.callTool({ name: 'studio_guide', arguments: {} });
    assert.equal(r.isError, true);
  } finally {
    await client.close();
  }
});
for (const era of ['auto', 'legacy'])
  test(`Workerd ${era} exposes the same conversational guide and bounded minted catalogue`, async () => {
    const origin = 'https://guide-test.example.org';
    const handler = await createPublicMcpHandler({ publicOrigin: origin });
    const client = new Client(
      { name: 'worker-guide', version: '1.0.0' },
      { versionNegotiation: { mode: era } },
    );
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(origin + '/mcp'), {
          fetch: (url, init) => handler.dispatchFetch(url, init),
        }),
      );
      const call = async (name, args = {}) =>
        unpack(await client.callTool({ name, arguments: args }));
      let r = await call('studio_guide');
      assert.equal(r.state.stage, 'start');
      r = await call('studio_guide', { state: r.state, choice: 'inspire' });
      assert.equal(r.options.length, 8);
      r = await call('studio_guide', {
        state: r.state,
        choice: 'turing-garden',
      });
      assert.equal(r.state.stage, 'direction');
      assert.equal(r.inspiration.original.status, 'confirmed');
      const gallery = await call('studio_inspiration', { limit: 8 });
      assert.equal(gallery.examples.length, 8);
      for (const e of gallery.examples) {
        assert.match(e.original.policyId, /^[0-9a-f]{56}$/);
        assert.match(e.original.assetNameHex, /^(?:[0-9a-f]{2})+$/);
        assert.match(
          e.shareUrl,
          /^https:\/\/beacnpool.github.io\/NFT-Studio\/\?inspire=/,
        );
        assert.equal(
          new URL(e.playUrl).pathname.startsWith('/NFT-Studio/'),
          true,
        );
      }
      assert.equal(
        (await call('studio_inspiration', { query: 'nonexistentxyz' })).examples
          .length,
        0,
      );
      const music = await call('studio_inspiration', { query: 'atlas' });
      assert.equal(music.examples[0].copyReviewUrl, null);
      assert.equal(handler.calls.length, 0);
    } finally {
      await client.close();
      await handler.close();
    }
  });

test('Modern Workerd returns an actual native form and consumes its answer without network reads', async () => {
  const origin = 'https://guide-form.example.org';
  const handler = await createPublicMcpHandler({ publicOrigin: origin });
  let asks = 0;
  const client = new Client(
    { name: 'worker-form', version: '1.0.0' },
    {
      versionNegotiation: { mode: 'auto' },
      capabilities: { elicitation: { form: {} } },
    },
  );
  client.setRequestHandler('elicitation/create', async () => {
    asks++;
    return { action: 'accept', content: { choice: 'inspire' } };
  });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(origin + '/mcp'), {
        fetch: (url, init) => handler.dispatchFetch(url, init),
      }),
    );
    const r = unpack(
      await client.callTool({ name: 'studio_guide', arguments: {} }),
    );
    assert.equal(asks, 1);
    assert.equal(r.state.stage, 'inspiration');
    assert.equal(handler.calls.length, 0);
  } finally {
    await client.close();
    await handler.close();
  }
});
