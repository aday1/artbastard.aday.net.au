import type { Fixture, Group } from '../../../store/types';
import { emitYaml, parseYaml } from '../yamlSerializer';

export interface GroupsSectionPayload {
  groups: Group[];
}

export function exportGroups(groups: Group[]): string {
  return emitYaml({ groups: groups.map(toYamlShape) });
}

export function parseGroups(
  yamlText: string,
  currentFixtures: Fixture[]
): { groups: Group[]; warnings: string[] } {
  const warnings: string[] = [];
  const raw = parseYaml<GroupsSectionPayload>(yamlText);
  if (!raw || !Array.isArray(raw.groups)) {
    throw new Error('groups.yaml must have a top-level "groups" list.');
  }
  const fixtureIdToIndex = new Map(currentFixtures.map((fx, idx) => [fx.id, idx]));
  const groups: Group[] = [];
  raw.groups.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      warnings.push(`group #${index + 1}: skipped (not an object)`);
      return;
    }
    if (!entry.id || !entry.name) {
      warnings.push(`group #${index + 1}: missing id or name`);
      return;
    }
    const rawIds = Array.isArray((entry as any).fixtureIds)
      ? (entry as any).fixtureIds.map((id: unknown) => String(id))
      : [];
    const resolvedIds: string[] = [];
    const resolvedIndices: number[] = [];
    rawIds.forEach((id: string) => {
      const idx = fixtureIdToIndex.get(id);
      if (idx === undefined) {
        warnings.push(`group "${entry.name}": fixtureId "${id}" not found in current rig — dropped`);
        return;
      }
      resolvedIds.push(id);
      resolvedIndices.push(idx);
    });
    groups.push({
      id: String(entry.id),
      name: String(entry.name),
      fixtureIndices: resolvedIndices,
      fixtureIds: resolvedIds,
      lastStates: Array.isArray((entry as any).lastStates)
        ? (entry as any).lastStates.map((v: any) => Number(v) || 0)
        : new Array(resolvedIndices.length).fill(0),
      position: entry.position,
      isMuted: Boolean(entry.isMuted),
      isSolo: Boolean(entry.isSolo),
      masterValue: Number((entry as any).masterValue ?? 255),
      midiMapping: (entry as any).midiMapping,
      oscAddress: (entry as any).oscAddress ? String((entry as any).oscAddress) : undefined,
      ignoreSceneChanges: (entry as any).ignoreSceneChanges,
      ignoreMasterFader: (entry as any).ignoreMasterFader,
      panOffset: (entry as any).panOffset !== undefined ? Number((entry as any).panOffset) : undefined,
      tiltOffset: (entry as any).tiltOffset !== undefined ? Number((entry as any).tiltOffset) : undefined,
      zoomValue: (entry as any).zoomValue !== undefined ? Number((entry as any).zoomValue) : undefined,
    });
  });
  return { groups, warnings };
}

function toYamlShape(group: Group) {
  return {
    id: group.id,
    name: group.name,
    fixtureIds: group.fixtureIds && group.fixtureIds.length ? group.fixtureIds : [],
    masterValue: group.masterValue,
    isMuted: group.isMuted || undefined,
    isSolo: group.isSolo || undefined,
    oscAddress: group.oscAddress,
    ignoreSceneChanges: group.ignoreSceneChanges || undefined,
    ignoreMasterFader: group.ignoreMasterFader || undefined,
    panOffset: group.panOffset,
    tiltOffset: group.tiltOffset,
    zoomValue: group.zoomValue,
    midiMapping: group.midiMapping,
    position: group.position,
  };
}
