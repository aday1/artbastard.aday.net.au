/**
 * MIDI interface grouping.
 *
 * Sorts raw port names into four buckets (hardware/virtual/network/other)
 * and de-duplicates copies that the OS exposes as `Foo`, `Foo 2`, `Foo 3`
 * — common with LoopBe / Ethernet MIDI / IAC where Windows enumerates one
 * port per channel.
 *
 * Hardware patterns are sourced from `data/hardwareControllers.yml` so the
 * user can edit + git-commit additions without a TypeScript change.
 */
import { parse as yamlParse } from 'yaml';
import patternsYaml from './data/hardwareControllers.yml?raw';

export type MidiBucket = 'hardware' | 'virtual' | 'network' | 'other';

export interface MidiGroup {
  baseName: string;
  bucket: MidiBucket;
  ports: string[];
}

interface PatternFile {
  hardware?: { patterns?: string[] };
  virtual?: { patterns?: string[] };
  network?: { patterns?: string[] };
}

let cachedPatterns: { hardware: string[]; virtual: string[]; network: string[] } | null = null;

function loadPatterns(): { hardware: string[]; virtual: string[]; network: string[] } {
  if (cachedPatterns) return cachedPatterns;
  try {
    const parsed = yamlParse(patternsYaml) as PatternFile;
    cachedPatterns = {
      hardware: (parsed.hardware?.patterns ?? []).map((p) => p.toLowerCase()),
      virtual: (parsed.virtual?.patterns ?? []).map((p) => p.toLowerCase()),
      network: (parsed.network?.patterns ?? []).map((p) => p.toLowerCase()),
    };
  } catch {
    cachedPatterns = { hardware: [], virtual: [], network: [] };
  }
  return cachedPatterns;
}

export function bucketFor(name: string): MidiBucket {
  const n = (name || '').toLowerCase();
  const p = loadPatterns();
  if (p.hardware.some((pat) => n.includes(pat))) return 'hardware';
  if (p.virtual.some((pat) => n.includes(pat))) return 'virtual';
  if (p.network.some((pat) => n.includes(pat))) return 'network';
  return 'other';
}

/**
 * Strip OS-assigned numeric suffixes so `LoopBe Internal MIDI 2` collapses
 * with `LoopBe Internal MIDI 16` under one base name.
 *
 * Handles ` 2`, ` 16`, ` [3]`, ` (4)`, ` #2`. Leaves names like
 * `APC40 mkII` alone (mkII is alphanumeric, not a pure suffix).
 */
export function stripPortSuffix(name: string): string {
  if (!name) return '';
  let stripped = name.trim();
  // ` 2`, ` 16` at the end (one to three digits)
  stripped = stripped.replace(/\s+\d{1,3}$/, '');
  // ` [3]`, ` (4)`, ` #5`
  stripped = stripped.replace(/\s+[\[(#]\d+[\])]?$/, '');
  return stripped.trim() || name.trim();
}

export function groupMidiInterfaces(names: string[]): Record<MidiBucket, MidiGroup[]> {
  const buckets: Record<MidiBucket, Map<string, MidiGroup>> = {
    hardware: new Map(),
    virtual: new Map(),
    network: new Map(),
    other: new Map(),
  };

  for (const name of names) {
    if (!name) continue;
    const bucket = bucketFor(name);
    const baseName = stripPortSuffix(name);
    const key = baseName.toLowerCase();
    const existing = buckets[bucket].get(key);
    if (existing) {
      existing.ports.push(name);
    } else {
      buckets[bucket].set(key, { baseName, bucket, ports: [name] });
    }
  }

  const sortGroups = (m: Map<string, MidiGroup>): MidiGroup[] =>
    Array.from(m.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));

  return {
    hardware: sortGroups(buckets.hardware),
    virtual: sortGroups(buckets.virtual),
    network: sortGroups(buckets.network),
    other: sortGroups(buckets.other),
  };
}

export const BUCKET_LABELS: Record<MidiBucket, string> = {
  hardware: 'Hardware controllers',
  virtual: 'Virtual / Loopback',
  network: 'Network MIDI',
  other: 'Other',
};

export const BUCKET_ORDER: MidiBucket[] = ['hardware', 'virtual', 'network', 'other'];
