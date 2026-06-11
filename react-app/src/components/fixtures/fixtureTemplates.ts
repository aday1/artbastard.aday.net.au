import {
  fixtureLibraryEntries,
  toCanvasFixtureTemplate,
  type FixtureDipSwitchAddressing,
} from '../../fixtures/library';

export interface FixtureTemplate {
  id: string;
  name: string;
  type: string;
  catalogId?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  modelConfidence?: 'confirmed' | 'probable' | 'unknown';
  photoUrl?: string;
  documentationPath?: string;
  notes?: string;
  tags?: string[];
  addressing?: FixtureDipSwitchAddressing;
  modes?: Array<{
    name: string;
    channels: number;
    channelData: Array<{
      name: string;
      type: string;
      ranges?: Array<{ min: number; max: number; description: string }>;
      ticksOnly?: boolean;
    }>;
  }>;
  channels?: Array<{ name: string; type: string; ticksOnly?: boolean }>;
}

// Compatibility export for older canvas/palette code. The data is sourced from
// the canonical fixture profile catalog, not a second hardcoded list.
export const fixtureTemplates: FixtureTemplate[] = fixtureLibraryEntries.map(toCanvasFixtureTemplate);
