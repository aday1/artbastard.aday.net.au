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

const RACK_AMIGA: RackChrome = {
  rkBg: '#0056a8',
  rkSurface: '#c7c7c7',
  rkPanel: '#e0e0e0',
  rkBevelHi: '#ffffff',
  rkBevelLo: '#4b4b4b',
  rkAccent: '#ff8a00',
  rkLabel: '#111827',
  rkLabelDim: '#374151',
};

const RACK_WIN31: RackChrome = {
  rkBg: '#008080',
  rkSurface: '#c0c0c0',
  rkPanel: '#d9d9d9',
  rkBevelHi: '#ffffff',
  rkBevelLo: '#808080',
  rkAccent: '#000080',
  rkLabel: '#000000',
  rkLabelDim: '#202020',
};

const RACK_TERMINAL: RackChrome = {
  rkBg: '#020804',
  rkSurface: '#07160b',
  rkPanel: '#0b2010',
  rkBevelHi: '#1f6d32',
  rkBevelLo: '#010401',
  rkAccent: '#39ff6a',
  rkLabel: '#d9ffe1',
  rkLabelDim: '#71a979',
};

const RACK_SGI: RackChrome = {
  rkBg: '#151026',
  rkSurface: '#241a3d',
  rkPanel: '#322451',
  rkBevelHi: '#7a66bd',
  rkBevelLo: '#090515',
  rkAccent: '#00c2c7',
  rkLabel: '#f0ebff',
  rkLabelDim: '#aa9dce',
};

