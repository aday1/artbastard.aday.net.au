export interface FixtureTemplate {
  id: string;
  name: string;
  type: string;
  modes?: Array<{
    name: string;
    channels: number;
    channelData: Array<{ name: string; type: string; ranges?: Array<{ min: number; max: number; description: string }> }>;
  }>;
  channels?: Array<{ name: string; type: string }>; // For backward compatibility
}

export const fixtureTemplates: FixtureTemplate[] = [
  {
    id: 'template-moving-head',
    name: 'Moving Head',
    type: 'moving-head',
    channels: [
      { name: 'Pan', type: 'pan' },
      { name: 'Tilt', type: 'tilt' },
      { name: 'Dimmer', type: 'dimmer' },
      { name: 'Red', type: 'red' },
      { name: 'Green', type: 'green' },
      { name: 'Blue', type: 'blue' }
    ]
  },
  {
    id: 'template-par-rgb',
    name: 'RGB Par Can',
    type: 'par',
    channels: [
      { name: 'Red', type: 'red' },
      { name: 'Green', type: 'green' },
      { name: 'Blue', type: 'blue' },
      { name: 'Dimmer', type: 'dimmer' }
    ]
  },
  {
    id: 'template-led-strip',
    name: 'LED Strip',
    type: 'strip',
    channels: [
      { name: 'Red', type: 'red' },
      { name: 'Green', type: 'green' },
      { name: 'Blue', type: 'blue' },
      { name: 'White', type: 'white' },
      { name: 'Dimmer', type: 'dimmer' }
    ]
  },
  {
    id: 'template-laser',
    name: 'Laser',
    type: 'laser',
    channels: [
      { name: 'Red', type: 'red' },
      { name: 'Green', type: 'green' },
      { name: 'Pattern', type: 'gobo_wheel' },
      { name: 'Speed', type: 'speed' },
      { name: 'Strobe', type: 'strobe' }
    ]
  },
  {
    id: 'template-strobe',
    name: 'Strobe',
    type: 'strobe',
    channels: [
      { name: 'Dimmer', type: 'dimmer' },
      { name: 'Strobe', type: 'strobe' },
      { name: 'Speed', type: 'speed' }
    ]
  },
  {
    id: 'template-smoke',
    name: 'Smoke Machine',
    type: 'smoke',
    channels: [
      { name: 'Output', type: 'dimmer' },
      { name: 'Fan Speed', type: 'speed' }
    ]
  },
  {
    id: 'template-laser-sparkler',
    name: 'Laser Sparkler',
    type: 'laser',
    channels: [
      { name: 'Mode', type: 'macro' },
      { name: 'Running Direction', type: 'pan' },
      { name: 'Running Speed', type: 'speed' },
      { name: 'Twinkle Speed', type: 'speed' },
      { name: 'Color Section', type: 'color_wheel' }
    ]
  },
  {
    id: 'mini-beam-move-head-light',
    name: 'MINI BEAM MOVE HEAD LIGHT',
    type: 'Mover',
    modes: [
      {
        name: '18-channel mode',
        channels: 18,
        channelData: [
          { name: 'Color Data', type: 'color_wheel', ranges: [
            { min: 0, max: 3, description: 'white' },
            { min: 4, max: 8, description: 'white+color1' },
            { min: 9, max: 12, description: 'color1' },
            { min: 13, max: 17, description: 'color1+color2' },
            { min: 18, max: 21, description: 'color2' },
            { min: 22, max: 26, description: 'color2+color3' },
            { min: 27, max: 31, description: 'color3' },
            { min: 32, max: 35, description: 'color3+color5' },
            { min: 36, max: 49, description: 'color5' },
            { min: 50, max: 53, description: 'color5+color6' },
            { min: 54, max: 58, description: 'color6' },
            { min: 59, max: 63, description: 'color6+color7' },
            { min: 64, max: 67, description: 'color7' },
            { min: 68, max: 72, description: 'color7+color8' },
            { min: 73, max: 76, description: 'color8' },
            { min: 77, max: 81, description: 'color8+color10' },
            { min: 82, max: 91, description: 'color10' },
            { min: 92, max: 99, description: 'color10+color11' },
            { min: 100, max: 104, description: 'color11' },
            { min: 105, max: 108, description: 'color11+color12' },
            { min: 109, max: 113, description: 'color12' },
            { min: 114, max: 117, description: 'color12+color13' },
            { min: 118, max: 122, description: 'color13' },
            { min: 123, max: 127, description: 'color13+color14' },
            { min: 128, max: 191, description: 'rotate forward (fast to slow)' },
            { min: 192, max: 255, description: 'rotate reverse (slow to fast)' }
          ]},
          { name: 'Strobe', type: 'strobe', ranges: [
            { min: 0, max: 3, description: 'dark' },
            { min: 4, max: 103, description: 'pulse strobe slow to fast' },
            { min: 104, max: 107, description: 'open' },
            { min: 108, max: 207, description: 'fade strobe slow to fast' },
            { min: 208, max: 212, description: 'open' },
            { min: 213, max: 251, description: 'random strobe slow to fast' },
            { min: 252, max: 255, description: 'open' }
          ]},
          { name: 'Dimmer', type: 'dimmer', ranges: [{ min: 0, max: 255, description: '0-100% Dimmer' }] },
          { name: 'Gobo', type: 'gobo_wheel', ranges: [
            { min: 0, max: 7, description: 'white' },
            { min: 8, max: 16, description: 'gobo1' },
            { min: 17, max: 24, description: 'gobo2' },
            { min: 25, max: 33, description: 'gobo3' },
            { min: 34, max: 41, description: 'gobo4' },
            { min: 42, max: 50, description: 'gobo5' },
            { min: 51, max: 58, description: 'gobo6' },
            { min: 59, max: 67, description: 'gobo7' },
            { min: 68, max: 75, description: 'gobo8' },
            { min: 76, max: 84, description: 'gobo9' },
            { min: 85, max: 92, description: 'gobo10' },
            { min: 93, max: 101, description: 'gobo11' },
            { min: 102, max: 109, description: 'gobo12' },
            { min: 110, max: 118, description: 'gobo13' },
            { min: 119, max: 127, description: 'gobo14' },
            { min: 128, max: 191, description: 'rotate reverse (fast to slow)' },
            { min: 192, max: 255, description: 'rotate forward (slow to fast)' }
          ]},
          { name: 'Prism', type: 'prism', ranges: [
            { min: 0, max: 127, description: 'none' },
            { min: 128, max: 255, description: 'insert prism1' }
          ]},
          { name: 'Prism Rotation', type: 'effect', ranges: [
            { min: 0, max: 127, description: '0-360°' },
            { min: 128, max: 190, description: 'rotate forward (fast to slow)' },
            { min: 191, max: 192, description: 'STOP' },
            { min: 193, max: 255, description: 'rotate reverse (slow to fast)' }
          ]},
          { name: 'Colorful', type: 'effect', ranges: [
            { min: 0, max: 127, description: 'none' },
            { min: 128, max: 255, description: 'insert Colorful' }
          ]},
          { name: 'Frost', type: 'effect', ranges: [
            { min: 0, max: 127, description: 'none' },
            { min: 128, max: 255, description: 'insert Frost' }
          ]},
          { name: 'Focus', type: 'focus', ranges: [{ min: 0, max: 255, description: 'Far to Near' }] },
          { name: 'PAN', type: 'pan', ranges: [{ min: 0, max: 255, description: '0-540°' }] },
          { name: 'PAN Fine', type: 'pan_fine', ranges: [{ min: 0, max: 255, description: '0-2°' }] },
          { name: 'TILT', type: 'tilt', ranges: [{ min: 0, max: 255, description: '0-270°' }] },
          { name: 'Tilt Fine', type: 'tilt_fine', ranges: [{ min: 0, max: 255, description: '0-1°' }] },
          { name: 'Macro Function', type: 'macro', ranges: [{ min: 0, max: 255, description: 'Macro functions' }] },
          { name: 'Reset', type: 'reset', ranges: [
            { min: 0, max: 25, description: 'none' },
            { min: 26, max: 76, description: 'reset effect motor over 3 seconds' },
            { min: 77, max: 127, description: 'reset XY motor over 3 seconds' },
            { min: 128, max: 255, description: 'reset fixture over 3 seconds' }
          ]},
          { name: 'Lamp Control', type: 'macro', ranges: [
            { min: 0, max: 25, description: 'none' },
            { min: 26, max: 100, description: 'turn off lamp over 3 seconds' },
            { min: 101, max: 255, description: 'turn on lamp over 3 seconds' }
          ]},
          { name: 'PT Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: 'Fast to Slow' }] },
          { name: 'Color Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: 'Note: 0-14 non-functional, 15-255 one effect for every five number intervals' }] }
        ]
      }
    ]
  },
  {
    id: 'mini-moving-head-gobo-light-led-strips',
    name: 'MINI MOVING HEAD GOBO LIGHT WITH LIGHT STRIPS',
    type: 'Mover',
    modes: [
      {
        name: '12-channel mode',
        channels: 12,
        channelData: [
          { name: 'Horizontal PAN', type: 'pan', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Horizontal PAN Fine Tune', type: 'pan_fine', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Vertical Operation (Tilt)', type: 'tilt', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Tilt Fine Tune', type: 'tilt_fine', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Color', type: 'color_wheel', ranges: [
            { min: 0, max: 9, description: 'white' },
            { min: 10, max: 138, description: 'color section' },
            { min: 140, max: 255, description: 'automatic color change from slow to fast' }
          ]},
          { name: 'Gobo', type: 'gobo_wheel', ranges: [
            { min: 0, max: 7, description: 'white' },
            { min: 8, max: 63, description: 'fixed gobo' },
            { min: 64, max: 127, description: 'shaking gobo' },
            { min: 128, max: 255, description: 'automatic change pattern from slow to fast' }
          ]},
          { name: 'Strobe', type: 'strobe', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Dimming', type: 'dimmer', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Motor Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: 'Fast to slow' }] },
          { name: 'Automatic Mode', type: 'macro', ranges: [
            { min: 0, max: 59, description: 'other channels function' },
            { min: 60, max: 84, description: 'automatic mode3' },
            { min: 85, max: 109, description: 'automatic mode2' },
            { min: 110, max: 134, description: 'automatic mode1' },
            { min: 135, max: 159, description: 'automatic mode0' },
            { min: 160, max: 184, description: 'voice-control mode3' },
            { min: 185, max: 209, description: 'voice-control mode2' },
            { min: 210, max: 234, description: 'voice-control mode1' },
            { min: 235, max: 255, description: 'voice-control mode0' }
          ]},
          { name: 'Reset', type: 'reset', ranges: [{ min: 250, max: 255, description: 'Reset over 5 seconds' }] },
          { name: 'LED Strip', type: 'effect', ranges: [
            { min: 0, max: 109, description: 'color section' },
            { min: 110, max: 255, description: 'color auto operation' }
          ]}
        ]
      },
      {
        name: '10-channel mode',
        channels: 10,
        channelData: [
          { name: 'PAN', type: 'pan', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Vertical (Tilt)', type: 'tilt', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Color', type: 'color_wheel', ranges: [
            { min: 0, max: 9, description: 'white' },
            { min: 10, max: 139, description: 'color selection' },
            { min: 140, max: 255, description: 'automatic color change from slow to fast' }
          ]},
          { name: 'Gobo', type: 'gobo_wheel', ranges: [
            { min: 0, max: 7, description: 'white' },
            { min: 8, max: 63, description: 'fixed gobo' },
            { min: 64, max: 127, description: 'shaking gobo' },
            { min: 128, max: 255, description: 'automatic change pattern from slow to fast' }
          ]},
          { name: 'Strobe', type: 'strobe', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Dimming', type: 'dimmer', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Motor Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Automatic Mode', type: 'macro', ranges: [
            { min: 0, max: 59, description: 'other channels function' },
            { min: 60, max: 159, description: 'automatic mode' },
            { min: 160, max: 255, description: 'voice-control mode' }
          ]},
          { name: 'Reset', type: 'reset', ranges: [{ min: 250, max: 255, description: 'Reset over 5 seconds' }] },
          { name: 'Light Strips', type: 'effect', ranges: [
            { min: 0, max: 109, description: 'color selection' },
            { min: 110, max: 255, description: 'color auto operations' }
          ]}
        ]
      }
    ]
  },
  {
    id: 'mini-led-moving-head-uking-rgb-wash',
    name: 'MINI LED MOVING HEAD BY UKING (RGB MOVING WASH)',
    type: 'RGB Wash / Mover',
    modes: [
      {
        name: '9-channel mode',
        channels: 9,
        channelData: [
          { name: 'PAN', type: 'pan', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'TILT', type: 'tilt', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Dimmer', type: 'dimmer', ranges: [
            { min: 0, max: 7, description: 'off' },
            { min: 8, max: 134, description: 'master dimmer' },
            { min: 135, max: 239, description: 'strobe from slow to fast' },
            { min: 240, max: 255, description: 'open' }
          ]},
          { name: 'Red Dimmer', type: 'red', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Green Dimmer', type: 'green', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Blue Dimmer', type: 'blue', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'White Dimmer', type: 'white', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'XY Speed (PAN/TILT)', type: 'speed', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Reset', type: 'reset', ranges: [{ min: 150, max: 200, description: 'Reset' }] }
        ]
      },
      {
        name: '14-channel mode',
        channels: 14,
        channelData: [
          { name: 'PAN', type: 'pan', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'PAN Fine', type: 'pan_fine', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'TILT', type: 'tilt', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Tilt Fine', type: 'tilt_fine', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'XY Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Dimmer and Strobe', type: 'dimmer', ranges: [
            { min: 0, max: 7, description: 'off' },
            { min: 8, max: 134, description: 'master dimmer' },
            { min: 135, max: 239, description: 'strobe from slow to fast' },
            { min: 240, max: 255, description: 'open' }
          ]},
          { name: 'Red Dimmer', type: 'red', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Green Dimmer', type: 'green', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Blue Dimmer', type: 'blue', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'White Dimmer', type: 'white', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Mix Colors and Jumping Colors', type: 'macro', ranges: [
            { min: 0, max: 7, description: 'mix color' },
            { min: 8, max: 231, description: 'macro color' },
            { min: 232, max: 255, description: 'color jumping' }
          ]},
          { name: 'Color Jumping Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'Color Speed', type: 'speed', ranges: [
            { min: 0, max: 7, description: 'color free' },
            { min: 8, max: 63, description: 'fast running' },
            { min: 64, max: 127, description: 'slow running' },
            { min: 128, max: 191, description: 'sound 1' },
            { min: 192, max: 255, description: 'sound 2' }
          ]},
          { name: 'Reset', type: 'reset', ranges: [{ min: 150, max: 255, description: 'Reset' }] }
        ]
      }
    ]
  },
  {
    id: 'laser-twinkler',
    name: 'Laser Twinkler',
    type: 'Laser',
    modes: [
      {
        name: '5-channel mode',
        channels: 5,
        channelData: [
          { name: 'Laser On/Off and Mode', type: 'macro', ranges: [
            { min: 0, max: 49, description: 'close laser off' },
            { min: 50, max: 99, description: 'DMX mode' },
            { min: 100, max: 149, description: 'sound active mode' },
            { min: 150, max: 255, description: 'auto mode' }
          ]},
          { name: 'Direction Rotation', type: 'pan', ranges: [
            { min: 0, max: 99, description: 'clockwise direction' },
            { min: 100, max: 199, description: 'stop running' },
            { min: 200, max: 255, description: 'counter clockwise direction' }
          ]},
          { name: 'Running Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: '0: fast, 255: slow' }] },
          { name: 'Twinkling Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: '0: fast, 255: slow' }] },
          { name: 'Color Section', type: 'color_wheel', ranges: [
            { min: 0, max: 99, description: 'red+green (yellow)' },
            { min: 100, max: 199, description: 'red' },
            { min: 200, max: 255, description: 'green' }
          ]}
        ]
      }
    ]
  },
  {
    id: 'uv-light',
    name: 'UV LIGHT',
    type: 'UV Light',
    modes: [
      {
        name: '7-channel mode',
        channels: 7,
        channelData: [
          { name: 'UV Brightness', type: 'uv', ranges: [{ min: 0, max: 255, description: '0-255' }] },
          { name: 'UV Light', type: 'uv', ranges: [
            { min: 0, max: 0, description: 'off' },
            { min: 1, max: 255, description: 'brightness dark to bright' }
          ]},
          { name: 'UV Light', type: 'uv', ranges: [
            { min: 0, max: 0, description: 'off' },
            { min: 1, max: 255, description: 'UV brightness dark to bright' }
          ]},
          { name: 'UV Light', type: 'uv', ranges: [
            { min: 0, max: 0, description: 'light off' },
            { min: 1, max: 55, description: 'bright to dark UV on' }
          ]},
          { name: 'Strobe', type: 'strobe', ranges: [
            { min: 0, max: 7, description: 'off' },
            { min: 8, max: 255, description: 'strobe flash from slow to fast' }
          ]},
          { name: 'Manual', type: 'macro', ranges: [
            { min: 0, max: 10, description: 'manual (based on CH1 and CH5)' },
            { min: 11, max: 60, description: 'UV selection' },
            { min: 61, max: 110, description: 'UV brightness' },
            { min: 111, max: 160, description: 'transform brightness' },
            { min: 161, max: 210, description: 'transitions' },
            { min: 211, max: 255, description: 'sound active mode' }
          ]},
          { name: 'Range of UV', type: 'uv', ranges: [{ min: 0, max: 255, description: '0-255' }] }
        ]
      }
    ]
  }
];
