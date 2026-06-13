/**
 * Version tracking and release information for ArtBastard DMX512
 */

export interface VersionInfo {
  version: string;
  buildDate: string;
  gitCommit?: string;
  releaseType: 'stable' | 'beta' | 'alpha' | 'dev';
  features: string[];
  changelog: string[];
}

export const CURRENT_VERSION: VersionInfo = {
  version: '5.2.12.0',
  buildDate: '2026-06-14',
  releaseType: 'stable',
  features: [
    'Hard version bump: light-theme remaster, SuperControl layout rebuild, footer monitor consolidation, and APC40 ON/OFF state semantics',
    'APC40 Record Arm, Solo/Cue, and Activator rows now treat ON as add/solo and OFF as remove/release, with LED feedback aligned to app state',
    'DMX Tracker is feature-flagged off by default while envelope automation and channel strip controls remain production-facing',
    'APC40 Deck A/B scene grid, ACT launch buttons, REC then Clip saves, Device Control role feedback',
    'Confirmed ArtBastard line promoted across dev/live lanes (GHCR + Linode)',
    'DMX512 desk: Art-Net, scenes, fixtures, MIDI/OSC, LAN bridge',
    'Reason rack + workbench envelopes + DMX transition tracker',
    'Channel role icons, fixture-aware tracker, live theme tuning',
    'Touch-friendly DMX faders with page-scroll isolation on mobile',
    'Single main scroll region; resizable panels; Canvas DMX mobile default',
    'Toggleable activity and pattern trackers; compact DMX strips hide unused channels',
    'Lightweight DMX activity glow replaces particle Sparkles for smoother browsers'
  ],
  changelog: [
    'v5.2.12.0: Hard release line for SuperControl card layout, cream/synthwave light theme, footer monitor controls, and APC40 ON/OFF button semantics',
    'v5.2.12.0: Record Arm/Solo Group, Solo/Cue fixture select, and Activator group select now follow explicit APC40 ON/OFF state instead of blind toggles',
    'v5.2.12.0: DMX Tracker hidden behind feature flag; SuperControl hides featureless cards and folds scenes/color autopilot into parent cards',
    'v5.2.12.0: Fixed light-mode dark leakage across DMX page, SuperControl selection, monitor panels, status bar, and deploy-meta dock',
    'v5.2.4.0: APC40 grid is Deck A, SHIFT grid is Deck B, Scene Launch buttons fire ACTS 1-5',
    'v5.2.4.0: APC40 REC then Clip saves deck scene slots; crossfader blends active Deck A/B scenes',
    'v5.2.4.0: APC40 Device Control follows selected fixture gobo/effects roles; Cue Level pages role banks',
    'v5.2.4.0: APC40 Activator toggles group auto; Solo/Cue isolates fixtures inside selected groups; Master Select is FULL ON',
    'v5.2.0.1: Particle Sparkles removed; DMX sends now pulse a single lightweight page glow',
    'v5.2.0.1: Sparkles toggles removed from nav, drawer, and app context menu',
    'v5.2.0.0: Live/dev canonical build; stale beta lane labels retired',
    'v5.2.0.0: DMX strip compact mode hides unused channels with one-tap full 512 fallback',
    'v5.2.0.0: Activity tracker and pattern tracker can be toggled independently',
    'v5.1.2.0: Official stable line (DMX512 nod) — consolidates hosted release and UI fixes',
    'v5.1.2.0: Theme preview loop fix; pinned vertical fader sizing',
    'v5.1.2.0: Scroll layout, range sliders, touch-action on faders',
    'v5.1.2.0: Larger fader thumbs; fixture tick slot/fine/full; channel window handles'
  ]
};

export const VERSION_HISTORY: VersionInfo[] = [
  {
    version: '5.2.12.0',
    buildDate: '2026-06-14',
    releaseType: 'stable',
    features: CURRENT_VERSION.features,
    changelog: CURRENT_VERSION.changelog
  },
  {
    version: '5.2.4.0',
    buildDate: '2026-06-09',
    releaseType: 'stable',
    features: CURRENT_VERSION.features,
    changelog: CURRENT_VERSION.changelog
  },
  {
    version: '5.2.0.1',
    buildDate: '2026-06-08',
    releaseType: 'stable',
    features: CURRENT_VERSION.features,
    changelog: CURRENT_VERSION.changelog
  },
  {
    version: '5.2.0.0',
    buildDate: '2026-06-08',
    releaseType: 'stable',
    features: CURRENT_VERSION.features,
    changelog: CURRENT_VERSION.changelog
  },
  {
    version: '5.1.2.0',
    buildDate: '2026-05-19',
    releaseType: 'stable',
    features: CURRENT_VERSION.features,
    changelog: CURRENT_VERSION.changelog
  }
];

export function getVersionDisplay(versionInfo: VersionInfo = CURRENT_VERSION): string {
  const { version, releaseType } = versionInfo;
  if (releaseType === 'stable') {
    return `v${version}`;
  }
  return `v${version}-${releaseType}`;
}

export function getBuildInfo(versionInfo: VersionInfo = CURRENT_VERSION): string {
  const { version, buildDate, gitCommit } = versionInfo;
  let buildInfo = `Version ${version} (${buildDate})`;
  if (gitCommit) {
    buildInfo += ` - ${gitCommit.substring(0, 8)}`;
  }
  return buildInfo;
}

export function isDevelopmentBuild(): boolean {
  return CURRENT_VERSION.releaseType === 'dev' || process.env.NODE_ENV === 'development';
}

export function getReleaseNotes(version: string): VersionInfo | undefined {
  return VERSION_HISTORY.find((v) => v.version === version);
}