const RACK_HOTDOG: RackChrome = {
  rkBg: '#b00000',
  rkSurface: '#ffef00',
  rkPanel: '#fff45c',
  rkBevelHi: '#ffffff',
  rkBevelLo: '#7a0000',
  rkAccent: '#d40000',
  rkLabel: '#110000',
  rkLabelDim: '#5c0000',
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

  preset('amiga-workbench-31', 'Amiga Workbench 3.1', {
    backgroundHue: 212,
    backgroundSaturation: 74,
    backgroundBrightness: 31,
    primaryHue: 214,
    primarySaturation: 86,
    primaryBrightness: 46,
    secondaryHue: 0,
    secondarySaturation: 0,
    secondaryBrightness: 76,
    accentHue: 30,
    accentSaturation: 95,
    accentBrightness: 53,
    textPrimaryBrightness: 96,
    textSecondaryBrightness: 80,
    textTertiaryBrightness: 66,
    borderBrightness: 54,
    borderSaturation: 12,
    cardBrightness: 38,
    cardSaturation: 8,
  }, RACK_AMIGA, { preferDark: true, description: 'Blue Workbench panels with chunky grey chrome and orange accents' }),

  preset('windows-31', 'Windows 3.1', {
    backgroundHue: 180,
    backgroundSaturation: 28,
    backgroundBrightness: 72,
    primaryHue: 240,
    primarySaturation: 64,
    primaryBrightness: 34,
    secondaryHue: 0,
    secondarySaturation: 0,
    secondaryBrightness: 52,
    accentHue: 180,
    accentSaturation: 100,
    accentBrightness: 25,
    successHue: 120,
    warningHue: 48,
    errorHue: 0,
    infoHue: 240,
    textPrimaryBrightness: 10,
    textSecondaryBrightness: 22,
    textTertiaryBrightness: 35,
    borderBrightness: 48,
    borderSaturation: 3,
    cardBrightness: 10,
    cardSaturation: 4,
    statusInactiveBrightness: 44,
  }, RACK_WIN31, { preferDark: false, description: 'Teal desktop, grey bevels, and classic navy selection chrome' }),

  preset('crt-terminal', 'CRT Terminal', {
    backgroundHue: 126,
    backgroundSaturation: 36,
    backgroundBrightness: 5,
    primaryHue: 134,
    primarySaturation: 100,
    primaryBrightness: 58,
    secondaryHue: 82,
    secondarySaturation: 78,
    secondaryBrightness: 44,
    accentHue: 43,
    accentSaturation: 100,
    accentBrightness: 58,
    textPrimaryBrightness: 88,
    textSecondaryBrightness: 66,
    textTertiaryBrightness: 48,
    borderBrightness: 24,
    borderSaturation: 42,
    cardBrightness: 7,
    cardSaturation: 50,
    statusConnectedHue: 134,
    statusActiveHue: 134,
  }, RACK_TERMINAL, { preferDark: true, description: 'Black glass, phosphor green, amber warning lamps' }),

  preset('sgi-indigo', 'SGI Indigo', {
    backgroundHue: 262,
    backgroundSaturation: 42,
    backgroundBrightness: 11,
    primaryHue: 267,
    primarySaturation: 52,
    primaryBrightness: 58,
    secondaryHue: 190,
    secondarySaturation: 82,
    secondaryBrightness: 42,
    accentHue: 172,
    accentSaturation: 88,
    accentBrightness: 44,
    textPrimaryBrightness: 94,
    textSecondaryBrightness: 72,
    textTertiaryBrightness: 55,
    borderBrightness: 33,
    borderSaturation: 24,
    cardBrightness: 16,
    cardSaturation: 34,
  }, RACK_SGI, { preferDark: true, description: 'Indigo workstation purple with teal instrument highlights' }),

  preset('hotdog-stand', 'Hotdog Stand', {
    backgroundHue: 55,
    backgroundSaturation: 100,
    backgroundBrightness: 82,
    primaryHue: 0,
    primarySaturation: 100,
    primaryBrightness: 36,
    secondaryHue: 0,
    secondarySaturation: 100,
    secondaryBrightness: 45,
    accentHue: 55,
    accentSaturation: 100,
    accentBrightness: 50,
    successHue: 120,
    warningHue: 40,
    errorHue: 0,
    infoHue: 220,
    textPrimaryBrightness: 8,
    textSecondaryBrightness: 18,
    textTertiaryBrightness: 28,
    borderBrightness: 42,
    borderSaturation: 72,
    cardBrightness: 4,
    cardSaturation: 100,
    statusInactiveBrightness: 36,
  }, RACK_HOTDOG, { preferDark: false, description: 'The historic Windows high-contrast red/yellow chaos preset' }),

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

export const RETRO_THEME_PRESET_IDS = [
  'synthwave',
  'amiga-workbench-31',
  'windows-31',
  'crt-terminal',
  'sgi-indigo',
  'hotdog-stand',
] as const;

export function getRandomThemePreset(excludeId?: string | null): ThemePreset {
  const retroPresets = RETRO_THEME_PRESET_IDS
    .map((id) => getPresetById(id))
    .filter((preset): preset is ThemePreset => Boolean(preset));
  const choices = retroPresets.filter((preset) => preset.id !== excludeId);
  const pool = choices.length > 0 ? choices : retroPresets;
  return pool[Math.floor(Math.random() * pool.length)] ?? THEME_PRESETS[0];
}

function themeTargets(): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  return [document.documentElement, document.body].filter((target): target is HTMLElement => Boolean(target));
}

function setThemeVar(name: string, value: string): void {
  themeTargets().forEach((target) => target.style.setProperty(name, value));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hslToRgbChannels(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c; g = x;
  } else if (hue < 120) {
    r = x; g = c;
  } else if (hue < 180) {
    g = c; b = x;
  } else if (hue < 240) {
    g = x; b = c;
  } else if (hue < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }

  return `${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}`;
}

export function applyRackChrome(rack: RackChrome): void {
  rack = rackForCurrentHost(rack);
  setThemeVar('--rk-bg', rack.rkBg);
  setThemeVar('--rk-surface', rack.rkSurface);
  setThemeVar('--rk-panel', rack.rkPanel);
  setThemeVar('--rk-module', rack.rkPanel);
  setThemeVar('--rk-module-edge', rack.rkBevelHi);
  setThemeVar('--rk-bevel-hi', rack.rkBevelHi);
  setThemeVar('--rk-bevel-lo', rack.rkBevelLo);
  setThemeVar('--rk-screw', rack.rkBevelLo);
  setThemeVar('--rk-accent', rack.rkAccent);
  setThemeVar('--rk-accent-glow', `color-mix(in srgb, ${rack.rkAccent} 55%, transparent)`);
  setThemeVar('--rk-label', rack.rkLabel);
  setThemeVar('--rk-label-dim', rack.rkLabelDim);
  setThemeVar('--rk-grid-bg', rack.rkBg);
  setThemeVar('--rk-grid-line', rack.rkBevelLo);
  setThemeVar('--rk-cell', rack.rkSurface);
  setThemeVar('--rk-cell-active', `color-mix(in srgb, ${rack.rkAccent} 20%, ${rack.rkSurface})`);
  setThemeVar('--wb-bg', rack.rkBg);
  setThemeVar('--wb-surface', rack.rkSurface);
  setThemeVar('--wb-panel', rack.rkPanel);
  setThemeVar('--wb-bevel-light', rack.rkBevelHi);
  setThemeVar('--wb-bevel-dark', rack.rkBevelLo);
  setThemeVar('--wb-accent', rack.rkAccent);
  setThemeVar('--wb-copper', rack.rkAccent);
  setThemeVar('--wb-amber', rack.rkAccent);
  setThemeVar('--wb-text', rack.rkLabel);
  setThemeVar('--wb-text-dim', rack.rkLabelDim);
}

