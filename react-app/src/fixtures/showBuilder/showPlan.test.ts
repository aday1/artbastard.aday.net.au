import { describe, expect, it } from 'vitest';
import { buildShowPatchPlan, formatPatchSheet, type ShowBuilderTemplate } from './showPlan';

const laserTemplate: ShowBuilderTemplate = {
  id: 'laser-twinkler',
  catalogId: 'AB-FIX-001',
  templateName: 'Twinkling Laser Series RGY',
  defaultNamePrefix: 'Twinkling Laser RGY',
  type: 'Laser',
  modes: [
    {
      name: '5-channel mode',
      channels: 5,
      channelData: [
        { name: 'Mode', type: 'macro' },
        { name: 'Rotation', type: 'effect' },
        { name: 'Speed', type: 'speed' },
        { name: 'Twinkle', type: 'speed' },
        { name: 'Colour', type: 'color_wheel' },
      ],
    },
  ],
};

describe('show patch planner', () => {
  it('generates sequential addresses with a configurable gap', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 2 }],
      [],
      { showName: 'Beta', startAddress: 1, gapChannels: 1, avoidExisting: true }
    );

    expect(plan.errors).toEqual([]);
    expect(plan.fixtures.map((fixture) => [fixture.startAddress, fixture.endAddress])).toEqual([
      [1, 5],
      [7, 11],
    ]);
    expect(plan.totalChannels).toBe(10);
  });

  it('skips existing occupied addresses when requested', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 1 }],
      [{ id: 'existing', name: 'Front Wash', startAddress: 1, channelCount: 20 }],
      { showName: 'Beta', startAddress: 1, gapChannels: 0, avoidExisting: true }
    );

    expect(plan.fixtures[0].startAddress).toBe(21);
  });

  it('reports universe overflow instead of generating invalid addresses', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 2 }],
      [],
      { showName: 'Beta', startAddress: 508, gapChannels: 0, avoidExisting: false }
    );

    expect(plan.fixtures).toHaveLength(1);
    expect(plan.errors[0]).toContain('does not fit');
  });

  it('formats a setup sheet operators can copy', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 1 }],
      [],
      { showName: 'Beta', startAddress: 1, gapChannels: 0, avoidExisting: false }
    );

    expect(formatPatchSheet(plan)).toContain('AB-FIX-001: DMX 1-5');
  });
});

