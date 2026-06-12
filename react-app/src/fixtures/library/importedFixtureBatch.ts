import type { FixtureLibraryChannel, FixtureLibraryEntry, FixtureLibraryRange } from './types';

const full = (description: string): FixtureLibraryRange[] => [
  { min: 0, max: 255, description },
];

const range = (min: number, max: number, description: string): FixtureLibraryRange => ({
  min,
  max,
  description,
});

const channel = (
  name: string,
  type: string,
  ranges: FixtureLibraryRange[] = full('0-100%'),
  ticksOnly = false
): FixtureLibraryChannel => ({
  name,
  type,
  ranges,
  ticksOnly,
});

const rgbwChannels = [
  channel('Red Dimmer', 'red', full('Red 0-100%')),
  channel('Green Dimmer', 'green', full('Green 0-100%')),
  channel('Blue Dimmer', 'blue', full('Blue 0-100%')),
  channel('White Dimmer', 'white', full('White 0-100%')),
];

const panTiltFine = [
  channel('Pan', 'pan', full('Pan movement')),
  channel('Pan Fine', 'pan_fine', full('Fine pan trim')),
  channel('Tilt', 'tilt', full('Tilt movement')),
  channel('Tilt Fine', 'tilt_fine', full('Fine tilt trim')),
];

const miniWashShutter = channel('Master Dimmer and Shutter', 'dimmer', [
  range(0, 7, 'Blackout / closed'),
  range(8, 134, 'Master dimmer'),
  range(135, 239, 'Strobe, slow to fast'),
  range(240, 255, 'Open'),
], true);

export const miniLedMovingHeadWash: FixtureLibraryEntry = {
  id: 'mini-led-moving-head-wash',
  catalogId: 'AB-FIX-003',
  name: 'Mini LED Moving Head Wash',
  defaultNamePrefix: 'Mini Wash',
  type: 'Moving Head Wash',
  category: 'Moving head / LED wash',
  manufacturer: 'Generic',
  model: 'Mini LED Moving Head',
  modelConfidence: 'confirmed',
  photoUrl: '/fixtures/ab-fix-003-mini-led-moving-head-wash.jpg',
  documentationPath: 'DOCS/fixtures/AB-FIX-003-mini-led-moving-head-wash.md',
  notes:
    'User-owned mini LED moving wash. Manual was partly bilingual Chinese/English; this profile normalises the 9-channel and 14-channel tables into English.',
  tags: ['MOVING HEAD', 'WASH', 'LED', 'RGBW', 'PAN', 'TILT', 'AUTO', 'SOUND'],
  modes: [
    {
      name: '14-channel mode',
      channels: 14,
      channelData: [
        ...panTiltFine,
        channel('Pan/Tilt Speed', 'speed', full('XY movement speed')),
        miniWashShutter,
        ...rgbwChannels,
        channel('Colour Macro', 'macro', [
          range(0, 7, 'Manual RGBW mix from channels 7-10'),
          range(8, 231, 'Built-in colour macros'),
          range(232, 255, 'Colour jump'),
        ], true),
        channel('Colour Jump Speed', 'speed', full('Colour jump speed')),
        channel('Program Mode', 'macro', [
          range(0, 7, 'Manual control using channels 1-12'),
          range(8, 63, 'Fast automatic program'),
          range(64, 127, 'Slow automatic program'),
          range(128, 191, 'Sound mode 1'),
          range(192, 255, 'Sound mode 2'),
        ], true),
        channel('Reset', 'reset', [
          range(0, 149, 'No documented action'),
          range(150, 200, 'Reset'),
          range(201, 255, 'No documented action'),
        ], true),
      ],
    },
    {
      name: '9-channel mode',
      channels: 9,
      channelData: [
        channel('Pan', 'pan', full('Pan movement')),
        channel('Tilt', 'tilt', full('Tilt movement')),
        miniWashShutter,
        ...rgbwChannels,
        channel('Pan/Tilt Speed', 'speed', full('XY movement speed')),
        channel('Reset', 'reset', [
          range(0, 149, 'No documented action'),
          range(150, 200, 'Reset'),
          range(201, 255, 'No documented action'),
        ], true),
      ],
    },
  ],
};

