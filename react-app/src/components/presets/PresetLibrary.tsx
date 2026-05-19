/**
 * Preset Library Component
 * Main UI for managing and using presets
 */

import React, { useState, useMemo } from 'react';
import { usePresetStore } from '../../store/presetStore';
import { useStore } from '../../store';
import { getButtonAriaLabel, announceToScreenReader } from '../../utils/accessibility';
import styles from './PresetLibrary.module.scss';

const PresetLibrary: React.FC = () => {
  const {
    presets,
    categories,
    addPreset,
    updatePreset,
    deletePreset,
    toggleFavorite,
    getPresetsByCategory,
    getFavorites,
    exportPresets,
    importPresets
  } = usePresetStore();

  const setMultipleDmxChannels = useStore(state => state.setMultipleDmxChannels);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get filtered presets
  const filteredPresets = useMemo(() => {
    let filtered = presets;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    return filtered;
  }, [presets, selectedCategory, searchQuery]);

  // Apply preset
  const applyPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setMultipleDmxChannels(preset.dmxValues, true);
      announceToScreenReader(`Applied preset ${preset.name}`);
    }
  };

  // Create preset from current DMX state
  const createPresetFromCurrent = () => {
    const dmxChannels = useStore.getState().dmxChannels;
    const dmxValues: Record<number, number> = {};
    dmxChannels.forEach((value, index) => {
      if (value > 0) {
        dmxValues[index] = value;
      }
    });

    const name = prompt('Enter preset name:');
    if (!name) return;

    const category = prompt('Enter category (or press Enter for "custom"):') || 'custom';
    
    addPreset({
      name,
      category,
      dmxValues,
      tags: [],
      isFavorite: false
    });
  };

  // Handle import
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = event.target?.result as string;
            importPresets(json);
          } catch (error) {
            alert('Failed to import presets: ' + (error instanceof Error ? error.message : 'Unknown error'));
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Handle export
  const handleExport = () => {
    const presetsData = exportPresets();
    const json = JSON.stringify(presetsData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artbastard-presets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.presetLibrary}>
      <div className={styles.header}>
        <h2>Preset Library</h2>
        <div className={styles.headerActions}>
          <button
            className={styles.createButton}
            onClick={createPresetFromCurrent}
            title="Create preset from current DMX state"
            aria-label={getButtonAriaLabel('Create preset', 'from current DMX state')}
          >
            <i className="fas fa-plus" aria-hidden="true"></i>
            Create from Current
          </button>
          <button
            className={styles.importButton}
            onClick={handleImport}
            title="Import presets from file"
            aria-label={getButtonAriaLabel('Import presets', 'from file')}
          >
            <i className="fas fa-upload" aria-hidden="true"></i>
            Import
          </button>
          <button
            className={styles.exportButton}
            onClick={handleExport}
            title="Export all presets"
            aria-label={getButtonAriaLabel('Export', 'all presets')}
          >
            <i className="fas fa-download" aria-hidden="true"></i>
            Export
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              className={styles.clearSearch}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className={styles.categoryFilters}>
          {categories.map(category => (
            <button
              key={category.id}
              className={`${styles.categoryButton} ${selectedCategory === category.id ? styles.active : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
              style={{ borderLeftColor: category.color }}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.presetsGrid}>
        {filteredPresets.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="fas fa-inbox"></i>
            <p>No presets found</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>Clear search</button>
            )}
          </div>
        ) : (
          filteredPresets.map(preset => (
            <div key={preset.id} className={styles.presetCard}>
              <div className={styles.presetHeader}>
                <h3>{preset.name}</h3>
                <button
                  className={`${styles.favoriteButton} ${preset.isFavorite ? styles.favorited : ''}`}
                  onClick={() => toggleFavorite(preset.id)}
                  aria-label={preset.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <i className={`fas fa-star ${preset.isFavorite ? 'fas' : 'far'}`}></i>
                </button>
              </div>
              
              {preset.description && (
                <p className={styles.presetDescription}>{preset.description}</p>
              )}

              {preset.thumbnail && (
                <div className={styles.presetThumbnail}>
                  {preset.thumbnail.type === 'image' ? (
                    <img src={preset.thumbnail.data} alt={preset.name} />
                  ) : preset.thumbnail.type === 'color' ? (
                    <div
                      style={{ backgroundColor: preset.thumbnail.data }}
                      className={styles.colorThumbnail}
                    />
                  ) : null}
                </div>
              )}

              <div className={styles.presetMeta}>
                <span className={styles.presetCategory}>{preset.category}</span>
                <span className={styles.presetChannels}>
                  {Object.keys(preset.dmxValues).length} channels
                </span>
              </div>

              {preset.tags && preset.tags.length > 0 && (
                <div className={styles.presetTags}>
                  {preset.tags.map(tag => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}

              <div className={styles.presetActions}>
                <button
                  className={styles.applyButton}
                  onClick={() => applyPreset(preset.id)}
                  title="Apply this preset"
                  aria-label={getButtonAriaLabel('Apply preset', preset.name)}
                >
                  <i className="fas fa-play" aria-hidden="true"></i>
                  Apply
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => {
                    if (confirm(`Delete preset "${preset.name}"?`)) {
                      deletePreset(preset.id);
                      announceToScreenReader(`Deleted preset ${preset.name}`);
                    }
                  }}
                  title="Delete preset"
                  aria-label={getButtonAriaLabel('Delete preset', preset.name)}
                >
                  <i className="fas fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PresetLibrary;