export function applyThemeColorsToDocument(colors: ThemeColorsHsl): void {
  const rotation = colors.hueRotation || 0;
  const applyRotation = (hue: number) => ((hue + rotation + 360) % 360);

  setThemeVar('--theme-primary-hue', `${applyRotation(colors.primaryHue)}`);
  setThemeVar('--theme-primary-saturation', `${colors.primarySaturation}%`);
  setThemeVar('--theme-primary-brightness', `${colors.primaryBrightness}%`);
  setThemeVar('--theme-secondary-hue', `${applyRotation(colors.secondaryHue)}`);
  setThemeVar('--theme-secondary-saturation', `${colors.secondarySaturation}%`);
  setThemeVar('--theme-secondary-brightness', `${colors.secondaryBrightness}%`);
  setThemeVar('--theme-accent-hue', `${applyRotation(colors.accentHue)}`);
  setThemeVar('--theme-accent-saturation', `${colors.accentSaturation}%`);
  setThemeVar('--theme-accent-brightness', `${colors.accentBrightness}%`);

  const primaryColor = `hsl(${applyRotation(colors.primaryHue)}, ${colors.primarySaturation}%, ${colors.primaryBrightness}%)`;
  const secondaryColor = `hsl(${applyRotation(colors.secondaryHue)}, ${colors.secondarySaturation}%, ${colors.secondaryBrightness}%)`;
  const accentColor = `hsl(${applyRotation(colors.accentHue)}, ${colors.accentSaturation}%, ${colors.accentBrightness}%)`;
  setThemeVar('--color-primary', primaryColor);
  setThemeVar('--color-secondary', secondaryColor);
  setThemeVar('--color-accent', accentColor);
  setThemeVar('--accent-color', accentColor);
  setThemeVar('--color-interactive', primaryColor);
  setThemeVar('--color-interactive-hover', `color-mix(in srgb, ${primaryColor} 84%, ${colors.primaryBrightness > 55 ? '#000' : '#fff'})`);
  setThemeVar('--color-interactive-active', `color-mix(in srgb, ${primaryColor} 72%, ${colors.primaryBrightness > 55 ? '#000' : '#fff'})`);
  setThemeVar('--color-border-focus', primaryColor);
  setThemeVar('--color-slider-thumb', primaryColor);
  setThemeVar('--color-button-bg', primaryColor);
  setThemeVar(
    '--color-button-text',
    colors.primaryBrightness > 58 ? '#081018' : '#f8fafc'
  );
  setThemeVar('--color-text-inverse', colors.primaryBrightness > 58 ? '#081018' : '#f8fafc');
  setThemeVar('--color-nav-active', primaryColor);
  setThemeVar('--color-nav-inactive', secondaryColor);
  setThemeVar('--color-primary-400', primaryColor);
  setThemeVar('--color-primary-500', primaryColor);
  setThemeVar('--color-primary-600', `color-mix(in srgb, ${primaryColor} 78%, #000)`);
  setThemeVar('--color-primary-700', `color-mix(in srgb, ${primaryColor} 65%, #000)`);
  setThemeVar('--color-primary-500-rgb', hslToRgbChannels(applyRotation(colors.primaryHue), colors.primarySaturation, colors.primaryBrightness));

  const bgHue = colors.backgroundHue ?? 220;
  const bgSaturation = colors.backgroundSaturation ?? 20;
  const bgBrightness = colors.backgroundBrightness ?? 25;
  const isLightPalette = bgBrightness >= 55;
  setThemeVar('--theme-background-hue', `${bgHue}`);
  setThemeVar('--theme-background-saturation', `${bgSaturation}%`);
  setThemeVar('--theme-background-brightness', `${bgBrightness}%`);

  const bgColor = `hsl(${bgHue}, ${bgSaturation}%, ${bgBrightness}%)`;
  setThemeVar('--color-background', bgColor);
  setThemeVar('--background-color', bgColor);
  setThemeVar('--bg-primary', bgColor);

  const successColor = `hsl(${applyRotation(colors.successHue ?? 142)}, ${colors.successSaturation ?? 71}%, ${colors.successBrightness ?? 47}%)`;
  const warningColor = `hsl(${applyRotation(colors.warningHue ?? 38)}, ${colors.warningSaturation ?? 92}%, ${colors.warningBrightness ?? 51}%)`;
  const errorColor = `hsl(${applyRotation(colors.errorHue ?? 0)}, ${colors.errorSaturation ?? 84}%, ${colors.errorBrightness ?? 60}%)`;
  const infoColor = `hsl(${applyRotation(colors.infoHue ?? 217)}, ${colors.infoSaturation ?? 91}%, ${colors.infoBrightness ?? 59}%)`;
  setThemeVar('--theme-success-hue', `${applyRotation(colors.successHue ?? 142)}`);
  setThemeVar('--theme-success-saturation', `${colors.successSaturation ?? 71}%`);
  setThemeVar('--theme-success-brightness', `${colors.successBrightness ?? 47}%`);
  setThemeVar('--color-success', successColor);
  setThemeVar('--color-success-500', successColor);
  setThemeVar('--theme-warning-hue', `${applyRotation(colors.warningHue ?? 38)}`);
  setThemeVar('--theme-warning-saturation', `${colors.warningSaturation ?? 92}%`);
  setThemeVar('--theme-warning-brightness', `${colors.warningBrightness ?? 51}%`);
  setThemeVar('--color-warning', warningColor);
  setThemeVar('--color-warning-500', warningColor);
  setThemeVar('--theme-error-hue', `${applyRotation(colors.errorHue ?? 0)}`);
  setThemeVar('--theme-error-saturation', `${colors.errorSaturation ?? 84}%`);
  setThemeVar('--theme-error-brightness', `${colors.errorBrightness ?? 60}%`);
  setThemeVar('--color-error', errorColor);
  setThemeVar('--error-color', errorColor);
  setThemeVar('--color-error-500', errorColor);
  setThemeVar('--theme-info-hue', `${applyRotation(colors.infoHue ?? 217)}`);
  setThemeVar('--theme-info-saturation', `${colors.infoSaturation ?? 91}%`);
  setThemeVar('--theme-info-brightness', `${colors.infoBrightness ?? 59}%`);
  setThemeVar('--color-info-500', infoColor);

  setThemeVar('--theme-text-primary-brightness', `${colors.textPrimaryBrightness ?? 90}%`);
  setThemeVar('--theme-text-secondary-brightness', `${colors.textSecondaryBrightness ?? 65}%`);
  setThemeVar('--theme-text-tertiary-brightness', `${colors.textTertiaryBrightness ?? 50}%`);

  const textPrimaryColor = `hsl(${bgHue}, ${bgSaturation}%, ${colors.textPrimaryBrightness ?? 90}%)`;
  const textSecondaryColor = `hsl(${bgHue}, ${bgSaturation}%, ${colors.textSecondaryBrightness ?? 65}%)`;
  const textTertiaryColor = `hsl(${bgHue}, ${bgSaturation}%, ${colors.textTertiaryBrightness ?? 50}%)`;
  const textDisabledColor = `hsl(${bgHue}, ${Math.min(bgSaturation, 18)}%, ${isLightPalette ? 48 : 36}%)`;
  setThemeVar('--color-text', textPrimaryColor);
  setThemeVar('--color-text-primary', textPrimaryColor);
  setThemeVar('--color-text-secondary', textSecondaryColor);
  setThemeVar('--color-text-tertiary', textTertiaryColor);
  setThemeVar('--color-text-muted', textSecondaryColor);
  setThemeVar('--color-text-disabled', textDisabledColor);
  setThemeVar('--text-primary', textPrimaryColor);
  setThemeVar('--text-secondary', textSecondaryColor);
  setThemeVar('--text-tertiary', textTertiaryColor);
  setThemeVar('--text-muted', textSecondaryColor);

  const borderBrightness = colors.borderBrightness ?? 30;
  const borderSaturation = colors.borderSaturation ?? 15;
  const borderColor = `hsl(${bgHue}, ${borderSaturation}%, ${borderBrightness}%)`;
  setThemeVar('--color-border', borderColor);
  setThemeVar('--border-color', borderColor);
  setThemeVar('--border-color-soft', `color-mix(in srgb, ${borderColor} 62%, transparent)`);
  setThemeVar('--border-color-subtle', `color-mix(in srgb, ${borderColor} 36%, transparent)`);
  setThemeVar('--color-card-border', borderColor);
  setThemeVar('--color-border-strong', `color-mix(in srgb, ${borderColor} 76%, ${isLightPalette ? '#000' : '#fff'})`);

  const cardBrightness = clampPercent(bgBrightness + (colors.cardBrightness ?? 8));
  const cardSaturation = colors.cardSaturation ?? bgSaturation;
  const cardColor = `hsl(${bgHue}, ${cardSaturation}%, ${cardBrightness}%)`;
  const tertiaryBrightness = clampPercent(bgBrightness + (isLightPalette ? -8 : 4));
  const hoverBrightness = clampPercent(cardBrightness + (isLightPalette ? -6 : 9));
  const elevatedBrightness = clampPercent(cardBrightness + (isLightPalette ? 3 : 5));
  const inputBrightness = clampPercent(bgBrightness + (isLightPalette ? 12 : 4));
  const headerBrightness = clampPercent(bgBrightness + (isLightPalette ? -2 : 6));
  const tertiaryColor = `hsl(${bgHue}, ${cardSaturation}%, ${tertiaryBrightness}%)`;
  const hoverColor = `hsl(${bgHue}, ${cardSaturation}%, ${hoverBrightness}%)`;
  const elevatedColor = `hsl(${bgHue}, ${cardSaturation}%, ${elevatedBrightness}%)`;
  const inputColor = `hsl(${bgHue}, ${cardSaturation}%, ${inputBrightness}%)`;
  const headerColor = `hsl(${bgHue}, ${cardSaturation}%, ${headerBrightness}%)`;
  const overlayColor = `hsla(${bgHue}, ${cardSaturation}%, ${cardBrightness}%, 0.95)`;
  const isLightSurface = cardBrightness >= 55;
  const surfaceTextSaturation = clampPercent(Math.min(bgSaturation, 24));
  const surfaceTextPrimaryColor = `hsl(${bgHue}, ${surfaceTextSaturation}%, ${isLightSurface ? 10 : 94}%)`;
  const surfaceTextSecondaryColor = `hsl(${bgHue}, ${surfaceTextSaturation}%, ${isLightSurface ? 28 : 72}%)`;
  const surfaceTextTertiaryColor = `hsl(${bgHue}, ${surfaceTextSaturation}%, ${isLightSurface ? 42 : 58}%)`;
  setThemeVar('--color-card-bg', cardColor);
  setThemeVar('--card-background', cardColor);
  setThemeVar('--panel-bg', cardColor);
  setThemeVar('--panel-background', cardColor);
  setThemeVar('--panel-text', surfaceTextPrimaryColor);
  setThemeVar('--panel-text-secondary', surfaceTextSecondaryColor);
  setThemeVar('--panel-text-tertiary', surfaceTextTertiaryColor);
  setThemeVar('--surface-color', cardColor);
  setThemeVar('--surface-text', surfaceTextPrimaryColor);
  setThemeVar('--surface-text-secondary', surfaceTextSecondaryColor);
  setThemeVar('--color-surface', cardColor);
  setThemeVar('--color-surface-elevated', elevatedColor);
  setThemeVar('--color-surface-overlay', overlayColor);
  setThemeVar('--color-on-surface', surfaceTextPrimaryColor);
  setThemeVar('--color-on-surface-muted', surfaceTextSecondaryColor);
  setThemeVar('--bg-secondary', cardColor);
  setThemeVar('--bg-tertiary', tertiaryColor);
  setThemeVar('--bg-hover', hoverColor);
  setThemeVar('--header-bg', headerColor);
  setThemeVar('--input-bg', inputColor);
  setThemeVar('--modal-bg', overlayColor);
  setThemeVar('--modal-border', borderColor);
  setThemeVar('--modal-text', surfaceTextPrimaryColor);
  setThemeVar('--modal-text-secondary', surfaceTextSecondaryColor);
  setThemeVar('--modal-text-tertiary', surfaceTextTertiaryColor);
  setThemeVar('--window-bg', cardColor);
  setThemeVar('--window-surface', elevatedColor);
  setThemeVar('--window-border', borderColor);
  setThemeVar('--window-text', surfaceTextPrimaryColor);
  setThemeVar('--window-text-secondary', surfaceTextSecondaryColor);
  setThemeVar('--window-text-tertiary', surfaceTextTertiaryColor);
  setThemeVar('--dock-bg', overlayColor);
  setThemeVar('--dock-border', `color-mix(in srgb, ${primaryColor} 46%, ${borderColor})`);
  setThemeVar('--dock-text', surfaceTextPrimaryColor);
  setThemeVar('--dock-text-secondary', surfaceTextSecondaryColor);
  setThemeVar('--dock-text-tertiary', surfaceTextTertiaryColor);

  const neutralSaturation = clampPercent(bgSaturation * 0.35);
  const neutralStops = isLightPalette
    ? [98, 94, 88, 78, 62, 47, 34, 24, 16, 10]
    : [8, 12, 18, 27, 38, 52, 64, 75, 86, 94];
  ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].forEach((stop, index) => {
    setThemeVar(`--color-neutral-${stop}`, `hsl(${bgHue}, ${neutralSaturation}%, ${neutralStops[index]}%)`);
  });

  setThemeVar('--color-slider-track', borderColor);
  setThemeVar('--color-channel-bg', inputColor);
  setThemeVar('--color-channel-border', borderColor);
  setThemeVar('--color-channel-selected', `color-mix(in srgb, ${primaryColor} 20%, transparent)`);
  setThemeVar('--shadow-rgb', isLightPalette ? '55 65 81' : '0 0 0');
  setThemeVar('--shadow-soft', isLightPalette ? '0 1px 6px rgb(55 65 81 / 0.08)' : '0 1px 6px rgb(0 0 0 / 0.35)');
  setThemeVar('--shadow-strong', isLightPalette ? '0 8px 24px rgb(55 65 81 / 0.16)' : '0 14px 36px rgb(0 0 0 / 0.5)');
  setThemeVar('--shadow-sm', isLightPalette ? '0 1px 2px rgb(55 65 81 / 0.06)' : '0 1px 2px rgb(0 0 0 / 0.34)');
  setThemeVar('--shadow-md', isLightPalette ? '0 4px 8px rgb(55 65 81 / 0.10)' : '0 6px 14px rgb(0 0 0 / 0.38)');
  setThemeVar('--shadow-lg', isLightPalette ? '0 12px 24px rgb(55 65 81 / 0.14)' : '0 18px 36px rgb(0 0 0 / 0.48)');
  setThemeVar('--shadow-xl', isLightPalette ? '0 20px 42px rgb(55 65 81 / 0.18)' : '0 24px 56px rgb(0 0 0 / 0.58)');

  setThemeVar('--theme-status-connected-hue', `${colors.statusConnectedHue ?? 142}`);
  setThemeVar('--theme-status-disconnected-hue', `${colors.statusDisconnectedHue ?? 0}`);
  setThemeVar('--theme-status-active-hue', `${colors.statusActiveHue ?? 142}`);
  setThemeVar('--theme-status-inactive-brightness', `${colors.statusInactiveBrightness ?? 50}%`);
  setThemeVar(
    '--color-status-connected',
    `hsl(${colors.statusConnectedHue ?? 142}, 71%, 47%)`
  );
  setThemeVar(
    '--color-status-disconnected',
    `hsl(${colors.statusDisconnectedHue ?? 0}, 84%, 60%)`
  );
  setThemeVar('--color-status-active', `hsl(${colors.statusActiveHue ?? 142}, 71%, 47%)`);
  setThemeVar(
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


