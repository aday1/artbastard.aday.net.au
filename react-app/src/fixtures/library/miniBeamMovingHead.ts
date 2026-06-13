import type { FixtureLibraryEntry } from './types';

export const miniBeamMovingHead: FixtureLibraryEntry = {
  id: 'minibeam-moving-head',
  catalogId: 'AB-FIX-002',
  name: 'MiniBeam Moving Head Spot',
  defaultNamePrefix: 'MiniBeam',
  type: 'Moving Head Spot',
  category: 'Moving head / Beam spot with gobos',
  manufacturer: 'Generic',
  model: 'MiniBeam',
  modelConfidence: 'confirmed',
  photoUrl: '/fixtures/ab-fix-002-minibeam-moving-head-generated.png',
  documentationPath: 'DOCS/fixtures/AB-FIX-002-minibeam-moving-head.md',
  notes:
    'User-owned MiniBeam moving-head fixture. Manual pages document one 18-channel mode with colour wheel, gobo wheel, prism, frost, focus, pan/tilt fine control, reset and lamp commands. The macro note is ambiguous in the photo and is preserved in documentation.',
  tags: ['MOVING HEAD', 'BEAM', 'SPOT', 'GOBO', 'PRISM', 'FROST', 'FOCUS', 'PAN', 'TILT'],
  modes: [
    {
      name: '18-channel mode',
      channels: 18,
      channelData: [
        {
          name: 'Colour Wheel',
          type: 'color_wheel',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 3, description: 'White' },
            { min: 4, max: 8, description: 'White plus colour 1' },
            { min: 9, max: 12, description: 'Colour 1' },
            { min: 13, max: 17, description: 'Colour 1 plus colour 2' },
            { min: 18, max: 21, description: 'Colour 2' },
            { min: 22, max: 26, description: 'Colour 2 plus colour 3' },
            { min: 27, max: 31, description: 'Colour 3' },
            { min: 32, max: 35, description: 'Colour 3 plus colour 4' },
            { min: 36, max: 40, description: 'Colour 4' },
            { min: 41, max: 44, description: 'Colour 4 plus colour 5' },
            { min: 45, max: 49, description: 'Colour 5' },
            { min: 50, max: 53, description: 'Colour 5 plus colour 6' },
            { min: 54, max: 58, description: 'Colour 6' },
            { min: 59, max: 63, description: 'Colour 6 plus colour 7' },
            { min: 64, max: 67, description: 'Colour 7' },
            { min: 68, max: 72, description: 'Colour 7 plus colour 8' },
            { min: 73, max: 76, description: 'Colour 8' },
            { min: 77, max: 81, description: 'Colour 8 plus colour 9' },
            { min: 82, max: 85, description: 'Colour 9' },
            { min: 86, max: 90, description: 'Colour 9 plus colour 10' },
            { min: 91, max: 95, description: 'Colour 10' },
            { min: 96, max: 99, description: 'Colour 10 plus colour 11' },
            { min: 100, max: 104, description: 'Colour 11' },
            { min: 105, max: 108, description: 'Colour 11 plus colour 12' },
            { min: 109, max: 113, description: 'Colour 12' },
            { min: 114, max: 117, description: 'Colour 12 plus colour 13' },
            { min: 118, max: 122, description: 'Colour 13' },
            { min: 123, max: 127, description: 'Colour 13 plus colour 14' },
            { min: 128, max: 191, description: 'Colour wheel rotate forward, fast to slow' },
            { min: 192, max: 255, description: 'Colour wheel rotate reverse, slow to fast' },
          ],
        },
        {
          name: 'Strobe',
          type: 'strobe',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 3, description: 'Closed / dark' },
            { min: 4, max: 103, description: 'Pulse strobe, slow to fast' },
            { min: 104, max: 107, description: 'Open' },
            { min: 108, max: 207, description: 'Pulse strobe, slow to fast' },
            { min: 208, max: 212, description: 'Open' },
            { min: 213, max: 251, description: 'Random strobe, slow to fast' },
            { min: 252, max: 255, description: 'Open' },
          ],
        },
        {
          name: 'Dimmer',
          type: 'dimmer',
          ranges: [
            { min: 0, max: 255, description: '0-100% dimmer' },
          ],
        },
        {
          name: 'Gobo Wheel',
          type: 'gobo',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 7, description: 'White / open' },
            { min: 8, max: 16, description: 'Gobo 1' },
            { min: 17, max: 24, description: 'Gobo 2' },
            { min: 25, max: 33, description: 'Gobo 3' },
            { min: 34, max: 41, description: 'Gobo 4' },
            { min: 42, max: 50, description: 'Gobo 5' },
            { min: 51, max: 58, description: 'Gobo 6' },
            { min: 59, max: 67, description: 'Gobo 7' },
            { min: 68, max: 75, description: 'Gobo 8' },
            { min: 76, max: 84, description: 'Gobo 9' },
            { min: 85, max: 92, description: 'Gobo 10' },
            { min: 93, max: 101, description: 'Gobo 11' },
            { min: 102, max: 109, description: 'Gobo 12' },
            { min: 110, max: 118, description: 'Gobo 13' },
            { min: 119, max: 127, description: 'Gobo 14' },
            { min: 128, max: 191, description: 'Gobo wheel rotate reverse, fast to slow' },
            { min: 192, max: 255, description: 'Gobo wheel rotate forward, slow to fast' },
          ],
        },
        {
          name: 'Prism',
          type: 'prism',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 127, description: 'No prism' },
            { min: 128, max: 255, description: 'Insert prism' },
          ],
        },
        {
          name: 'Prism Rotation',
          type: 'prism_rotation',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 127, description: 'Indexed prism angle, manual notes 5-60 degrees' },
            { min: 128, max: 190, description: 'Rotate forward, fast to slow' },
            { min: 191, max: 192, description: 'Stop' },
            { min: 193, max: 255, description: 'Rotate reverse, slow to fast' },
          ],
        },
        {
          name: 'Colourful Effect',
          type: 'effect',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 127, description: 'None' },
            { min: 128, max: 255, description: 'Insert colourful effect' },
          ],
        },
        {
          name: 'Frost',
          type: 'frost',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 127, description: 'No frost' },
            { min: 128, max: 255, description: 'Insert frost' },
          ],
        },
        {
          name: 'Focus',
          type: 'focus',
          ranges: [
            { min: 0, max: 255, description: 'Far to near' },
          ],
        },
        {
          name: 'Pan',
          type: 'pan',
          ranges: [
            { min: 0, max: 255, description: '0-540 degrees' },
          ],
        },
        {
          name: 'Pan Fine',
          type: 'pan_fine',
          ranges: [
            { min: 0, max: 255, description: 'Fine pan, 0-2 degrees' },
          ],
        },
        {
          name: 'Tilt',
          type: 'tilt',
          ranges: [
            { min: 0, max: 255, description: '0-270 degrees' },
          ],
        },
        {
          name: 'Tilt Fine',
          type: 'tilt_fine',
          ranges: [
            { min: 0, max: 255, description: 'Fine tilt, 0-1 degree' },
          ],
        },
        {
          name: 'Macro Function',
          type: 'macro',
          ticksOnly: true,
          ranges: [
            {
              min: 0,
              max: 255,
              description: 'Macro function. Manual note: 0-14 no function, 15-255 one effect per five-value interval.',
            },
          ],
        },
        {
          name: 'Reset',
          type: 'reset',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 25, description: 'None' },
            { min: 26, max: 76, description: 'Reset effect motor over 3 seconds' },
            { min: 77, max: 127, description: 'Reset pan/tilt motor over 3 seconds' },
            { min: 128, max: 255, description: 'Reset fixture over 3 seconds' },
          ],
        },
        {
          name: 'Lamp Control',
          type: 'lamp',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 25, description: 'None' },
            { min: 26, max: 100, description: 'Turn lamp off over 3 seconds' },
            { min: 101, max: 255, description: 'Turn lamp on over 3 seconds' },
          ],
        },
        {
          name: 'Pan/Tilt Speed',
          type: 'speed',
          ranges: [
            { min: 0, max: 255, description: 'Fast to slow' },
          ],
        },
        {
          name: 'Colour Speed',
          type: 'speed',
          ranges: [
            { min: 0, max: 255, description: 'Colour wheel/effect speed' },
          ],
        },
      ],
    },
  ],
};
