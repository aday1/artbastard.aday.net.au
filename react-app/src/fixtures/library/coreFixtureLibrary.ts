import type { FixtureLibraryEntry } from './types';

export const genericDimmer: FixtureLibraryEntry = {
  id: 'generic-dimmer',
  catalogId: 'AB-FIX-010',
  name: 'Generic Dimmer',
  defaultNamePrefix: 'Dimmer',
  type: 'Dimmer',
  category: 'Generic Control',
  manufacturer: 'Generic',
  model: '1-channel intensity profile',
  modelConfidence: 'confirmed',
  documentationPath: 'DOCS/fixtures/AB-FIX-010-generic-dimmer.md',
  notes: 'Canonical fallback profile for a single DMX dimmer or intensity-only fixture.',
  tags: ['DIMMER', 'GENERIC', 'INTENSITY'],
  modes: [
    {
      name: '1-channel mode',
      channels: 1,
      channelData: [
        {
          name: 'Intensity',
          type: 'dimmer',
          ranges: [{ min: 0, max: 255, description: '0-100% intensity' }],
        },
      ],
    },
  ],
};

export const simpleRgbPar: FixtureLibraryEntry = {
  id: 'simple-rgb-par',
  catalogId: 'AB-FIX-011',
  name: 'Simple RGB Par Can',
  defaultNamePrefix: 'RGB Par',
  type: 'RGB Wash',
  category: 'Par / Wash',
  manufacturer: 'Generic',
  model: '4-channel RGB plus dimmer profile',
  modelConfidence: 'confirmed',
  documentationPath: 'DOCS/fixtures/AB-FIX-011-simple-rgb-par.md',
  notes: 'Generic starter profile for RGB par cans using direct RGB plus master dimmer.',
  tags: ['WASH', 'RGB', 'PAR', 'GENERIC'],
  modes: [
    {
      name: '4-channel mode',
      channels: 4,
      channelData: [
        { name: 'Red', type: 'red', ranges: [{ min: 0, max: 255, description: '0-100% red' }] },
        { name: 'Green', type: 'green', ranges: [{ min: 0, max: 255, description: '0-100% green' }] },
        { name: 'Blue', type: 'blue', ranges: [{ min: 0, max: 255, description: '0-100% blue' }] },
        { name: 'Dimmer', type: 'dimmer', ranges: [{ min: 0, max: 255, description: '0-100% master dimmer' }] },
      ],
    },
  ],
};

export const rgbwParCan: FixtureLibraryEntry = {
  id: 'rgbw-par-can',
  catalogId: 'AB-FIX-012',
  name: 'RGBW Par Can',
  defaultNamePrefix: 'RGBW Par',
  type: 'RGBW Wash',
  category: 'Par / Wash',
  manufacturer: 'Generic',
  model: '5-channel RGBW plus dimmer profile',
  modelConfidence: 'confirmed',
  documentationPath: 'DOCS/fixtures/AB-FIX-012-rgbw-par-can.md',
  notes: 'Generic starter profile for RGBW par cans using direct RGBW plus master dimmer.',
  tags: ['WASH', 'RGBW', 'LED', 'PAR', 'GENERIC'],
  modes: [
    {
      name: '5-channel mode',
      channels: 5,
      channelData: [
        { name: 'Red', type: 'red', ranges: [{ min: 0, max: 255, description: '0-100% red' }] },
        { name: 'Green', type: 'green', ranges: [{ min: 0, max: 255, description: '0-100% green' }] },
        { name: 'Blue', type: 'blue', ranges: [{ min: 0, max: 255, description: '0-100% blue' }] },
        { name: 'White', type: 'white', ranges: [{ min: 0, max: 255, description: '0-100% white' }] },
        { name: 'Dimmer', type: 'dimmer', ranges: [{ min: 0, max: 255, description: '0-100% master dimmer' }] },
      ],
    },
  ],
};

export const basicMovingHeadSpot: FixtureLibraryEntry = {
  id: 'basic-moving-head-spot',
  catalogId: 'AB-FIX-013',
  name: 'Basic Moving Head Spot',
  defaultNamePrefix: 'Basic Mover',
  type: 'Moving Head Spot',
  category: 'Moving Head',
  manufacturer: 'Generic',
  model: '10-channel pan/tilt spot profile',
  modelConfidence: 'confirmed',
  documentationPath: 'DOCS/fixtures/AB-FIX-013-basic-moving-head-spot.md',
  notes: 'Generic starter profile for unconfirmed moving head spot fixtures.',
  tags: ['MOVING HEAD', 'SPOT', 'RGB', 'GENERIC'],
  modes: [
    {
      name: '10-channel mode',
      channels: 10,
      channelData: [
        { name: 'Pan', type: 'pan', ranges: [{ min: 0, max: 255, description: 'Pan coarse' }] },
        { name: 'Tilt', type: 'tilt', ranges: [{ min: 0, max: 255, description: 'Tilt coarse' }] },
        { name: 'Dimmer', type: 'dimmer', ranges: [{ min: 0, max: 255, description: '0-100% master dimmer' }] },
        { name: 'Red', type: 'red', ranges: [{ min: 0, max: 255, description: '0-100% red' }] },
        { name: 'Green', type: 'green', ranges: [{ min: 0, max: 255, description: '0-100% green' }] },
        { name: 'Blue', type: 'blue', ranges: [{ min: 0, max: 255, description: '0-100% blue' }] },
        { name: 'Gobo Wheel', type: 'gobo_wheel', ranges: [{ min: 0, max: 255, description: 'Gobo selection or rotation' }] },
        { name: 'Color Wheel', type: 'color_wheel', ranges: [{ min: 0, max: 255, description: 'Color wheel selection or rotation' }] },
        { name: 'Strobe', type: 'strobe', ranges: [{ min: 0, max: 255, description: 'Strobe slow to fast' }] },
        { name: 'Zoom', type: 'zoom', ranges: [{ min: 0, max: 255, description: 'Beam zoom' }] },
      ],
    },
  ],
};

