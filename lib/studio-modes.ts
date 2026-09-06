export const MODES = [
  {
    id: 'art',
    number: '01',
    title: 'Image & art',
    verb: 'Make it unmistakably yours.',
    detail:
      'Your image, a blank canvas, or generative art. Draw, remix and mint.',
    tag: 'PNG · JPEG · WebP · generative SVG',
    accent: '#d7f98a',
    image: '/art/chroma.webp',
  },
  {
    id: 'scroll',
    number: '02',
    title: 'Ledger Scroll',
    verb: 'A story with a final word.',
    detail:
      'Publish a complete text or file as an immutable, recoverable Scroll.',
    tag: 'Writing · documents · archives',
    accent: '#e6c99a',
    image: '',
  },
  {
    id: 'book',
    number: '03',
    title: 'Ledger Book',
    verb: 'Leave room for the next chapter.',
    detail:
      'An ongoing public book with entries, replies and a permanent trail.',
    tag: 'Journals · communities · living records',
    accent: '#b6b3ff',
    image: '',
  },
  {
    id: 'music',
    number: '04',
    title: 'Music & sound',
    verb: 'Let your art make some noise.',
    detail: 'Compose a groove, pair it with a cover, or embed your own audio.',
    tag: 'Beat Lab · audio · synthesized scores',
    accent: '#e8b886',
    image: '',
  },
  {
    id: 'game',
    number: '05',
    title: 'Playable games',
    verb: 'The collectible is the game.',
    detail: 'Try nine complete games. Keep the one you love in your wallet.',
    tag: 'Puzzles · strategy · arcade',
    accent: '#9acfd6',
    image: '/arcade/starfall/cover.svg',
  },
  {
    id: 'utility',
    number: '06',
    title: 'Useful little things',
    verb: 'Give your NFT something to do.',
    detail:
      'A focus timer, decision deck or beat machine with your own settings.',
    tag: 'Working apps · open and reusable',
    accent: '#b9cdaa',
    image: '',
  },
  {
    id: 'motion',
    number: '07',
    title: 'Motion & animation',
    verb: 'A still image is only the beginning.',
    detail:
      'Explore on-chain animation and bring your own compact moving artwork.',
    tag: 'SVG motion · HTML · animated media',
    accent: '#c9a8eb',
    image: '/art/solar.webp',
  },
  {
    id: 'data',
    number: '08',
    title: 'Files & data',
    verb: 'Put the actual bytes on chain.',
    detail:
      'Package files with an NFT, or publish data without minting a token.',
    tag: 'Files · JSON · text · verification',
    accent: '#a7cbbd',
    image: '',
  },
] as const;
export type CreationMode = (typeof MODES)[number]['id'];
export type StudioView =
  | 'create'
  | 'showcase'
  | 'projects'
  | 'recover'
  | 'guide';
export const isCreationMode = (v: unknown): v is CreationMode =>
  MODES.some((m) => m.id === v);
