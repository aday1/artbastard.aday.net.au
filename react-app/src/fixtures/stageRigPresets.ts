import type { Fixture, FixtureTemplate, PlacedFixture } from '../store';
import {
  createFixtureFromTemplate,
  findNextAvailableDmxStart,
  makeLayoutForFixture,
  STAGE_MAP_HEIGHT,
  STAGE_MAP_WIDTH,
} from './stageMap';

export interface RigSlot {
  role: string;
  keywords: string[];
  position: { x: number; y: number };
}

export interface StageRigPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  slots: RigSlot[];
}

const rel = (xRatio: number, yRatio: number) => ({
  x: Math.round(xRatio * STAGE_MAP_WIDTH),
  y: Math.round(yRatio * STAGE_MAP_HEIGHT),
});

const linearRow = (count: number, y: number, xStart = 0.15, xEnd = 0.85): { x: number; y: number }[] => {
  if (count <= 0) return [];
  if (count === 1) return [rel((xStart + xEnd) / 2, y)];
  const step = (xEnd - xStart) / (count - 1);
  return Array.from({ length: count }, (_, i) => rel(xStart + step * i, y));
};

const PAR_KEYWORDS = ['par', 'wash', 'rgbw', 'rgb wash', 'rgba', 'rgb par'];
const MOVING_KEYWORDS = ['moving head', 'moving', 'mover', 'spot', 'beam', 'wash mover'];
const STROBE_KEYWORDS = ['strobe', 'flash', 'blinder'];
const LASER_KEYWORDS = ['laser', 'twinkling'];
const DIMMER_KEYWORDS = ['dimmer', 'conventional'];

const slot = (role: string, keywords: string[], x: number, y: number): RigSlot => ({
  role,
  keywords,
  position: rel(x, y),
});

const rowSlots = (
  role: string,
  keywords: string[],
  count: number,
  y: number,
  xStart = 0.15,
  xEnd = 0.85
): RigSlot[] =>
  linearRow(count, y, xStart, xEnd).map((position, i) => ({
    role: `${role} ${i + 1}`,
    keywords,
    position,
  }));

export const STAGE_RIG_PRESETS: StageRigPreset[] = [
  {
    id: 'basic-wash',
    name: 'Basic Stage Wash',
    description: '4 wash pars across the front, 2 across the back. Good for a first show.',
    icon: 'Sun',
    slots: [
      ...rowSlots('Front Wash', PAR_KEYWORDS, 4, 0.78),
      ...rowSlots('Back Wash', PAR_KEYWORDS, 2, 0.22, 0.3, 0.7),
    ],
  },
  {
    id: 'dj-performance',
    name: 'DJ Performance',
    description: '4 wash pars on the floor, 2 moving heads on truss, 2 strobes on the sides.',
    icon: 'Disc3',
    slots: [
      ...rowSlots('Floor Wash', PAR_KEYWORDS, 4, 0.78),
      ...rowSlots('Mover', MOVING_KEYWORDS, 2, 0.25, 0.35, 0.65),
      slot('Strobe L', STROBE_KEYWORDS, 0.08, 0.5),
      slot('Strobe R', STROBE_KEYWORDS, 0.92, 0.5),
    ],
  },
  {
    id: 'theater',
    name: 'Theater Setup',
    description: '6 par cans on the upstage truss + 2 wash fills downstage corners.',
    icon: 'Theater',
    slots: [
      ...rowSlots('Truss Par', PAR_KEYWORDS, 6, 0.2),
      slot('Apron Fill L', PAR_KEYWORDS, 0.15, 0.85),
      slot('Apron Fill R', PAR_KEYWORDS, 0.85, 0.85),
    ],
  },
  {
    id: 'festival',
    name: 'Festival Rig',
    description: '8 moving heads on truss, 4 strobes, 2 lasers, 4 floor pars.',
    icon: 'Rocket',
    slots: [
      ...rowSlots('Truss Mover', MOVING_KEYWORDS, 8, 0.2, 0.1, 0.9),
      ...rowSlots('Strobe', STROBE_KEYWORDS, 4, 0.5, 0.15, 0.85),
      slot('Laser L', LASER_KEYWORDS, 0.25, 0.4),
      slot('Laser R', LASER_KEYWORDS, 0.75, 0.4),
      ...rowSlots('Floor Par', PAR_KEYWORDS, 4, 0.82),
    ],
  },
];

const textBlobForTemplate = (template: FixtureTemplate): string =>
  [
    template.templateName,
    template.defaultNamePrefix,
    template.type,
    template.category,
    template.model,
    ...(template.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const scoreTemplate = (template: FixtureTemplate, keywords: string[]): number => {
  const blob = textBlobForTemplate(template);
  let score = 0;
  for (const keyword of keywords) {
    if (!keyword) continue;
    const k = keyword.toLowerCase();
    if (blob === k) score += 5;
    else if (blob.includes(k)) score += 2;
  }
  if (template.isFavorite) score += 1;
  if (template.isBuiltIn) score += 0.5;
  return score;
};

export const pickTemplateForSlot = (
  templates: FixtureTemplate[],
  keywords: string[]
): FixtureTemplate | null => {
  const candidates = templates.filter((t) => t.id !== 'custom-blank');
  if (!candidates.length) return null;
  const scored = candidates
    .map((template) => ({ template, score: scoreTemplate(template, keywords) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score <= 0) {
    return candidates.find((t) => /rgb|wash|par|dimmer/i.test(textBlobForTemplate(t))) || candidates[0];
  }
  return best.template;
};

export interface AppliedRig {
  fixtures: Fixture[];
  layout: PlacedFixture[];
  unmatched: string[];
}

export const buildRigFromPreset = (
  preset: StageRigPreset,
  existingFixtures: Fixture[],
  templates: FixtureTemplate[]
): AppliedRig => {
  const fixtures: Fixture[] = [...existingFixtures];
  const layout: PlacedFixture[] = [];
  const unmatched: string[] = [];
  const namePrefixCounts = new Map<string, number>();
  for (const f of fixtures) {
    namePrefixCounts.set(f.name.replace(/\s+\d+$/, ''), (namePrefixCounts.get(f.name.replace(/\s+\d+$/, '')) || 0) + 1);
  }

  for (const rigSlot of preset.slots) {
    const template = pickTemplateForSlot(templates, rigSlot.keywords);
    if (!template) {
      unmatched.push(rigSlot.role);
      continue;
    }
    const mode = template.modes?.[0];
    const channelCount = Math.max(
      1,
      mode?.channelData?.length || template.channels?.length || mode?.channels || 1
    );
    const startAddress = findNextAvailableDmxStart(fixtures, channelCount);
    const prefix = template.defaultNamePrefix || template.templateName || 'Fixture';
    const seqKey = prefix;
    const seq = (namePrefixCounts.get(seqKey) || 0) + 1;
    namePrefixCounts.set(seqKey, seq);
    const fixture = createFixtureFromTemplate(template, startAddress, seq);
    fixtures.push(fixture);
    layout.push(makeLayoutForFixture(fixture, rigSlot.position));
  }

  return { fixtures, layout, unmatched };
};
