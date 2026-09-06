import type { CreationMode, StudioView } from './studio-modes';
import { MODES, isCreationMode } from './studio-modes';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerStudioTools(actions: {
  read: () => { view: StudioView; format: CreationMode | null };
  start: (mode: CreationMode) => void;
}) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const object = (input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Expected an object.');
    return input as Record<string, unknown>;
  };
  const tools: Tool[] = [
    {
      name: 'read_nft_studio',
      description:
        'Read the visible Studio location and supported creation formats. Returns no wallet information or private project content.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (Object.keys(object(input)).length)
          throw new Error('No arguments expected.');
        return {
          ...actions.read(),
          formats: MODES.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.detail,
          })),
        };
      },
    },
    {
      name: 'start_nft_creation',
      description:
        'Open a creation format in the visible Studio. Starts a new draft; does not connect a wallet, build a transaction, sign or submit. Ask the user before replacing an unsaved draft.',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: MODES.map((m) => m.id) },
        },
        required: ['format'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = object(input);
        if (
          Object.keys(value).some((k) => k !== 'format') ||
          !isCreationMode(value.format)
        )
          throw new Error('Choose a supported creation format.');
        actions.start(value.format);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return { status: 'creator_open', ...actions.read() };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Standard browsers continue using the visible controls. */
    }
  }
  return () => lifecycle.abort();
}
