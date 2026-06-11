import type { Fixture, Scene } from '../store';

export interface SceneDiff {
  changedChannels: number[];
  addedFixtures: string[];
  removedFixtures: string[];
}

const EMPTY_DIFF: SceneDiff = {
  changedChannels: [],
  addedFixtures: [],
  removedFixtures: [],
};

/**
 * Pure diff between two scene snapshots, mapping changed DMX channels
 * back to fixture ids via fixture startAddress/channels length.
 *
 * - A fixture is "added" when it is dark in `prev` but lit in `next`.
 * - A fixture is "removed" when it was lit in `prev` but dark in `next`.
 * - `changedChannels` lists every DMX index whose value differs.
 *
 * Returns an empty diff if `prev` is null (first scene loaded in a session).
 */
export function computeSceneDiff(
  prev: Scene | null | undefined,
  next: Scene | null | undefined,
  fixtures: Fixture[]
): SceneDiff {
  if (!next) return EMPTY_DIFF;
  if (!prev) return EMPTY_DIFF;
  if (prev.name === next.name) return EMPTY_DIFF;

  const prevVals = prev.channelValues || [];
  const nextVals = next.channelValues || [];
  const length = Math.max(prevVals.length, nextVals.length);

  const changedChannels: number[] = [];
  for (let i = 0; i < length; i++) {
    if ((prevVals[i] || 0) !== (nextVals[i] || 0)) {
      changedChannels.push(i);
    }
  }

  const fixtureLit = (vals: number[], fixture: Fixture): boolean => {
    const start = fixture.startAddress - 1; // DMX 1-based → array 0-based
    const end = start + (fixture.channels?.length || 0);
    for (let i = start; i < end; i++) {
      if ((vals[i] || 0) > 0) return true;
    }
    return false;
  };

  const addedFixtures: string[] = [];
  const removedFixtures: string[] = [];
  for (const fixture of fixtures) {
    const wasLit = fixtureLit(prevVals, fixture);
    const isLit = fixtureLit(nextVals, fixture);
    if (!wasLit && isLit) addedFixtures.push(fixture.id);
    else if (wasLit && !isLit) removedFixtures.push(fixture.id);
  }

  return { changedChannels, addedFixtures, removedFixtures };
}
