import { describe, it, expect } from 'vitest';
import {
  parseHexCell,
  formatHexCell,
  lineDurationMs,
  parseEasingCode,
  formatEasingCode,
  interpolateChannelTargets,
  createEmptyLine,
  createDefaultPattern,
  normalizePattern,
  resolveVisibleChannels,
} from './transitionTrackerEngine';
import { bakeEnvelopeToPatternLines } from './automationEnvelopeTrackerSync';
import type { ChannelEnvelope } from '../store/types';

describe('transitionTrackerEngine', () => {
  it('parses hex cells', () => {
    expect(parseHexCell('FF')).toBe(255);
    expect(parseHexCell('00')).toBe(0);
    expect(parseHexCell('..')).toBeNull();
    expect(parseHexCell('')).toBeNull();
    expect(parseHexCell('GG')).toBeNull();
  });

  it('formats hex cells', () => {
    expect(formatHexCell(255)).toBe('FF');
    expect(formatHexCell(0)).toBe('00');
    expect(formatHexCell(null)).toBe('..');
  });

  it('computes line duration from BPM and LPB', () => {
    expect(lineDurationMs(120, 4)).toBe(125);
    expect(lineDurationMs(60, 4)).toBe(250);
  });

  it('maps easing codes', () => {
    expect(parseEasingCode('IO')).toBe('easeInOut');
    expect(formatEasingCode('linear')).toBe('LN');
  });

  it('interpolates channel targets', () => {
    const from = [0, 100, 0];
    const out = interpolateChannelTargets(from, { 0: 200 }, 0.5, 'linear');
    expect(out[0]).toBe(100);
    expect(out[1]).toBe(100);
  });

  it('creates empty lines with default fx', () => {
    const line = createEmptyLine(3);
    expect(line.index).toBe(3);
    expect(line.fx.transitionMs).toBe(1000);
    expect(line.fx.easing).toBe('easeInOut');
  });

  it('normalizes legacy patterns with empty channels by default', () => {
    const legacy = {
      ...createDefaultPattern('Legacy'),
      pages: undefined as never,
      tracks: undefined as never,
    };
    const normalized = normalizePattern(legacy);
    expect(normalized.pages.length).toBeGreaterThan(0);
    expect(normalized.pages[0].channelIndices).toEqual([]);
    expect(normalized.tracks.length).toBe(0);
    expect(normalized.activePageId).toBeTruthy();
    expect(normalized.followSelection).toBe(false);
  });

  it('strips factory default CH 1-8 from saved pages', () => {
    const p = createDefaultPattern();
    const page = p.pages[0];
    const withDefaults = {
      ...p,
      pages: [{ ...page, channelIndices: [0, 1, 2, 3, 4, 5, 6, 7] }],
      tracks: [0, 1, 2, 3, 4, 5, 6, 7].map((ch) => ({
        id: `t-${ch}`,
        channelIndex: ch,
        name: undefined,
        envelopeId: null,
      })),
    };
    const normalized = normalizePattern(withDefaults);
    expect(normalized.pages[0].channelIndices).toEqual([]);
    expect(normalized.tracks.length).toBe(0);
  });

  it('uses locked page channels when channelsLocked', () => {
    const p = normalizePattern(createDefaultPattern());
    const page = p.pages[0];
    const locked = {
      ...p,
      channelsLocked: true,
      pages: [{ ...page, channelIndices: [2, 4, 6] }],
      activePageId: page.id,
    };
    expect(resolveVisibleChannels(locked, [], [])).toEqual([2, 4, 6]);
  });

  it('returns empty grid when no page channels configured', () => {
    const p = normalizePattern(createDefaultPattern());
    expect(resolveVisibleChannels(p, [], [])).toEqual([]);
  });

  it('does not auto-include pinned channels', () => {
    const p = normalizePattern(createDefaultPattern());
    const page = p.pages[0];
    const withPage = {
      ...p,
      channelsLocked: true,
      pages: [{ ...page, channelIndices: [0, 1] }],
      activePageId: page.id,
    };
    expect(resolveVisibleChannels(withPage, [], [17, 18])).toEqual([0, 1]);
    expect(
      resolveVisibleChannels(withPage, [], [17, 18], { includePinned: true })
    ).toEqual([0, 1, 17, 18]);
  });

  it('bakes envelope samples into pattern lines', () => {
    const pattern = createDefaultPattern();
    const envelope: ChannelEnvelope = {
      id: 'e1',
      channel: 0,
      enabled: false,
      waveform: 'sine',
      customPoints: [],
      amplitude: 100,
      offset: 127,
      phase: 0,
      tempoSync: false,
      tempoMultiplier: 1,
      repeatMode: 'loop',
      loopDirection: 'forward',
      min: 0,
      max: 255,
      speed: 1,
    };
    const lines = bakeEnvelopeToPatternLines(envelope, pattern, 0, 0, 4);
    expect(lines[0].channelValues[0]).toBeGreaterThanOrEqual(0);
    expect(lines[3].channelValues[0]).toBeGreaterThanOrEqual(0);
  });
});
