import React, { useState } from 'react';
import { THEME_PRESETS, applyThemePreset, type ThemeColorsHsl } from '../../utils/themeUtils';
import { SiteBrandingLink } from '../ui/SiteBrandingLink';
import styles from './ThemePresetStrip.module.scss';

interface ThemePresetStripProps {
  onPreview: (colors: ThemeColorsHsl) => void;
  onPreferDark?: (prefer: boolean) => void;
}

export const ThemePresetStrip: React.FC<ThemePresetStripProps> = ({
  onPreview,
  onPreferDark,
}) => {
  const [activeId, setActiveId] = useState(
    () => localStorage.getItem('themePresetId') || 'reason-rack',
  );

  return (
    <div className={styles.strip}>
      <p className={styles.hint}>
        Rack presets (
        <SiteBrandingLink brand="macroverse">Macroverse</SiteBrandingLink>
        -style). Click to apply instantly; syncs to the server automatically. By{' '}
        <SiteBrandingLink brand="artbastard">aday.net.au</SiteBrandingLink>.
      </p>
      <div className={styles.chips}>
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`${styles.chip} ${activeId === preset.id ? styles.chipActive : ''}`}
            title={preset.description}
            onClick={() => {
              setActiveId(preset.id);
              localStorage.setItem('themePresetId', preset.id);
              if (preset.preferDark !== undefined) {
                onPreferDark?.(preset.preferDark);
              }
              const colors = applyThemePreset(preset);
              onPreview(colors);
            }}
          >
            <span className={styles.swatch} style={{ background: preset.rack.rkAccent }} />
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
};
