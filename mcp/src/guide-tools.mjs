import * as z from 'zod/v4';
import {
  inputRequired,
  inputResponse,
  CLIENT_CAPABILITIES_META_KEY,
} from '@modelcontextprotocol/server';
import {
  advanceGuide,
  guideView,
  INITIAL_GUIDE,
  GUIDE_FORMATS,
  INSPIRATION,
} from '@studio/studio-guide.ts';

const formats = GUIDE_FORMATS.map((x) => x.id);
const text = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .refine(
    (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),
    'Use ordinary text.',
  );
const stateSchema = z
  .strictObject({
    schema: z.literal('nft-studio.guide.v1'),
    stage: z.enum([
      'start',
      'inspiration',
      'format',
      'idea',
      'direction',
      'brief',
      'creating',
      'feedback',
      'revision',
      'handoff',
    ]),
    format: z.enum(formats).optional(),
    idea: text.optional(),
    direction: z.enum(['bold', 'playful', 'quiet', 'agent']).optional(),
    exampleId: z.enum(INSPIRATION.map((x) => x.id)).optional(),
    revision: text.optional(),
    existing: z.boolean().optional(),
    paused: z.boolean().optional(),
    handoffTarget: z.enum(['desktop', 'mobile', 'payload', 'options']).optional(),
  })
  .superRefine((s, ctx) => {
    if (
      [
        'idea',
        'direction',
        'brief',
        'creating',
        'feedback',
        'revision',
        'handoff',
      ].includes(s.stage) &&
      !s.format
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a format before continuing.',
      });
    if (
      [
        'direction',
        'brief',
        'creating',
        'feedback',
        'revision',
        'handoff',
      ].includes(s.stage) &&
      !s.idea
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Describe the idea before continuing.',
      });
    if (
      ['brief', 'creating', 'feedback', 'revision', 'handoff'].includes(
        s.stage,
      ) &&
      !s.direction
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a direction before continuing.',
      });
  });
const schema = z.strictObject({
  state: stateSchema.optional(),
  choice: z.string().min(1).max(40).optional(),
  answer: text.optional(),
  event: z.literal('preview_ready').optional(),
  interaction: z.enum(['auto', 'chat']).default('auto'),
});
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
export const GUIDE_CAPABILITIES = Object.freeze({
  version: 1,
  startTool: 'studio_guide',
  inspirationTool: 'studio_inspiration',
  prompt: 'nft-studio',
  default: 'One question at a time, with choices, back, pause, and revision.',
  interaction:
    'Native form elicitation when advertised by the client; numbered chat menus otherwise.',
  state:
    'Caller-held creative preferences, validated on every call. No persistent session, files, or wallet data.',
  onePrompt:
    'Supported. A complete user brief can use the existing content tools directly; do not force an interview.',
  mediaGeneration:
    'The connected AI creates the files; the MCP guides, validates, and packages them.',
  mobileHandoff:
    'Offer Send to mobile (QR) after the preview. Use create_mobile_handoff for the same encrypted 15-minute transfer as the Studio browser. A mobile request is not permission to connect a wallet or mint.',
});
export const GUIDE_INSTRUCTIONS =
  "Before wallet review, offer Add utility & mint options using studio_utilities and configure_mint_options. Quantity is copies in this transaction, not a lifetime cap or shared edition. For print or copy-forward sharing use create_payload_qr; it embeds small public content with no expiry. For a private temporary phone handoff keep create_mobile_handoff. Do not call these transfer types interchangeable. " +
  'For creation requests, use studio_guide to lead an interactive creative conversation. Offer one question at a time with a short menu, accept numbers or free text, remember answers in returned state, and offer Back, Pause, and Start over. After showing an actual preview, ask Revise / Prepare for wallet review / Keep without minting / Send to mobile (QR). For a requested mobile QR, use create_mobile_handoff with the exact verified ordinary intent, or the local-file helper with --mobile. Display the returned QR as an image, the full phone link and expiry. This is the same 15-minute encrypted transfer as Continue on phone in Studio. Preserve oversized or unsupported creations and explain the supported route; never substitute a LAN server or unrelated QR. Never select a creative option without the user’s answer unless they requested your choice. A complete one-prompt request may use the content tools directly. Use studio_inspiration for minted examples and cite their original identity separately from any new copy. Menus and client-held state are creative preferences, never wallet approval or proof of a mint. ';