export const uvDmxLedPar: FixtureLibraryEntry = {
  id: 'uv-dmx-led-par',
  catalogId: 'AB-FIX-004',
  name: 'UV DMX LED Par',
  defaultNamePrefix: 'UV Par',
  type: 'UV LED Par',
  category: 'UV / LED par wash',
  manufacturer: 'Generic',
  modelConfidence: 'unknown',
  photoUrl: '/fixtures/ab-fix-004-uv-dmx-led-par.jpg',
  documentationPath: 'DOCS/fixtures/AB-FIX-004-uv-dmx-led-par.md',
  notes:
    'Purple/UV LED par-style wash. Manual documents one 7-channel DMX mode plus local menu programs for colour select, shade, pulse, transition, strobe and sound.',
  tags: ['UV', 'PURPLE', 'LED', 'PAR', 'WASH', 'STROBE', 'SOUND'],
  modes: [
    {
      name: '7-channel mode',
      channels: 7,
      channelData: [
        channel('Master UV Brightness', 'dimmer', full('Master brightness, used with channels 2-4')),
        channel('UV Bank 1', 'uv', [
          range(0, 0, 'Purple/UV bank off'),
          range(1, 255, 'Purple/UV brightness, dark to bright'),
        ]),
        channel('UV Bank 2', 'uv', [
          range(0, 0, 'Purple/UV bank off'),
          range(1, 255, 'Purple/UV brightness, dark to bright'),
        ]),
        channel('UV Bank 3', 'uv', [
          range(0, 0, 'Purple/UV bank off'),
          range(1, 255, 'Purple/UV brightness, dark to bright'),
        ]),
        channel('Strobe', 'strobe', [
          range(0, 7, 'No strobe'),
          range(8, 255, 'Strobe, slow to fast'),
        ], true),
        channel('Program Mode', 'macro', [
          range(0, 10, 'Manual control using channels 1-5'),
          range(11, 60, 'Colour selection, speed/colour controlled by channel 7'),
          range(61, 110, 'Colour shade, speed controlled by channel 7'),
          range(111, 160, 'Colour pulse transform, speed controlled by channel 7'),
          range(161, 210, 'Colour transition, speed controlled by channel 7'),
          range(211, 255, 'Sound-activated mode'),
        ], true),
        channel('Program Selector / Speed', 'speed', full('Colour selection, shade, or program speed')),
      ],
    },
  ],
};

const colourWheelRanges = [
  range(0, 7, 'Colour 1'),
  range(8, 14, 'Colour 2'),
  range(15, 21, 'Colour 3'),
  range(22, 28, 'Colour 4'),
  range(29, 35, 'Colour 5'),
  range(36, 42, 'Colour 6'),
  range(43, 49, 'Colour 7'),
  range(50, 56, 'Colour 8'),
  range(57, 127, 'Half-colour positions'),
  range(128, 189, 'Colour wheel rotate fast to slow, then stop'),
  range(190, 193, 'Fast colour rotation'),
  range(194, 255, 'Colour wheel rotate slow to fast'),
];

const goboWheelRanges = [
  range(0, 7, 'Gobo 1'),
  range(8, 15, 'Gobo 2'),
  range(16, 23, 'Gobo 3'),
  range(24, 31, 'Gobo 4'),
  range(32, 39, 'Gobo 5'),
  range(40, 47, 'Gobo 6'),
  range(48, 55, 'Gobo 7'),
  range(56, 63, 'Gobo 8'),
  range(64, 71, 'Gobo 1 jitter'),
  range(72, 79, 'Gobo 2 jitter'),
  range(80, 87, 'Gobo 3 jitter'),
  range(88, 95, 'Gobo 4 jitter'),
  range(96, 103, 'Gobo 5 jitter'),
  range(104, 111, 'Gobo 6 jitter'),
  range(112, 119, 'Gobo 7 jitter'),
  range(120, 127, 'Gobo 8 jitter'),
  range(128, 189, 'Gobo wheel rotate fast to slow, then stop'),
  range(190, 193, 'Fast gobo rotation'),
  range(194, 255, 'Gobo wheel rotate slow to fast'),
];

