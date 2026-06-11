/**
 * Central theme application for ArtBastard (HSL store model + Reason rack chrome).
 * Macroverse-style preset chips map to full themeColors + rack CSS variables.
 */

export interface ThemeColorsHsl {
  primaryHue: number;
  primarySaturation: number;
  primaryBrightness: number;
  secondaryHue: number;
  secondarySaturation: number;
  secondaryBrightness: number;
  accentHue: number;
  accentSaturation: number;
  accentBrightness: number;
  backgroundBrightness: number;
  backgroundHue: number;
  backgroundSaturation: number;
  hueRotation: number;
  successHue: number;
  successSaturation: number;
  successBrightness: number;
  warningHue: number;
  warningSaturation: number;
  warningBrightness: number;
  errorHue: number;
  errorSaturation: number;
  errorBrightness: number;
  infoHue: number;
  infoSaturation: number;
  infoBrightness: number;
  textPrimaryBrightness: number;
  textSecondaryBrightness: number;
  textTertiaryBrightness: number;
  borderBrightness: number;
  borderSaturation: number;
  cardBrightness: number;
  cardSaturation: number;
  statusConnectedHue: number;
  statusDisconnectedHue: number;
  statusActiveHue: number;
  statusInactiveBrightness: number;
}

export interface RackChrome {
  rkBg: string;
  rkSurface: string;
  rkPanel: string;
  rkBevelHi: string;
  rkBevelLo: string;
  rkAccent: string;
  rkLabel: string;
  rkLabelDim: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description?: string;
  colors: ThemeColorsHsl;
  rack: RackChrome;
  /** Force dark data-theme for rack-heavy presets */
  preferDark?: boolean;
}

export const DEFAULT_THEME_COLORS: ThemeColorsHsl = {
  primaryHue: 220,
  primarySaturation: 70,
  primaryBrightness: 50,
  secondaryHue: 280,
  secondarySaturation: 60,
  secondaryBrightness: 45,
  accentHue: 32,
  accentSaturation: 88,
  accentBrightness: 55,
  backgroundBrightness: 12,
  backgroundHue: 265,
  backgroundSaturation: 28,
  hueRotation: 0,
  successHue: 142,
  successSaturation: 71,
  successBrightness: 47,
  warningHue: 38,
  warningSaturation: 92,
  warningBrightness: 51,
  errorHue: 0,
  errorSaturation: 84,
  errorBrightness: 60,
  infoHue: 217,
  infoSaturation: 91,
  infoBrightness: 59,
  textPrimaryBrightness: 92,
  textSecondaryBrightness: 68,
  textTertiaryBrightness: 52,
  borderBrightness: 28,
  borderSaturation: 18,
  cardBrightness: 18,
  cardSaturation: 26,
  statusConnectedHue: 142,
  statusDisconnectedHue: 0,
  statusActiveHue: 142,
  statusInactiveBrightness: 48,
};

const RACK_WIRED: RackChrome = {
  rkBg: '#1a1530',
  rkSurface: '#251c44',
  rkPanel: '#2d2350',
  rkBevelHi: '#5a48a0',
  rkBevelLo: '#110a25',
  rkAccent: '#ffa044',
  rkLabel: '#ece4f8',
  rkLabelDim: '#9c8cc8',
};

const RACK_REASON: RackChrome = {
  rkBg: '#121018',
  rkSurface: '#1c1824',
  rkPanel: '#252030',
  rkBevelHi: '#6a5a88',
  rkBevelLo: '#0a060e',
  rkAccent: '#e8882a',
  rkLabel: '#c4b8d8',
  rkLabelDim: '#7a6e94',
};

const RACK_LIGHT: RackChrome = {
  rkBg: '#eef2f4',
  rkSurface: '#f7f8f5',
  rkPanel: '#ffffff',
  rkBevelHi: '#ffffff',
  rkBevelLo: '#aab4ba',
  rkAccent: '#0e8fb1',
  rkLabel: '#1f2933',
  rkLabelDim: '#60707a',
};

const RACK_REFRESHED: RackChrome = {
  rkBg: '#070b12',
  rkSurface: '#101827',
  rkPanel: '#162338',
  rkBevelHi: '#568aa2',
  rkBevelLo: '#02060a',
  rkAccent: '#00d7ff',
  rkLabel: '#d9fbff',
  rkLabelDim: '#7fa2b4',
};

function isRefreshedArtBastardHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'artbastard.aday.net.au' || host === 'artbastard-dev.aday.net.au' || host === 'artbastard-beta.aday.net.au';
}

function isLightThemeActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function rackForCurrentHost(rack: RackChrome): RackChrome {
  return isRefreshedArtBastardHost() && !isLightThemeActive()
    ? RACK_REFRESHED
    : rack;
}

function preset(
  id: string,
  name: string,
  colors: Partial<ThemeColorsHsl>,
  rack: RackChrome,
  extra?: Partial<ThemePreset>
): ThemePreset {
  return {
    id,
    name,
    colors: { ...DEFAULT_THEME_COLORS, ...colors },
    rack,
    ...extra,
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  preset('reason-rack', 'Reason Rack', {
    backgroundHue: 280,
    backgroundSaturation: 22,
    backgroundBrightness: 10,
    primaryHue: 270,
    accentHue: 28,
    accentSaturation: 90,
    accentBrightness: 58,
  }, RACK_REASON, { preferDark: true, description: 'Graphite rack + copper knobs (default studio look)' }),

  preset('wired-atelier', 'Wired Atelier', {
    backgroundHue: 265,
    backgroundSaturation: 30,
    backgroundBrightness: 12,
    primaryHue: 210,
    accentHue: 32,
  }, RACK_WIRED, { preferDark: true, description: 'Macroverse workbench purple + copper' }),

  preset('synthwave', 'Synthwave', {
    backgroundHue: 260,
    backgroundSaturation: 45,
    backgroundBrightness: 8,
    primaryHue: 300,
    secondaryHue: 190,
    accentHue: 330,
    accentBrightness: 65,
  }, {
    ...RACK_REASON,
    rkAccent: '#ff44aa',
    rkBevelHi: '#6644aa',
  }, { preferDark: true }),

  preset('ocean', 'Ocean Blue', {
    backgroundHue: 210,
    backgroundSaturation: 35,
    backgroundBrightness: 14,
    primaryHue: 200,
    accentHue: 180,
  }, RACK_REASON, { preferDark: true }),

  preset('warm-orange', 'Warm Orange', {
    backgroundHue: 30,
    backgroundSaturation: 25,
    backgroundBrightness: 14,
    primaryHue: 25,
    accentHue: 38,
    accentBrightness: 58,
  }, { ...RACK_REASON, rkAccent: '#f59e0b' }, { preferDark: true }),

  preset('forest', 'Forest Green', {
    backgroundHue: 140,
    backgroundSaturation: 22,
    backgroundBrightness: 12,
    primaryHue: 130,
    accentHue: 85,
  }, RACK_REASON, { preferDark: true }),

  preset('studio-light', 'Studio Light', {
    backgroundHue: 205,
    backgroundSaturation: 18,
    backgroundBrightness: 93,
    primaryHue: 194,
    primarySaturation: 74,
    primaryBrightness: 38,
    secondaryHue: 265,
    secondarySaturation: 32,
    secondaryBrightness: 42,
    accentHue: 31,
    accentSaturation: 84,
    accentBrightness: 48,
    textPrimaryBrightness: 16,
    textSecondaryBrightness: 34,
    textTertiaryBrightness: 48,
    borderBrightness: 70,
    borderSaturation: 14,
    cardBrightness: 3,
    cardSaturation: 14,
  }, RACK_LIGHT, { preferDark: false, description: 'Bright booth / programming in daylight' }),

  preset('brighter-default', 'Brighter Dark', {
    backgroundBrightness: 22,
    backgroundHue: 220,
    backgroundSaturation: 20,
  }, RACK_WIRED, { preferDark: true }),
];

export function applyRackChrome(rack: RackChrome): void {
  const root = document.documentElement;
  rack = rackForCurrentHost(rack);
  root.style.setProperty('--rk-bg', rack.rkBg);
  root.style.setProperty('--rk-surface', rack.rkSurface);
  root.style.setProperty('--rk-panel', rack.rkPanel);
  root.style.setProperty('--rk-bevel-hi', rack.rkBevelHi);
  root.style.setProperty('--rk-bevel-lo', rack.rkBevelLo);
  root.style.setProperty('--rk-accent', rack.rkAccent);
  root.style.setProperty('--rk-label', rack.rkLabel);
  root.style.setProperty('--rk-label-dim', rack.rkLabelDim);
  root.style.setProperty('--wb-bg', rack.rkBg);
  root.style.setProperty('--wb-surface', rack.rkSurface);
  root.style.setProperty('--wb-panel', rack.rkPanel);
  root.style.setProperty('--wb-bevel-light', rack.rkBevelHi);
  root.style.setProperty('--wb-bevel-dark', rack.rkBevelLo);
  root.style.setProperty('--wb-copper', rack.rkAccent);
  root.style.setProperty('--wb-text', rack.rkLabel);
  root.style.setProperty('--wb-text-dim', rack.rkLabelDim);
}

export function applyThemeColorsToDocument(colors: ThemeColorsHsl): void {
  const root = document.documentElement;
  const rotation = colors.hueRotation || 0;
  const applyRotation = (hue: number) => ((hue + rotation + 360) % 360);

  root.style.setProperty('--theme-primary-hue', `${applyRotation(colors.primaryHue)}`);
  root.style.setProperty('--theme-primary-saturation', `${colors.primarySaturation}%`);
  root.style.setProperty('--theme-primary-brightness', `${colors.primaryBrightness}%`);
  root.style.setProperty('--theme-secondary-hue', `${applyRotation(colors.secondaryHue)}`);
  root.style.setProperty('--theme-secondary-saturation', `${colors.secondarySaturation}%`);
  root.style.setProperty('--theme-secondary-brightness', `${colors.secondaryBrightness}%`);
  root.style.setProperty('--theme-accent-hue', `${applyRotation(colors.accentHue)}`);
  root.style.setProperty('--theme-accent-saturation', `${colors.accentSaturation}%`);
  root.style.setProperty('--theme-accent-brightness', `${colors.accentBrightness}%`);

  const primaryColor = `hsl(${applyRotation(colors.primaryHue)}, ${colors.primarySaturation}%, ${colors.primaryBrightness}%)`;
  const secondaryColor = `hsl(${applyRotation(colors.secondaryHue)}, ${colors.secondarySaturation}%, ${colors.secondaryBrightness}%)`;
  const accentColor = `hsl(${applyRotation(colors.accentHue)}, ${colors.accentSaturation}%, ${colors.accentBrightness}%)`;
  root.style.setProperty('--color-primary', primaryColor);
  root.style.setProperty('--color-secondary', secondaryColor);
  root.style.setProperty('--color-accent', accentColor);
  root.style.setProperty('--accent-color', accentColor);
  root.style.setProperty('--color-slider-thumb', primaryColor);
  root.style.setProperty('--color-button-bg', primaryColor);
  root.style.setProperty(
    '--color-button-text',
    colors.backgroundBrightness > 60 ? '#ffffff' : '#f8fafc'
  );
  root.style.setProperty('--color-nav-active', primaryColor);
  root.style.setProperty('--color-nav-inactive', secondaryColor);

  const bgHue = colors.backgroundHue ?? 220;
  const bgSaturation = colors.backgroundSaturation ?? 20;
  const bgBrightness = colors.backgroundBrightness ?? 25;
  root.style.setProperty('--theme-background-hue', `${bgHue}`);
  root.style.setProperty('--theme-background-saturation', `${bgSaturation}%`);
  root.style.setProperty('--theme-background-brightness', `${bgBrightness}%`);

  const bgColor = `hsl(${bgHue}, ${bgSaturation}%, ${bgBrightness}%)`;
  root.style.setProperty('--color-background', bgColor);
  root.style.setProperty('--bg-primary', bgColor);

  root.style.setProperty('--theme-success-hue', `${applyRotation(colors.successHue ?? 142)}`);
  root.style.setProperty('--theme-success-saturation', `${colors.successSaturation ?? 71}%`);
  root.style.setProperty('--theme-success-brightness', `${colors.successBrightness ?? 47}%`);
  root.style.setProperty('--theme-warning-hue', `${applyRotation(colors.warningHue ?? 38)}`);
  root.style.setProperty('--theme-warning-saturation', `${colors.warningSaturation ?? 92}%`);
  root.style.setProperty('--theme-warning-brightness', `${colors.warningBrightness ?? 51}%`);
  root.style.setProperty('--theme-error-hue', `${applyRotation(colors.errorHue ?? 0)}`);
  root.style.setProperty('--theme-error-saturation', `${colors.errorSaturation ?? 84}%`);
  root.style.setProperty('--theme-error-brightness', `${colors.errorBrightness ?? 60}%`);
  root.style.setProperty('--theme-info-hue', `${applyRotation(colors.infoHue ?? 217)}`);
  root.style.setProperty('--theme-info-saturation', `${colors.infoSaturation ?? 91}%`);
  root.style.setProperty('--theme-info-brightness', `${colors.infoBrightness ?? 59}%`);

  root.style.setProperty('--theme-text-primary-brightness', `${colors.textPrimaryBrightness ?? 90}%`);
  root.style.setProperty('--theme-text-secondary-brightness', `${colors.textSecondaryBrightness ?? 65}%`);
  root.style.setProperty('--theme-text-tertiary-brightness', `${colors.textTertiaryBrightness ?? 50}%`);

  const textPrimaryColor = `hsl(${bgHue}, ${bgSaturation}%, ${colors.textPrimaryBrightness ?? 90}%)`;
  const textSecondaryColor = `hsl(${bgHue}, ${bgSaturation}%, ${colors.textSecondaryBrightness ?? 65}%)`;
  root.style.setProperty('--color-text', textPrimaryColor);
  root.style.setProperty('--text-primary', textPrimaryColor);
  root.style.setProperty('--text-secondary', textSecondaryColor);

  const borderBrightness = colors.borderBrightness ?? 30;
  const borderSaturation = colors.borderSaturation ?? 15;
  const borderColor = `hsl(${bgHue}, ${borderSaturation}%, ${borderBrightness}%)`;
  root.style.setProperty('--color-border', borderColor);
  root.style.setProperty('--border-color', borderColor);
  root.style.setProperty('--color-card-border', borderColor);

  const cardBrightness = Math.min(100, bgBrightness + (colors.cardBrightness ?? 8));
  const cardSaturation = colors.cardSaturation ?? bgSaturation;
  const cardColor = `hsl(${bgHue}, ${cardSaturation}%, ${cardBrightness}%)`;
  root.style.setProperty('--color-card-bg', cardColor);
  root.style.setProperty('--bg-secondary', cardColor);

  root.style.setProperty('--theme-status-connected-hue', `${colors.statusConnectedHue ?? 142}`);
  root.style.setProperty('--theme-status-disconnected-hue', `${colors.statusDisconnectedHue ?? 0}`);
  root.style.setProperty('--theme-status-active-hue', `${colors.statusActiveHue ?? 142}`);
  root.style.setProperty('--theme-status-inactive-brightness', `${colors.statusInactiveBrightness ?? 50}%`);
  root.style.setProperty(
    '--color-status-connected',
    `hsl(${colors.statusConnectedHue ?? 142}, 71%, 47%)`
  );
  root.style.setProperty(
    '--color-status-disconnected',
    `hsl(${colors.statusDisconnectedHue ?? 0}, 84%, 60%)`
  );
  root.style.setProperty('--color-status-active', `hsl(${colors.statusActiveHue ?? 142}, 71%, 47%)`);
  root.style.setProperty(
    '--color-status-inactive',
    `hsl(${bgHue}, ${bgSaturation}%, ${colors.statusInactiveBrightness ?? 50}%)`
  );
}

export function applyThemePreset(preset: ThemePreset): ThemeColorsHsl {
  applyThemeColorsToDocument(preset.colors);
  applyRackChrome(preset.rack);
  return preset.colors;
}

export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

export function getModeAwarePreset(
  preferredPresetId: string | null | undefined,
  darkMode: boolean
): ThemePreset {
  const preferred = preferredPresetId ? getPresetById(preferredPresetId) : undefined;

  if (preferred) {
    if (darkMode && preferred.preferDark !== false) return preferred;
    if (!darkMode && preferred.preferDark === false) return preferred;
  }

  return getPresetById(darkMode ? 'reason-rack' : 'studio-light') ?? THEME_PRESETS[0];
}

export function applyModeAwarePreset(
  darkMode: boolean,
  preferredPresetId?: string | null
): ThemeColorsHsl {
  const preset = getModeAwarePreset(preferredPresetId, darkMode);
  const colors = applyThemePreset(preset);

  try {
    localStorage.setItem('themePresetId', preset.id);
    localStorage.setItem('themeColors', JSON.stringify(colors));
  } catch {
    // Local storage is optional during SSR/tests.
  }

  return colors;
}

export interface AppearanceSettings {
  theme?: 'artsnob' | 'standard' | 'minimal';
  darkMode?: boolean;
  themePresetId?: string;
  themeColors?: Partial<ThemeColorsHsl>;
}


