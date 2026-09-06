import { INITIAL, type Artwork } from './art';
import { DEFAULT_DESIGN, type InkStroke, type TextLayer } from './design';
const words = (
  text: string,
  y: number,
  size: number,
  color: string,
  font: TextLayer['font'] = 'sans',
): TextLayer => ({
  id: text,
  text,
  x: 512,
  y,
  size,
  color,
  font,
  rotation: 0,
  align: 'center',
});
const petal: InkStroke = {
  tool: 'pen',
  color: '#6bdde5',
  width: 3,
  opacity: 80,
  symmetry: 8,
  points: Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * Math.PI * 2;
    return [
      512 + Math.sin(t) * (90 + 25 * Math.cos(t * 3)),
      330 + Math.cos(t) * 145,
    ] as [number, number];
  }),
};
export const DESIGN_STARTERS: { title: string; note: string; art: Artwork }[] =
  [
    {
      title: 'Afterlight',
      note: 'One gesture. Eightfold symmetry.',
      art: {
        ...INITIAL,
        name: 'Afterlight / 001',
        description: 'A small gesture, repeated into a luminous whole.',
        source: 'blank',
        background: '#061316',
        design: {
          ...DEFAULT_DESIGN,
          backdrop: 'radial',
          accent: '#173841',
          strokes: [
            petal,
            {
              ...petal,
              color: '#d8ef82',
              width: 2,
              points: petal.points.map(([x, y]) => [
                512 + (x - 512) * 0.7,
                512 + (y - 512) * 0.7,
              ]),
            },
          ],
          frame: 'corners',
          frameColor: '#518c8f',
          texts: [words('AFTERLIGHT', 891, 42, '#cde8d8', 'mono')],
        },
      },
    },
    {
      title: 'Stay curious',
      note: 'A statement, in your own words.',
      art: {
        ...INITIAL,
        name: 'Stay curious',
        description:
          'Keep a little room for the things you have not imagined yet.',
        source: 'blank',
        background: '#170d25',
        design: {
          ...DEFAULT_DESIGN,
          backdrop: 'linear',
          accent: '#4d2b53',
          frame: 'double',
          frameColor: '#aa7fab',
          texts: [
            words('STAY', 358, 150, '#f4e5fa'),
            words('CURIOUS.', 525, 130, '#f4e5fa'),
            words('AN IDEA IS ONLY THE BEGINNING', 785, 23, '#d4b7e4', 'mono'),
          ],
          strokes: [
            {
              tool: 'circle',
              color: '#e69ac9',
              width: 3,
              opacity: 60,
              symmetry: 1,
              points: [
                [100, 110],
                [890, 900],
              ],
            },
          ],
        },
      },
    },
    {
      title: 'Signal study',
      note: 'Geometry with an editorial finish.',
      art: {
        ...INITIAL,
        source: 'orbit',
        name: 'Signal study / 01',
        description: 'A pair of trajectories, finding their own rhythm.',
        hue: 85,
        detail: 65,
        scale: 125,
        background: '#081118',
        design: {
          ...DEFAULT_DESIGN,
          backdrop: 'grid',
          accent: '#1b3037',
          copies: 2,
          frame: 'corners',
          frameColor: '#7dabb1',
          texts: [
            words('SIGNAL / 01', 112, 38, '#c9f2ed', 'mono'),
            words(
              'MAKE SOMETHING ONLY YOU CAN MAKE',
              922,
              20,
              '#a9c0b8',
              'mono',
            ),
          ],
        },
      },
    },
  ];