const smallMoverStrobe = channel('Strobe', 'strobe', [
  range(0, 7, 'On'),
  range(8, 15, 'Off'),
  range(16, 131, 'Strobe, slow to fast'),
  range(132, 139, 'Off'),
  range(140, 181, 'Fast-on / slow-off pulse'),
  range(182, 189, 'Off'),
  range(190, 231, 'Fast-off / slow-on pulse'),
  range(232, 239, 'Off'),
  range(240, 247, 'Dimming effect'),
  range(248, 255, 'Off'),
], true);

const smallMoverMode = channel('Movement Macro', 'macro', [
  range(0, 69, 'Pan/tilt movement with lamp on'),
  range(70, 119, 'Pan/tilt and colour/gobo movement programs'),
  range(120, 249, 'Gobo and colour movement programs'),
  range(250, 255, 'Sound effect show'),
], true);

const smallMoverDimMode = channel('Dim Mode / Reset', 'reset', [
  range(0, 20, 'Standard dim mode'),
  range(21, 40, 'Stage dim mode'),
  range(41, 60, 'TV dim mode'),
  range(61, 80, 'Building dim mode'),
  range(81, 100, 'Theatre dim mode'),
  range(101, 255, 'Reset'),
], true);

export const smallMovingHeadSpot: FixtureLibraryEntry = {
  id: 'small-moving-head-spot',
  catalogId: 'AB-FIX-005',
  name: 'Small Moving Head Spot',
  defaultNamePrefix: 'Small Mover',
  type: 'Moving Head Spot',
  category: 'Moving head / Small spot with colour and gobos',
  manufacturer: 'Generic',
  modelConfidence: 'unknown',
  photoUrl: '/fixtures/ab-fix-005-small-moving-head-spot-lineart.png',
  documentationPath: 'DOCS/fixtures/AB-FIX-005-small-moving-head-spot.md',
  notes:
    'Manual-only small moving head profile. The source page is incomplete and broken English; ambiguous macro rows are preserved conservatively.',
  tags: ['MOVING HEAD', 'SPOT', 'GOBO', 'COLOR WHEEL', 'PAN', 'TILT', 'STROBE', 'PARTIAL MANUAL'],
  modes: [
    {
      name: '9-channel mode',
      channels: 9,
      channelData: [
        channel('Pan', 'pan', full('Pan movement')),
        channel('Tilt', 'tilt', full('Tilt movement')),
        channel('Colour Wheel', 'color_wheel', colourWheelRanges, true),
        channel('Gobo Wheel', 'gobo', goboWheelRanges, true),
        smallMoverStrobe,
        channel('Dimmer', 'dimmer', full('0-100% dimmer')),
        channel('Pan/Tilt Speed', 'speed', full('Fast to slow')),
        smallMoverMode,
        smallMoverDimMode,
      ],
    },
    {
      name: '11-channel mode',
      channels: 11,
      channelData: [
        channel('Pan', 'pan', full('Pan movement')),
        channel('Pan Fine', 'pan_fine', full('Fine pan trim')),
        channel('Tilt', 'tilt', full('Tilt movement')),
        channel('Tilt Fine', 'tilt_fine', full('Fine tilt trim')),
        channel('Colour Wheel', 'color_wheel', colourWheelRanges, true),
        channel('Gobo Wheel', 'gobo', goboWheelRanges, true),
        smallMoverStrobe,
        channel('Dimmer', 'dimmer', full('0-100% dimmer')),
        channel('Pan/Tilt Speed', 'speed', full('Fast to slow')),
        smallMoverMode,
        smallMoverDimMode,
      ],
    },
  ],
};

