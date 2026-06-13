type FeatureFlagName = 'dmxTracker';

const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagName, boolean> = {
  dmxTracker: false,
};

const FEATURE_FLAG_ENV_KEYS: Record<FeatureFlagName, string> = {
  dmxTracker: 'VITE_FEATURE_DMX_TRACKER',
};

const FEATURE_FLAG_STORAGE_KEYS: Record<FeatureFlagName, string> = {
  dmxTracker: 'artbastard.feature.dmxTracker',
};

function parseFlagValue(value: unknown): boolean | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return null;
}

export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  const env = (import.meta as any).env as Record<string, string | undefined> | undefined;
  const envValue = parseFlagValue(env?.[FEATURE_FLAG_ENV_KEYS[flag]]);
  if (envValue !== null) return envValue;

  if (typeof window !== 'undefined') {
    const storedValue = parseFlagValue(window.localStorage.getItem(FEATURE_FLAG_STORAGE_KEYS[flag]));
    if (storedValue !== null) return storedValue;
  }

  return FEATURE_FLAG_DEFAULTS[flag];
}
