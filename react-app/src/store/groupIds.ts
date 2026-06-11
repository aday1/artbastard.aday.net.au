// Bridge helpers between Group.fixtureIndices (positional, in-memory live state)
// and Group.fixtureIds (stable, for YAML round-trip / cross-rig persistence).
//
// fixtureIndices is the source of truth for live UI/DMX paths so we don't churn
// the ~30 callsites that already read it. fixtureIds is materialised on
// demand by exporters and resolved back to indices on import.

import type { Fixture, Group } from './types';

/** Resolve `group.fixtureIndices` against `fixtures` to a list of fixture IDs. */
export function resolveGroupFixtureIds(group: Pick<Group, 'fixtureIndices' | 'fixtureIds'>, fixtures: Fixture[]): string[] {
  if (group.fixtureIds && group.fixtureIds.length) return group.fixtureIds.slice();
  return group.fixtureIndices
    .map((idx) => fixtures[idx]?.id)
    .filter((id): id is string => Boolean(id));
}

/** Resolve a list of fixture IDs back to positional indices in the current rig. */
export function resolveFixtureIdsToIndices(fixtureIds: string[], fixtures: Fixture[]): { indices: number[]; missing: string[] } {
  const indices: number[] = [];
  const missing: string[] = [];
  const idToIndex = new Map(fixtures.map((f, i) => [f.id, i] as const));
  for (const id of fixtureIds) {
    const idx = idToIndex.get(id);
    if (idx === undefined) missing.push(id);
    else indices.push(idx);
  }
  return { indices, missing };
}

/**
 * Return a copy of `group` with fixtureIds populated and fixtureIndices reflecting
 * the current rig. Use on hydration and before persisting.
 */
export function ensureGroupSync(group: Group, fixtures: Fixture[]): Group {
  const fixtureIds = resolveGroupFixtureIds(group, fixtures);
  const { indices } = resolveFixtureIdsToIndices(fixtureIds, fixtures);
  return { ...group, fixtureIds, fixtureIndices: indices };
}

/** Batch helper — runs ensureGroupSync over an array. */
export function ensureGroupsSync(groups: Group[], fixtures: Fixture[]): Group[] {
  return groups.map((g) => ensureGroupSync(g, fixtures));
}