export const fullColourAnimationLaser: FixtureLibraryEntry = {
  id: 'full-colour-animation-laser',
  catalogId: 'AB-FIX-006',
  name: 'Full Colour Animation Laser',
  defaultNamePrefix: 'Animation Laser',
  type: 'Laser',
  category: 'Laser / Full-colour animation and pattern laser',
  manufacturer: 'Generic',
  modelConfidence: 'unknown',
  documentationPath: 'DOCS/fixtures/AB-FIX-006-full-colour-animation-laser.md',
  notes:
    'Ripped single-page manual source. Profile keeps the documented 12-channel and 20-channel maps usable for patching; unclear rows are marked partial.',
  tags: ['LASER', 'RGB', 'ANIMATION', 'PATTERN', 'SOUND', 'AUTO', 'PARTIAL MANUAL'],
  modes: [
    {
      name: '12-channel standard mode',
      channels: 12,
      channelData: [
        channel('Laser Switch', 'shutter', [range(0, 0, 'Laser off'), range(1, 255, 'Laser on')], true),
        channel('Auto / Music Trigger', 'macro', [
          range(0, 63, 'Manual control'),
          range(64, 127, 'Auto built-in'),
          range(128, 191, 'Music control'),
          range(192, 255, 'DMX-controlled trigger'),
        ], true),
        channel('Pattern Selection', 'gobo', full('Pattern selection')),
        channel('Effect Group Selection', 'effect', full('Built-in effect group selection')),
        channel('Effect Speed', 'speed', full('Effect speed')),
        channel('Colour Mode', 'color_wheel', [
          range(0, 63, 'Fixed colour selection'),
          range(64, 127, 'Colour-changing effect speed'),
          range(128, 191, 'Flow effect speed'),
          range(192, 255, 'Gradual drawing effect speed'),
        ], true),
        channel('Pattern Flip Horizontal', 'effect', full('Horizontal flip position/speed')),
        channel('Pattern Flip Vertical', 'effect', full('Vertical flip position/speed')),
        channel('Pattern Zoom', 'zoom', full('Pattern zoom selection/speed')),
        channel('Pattern Draw Speed', 'speed', full('Gradual drawing speed')),
        channel('Scan Speed / Point Effect', 'speed', full('Scan speed and point effect')),
        channel('Pattern Rotation / Partial Utility', 'effect', full('Torn manual row, preserve as utility')),
      ],
    },
    {
      name: '20-channel professional mode',
      channels: 20,
      channelData: [
        channel('Laser Switch', 'shutter', [range(0, 0, 'Laser off'), range(1, 255, 'Laser on')], true),
        channel('Auto / Music Trigger', 'macro', [
          range(0, 63, 'Manual control'),
          range(64, 127, 'Run built-in'),
          range(128, 191, 'Music control'),
          range(192, 255, 'DMX-controlled trigger'),
        ], true),
        channel('Pattern Selection', 'gobo', full('Select pattern; manual notes one pattern every two values')),
        channel('Pattern Rotation', 'effect', [
          range(0, 127, 'Rotation angle selection'),
          range(128, 191, 'Inverted rotation speed'),
          range(192, 255, 'Normal rotation speed'),
        ], true),
        channel('Effect Selection', 'effect', full('Built-in effect selection')),
        channel('Horizontal Flip', 'effect', [range(1, 127, 'Horizontal flip position'), range(128, 255, 'Horizontal flip speed')], true),
        channel('Vertical Flip', 'effect', [range(1, 127, 'Vertical flip position'), range(128, 255, 'Vertical flip speed')], true),
        channel('Horizontal Movement', 'pan', [range(1, 127, 'Horizontal movement position'), range(128, 255, 'Horizontal movement speed')]),
        channel('Vertical Movement', 'tilt', [range(1, 127, 'Vertical movement position'), range(128, 255, 'Vertical movement speed')]),
        channel('Pattern Size', 'zoom', [range(0, 63, 'Pattern size selection'), range(64, 127, 'Zoom out speed'), range(128, 191, 'Zoom speed'), range(192, 255, 'Zoom speed')], true),
        channel('Pattern Gradual Draw', 'effect', [range(1, 127, 'Gradual drawing speed'), range(128, 255, 'Gradual drawing reverse/speed')], true),
        channel('Colour Mode', 'color_wheel', [range(0, 63, 'Fixed colour selection'), range(64, 127, 'Colour-changing effect speed'), range(128, 191, 'Flow effect speed'), range(192, 255, 'Gradual drawing effect speed')], true),
        channel('Pattern Selection B', 'gobo', full('Secondary pattern selection')),
        channel('Pattern Rotation B', 'effect', [range(1, 127, 'Rotation angle'), range(128, 191, 'Inverted rotation speed'), range(192, 255, 'Normal rotation speed')], true),
        channel('Horizontal Flip B', 'effect', [range(1, 127, 'Horizontal flip position'), range(128, 255, 'Horizontal flip speed')], true),
        channel('Vertical Flip B', 'effect', [range(1, 127, 'Vertical flip position'), range(128, 255, 'Vertical flip speed')], true),
        channel('Horizontal Movement B', 'pan', [range(1, 127, 'Horizontal movement position'), range(128, 255, 'Horizontal movement speed')]),
        channel('Vertical Movement B', 'tilt', [range(1, 127, 'Vertical movement position'), range(128, 255, 'Vertical movement speed')]),
        channel('Pattern Zoom B', 'zoom', [range(0, 63, 'Pattern size selection'), range(64, 127, 'Zoom out speed'), range(128, 191, 'Zoom speed'), range(192, 255, 'Zoom speed')], true),
        channel('Pattern Draw Speed B', 'speed', full('Torn manual final utility row')),
      ],
    },
  ],
};

