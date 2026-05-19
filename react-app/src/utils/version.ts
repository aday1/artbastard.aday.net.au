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
  version: '5.1.2.0',
  buildDate: '2026-05-19',
  releaseType: 'stable',
  features: [
    'Stable hosted release on dev/live lanes (GHCR + Linode)',
    'DMX512 desk: Art-Net, scenes, fixtures, MIDI/OSC, LAN bridge',
    'Reason rack + workbench envelopes + DMX transition tracker',
    'Channel role icons, fixture-aware tracker, live theme tuning',
    'Touch-friendly DMX faders with page-scroll isolation on mobile',
    'Single main scroll region; resizable panels; Canvas DMX mobile default'
  ],
  changelog: [
    'v5.1.2.0: Official stable line (DMX512 nod) — consolidates hosted release and UI fixes',
    'v5.1.2.0: Theme preview loop fix; pinned vertical fader sizing',
    'v5.1.2.0: Scroll layout, range sliders, touch-action on faders',
    'v5.1.2.0: Larger fader thumbs; fixture tick slot/fine/full; channel window handles'
  ]
};

export const VERSION_HISTORY: VersionInfo[] = [
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
