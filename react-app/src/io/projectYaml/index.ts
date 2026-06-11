export type ProjectSection = 'fixtures' | 'groups' | 'scenes' | 'acts' | 'bindings';

export const PROJECT_SECTIONS: readonly ProjectSection[] = [
  'fixtures',
  'groups',
  'scenes',
  'acts',
  'bindings',
] as const;

export { emitYaml, parseYaml } from './yamlSerializer';
export { exportFixtures, parseFixtures } from './sections/fixtures';
export { exportGroups, parseGroups } from './sections/groups';
export { exportScenes, parseScenes } from './sections/scenes';
export { exportActs, parseActs } from './sections/acts';
export { exportBindings, parseBindings } from './sections/bindings';