const tinyMoverCommon = [
  channel('Pan', 'pan', full('Pan movement')),
  channel('Pan Fine', 'pan_fine', full('Fine pan trim')),
  channel('Tilt', 'tilt', full('Tilt movement')),
  channel('Tilt Fine', 'tilt_fine', full('Fine tilt trim')),
  channel('Movement Speed', 'speed', full('Pan/tilt speed')),
  channel('Master Dimmer', 'dimmer', full('Master dimmer')),
  channel('Strobe', 'strobe', full('Strobe')),
  ...rgbwChannels,
];

export const tinyLedMovingHeadWash: FixtureLibraryEntry = {
  id: 'tiny-led-moving-head-wash',
  catalogId: 'AB-FIX-007',
  name: 'Tiny LED Moving Head Wash',
  defaultNamePrefix: 'Tiny Mover',
  type: 'Moving Head Wash',
  category: 'Moving head / Toy LED wash',
  manufacturer: 'Generic',
  model: 'LED Stage Lighting',
  modelConfidence: 'probable',
  photoUrl: '/fixtures/ab-fix-007-tiny-led-moving-head-wash.jpg',
  documentationPath: 'DOCS/fixtures/AB-FIX-007-tiny-led-moving-head-wash.md',
  notes:
    'Small toy-grade LED pan/tilt light. Manual documents 11-channel and 13-channel modes plus local auto, sound, motor direction and reset menus.',
  tags: ['MOVING HEAD', 'TOY', 'LED', 'RGBW', 'PAN', 'TILT', 'AUTO', 'SOUND'],
  modes: [
    {
      name: '13-channel mode',
      channels: 13,
      channelData: [
        ...tinyMoverCommon,
        channel('Self-propelled Program', 'macro', full('Automatic/self-propelled program')),
        channel('Reset', 'reset', [range(0, 149, 'No documented action'), range(150, 250, 'Reset'), range(251, 255, 'No documented action')], true),
      ],
    },
    {
      name: '11-channel mode',
      channels: 11,
      channelData: tinyMoverCommon,
    },
  ],
};

const spiderLedDimmers = Array.from({ length: 8 }, (_, index) =>
  channel(`LED ${index + 1} Dimmer`, index < 2 ? 'red' : index < 5 ? 'green' : 'blue', full('0-100% LED dimmer'))
);

