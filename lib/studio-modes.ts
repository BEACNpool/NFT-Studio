export const MODES = [
  {
    id: 'art',
    number: '01',
    title: 'Image & art',
    verb: 'Make it unmistakably yours.',
    detail: 'Upload an image or design your own.',
    tag: 'PNG · JPEG · WebP · generative SVG',
    accent: '#d7f98a',
    image: '/art/chroma.webp',
  },
  {
    id: 'scroll',
    number: '02',
    title: 'Ledger Scroll',
    verb: 'A story with a final word.',
    detail: 'Publish writing and complete files on chain.',
    tag: 'Writing · documents · archives',
    accent: '#e6c99a',
    image: '',
  },
  {
    id: 'book',
    number: '03',
    title: 'Ledger Book',
    verb: 'Leave room for the next chapter.',
    detail: 'Start a book with room for new entries.',
    tag: 'Journals · communities · living records',
    accent: '#b6b3ff',
    image: '',
  },
  {
    id: 'music',
    number: '04',
    title: 'Music & sound',
    verb: 'Let your art make some noise.',
    detail: 'Create a beat or add your own audio.',
    tag: 'Beat Lab · audio · synthesized scores',
    accent: '#e8b886',
    image: '',
  },
  {
    id: 'game',
    number: '05',
    title: 'Playable games',
    verb: 'The collectible is the game.',
    detail: 'Make a collectible you can actually play.',
    tag: 'Puzzles · strategy · arcade',
    accent: '#9acfd6',
    image: '/arcade/starfall/cover.svg',
  },
  {
    id: 'utility',
    number: '06',
    title: 'Apps & utility',
    verb: 'Give your NFT something to do.',
    detail: 'Add a working app to your collectible.',
    tag: 'Working apps · open and reusable',
    accent: '#b9cdaa',
    image: '',
  },
  {
    id: 'motion',
    number: '07',
    title: 'Motion & animation',
    verb: 'A still image is only the beginning.',
    detail: 'Give your artwork a little movement.',
    tag: 'SVG motion · HTML · animated media',
    accent: '#c9a8eb',
    image: '/art/solar.webp',
  },
  {
    id: 'data',
    number: '08',
    title: 'Files & data',
    verb: 'Put the actual bytes on chain.',
    detail: 'Preserve files, documents and data.',
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
  | 'labs'
  | 'guide';
export const isCreationMode = (v: unknown): v is CreationMode =>
  MODES.some((m) => m.id === v);
