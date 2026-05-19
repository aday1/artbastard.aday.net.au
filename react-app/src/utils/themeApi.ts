import axios from 'axios';
import type { AppearanceSettings } from './themeUtils';

export async function fetchAppearance(): Promise<AppearanceSettings | null> {
  try {
    const { data } = await axios.get<AppearanceSettings>('/api/appearance', { timeout: 5000 });
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export async function saveAppearance(settings: AppearanceSettings): Promise<boolean> {
  try {
    await axios.post('/api/appearance', settings, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