function response(state, extra = {}) {
  const output = { ...guideView(state), ...extra };
  const lines = [
    output.question,
    output.note,
    ...output.options.map(
      (x, i) =>
        `${i + 1}. ${x.label}${x.description ? ' — ' + x.description : ''}`,
    ),
    output.acceptsText && 'Or describe it in your own words.',
    'Back · Pause · Start over',
  ];
  return {
    content: [{ type: 'text', text: lines.filter(Boolean).join('\n\n') }],
    structuredContent: output,
  };
}
function supportsForm(server, ctx) {
  const capabilities =
    ctx.mcpReq.envelope?.[CLIENT_CAPABILITIES_META_KEY] ||
    server.server.getClientCapabilities();
  const e = capabilities?.elicitation;
  return (
    !!e &&
    (e.form !== undefined || (e.form === undefined && e.url === undefined))
  );
}
export function registerGuideTools(server) {
  server.registerTool(
    'studio_guide',
    {
      title: 'NFT-Studio creative guide',
      description:
        'Start or continue the interactive NFT creation menu. Call with no state to begin; carry returned state into later calls. Show one question at a time and wait for the user. Accept a current option ID or number in choice, or written text in answer where allowed. Global choices: back, pause, resume, start_over. Send event preview_ready only after your AI has created and shown actual files. Native client forms are optional; interaction chat always returns a readable menu. No creation, wallet connection, signing, submission, or confirmation happens here.',
      inputSchema: schema,
      annotations,
    },
    async (args, ctx) => {
      try {
        const state = advanceGuide(args.state || INITIAL_GUIDE, args);
        const view = guideView(state);
        const key = 'studio_' + state.stage;
        const incoming = inputResponse(ctx.mcpReq.inputResponses, key);
        if (incoming.kind === 'elicit') {
          if (incoming.action !== 'accept')
            return response(state, {
              interactionStatus: incoming.action,
              agentAction:
                'The user declined or cancelled. Stop asking, do not advance or mint. Keep this state available if they choose to resume.',
            });
          const formSchema = view.acceptsText
            ? z.strictObject({ answer: text })
            : z.strictObject({
                choice: z.enum([
                  ...view.options.map((x) => x.id),
                  'back',
                  'pause',
                  'start_over',
                ]),
              });
          const value = formSchema.safeParse(incoming.content);
          if (!value.success)
            throw Error(
              'The form answer does not match the current question. No step was taken.',
            );
          return response(advanceGuide(state, value.data), {
            interactionStatus: 'answered',
          });
        }
        // One optional form per tool call. No detached asks or retained state. The SDK
        // translates input_required to legacy elicitation on supported transports.
        const formOptions = [
          ...view.options,
          ...(state.stage !== 'start'
            ? [
                {
                  id: 'back',
                  label: 'Back',
                  description: 'Return to the previous question.',
                },
              ]
            : []),
          {
            id: 'pause',
            label: 'Pause',
            description: 'Keep this brief for later.',
          },
        ];
        if (
          args.interaction === 'auto' &&
          !state.paused &&
          (view.options.length || view.acceptsText) &&
          supportsForm(server, ctx)
        ) {
          const requestedSchema = view.acceptsText
            ? {
                type: 'object',
                properties: {
                  answer: {
                    type: 'string',
                    title: 'Your answer',
                    minLength: 1,
                    maxLength: 600,
                  },
                },
                required: ['answer'],
              }
            : {
                type: 'object',
                properties: {
                  choice: {
                    type: 'string',
                    title: 'Choose a direction',
                    enum: formOptions.map((x) => x.id),
                    enumNames: formOptions.map((x) => x.label),
                  },
                },
                required: ['choice'],
              };
          return inputRequired({
            inputRequests: {
              [key]: inputRequired.elicit({
                mode: 'form',
                message:
                  view.question +
                  '\n' +
                  (view.acceptsText
                    ? 'Write your answer. Use /back or /pause at any time.' +
                      (state.stage === 'idea'
                        ? ' Type /suggest for an original starting idea.'
                        : '')
                    : formOptions
                        .map((x) => x.label + ': ' + x.description)
                        .join('\n')),
                requestedSchema,
              }),
            },
          });
        }
        return response(state, { interactionStatus: 'chat' });
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: (error instanceof Error
                ? error.message
                : 'Invalid creative guide request.'
              ).slice(0, 400),
            },
          ],
        };
      }
    },
  );
  server.registerTool(
    'studio_inspiration',
    {
      title: 'Minted NFT inspiration',
      description:
        'Browse curated minted originals, play links, original policy and exact asset-name identities, source attribution, copy-review links where supported, and prompts for a new inspired work. Fixed bundled catalogue; no network or wallet access. Mint status is the recorded publication evidence, not a fresh chain lookup. Never present a creator copy as the original edition.',
      inputSchema: z.strictObject({
        query: z.string().max(120).optional(),
        format: z.enum(formats).optional(),
        limit: z.number().int().min(1).max(8).default(4),
      }),
      annotations,
    },
    async ({ query = '', format, limit }) => {
      const matches = INSPIRATION.filter(
        (x) =>
          (!format || x.format === format) &&
          [x.id, x.title, x.description, x.format]
            .join(' ')
            .toLowerCase()
            .includes(query.toLowerCase()),
      );
      const examples = matches
        .slice(0, limit)
        .map((x) => ({
          ...x,
          playUrl: 'https://beacnpool.github.io/NFT-Studio' + x.playPath,
          shareUrl: `https://beacnpool.github.io/NFT-Studio/?inspire=${x.id}`,
          copyReviewUrl: x.copyPath
            ? 'https://beacnpool.github.io/NFT-Studio' + x.copyPath
            : null,
        }));
      const out = {
        examples,
        total: matches.length,
        chainStatus: 'Recorded original mint evidence; no live chain lookup.',
        next: 'Offer an example, start studio_guide with choice inspire, or return the copyReviewUrl for visible review. A new copy never inherits the original policy or identity.',
      };
      return {
        content: [
          {
            type: 'text',
            text: examples.length
              ? examples
                  .map(
                    (x) =>
                      `${x.title}: ${x.description}\nPlay: ${x.playUrl}\nOriginal: ${x.original.viewer}\nInspiration: ${x.shareUrl}`,
                  )
                  .join('\n\n')
              : 'No matching examples. Try another format or a broader query.',
          },
        ],
        structuredContent: out,
      };
    },
  );
  server.registerPrompt(
    'nft-studio',
    {
      title: 'Create with NFT-Studio',
      description: 'Open a guided creative menu, or begin with an idea.',
      argsSchema: z.object({ idea: z.string().max(600).optional() }),
    },
    ({ idea }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Help me create with NFT-Studio.${idea ? ' My idea: ' + idea : ''} Discover studio_capabilities, then start studio_guide. Carry forward anything I already told you. Ask one question at a time with a short menu, create an actual preview with your creative tools, offer revisions, and only prepare the exact files for wallet review when I choose. I approve any mint in my own wallet.`,
          },
        },
      ],
    }),
  );
}
