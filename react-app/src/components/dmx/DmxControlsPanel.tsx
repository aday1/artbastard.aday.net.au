import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import styles from '../pages/DmxChannelControlPage.module.scss';

type ViewMode = 'grid' | 'list' | 'compact';
type ChannelFilter = 'all' | 'active' | 'selected' | 'range' | 'selectedFixtures';

interface DmxControlsPanelProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  channelsPerRow: number;
  onChannelsPerRowChange: (count: number) => void;
  filter: ChannelFilter;
  onFilterChange: (filter: ChannelFilter) => void;
  selectedFixturesCount: number;
  selectedChannelsCount: number;
  range: { start: number; end: number };
  onRangeChange: (range: { start: number; end: number }) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onShowSelectedOnly: () => void;
  onSelectAllChannels: () => void;
  onDeselectAllChannels: () => void;
  channelsPerPage: number;
  onChannelsPerPageChange: (value: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (direction: 'first' | 'prev' | 'next' | 'last') => void;
  showSceneControls: boolean;
  onToggleSceneControls: () => void;
  showMidiControls: boolean;
  onToggleMidiControls: () => void;
  showOscControls: boolean;
  onToggleOscControls: () => void;
  showEnvelopeAutomation: boolean;
  onToggleEnvelopeAutomation: () => void;
  showTransitionTracker: boolean;
  onToggleTransitionTracker: () => void;
  showActiveChannelTracker: boolean;
  onToggleActiveChannelTracker: () => void;
  hideUnusedChannels: boolean;
  hiddenUnusedCount: number;
  onToggleHideUnusedChannels: () => void;
  showGlobalChannelNames: boolean;
  onToggleGlobalChannelNames: () => void;
}

