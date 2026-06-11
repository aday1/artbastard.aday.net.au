import type { Act } from '../../../store';
import { emitYaml, parseYaml } from '../yamlSerializer';

export interface ActsSectionPayload {
  acts: Act[];
}

export function exportActs(acts: Act[]): string {
  return emitYaml({ acts });
}

export function parseActs(yamlText: string): { acts: Act[]; warnings: string[] } {
  const warnings: string[] = [];
  const raw = parseYaml<ActsSectionPayload>(yamlText);
  if (!raw || !Array.isArray(raw.acts)) {
    throw new Error('acts.yaml must have a top-level "acts" list.');
  }
  const acts: Act[] = [];
  raw.acts.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      warnings.push(`act #${index + 1}: skipped (not an object)`);
      return;
    }
    if (!entry.id || !entry.name) {
      warnings.push(`act #${index + 1}: missing id or name`);
      return;
    }
    const now = Date.now();
    acts.push({
      id: String(entry.id),
      name: String(entry.name),
      description: entry.description ? String(entry.description) : undefined,
      steps: Array.isArray(entry.steps) ? entry.steps : [],
      loopMode: entry.loopMode || 'none',
      totalDuration: Number(entry.totalDuration) || 0,
      triggers: Array.isArray(entry.triggers) ? entry.triggers : [],
      timelineEvents: Array.isArray(entry.timelineEvents) ? entry.timelineEvents : [],
      createdAt: Number(entry.createdAt) || now,
      updatedAt: Number(entry.updatedAt) || now,
      playbackMode: entry.playbackMode,
      playbackSpeed: entry.playbackSpeed !== undefined ? Number(entry.playbackSpeed) : undefined,
      syncToBpm: entry.syncToBpm,
      bpmMultiplier: entry.bpmMultiplier,
      markers: Array.isArray(entry.markers) ? entry.markers : undefined,
      seed: entry.seed,
    } as Act);
  });
  return { acts, warnings };
}
