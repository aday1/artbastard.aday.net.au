export interface FixtureLibraryRange {
  min: number;
  max: number;
  description: string;
}

export interface FixtureLibraryChannel {
  name: string;
  type: string;
  ranges?: FixtureLibraryRange[];
  ticksOnly?: boolean;
}

export interface FixtureLibraryMode {
  name: string;
  channels: number;
  channelData: FixtureLibraryChannel[];
}

export interface FixtureDipSwitchAddressing {
  method: 'dip-switch';
  addressRange: {
    min: number;
    max: number;
    switches: Array<{ switch: number; value: number }>;
  };
  modeSwitches: Array<{
    description: string;
    states: Record<number, 0 | 1 | 'either'>;
  }>;
}

export interface FixtureLibraryEntry {
  id: string;
  catalogId: string;
  name: string;
  defaultNamePrefix: string;
  type: string;
  category: string;
  manufacturer: string;
  model?: string;
  modelConfidence?: 'confirmed' | 'probable' | 'unknown';
  photoUrl?: string;
  documentationPath?: string;
  notes?: string;
  tags: string[];
  addressing?: FixtureDipSwitchAddressing;
  modes: FixtureLibraryMode[];
}

