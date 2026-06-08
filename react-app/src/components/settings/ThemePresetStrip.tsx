import React, { useMemo, useState } from 'react';
import { THEME_PRESETS, applyThemePreset, type ThemeColorsHsl } from '../../utils/themeUtils';
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

  const { darkPresets, lightPresets } = useMemo(() => {
    const dark = THEME_PRESETS.filter((p) => p.preferDark !== false);
    const light = THEME_PRESETS.filter((p) => p.preferDark === false);
    return { darkPresets: dark, lightPresets: light };
  }, []);

  const handlePick = (preset: typeof THEME_PRESETS[number]) => {
    setActiveId(preset.id);
    localStorage.setItem('themePresetId', preset.id);
    if (preset.preferDark !== undefined) {
      onPreferDark?.(preset.preferDark);
    }
    const colors = applyThemePreset(preset);
    onPreview(colors);
  };

  const renderChip = (preset: typeof THEME_PRESETS[number]) => (
    <button
      key={preset.id}
      type="button"
      className={`${styles.chip} ${activeId === preset.id ? styles.chipActive : ''}`}
      title={preset.description}
      onClick={() => handlePick(preset)}
    >
      <span className={styles.swatch} style={{ background: preset.rack.rkAccent }} />
      <span className={styles.chipLabel}>{preset.name}</span>
    </button>
  );

  return (
    <div className={styles.strip}>
      <div className={styles.heading}>
        <h4 className={styles.headingTitle}>Built-in presets</h4>
        <p className={styles.hint}>
          Click a preset to apply instantly. Selection syncs to the server and is restored on next launch.
        </p>
      </div>

      {darkPresets.length > 0 && (
        <div className={styles.group}>
          <span className={styles.groupLabel}>Dark</span>
          <div className={styles.chips}>{darkPresets.map(renderChip)}</div>
        </div>
      )}

      {lightPresets.length > 0 && (
        <div className={styles.group}>
          <span className={styles.groupLabel}>Light</span>
          <div className={styles.chips}>{lightPresets.map(renderChip)}</div>
        </div>
      )}
    </div>
  );
};
