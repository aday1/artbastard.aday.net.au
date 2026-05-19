import { describe, expect, it, vi, afterEach } from 'vitest';
import { findNextClipInRow, findRandomClipInRow } from './useClipLauncher';

describe('useClipLauncher follow helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('findNextClipInRow skips empty slots and wraps to first playable clip', () => {
    const rowClips = [
      { id: 'a', row: 0, column: 0, scene: { name: 'Scene A' } },
      { id: 'b', row: 0, column: 1, scene: null },
      { id: 'c', row: 0, column: 2, scene: { name: 'Scene C' } },
      { id: 'd', row: 0, column: 3, scene: null },
    ];

    const nextFromZero = findNextClipInRow(rowClips, 0);
    expect(nextFromZero?.id).toBe('c');

    const nextFromTwo = findNextClipInRow(rowClips, 2);
    expect(nextFromTwo?.id).toBe('a');
  });

  it('findNextClipInRow returns null when row has no playable clips', () => {
    const rowClips = [
      { id: 'a', row: 0, column: 0, scene: null },
      { id: 'b', row: 0, column: 1, scene: null },
    ];
    expect(findNextClipInRow(rowClips, 0)).toBeNull();
  });

  it('findRandomClipInRow excludes current clip and only picks playable clips', () => {
    const rowClips = [
      { id: 'a', row: 0, column: 0, scene: { name: 'Scene A' } },
      { id: 'b', row: 0, column: 1, scene: { name: 'Scene B' } },
      { id: 'c', row: 0, column: 2, scene: null },
      { id: 'd', row: 0, column: 3, scene: { name: 'Scene D' } },
    ];
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.49);
    const result = findRandomClipInRow(rowClips, 'a');

    expect(randomSpy).toHaveBeenCalledOnce();
    expect(result?.id).toBe('b');
  });

  it('findRandomClipInRow returns null when no alternative playable clip exists', () => {
    const rowClips = [
      { id: 'only', row: 0, column: 0, scene: { name: 'Only' } },
      { id: 'empty', row: 0, column: 1, scene: null },
    ];
    expect(findRandomClipInRow(rowClips, 'only')).toBeNull();
  });
});
