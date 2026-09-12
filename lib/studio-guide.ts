import inspiration from './studio-inspiration.json';

/** Portable creative preferences only. Never a transaction, approval, or mint receipt. */
export const GUIDE_FORMATS = [
  {
    id: 'art',
    label: 'Art & images',
    description: 'An illustration, a collectible, a visual experiment.',
  },
  {
    id: 'game',
    label: 'A playable game',
    description: 'A tiny puzzle, arcade game, or strategy world.',
  },
  {
    id: 'music',
    label: 'Music & sound',
    description: 'A sound toy, instrument, or short original release.',
  },
  {
    id: 'utility',
    label: 'A useful app',
    description: 'A timer, decision maker, or personal tool.',
  },
  {
    id: 'motion',
    label: 'Moving art',
    description: 'An animation or interactive scene with a story.',
  },
  {
    id: 'data',
    label: 'Files & writing',
    description: 'Preserve exact compact files with an image cover.',
  },
  {
    id: 'scroll',
    label: 'A Ledger Scroll',
    description: 'Longer writing and archives, finished in the browser.',
  },
  {
    id: 'book',
    label: 'A Ledger Book',
    description: 'An open book with new entries, finished in the browser.',
  },
] as const;
export const GUIDE_DIRECTIONS = [
  {
    id: 'bold',
    label: 'Bold & graphic',
    description: 'Strong shapes, vivid contrast, a clear focal point.',
  },
  {
    id: 'playful',
    label: 'Playful & surprising',
    description: 'Character, curiosity, and a little unexpected delight.',
  },
  {
    id: 'quiet',
    label: 'Calm & minimal',
    description: 'Space to breathe, restrained color, simple controls.',
  },
  {
    id: 'agent',
    label: 'Let my AI choose',
    description: 'A considered direction based on my idea.',
  },
] as const;
export type GuideFormat = (typeof GUIDE_FORMATS)[number]['id'];
export type GuideStage =
  | 'start'
  | 'inspiration'
  | 'format'
  | 'idea'
  | 'direction'
  | 'brief'
  | 'creating'
  | 'feedback'
  | 'revision'
  | 'handoff';