const spiderMacroRanges = [
  range(0, 7, 'No effect'),
  range(8, 27, 'Effect 1'),
  range(28, 37, 'Effect 2'),
  range(38, 47, 'Effect 3'),
  range(48, 67, 'Effect 4'),
  range(68, 87, 'Effect 5'),
  range(88, 107, 'Effect 6'),
  range(108, 127, 'Effect 7'),
  range(128, 137, 'Effect 8'),
  range(138, 147, 'Effect 9'),
  range(148, 157, 'Effect 10'),
  range(158, 167, 'Effect 11'),
  range(168, 177, 'Effect 12'),
  range(178, 187, 'Effect 13'),
  range(188, 207, 'Effect 14'),
  range(208, 227, 'Effect 15'),
  range(228, 255, 'Effect 16+ / torn manual range'),
];

export const miniSpiderLight: FixtureLibraryEntry = {
  id: 'mini-spider-light',
  catalogId: 'AB-FIX-008',
  name: 'Mini Spider Light',
  defaultNamePrefix: 'Mini Spider',
  type: 'LED Effect',
  category: 'LED effect / Mini spider derby',
  manufacturer: 'Generic',
  model: 'Mini Spider Light',
  modelConfidence: 'confirmed',
  photoUrl: '/fixtures/ab-fix-008-mini-spider-light.jpg',
  documentationPath: 'DOCS/fixtures/AB-FIX-008-mini-spider-light.md',
  notes:
    'Mini Spider LED effect. Manual is torn but documents 7-channel and 15-channel DMX modes plus menu setup for sound, slave, display and motor direction.',
  tags: ['SPIDER', 'DERBY', 'LED', 'RGB', 'STROBE', 'DIMMER', 'AUTO', 'SOUND', 'PARTIAL MANUAL'],
  modes: [
    {
      name: '15-channel mode',
      channels: 15,
      channelData: [
        channel('Motor 1 Route', 'pan', full('Motor 1 route / position')),
        channel('Motor 2 Route', 'tilt', full('Motor 2 route / position')),
        channel('Master Dimmer', 'dimmer', full('0-100% master dimmer')),
        channel('Strobe', 'strobe', [range(0, 9, 'No strobe'), range(10, 255, 'Strobe speed, slow to fast')], true),
        ...spiderLedDimmers,
        channel('Macro Function', 'macro', spiderMacroRanges, true),
        channel('Effect Speed', 'speed', full('Effect speed')),
        channel('Reset / Utility', 'reset', full('Torn manual utility channel')),
      ],
    },
    {
      name: '7-channel mode',
      channels: 7,
      channelData: [
        channel('Motor 1 Route', 'pan', full('Motor 1 route / position')),
        channel('Motor 2 Route', 'tilt', full('Motor 2 route / position')),
        channel('Sun / LED Dimmer', 'dimmer', full('LED dimmer')),
        channel('Strobe', 'strobe', [range(0, 9, 'No strobe'), range(10, 255, 'Strobe speed, slow to fast')], true),
        channel('Macro Function', 'macro', spiderMacroRanges, true),
        channel('Effect Speed', 'speed', full('Effect speed')),
        channel('Reset / Utility', 'reset', full('Torn manual utility channel')),
      ],
    },
  ],
};