export const DmxControlsPanel: React.FC<DmxControlsPanelProps> = ({
  viewMode,
  onViewModeChange,
  channelsPerRow,
  onChannelsPerRowChange,
  filter,
  onFilterChange,
  selectedFixturesCount,
  selectedChannelsCount,
  range,
  onRangeChange,
  searchTerm,
  onSearchTermChange,
  onShowSelectedOnly,
  onSelectAllChannels,
  onDeselectAllChannels,
  channelsPerPage,
  onChannelsPerPageChange,
  currentPage,
  totalPages,
  onPageChange,
  showSceneControls,
  onToggleSceneControls,
  showMidiControls,
  onToggleMidiControls,
  showOscControls,
  onToggleOscControls,
  showEnvelopeAutomation,
  onToggleEnvelopeAutomation,
  showTransitionTracker,
  onToggleTransitionTracker,
  showActiveChannelTracker,
  onToggleActiveChannelTracker,
  hideUnusedChannels,
  hiddenUnusedCount,
  onToggleHideUnusedChannels,
  showGlobalChannelNames,
  onToggleGlobalChannelNames,
}) => {
  return (
    <div className={styles.controlsPanel}>
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>View Mode</label>
        <div className={styles.viewModeButtons}>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => onViewModeChange('grid')}
          >
            <LucideIcon name="Grid3X3" />
            Grid
          </button>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => onViewModeChange('list')}
          >
            <LucideIcon name="List" />
            List
          </button>
          <button
            className={`${styles.viewModeButton} ${viewMode === 'compact' ? styles.active : ''}`}
            onClick={() => onViewModeChange('compact')}
          >
            <LucideIcon name="Minimize2" />
            Compact
          </button>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor="dmx-channels-per-row">
          Channels per row
        </label>
        <div className={styles.channelsPerRowRow}>
          <input
            id="dmx-channels-per-row"
            type="number"
            min={0}
            max={128}
            step={1}
            value={channelsPerRow}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChannelsPerRowChange(0);
                return;
              }
              const n = parseInt(raw, 10);
              if (!Number.isNaN(n)) onChannelsPerRowChange(n);
            }}
            className={styles.channelsPerRowInput}
            disabled={viewMode === 'list'}
            title={
              viewMode === 'list'
                ? 'List view uses one column only'
                : '0 = auto fit width. Enter 4, 8, 16, 24… for fixed columns (up to 128).'
            }
          />
          <button
            type="button"
            className={`${styles.channelsPerRowPreset} ${channelsPerRow === 0 ? styles.active : ''}`}
            disabled={viewMode === 'list'}
            onClick={() => onChannelsPerRowChange(0)}
            title="Fit as many columns as the window allows"
          >
            Auto
          </button>
        </div>
        <div className={styles.channelsPerRowPresets}>
          {[4, 8, 12, 16, 24, 32].map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.channelsPerRowPreset} ${channelsPerRow === n ? styles.active : ''}`}
              disabled={viewMode === 'list'}
              onClick={() => onChannelsPerRowChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <span className={styles.channelsPerRowHint}>
          {viewMode === 'list'
            ? 'List view: one column only.'
            : '0 = auto. Type any count up to 128 (e.g. 4 or 8 on normal screens, 24+ ultrawide).'}
        </span>
      </div>

      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>Filter</label>
        <div className={styles.filterControls}>
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as ChannelFilter)}
            className={styles.filterSelect}
          >
            <option value="all">All Channels</option>
            <option value="active">Active Only</option>
            <option value="selected">Selected Channels Only</option>
            <option value="selectedFixtures" disabled={selectedFixturesCount === 0}>
              {selectedFixturesCount > 0
                ? `Selected Fixtures (${selectedFixturesCount})`
                : 'Selected Fixtures (none selected)'}
            </option>
            <option value="range">Range</option>
          </select>

          <button
            className={`${styles.activeSelectionsButton} ${hideUnusedChannels ? styles.active : ''}`}
            onClick={onToggleHideUnusedChannels}
            title="Keep fixture-assigned, active, selected, pinned, named, MIDI, and OSC channels visible. Toggle off to open the full 512-channel strip."
          >
            <LucideIcon name={hideUnusedChannels ? 'EyeOff' : 'Eye'} />
            {hideUnusedChannels
              ? `Unused hidden (${hiddenUnusedCount})`
              : 'All channels open'}
          </button>

          <button
            onClick={onShowSelectedOnly}
            className={`${styles.activeSelectionsButton} ${filter === 'selected' ? styles.active : ''}`}
            disabled={selectedChannelsCount === 0}
            title={`Show ${selectedChannelsCount} selected channel${selectedChannelsCount !== 1 ? 's' : ''}`}
          >
            <LucideIcon name="CheckSquare" />
            Active Selections ({selectedChannelsCount})
          </button>

          {filter === 'range' && (
            <div className={styles.rangeInputs}>
              <input
                type="number"
                min="1"
                max="512"
                value={range.start}
                onChange={(e) => onRangeChange({ ...range, start: parseInt(e.target.value, 10) || 1 })}
                className={styles.rangeInput}
              />
              <span>-</span>
              <input
                type="number"
                min="1"
                max="512"
                value={range.end}
                onChange={(e) => onRangeChange({ ...range, end: parseInt(e.target.value, 10) || 512 })}
                className={styles.rangeInput}
              />
            </div>
          )}

          <div className={styles.searchInput}>
            <LucideIcon name="Search" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className={styles.searchField}
            />
          </div>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>Selection</label>
        <div className={styles.selectionControls}>
          <button onClick={onSelectAllChannels} className={styles.selectionButton}>
            <LucideIcon name="CheckSquare" />
            Select All
          </button>
          <button onClick={onDeselectAllChannels} className={styles.selectionButton}>
            <LucideIcon name="Square" />
            Deselect All
          </button>
          <span className={styles.selectionCount}>{selectedChannelsCount} selected</span>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>Pagination</label>
        <div className={styles.paginationControls}>
          <select
            value={channelsPerPage}
            onChange={(e) => onChannelsPerPageChange(parseInt(e.target.value, 10))}
            className={styles.pageSizeSelect}
          >
            <option value={8}>8 per page</option>
            <option value={16}>16 per page</option>
            <option value={32}>32 per page</option>
            <option value={64}>64 per page</option>
            <option value={128}>128 per page</option>
          </select>

          <div className={styles.pageNavigation}>
            <button
              onClick={() => onPageChange('first')}
              disabled={currentPage === 0}
              className={styles.pageButton}
            >
              <LucideIcon name="ChevronsLeft" />
            </button>
            <button
              onClick={() => onPageChange('prev')}
              disabled={currentPage === 0}
              className={styles.pageButton}
            >
              <LucideIcon name="ChevronLeft" />
            </button>
            <span className={styles.pageInfo}>
              {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange('next')}
              disabled={currentPage >= totalPages - 1}
              className={styles.pageButton}
            >
              <LucideIcon name="ChevronRight" />
            </button>
            <button
              onClick={() => onPageChange('last')}
              disabled={currentPage >= totalPages - 1}
              className={styles.pageButton}
            >
              <LucideIcon name="ChevronsRight" />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>Display Options</label>
        <div className={styles.toggleControls}>
          <button
            className={`${styles.toggleButton} ${showSceneControls ? styles.active : ''}`}
            onClick={onToggleSceneControls}
          >
            <LucideIcon name="Camera" />
            Scene Controls
          </button>
          <button
            className={`${styles.toggleButton} ${showMidiControls ? styles.active : ''}`}
            onClick={onToggleMidiControls}
            title="Super-Control / MIDI I/O panel (collapsed by default)"
          >
            <LucideIcon name="Music" />
            MIDI I/O
          </button>
          <button
            className={`${styles.toggleButton} ${showOscControls ? styles.active : ''}`}
            onClick={onToggleOscControls}
          >
            <LucideIcon name="Globe" />
            OSC Controls
          </button>
          <button
            className={`${styles.toggleButton} ${showEnvelopeAutomation ? styles.active : ''}`}
            onClick={onToggleEnvelopeAutomation}
            title="Show or hide the envelope editor"
          >
            <LucideIcon name="Activity" />
            Envelopes
          </button>
          <button
            className={`${styles.toggleButton} ${showTransitionTracker ? styles.active : ''}`}
            onClick={onToggleTransitionTracker}
            title="Show or hide the DMX transition pattern tracker"
          >
            <LucideIcon name="Grid3X3" />
            Pattern Tracker
          </button>
          <button
            className={`${styles.toggleButton} ${showActiveChannelTracker ? styles.active : ''}`}
            onClick={onToggleActiveChannelTracker}
            title="Show or hide the live active-channel tracker strip"
          >
            <LucideIcon name="BarChart3" />
            Activity Tracker
          </button>
          <button
            className={`${styles.toggleButton} ${showGlobalChannelNames ? styles.active : ''}`}
            onClick={onToggleGlobalChannelNames}
          >
            <LucideIcon name="Tag" />
            Channel Names
          </button>
        </div>
      </div>
    </div>
  );
};