export type GuideState = {
  schema: 'nft-studio.guide.v1';
  stage: GuideStage;
  format?: GuideFormat;
  idea?: string;
  direction?: string;
  exampleId?: string;
  revision?: string;
  existing?: boolean;
  paused?: boolean;
  handoffTarget?: 'desktop' | 'mobile';
};
export type GuideChoice = { id: string; label: string; description: string };
export type GuideInput = {
  choice?: string;
  answer?: string;
  event?: 'preview_ready';
};
export const INITIAL_GUIDE: GuideState = {
  schema: 'nft-studio.guide.v1',
  stage: 'start',
};
export const STUDIO_PUBLIC_URL = 'https://beacnpool.github.io/NFT-Studio/';
export const INSPIRATION = inspiration;
const option = (id: string, label: string, description = '') => ({
  id,
  label,
  description,
});
export function guidePrompt(state: GuideState) {
  const format = GUIDE_FORMATS.find((x) => x.id === state.format)?.label;
  const direction = GUIDE_DIRECTIONS.find(
    (x) => x.id === state.direction,
  )?.label;
  const example = inspiration.find((x) => x.id === state.exampleId);
  return [
    '$nft-studio',
    'Use studio_guide to help me create an NFT, with one question at a time.',
    format && `Format: ${format}.`,
    state.idea && `My idea: ${state.idea}`,
    direction && `Creative direction: ${direction}.`,
    example &&
      `Inspiration: ${STUDIO_PUBLIC_URL}?inspire=${example.id}. Make a new work; keep the original identity separate.`,
    state.existing &&
      'I have files to bring. Ask which files I want to use before reading them.',
    'Carry forward these preferences; do not ask me to repeat them. Create a first preview, then offer revise, prepare for wallet review, keep without minting, or Send to mobile (QR).',
    'When I request a phone QR, validate the exact compact files and use create_mobile_handoff for NFT-Studio’s native encrypted transfer. Show its QR, complete phone link and expiry. If the file is too large, preserve it and explain the limit before adapting it. Do not substitute a local-network preview server.',
    'After I choose wallet review, validate the exact files and give me the NFT-Studio review link or requested mobile handoff. I approve any mint in my own wallet.',
  ]
    .filter(Boolean)
    .join('\n');
}
export function guideView(state: GuideState) {
  const example = inspiration.find((x) => x.id === state.exampleId);
  let question = '',
    options: GuideChoice[] = [],
    acceptsText = false,
    note = '';
  switch (state.stage) {
    case 'start':
      question = 'Where would you like to begin?';
      options = [
        option(
          'new',
          'Create something new',
          'Start with an idea, or find one together.',
        ),
        option(
          'inspire',
          'Explore minted originals',
          'Find a starting point in something real.',
        ),
        option(
          'existing',
          'Bring my own files',
          'Build around artwork or files you already have.',
        ),
      ];
      break;
    case 'inspiration':
      question = 'Which original sparks an idea?';
      options = inspiration.map((x) => option(x.id, x.title, x.description));
      note =
        'These original editions have recorded mint receipts. A copy or inspired work has a different identity.';
      break;
    case 'format':
      question = 'What would you like to make?';
      options = [...GUIDE_FORMATS];
      break;
    case 'idea':
      question = state.existing
        ? 'What are you bringing, and what should it become?'
        : 'What should your creation be about?';
      acceptsText = true;
      options = [
        option(
          'suggest',
          'Suggest an idea for me',
          'Use a small, original concept as a starting point.',
        ),
      ];
      break;
    case 'direction':
      question = 'What should it feel like?';
      options = [...GUIDE_DIRECTIONS];
      break;
    case 'brief':
      question = 'Ready for a first preview?';
      options = [
        option(
          'create',
          'Create the first preview',
          'Your AI makes the files and shows you the result.',
        ),
        option('edit', 'Change the idea', 'Adjust the brief before creating.'),
        option(
          'style',
          'Change the direction',
          'Try a different look and feel.',
        ),
      ];
      note =
        'This is a creative brief. Nothing has been generated or minted yet.';
      break;
    case 'creating':
      question = 'Your AI can now create the first preview.';
      note =
        'Use the AI client’s creative tools to make and show the actual files. Only then send event: preview_ready. The MCP itself does not generate media.';
      break;
    case 'feedback':
      question = 'How is the preview looking?';
      options = [
        option(
          'revise',
          'Make a change',
          'Tell your AI what to keep and what to adjust.',
        ),
        option(
          'prepare',
          'Prepare for wallet review',
          'Validate the exact files and create a review link.',
        ),
        option(
          'keep',
          'Keep it without minting',
          'Save the files and a prompt for another session.',
        ),
        option(
          'mobile',
          'Send to mobile (QR)',
          'Open the same supported creation on your phone with a 15-minute link.',
        ),
      ];
      break;
    case 'revision':
      question = 'What would you like to change?';
      acceptsText = true;
      break;
    case 'handoff':
      question = state.handoffTarget === 'mobile'
        ? 'Continue on your phone with NFT-Studio.'
        : 'Continue in NFT-Studio for wallet review.';
      note = state.handoffTarget === 'mobile'
        ? 'Validate the exact supported files, then create the native encrypted QR transfer. The link lasts 15 minutes. Scanning opens the creation; wallet connection and mint approval remain separate.'
        : 'Prepare and verify the exact content with the appropriate tools. Use Continue on phone for a mobile QR. A review link does not connect a wallet, sign, submit, or confirm a mint.';
      options = [
        option(
          'revise',
          'Revise the creation',
          'Return to the creative process.',
        ),
        option('mobile', state.handoffTarget === 'mobile' ? 'Create a fresh mobile QR' : 'Send to mobile (QR)', 'Use NFT-Studio’s encrypted 15-minute phone transfer.'),
      ];
      break;
  }
  if (state.paused) {
    question = 'Your creative brief is ready to keep.';
    note =
      'No mint was requested. Save the brief or files with your AI client to resume later.';
    options = [option('resume', 'Resume this creation')];
    acceptsText = false;
  }
  const current = ['start', 'inspiration', 'format'].includes(state.stage)
    ? 1
    : ['idea', 'direction', 'brief'].includes(state.stage)
      ? 2
      : ['creating', 'feedback', 'revision'].includes(state.stage)
        ? 3
        : 4;
  return {
    schema: 'nft-studio.guide-result.v1',
    state,
    question,
    options,
    acceptsText,
    note,
    progress: {
      current,
      total: 4,
      labels: ['Start', 'Shape the idea', 'Preview & refine', 'Wallet review'],
    },
    summary: {
      format: GUIDE_FORMATS.find((x) => x.id === state.format)?.label,
      idea: state.idea,
      direction: GUIDE_DIRECTIONS.find((x) => x.id === state.direction)?.label,
      revision: state.revision,
    },
    inspiration: example || null,
    browserOnly: state.format === 'scroll' || state.format === 'book',
    browserUrl:
      state.format === 'scroll' || state.format === 'book'
        ? `${STUDIO_PUBLIC_URL}?create=${state.format}`
        : `${STUDIO_PUBLIC_URL}?view=labs&lab=agents`,
    prompt: guidePrompt(state),
    agentAction: state.paused
      ? 'Save the brief if requested. Stop; do not prepare a mint.'
      : state.stage === 'creating'
        ? 'Create or revise actual files and show their preview, then call studio_guide with event preview_ready and this state.'
        : state.stage === 'handoff'
          ? state.handoffTarget === 'mobile'
            ? 'Use capabilities to validate the supported ordinary NFT/data intent with create_mint_intent + verify_mint_intent, then call create_mobile_handoff. For local files use mcp/create-review.mjs --mobile. Display the actual QR, complete phone link and expiry. Oversized files and dedicated Music/Scroll/Book packets need their supported route; explain this and preserve the files. Never invent a LAN preview URL or infer wallet approval. Do not regenerate a completed transfer unless requested.'
            : 'Use capabilities to choose create_mint_intent + verify_mint_intent, the dedicated Music tools, or the browser-only creator. Deliver the exact returned review link or packet and mention Continue on phone for its native QR handoff. If the user requests the QR, call create_mobile_handoff for a supported ordinary intent. Never infer wallet approval or confirmation.'
          : 'Show this question and numbered options in plain language, accept a number or free text, and wait for the user. Never choose on their behalf unless they asked you to. Call studio_guide with this state and their choice/answer. Back, start_over, and pause are always available.',
    custody:
      'Creative preferences only; no wallet access, transaction, signature, submission, or ledger confirmation.',
  };
}
export function advanceGuide(
  previous: GuideState = INITIAL_GUIDE,
  input: GuideInput = {},
): GuideState {
  const state = { ...previous };
  let { choice } = input;
  let { answer } = input;
  if (
    previous.stage === 'idea' &&
    answer?.trim().toLowerCase() === '/suggest'
  ) {
    choice = 'suggest';
    answer = undefined;
  }
  if (answer && ['/back', '/pause', '/start_over'].includes(answer.trim())) {
    choice = answer.trim().slice(1);
    answer = undefined;
  }
  if (choice && answer)
    throw Error('Choose a menu item or send a written answer, not both.');
  if (input.event && (choice || answer))
    throw Error('A preview event cannot also choose a menu item.');
  if (choice === 'start_over') return { ...INITIAL_GUIDE };
  if (choice === 'pause') return { ...state, paused: true };
  if (choice === 'resume') {
    delete state.paused;
    return state;
  }
  if (state.paused && (choice || answer || input.event))
    throw Error('Resume the paused brief before continuing.');
  if (choice === 'back') {
    const back: Record<GuideStage, GuideStage> = {
      start: 'start',
      inspiration: 'start',
      format: 'start',
      idea: 'format',
      direction: 'idea',
      brief: 'direction',
      creating: 'brief',
      feedback: 'brief',
      revision: 'feedback',
      handoff: 'feedback',
    };
    return { ...state, stage: back[state.stage] };
  }
  if (input.event) {
    if (state.stage !== 'creating')
      throw Error('A preview can only follow the creation step.');
    return { ...state, stage: 'feedback' };
  }
  if (!choice && !answer) return state;
  const menu = guideView(state);
  if (choice && /^\d+$/.test(choice))
    choice = menu.options[Number(choice) - 1]?.id || choice;
  if (choice && !menu.options.some((x) => x.id === choice))
    throw Error(
      'That choice is not in the current menu. Use the current option ID, number, or back.',
    );
  if (answer && !menu.acceptsText)
    throw Error(
      'Choose from the current menu first. Use edit to change the idea.',
    );
  switch (state.stage) {
    case 'start':
      return {
        ...INITIAL_GUIDE,
        stage: choice === 'inspire' ? 'inspiration' : 'format',
        ...(choice === 'existing' ? { existing: true } : {}),
      };
    case 'inspiration': {
      const item = inspiration.find((x) => x.id === choice)!;
      return {
        ...state,
        stage: 'direction',
        exampleId: item.id,
        format: item.format as GuideFormat,
        idea: item.idea,
      };
    }
    case 'format':
      return {
        ...state,
        stage: 'idea',
        format: choice as GuideFormat,
        idea: undefined,
        direction: undefined,
        exampleId: undefined,
        revision: undefined,
      };
    case 'idea': {
      const ideas: Record<GuideFormat, string> = {
        art: 'A tiny night garden with a luminous moon and three unexpected plants.',
        game: 'A one-screen constellation puzzle where each move changes the night sky.',
        music:
          'A pocket sound garden: tap three plants to compose a short original melody.',
        utility:
          'A calm focus timer that grows a small digital garden as time passes.',
        motion: 'A miniature city that wakes up when you tap the moon.',
        data: 'A compact time capsule with a letter to my future self and an original cover.',
        scroll: 'A finished short story with an illustrated title page.',
        book: 'A shared journal with an opening chapter and space for future entries.',
      };
      return {
        ...state,
        stage: 'direction',
        idea: answer?.trim() || ideas[state.format || 'art'],
        revision: undefined,
      };
    }
    case 'direction':
      return { ...state, stage: 'brief', direction: choice };
    case 'brief':
      return {
        ...state,
        stage:
          choice === 'create'
            ? 'creating'
            : choice === 'edit'
              ? 'idea'
              : 'direction',
      };
    case 'feedback':
      return choice === 'keep'
        ? { ...state, paused: true }
        : choice === 'revise'
          ? { ...state, stage: 'revision' }
          : { ...state, stage: 'handoff', handoffTarget: choice === 'mobile' ? 'mobile' : 'desktop' };
    case 'revision':
      return { ...state, stage: 'creating', revision: answer?.trim() };
    case 'handoff':
      return choice === 'mobile'
        ? { ...state, handoffTarget: 'mobile' }
        : { ...state, stage: 'revision' };
    default:
      throw Error('Show the actual preview before continuing.');
  }
}
