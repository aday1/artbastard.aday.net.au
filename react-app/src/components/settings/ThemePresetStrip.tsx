import React, { useMemo, useState } from 'react';
import { THEME_PRESETS, applyThemePreset, type ThemeColorsHsl, type ThemePreset } from '../../utils/themeUtils';
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

  const handlePick = (preset: ThemePreset) => {
    setActiveId(preset.id);
    localStorage.setItem('themePresetId', preset.id);
    if (preset.preferDark !== undefined) {
      onPreferDark?.(preset.preferDark);
    }
    const colors = applyThemePreset(preset);
    onPreview(colors);
  };

  const hsl = (hue: number, saturation: number, brightness: number) =>
    `hsl(${hue}, ${saturation}%, ${brightness}%)`;

  const paletteForPreset = (preset: ThemePreset) => [
    {
      label: 'Primary',
      color: hsl(preset.colors.primaryHue, preset.colors.primarySaturation, preset.colors.primaryBrightness),
    },
    {
      label: 'Secondary',
      color: hsl(preset.colors.secondaryHue, preset.colors.secondarySaturation, preset.colors.secondaryBrightness),
    },
    {
      label: 'Accent',
      color: hsl(preset.colors.accentHue, preset.colors.accentSaturation, preset.colors.accentBrightness),
    },
    {
      label: 'Surface',
      color: preset.rack.rkPanel,
    },
  ];

  const renderPresetCard = (preset: ThemePreset, modeLabel: 'Dark' | 'Light') => (
    <button
      key={preset.id}
      type="button"
      className={`${styles.presetCard} ${activeId === preset.id ? styles.presetCardActive : ''}`}
      title={preset.description}
      aria-pressed={activeId === preset.id}
      onClick={() => handlePick(preset)}
    >
      <span className={styles.paletteBar} aria-hidden="true">
        {paletteForPreset(preset).map((swatch) => (
          <span
            key={swatch.label}
            className={styles.paletteSwatch}
            style={{ background: swatch.color }}
          />
        ))}
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardTitleRow}>
          <strong>{preset.name}</strong>
          <em>{modeLabel}</em>
        </span>
        {preset.description && <small>{preset.description}</small>}
      </span>
    </button>
  );

  return (
    <div className={styles.strip}>
      <div className={styles.heading}>
        <h4 className={styles.headingTitle}>Built-in presets</h4>
        <p className={styles.hint}>Pick by palette, then fine-tune below.</p>
      </div>

      {darkPresets.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupLabel}>Dark</span>
            <span>{darkPresets.length} presets</span>
          </div>
          <div className={styles.presetGrid}>
            {darkPresets.map((preset) => renderPresetCard(preset, 'Dark'))}
          </div>
        </div>
      )}

      {lightPresets.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupLabel}>Light</span>
            <span>{lightPresets.length} preset</span>
          </div>
          <div className={styles.presetGrid}>
            {lightPresets.map((preset) => renderPresetCard(preset, 'Light'))}
          </div>
        </div>
      )}
    </div>
  );
};
