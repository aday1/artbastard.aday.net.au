import type { Scene } from '../../../store/types';
import { emitYaml, parseYaml } from '../yamlSerializer';

export interface ScenesSectionPayload {
  scenes: Scene[];
}

export function exportScenes(scenes: Scene[]): string {
  return emitYaml({ scenes: scenes.map(toYamlShape) });
}

export function parseScenes(yamlText: string): { scenes: Scene[]; warnings: string[] } {
  const warnings: string[] = [];
  const raw = parseYaml<ScenesSectionPayload>(yamlText);
  if (!raw || !Array.isArray(raw.scenes)) {
    throw new Error('scenes.yaml must have a top-level "scenes" list.');
  }
  const scenes: Scene[] = [];
  raw.scenes.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      warnings.push(`scene #${index + 1}: skipped (not an object)`);
      return;
    }
    if (!entry.name) {
      warnings.push(`scene #${index + 1}: missing name`);
      return;
    }
    scenes.push({
      name: String(entry.name),
      oscAddress: String(entry.oscAddress || `/scene/${index + 1}`),
      channelValues: Array.isArray(entry.channelValues)
        ? entry.channelValues.map((v: any) => Math.max(0, Math.min(255, Number(v) || 0)))
        : [],
      timeline: entry.timeline,
      seed: entry.seed,
    });
  });
  return { scenes, warnings };
}

function toYamlShape(scene: Scene) {
  return {
    name: scene.name,
    oscAddress: scene.oscAddress,
    channelValues: scene.channelValues,
    timeline: scene.timeline,
    seed: scene.seed,
  };
}
