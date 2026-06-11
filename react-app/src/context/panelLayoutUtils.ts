import type { LayoutMode, PanelComponent, PanelLayout, PanelState } from './panelTypes';

export const PANEL_IDS = ['top-left', 'top-right', 'bottom', 'bottom-right'] as const;

const VALID_LAYOUT_MODES: LayoutMode[] = [
  'single',
  'split-vertical',
  'split-horizontal',
  'grid-3',
  'grid-4',
];

const REMOVED_COMPONENT_TYPES = new Set(['dashboard']);

/** Legacy panel component types merged into supported ones. */
const COMPONENT_TYPE_ALIASES: Record<string, string> = {
  'chromatic-energy-manipulator': 'professional-fixture-controller',
  'touch-fixture-controller': 'professional-fixture-controller',
};

function normalizePanelState(value: unknown): PanelState {
  if (value && typeof value === 'object' && Array.isArray((value as PanelState).components)) {
    return { components: (value as PanelState).components };
  }
  return { components: [] };
}

function dedupeComponents(components: PanelComponent[]): PanelComponent[] {
  const seen = new Set<string>();
  const result: PanelComponent[] = [];
  for (const component of components) {
    if (REMOVED_COMPONENT_TYPES.has(component.type)) continue;
    const type = COMPONENT_TYPE_ALIASES[component.type] ?? component.type;
    if (seen.has(component.id)) continue;
    seen.add(component.id);
    result.push(type === component.type ? component : { ...component, type });
  }
  return result;
}

export function sanitizePanelLayout(
  raw: Record<string, unknown>,
  fallback: PanelLayout
): PanelLayout {
  const topLeft = normalizePanelState(raw['top-left']);
  const topRight = normalizePanelState(raw['top-right']);
  const bottom = normalizePanelState(raw['bottom']);
  const bottomRight = normalizePanelState(raw['bottom-right']);
  const external = normalizePanelState(raw['external']);

  const layoutMode = VALID_LAYOUT_MODES.includes(raw.layoutMode as LayoutMode)
    ? (raw.layoutMode as LayoutMode)
    : fallback.layoutMode;

  const rawSplitter =
    raw.splitterPositions && typeof raw.splitterPositions === 'object'
      ? (raw.splitterPositions as PanelLayout['splitterPositions'])
      : null;

  return {
    'top-left': { components: dedupeComponents(topLeft.components) },
    'top-right': { components: dedupeComponents(topRight.components) },
    bottom: {
      components: dedupeComponents([
        ...bottom.components,
        ...external.components,
      ]),
    },
    'bottom-right': { components: dedupeComponents(bottomRight.components) },
    layoutMode,
    splitterPositions: {
      horizontal: rawSplitter?.horizontal ?? fallback.splitterPositions.horizontal,
      vertical: rawSplitter?.vertical ?? fallback.splitterPositions.vertical,
    },
  };
}

export function migrateSavedLayoutsStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('artbastard-saved-layouts');
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    const fallback: PanelLayout = {
      'top-left': { components: [] },
      'top-right': { components: [] },
      bottom: { components: [] },
      'bottom-right': { components: [] },
      layoutMode: 'grid-3',
      splitterPositions: { horizontal: 50, vertical: 70 },
    };
    const migrated: Record<string, PanelLayout> = {};
    let changed = false;
    for (const name of Object.keys(parsed)) {
      const before = JSON.stringify(parsed[name]);
      migrated[name] = sanitizePanelLayout(parsed[name], fallback);
      if (JSON.stringify(migrated[name]) !== before) changed = true;
    }
    if (changed) {
      localStorage.setItem('artbastard-saved-layouts', JSON.stringify(migrated));
    }
  } catch {
    // Ignore corrupt storage.
  }
}
