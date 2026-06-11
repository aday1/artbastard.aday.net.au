import type { FixtureLibraryEntry } from './types';

export const laserTwinklingRgy: FixtureLibraryEntry = {
  id: 'laser-twinkler',
  catalogId: 'AB-FIX-001',
  name: 'Twinkling Laser Series RGY',
  defaultNamePrefix: 'Twinkling Laser RGY',
  type: 'Laser',
  category: 'Laser / Twinkling and starfield',
  manufacturer: 'Generic',
  model: 'TL-2028',
  modelConfidence: 'probable',
  photoUrl: '/fixtures/ab-fix-001-twinkling-laser-rgy.jpg',
  documentationPath: 'DOCS/fixtures/AB-FIX-001-twinkling-laser-rgy.md',
  notes:
    'Probable TL-2028 variant. Channels 2-4 are active only when channel 1 is in DMX mode (50-99). The manual documents channel 5 only for TL-2028.',
  tags: ['LASER', 'TWINKLING', 'STARFIELD', 'RGY', 'SOUND ACTIVE', 'AUTO'],
  addressing: {
    method: 'dip-switch',
    addressRange: {
      min: 1,
      max: 511,
      switches: [
        { switch: 1, value: 1 },
        { switch: 2, value: 2 },
        { switch: 3, value: 4 },
        { switch: 4, value: 8 },
        { switch: 5, value: 16 },
        { switch: 6, value: 32 },
        { switch: 7, value: 64 },
        { switch: 8, value: 128 },
        { switch: 9, value: 256 },
      ],
    },
    modeSwitches: [
      {
        description: 'DMX or slave mode',
        states: { 10: 0 },
      },
      {
        description: 'Sound-active master mode',
        states: { 9: 0, 10: 1 },
      },
      {
        description: 'Automatic master mode',
        states: { 9: 1, 10: 1 },
      },
    ],
  },
  modes: [
    {
      name: '5-channel mode',
      channels: 5,
      channelData: [
        {
          name: 'Laser Power and Operating Mode',
          type: 'macro',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 49, description: 'Laser off' },
            { min: 50, max: 99, description: 'DMX mode' },
            { min: 100, max: 149, description: 'Sound-active mode' },
            { min: 150, max: 255, description: 'Automatic mode' },
          ],
        },
        {
          name: 'Effect Rotation Direction',
          type: 'effect',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 99, description: 'Clockwise rotation' },
            { min: 100, max: 199, description: 'Rotation stopped' },
            { min: 200, max: 255, description: 'Counter-clockwise rotation' },
          ],
        },
        {
          name: 'Effect Rotation Speed',
          type: 'speed',
          ranges: [
            { min: 0, max: 255, description: 'Fast to slow' },
          ],
        },
        {
          name: 'Twinkle Speed',
          type: 'speed',
          ranges: [
            { min: 0, max: 255, description: 'Fast to slow' },
          ],
        },
        {
          name: 'Laser Colour Selection',
          type: 'color_wheel',
          ticksOnly: true,
          ranges: [
            { min: 0, max: 99, description: 'Red and green (yellow)' },
            { min: 100, max: 199, description: 'Red' },
            { min: 200, max: 255, description: 'Green' },
          ],
        },
      ],
    },
  ],
};

