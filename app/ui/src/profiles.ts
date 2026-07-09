// Built-in fixture profile library. Enough to patch a typical small rig instantly;
// anything else can be built with the custom channel editor.
import type { FixtureProfile } from '../../shared/types'

export const PROFILES: FixtureProfile[] = [
  {
    id: 'generic-dimmer',
    name: 'Generic Dimmer (1ch)',
    channels: [{ name: 'Dimmer', role: 'intensity' }],
  },
  {
    id: 'rgb-par',
    name: 'RGB PAR (3ch)',
    channels: [
      { name: 'Red', role: 'red' },
      { name: 'Green', role: 'green' },
      { name: 'Blue', role: 'blue' },
    ],
  },
  {
    id: 'rgb-par-d',
    name: 'RGB PAR + Dimmer (4ch)',
    channels: [
      { name: 'Dimmer', role: 'intensity' },
      { name: 'Red', role: 'red' },
      { name: 'Green', role: 'green' },
      { name: 'Blue', role: 'blue' },
    ],
  },
  {
    id: 'rgbw-par',
    name: 'RGBW PAR (4ch)',
    channels: [
      { name: 'Red', role: 'red' },
      { name: 'Green', role: 'green' },
      { name: 'Blue', role: 'blue' },
      { name: 'White', role: 'white' },
    ],
  },
  {
    id: 'rgbawuv-par',
    name: 'RGBAW+UV PAR (6ch)',
    channels: [
      { name: 'Red', role: 'red' },
      { name: 'Green', role: 'green' },
      { name: 'Blue', role: 'blue' },
      { name: 'Amber', role: 'amber' },
      { name: 'White', role: 'white' },
      { name: 'UV', role: 'uv' },
    ],
  },
  {
    id: 'mover-spot-11',
    name: 'Moving Head Spot (11ch)',
    channels: [
      { name: 'Pan', role: 'pan' },
      { name: 'Pan Fine', role: 'pan_fine' },
      { name: 'Tilt', role: 'tilt' },
      { name: 'Tilt Fine', role: 'tilt_fine' },
      { name: 'Speed', role: 'speed' },
      { name: 'Dimmer', role: 'intensity' },
      { name: 'Strobe', role: 'strobe' },
      { name: 'Color Wheel', role: 'color_wheel' },
      { name: 'Gobo', role: 'gobo' },
      { name: 'Prism', role: 'prism' },
      { name: 'Focus', role: 'focus' },
    ],
  },
  {
    id: 'mover-wash-13',
    name: 'Moving Head Wash RGBW (13ch)',
    channels: [
      { name: 'Pan', role: 'pan' },
      { name: 'Pan Fine', role: 'pan_fine' },
      { name: 'Tilt', role: 'tilt' },
      { name: 'Tilt Fine', role: 'tilt_fine' },
      { name: 'Speed', role: 'speed' },
      { name: 'Dimmer', role: 'intensity' },
      { name: 'Strobe', role: 'strobe' },
      { name: 'Red', role: 'red' },
      { name: 'Green', role: 'green' },
      { name: 'Blue', role: 'blue' },
      { name: 'White', role: 'white' },
      { name: 'Zoom', role: 'zoom' },
      { name: 'Macro', role: 'macro' },
    ],
  },
  {
    id: 'strobe-2',
    name: 'Strobe (2ch)',
    channels: [
      { name: 'Rate', role: 'strobe' },
      { name: 'Intensity', role: 'intensity' },
    ],
  },
  {
    id: 'smoke-1',
    name: 'Smoke / Hazer (1ch)',
    channels: [{ name: 'Output', role: 'intensity' }],
  },
]

export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'intensity', label: 'Intensity / Dimmer' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'white', label: 'White' },
  { value: 'amber', label: 'Amber' },
  { value: 'uv', label: 'UV' },
  { value: 'pan', label: 'Pan' },
  { value: 'pan_fine', label: 'Pan Fine' },
  { value: 'tilt', label: 'Tilt' },
  { value: 'tilt_fine', label: 'Tilt Fine' },
  { value: 'strobe', label: 'Strobe' },
  { value: 'gobo', label: 'Gobo' },
  { value: 'color_wheel', label: 'Color Wheel' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'focus', label: 'Focus' },
  { value: 'prism', label: 'Prism' },
  { value: 'speed', label: 'Speed' },
  { value: 'macro', label: 'Macro' },
  { value: 'other', label: 'Other' },
]