export const eventLightingEl1000Rgb: FixtureLibraryEntry = {
  id: 'event-lighting-el1000rgb',
  catalogId: 'AB-FIX-009',
  name: 'Event Lighting EL1000RGB',
  defaultNamePrefix: 'EL1000RGB',
  type: 'Laser',
  category: 'Laser / ILDA RGB animation laser',
  manufacturer: 'Event Lighting',
  model: 'EL1000RGB',
  modelConfidence: 'confirmed',
  documentationPath: 'DOCS/fixtures/AB-FIX-009-event-lighting-el1000rgb.md',
  notes:
    'Professional 1000 mW RGB animation laser with ILDA support. DMX profile completed from the official Event Lighting EL1000RGB manual.',
  tags: ['LASER', 'RGB', 'ANIMATION', 'ILDA', 'DMX', 'AUTO', 'SOUND', 'MASTER SLAVE', 'SAFETY'],
  modes: [
    {
      name: '16-channel mode',
      channels: 16,
      channelData: [
        channel('Laser On/Off', 'shutter', [range(0, 9, 'Laser off'), range(10, 255, 'Laser on')], true),
        channel('Colour Control', 'color_wheel', [
          range(0, 69, 'Static colours, white/red/green'),
          range(70, 79, 'Colour change'),
          range(80, 89, 'Default colour'),
          range(90, 99, 'Rainbow colour'),
          range(100, 224, 'Segmented colour, controlled by colour speed'),
          range(225, 229, 'Dynamic colour 1'),
          range(230, 234, 'Dynamic colour 2'),
          range(235, 239, 'Dynamic colour 3'),
          range(240, 244, 'Dynamic colour 4'),
          range(245, 249, 'Dynamic colour 5'),
          range(250, 255, 'Dynamic colour 6'),
        ], true),
        channel('Colour Speed', 'speed', [
          range(0, 9, 'No function'),
          range(10, 127, 'Clockwise colour speed, slow to fast'),
          range(128, 255, 'Anticlockwise colour speed, slow to fast'),
        ], true),
        channel('Pattern Option', 'gobo', full('Pattern option')),
        channel('Pattern Group Option', 'gobo', [
          range(0, 50, 'Inner patterns group 1'),
          range(51, 101, 'Inner patterns group 2'),
          range(102, 152, 'Inner patterns group 3'),
          range(153, 203, 'Inner patterns group 4'),
          range(204, 255, 'Inner patterns group 5'),
        ], true),
        channel('Pattern Size', 'zoom', full('Pattern size')),
        channel('Pattern Auto Zoom', 'zoom', [
          range(0, 15, 'No auto zoom'),
          range(16, 55, 'Zoom 1 speed'),
          range(56, 95, 'Zoom 2 speed'),
          range(96, 135, 'Zoom 3 speed'),
          range(136, 175, 'Cycle zoom 1 speed'),
          range(176, 215, 'Cycle zoom 2 speed'),
          range(216, 255, 'Cycle zoom 3 speed'),
        ], true),
        channel('Centre Rotation', 'effect', [
          range(0, 127, 'Rotation angle'),
          range(128, 191, 'Clockwise rotation speed'),
          range(192, 255, 'Anticlockwise rotation speed'),
        ], true),
        channel('Horizontal Rotation', 'pan', [range(0, 127, 'Flip horizontal location'), range(128, 255, 'Flip horizontal speed')]),
        channel('Vertical Rotation', 'tilt', [range(0, 127, 'Flip vertical location'), range(128, 255, 'Flip vertical speed')]),
        channel('Horizontal Move', 'pan', [range(0, 127, 'Horizontal location'), range(128, 255, 'Horizontal auto location')]),
        channel('Vertical Move', 'tilt', [range(0, 127, 'Vertical location'), range(128, 255, 'Vertical auto location speed')]),
        channel('Wave', 'effect', [range(0, 9, 'No function'), range(10, 255, 'Wave range and speed, slow to fast')], true),
        channel('Pattern Drawing', 'effect', [
          range(0, 1, 'No function'),
          range(2, 63, 'Drawing by manual adjustment'),
          range(64, 127, 'Drawing by manual adjustment'),
          range(128, 153, 'Automatic drawing increasing'),
          range(154, 179, 'Automatic drawing decreasing'),
          range(180, 205, 'Automatic drawing increasing/reverse'),
          range(206, 255, 'Automatic drawing increasing'),
        ], true),
        channel('Inner Dynamic Effect', 'effect', [
          range(0, 2, 'No function'),
          range(3, 229, 'Single group dynamic effect, speed controlled by channel 16'),
          range(230, 249, 'Random auto effect, speed controlled by channel 16'),
          range(250, 255, 'No documented action'),
        ], true),
        channel('Inner Dynamic Effect Speed', 'speed', [
          range(0, 127, 'Inner effect speed from internal program'),
          range(128, 255, 'Inner effect speed determined by DMX'),
        ]),
      ],
    },
  ],
};
