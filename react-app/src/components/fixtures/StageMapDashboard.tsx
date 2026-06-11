import React, { useMemo } from 'react';
import { useStore } from '../../store';
import { getFixtureTypeColor, getFixtureTypeIcon } from '../../utils/fixturePresentation';
import { normalizeFixtureLayout, STAGE_MAP_HEIGHT, STAGE_MAP_WIDTH } from '../../fixtures/stageMap';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './StageMapDashboard.module.scss';

interface StageMapDashboardProps {
  title?: string;
  subtitle?: string;
  highlightGroupId?: string | null;
  highlightFixtureIds?: string[];
  highlightLabel?: string | null;
  onSelectGroup?: (groupId: string) => void;
  showGroupPicker?: boolean;
  maxGroupChips?: number;
  /**
   * Optional DMX snapshot to render instead of the live channel feed.
   * Use for scene previews and act-timeline hover previews so the
   * miniature reflects the scene's stored values, not the current bus.
   */
  dmxOverride?: number[];
}

export const StageMapDashboard: React.FC<StageMapDashboardProps> = ({
  title = 'Live Stage Map',
  subtitle,
  highlightGroupId = null,
  highlightFixtureIds = [],
  highlightLabel = null,
  onSelectGroup,
  showGroupPicker = true,
  maxGroupChips = 8,
  dmxOverride,
}) => {
  const { fixtures, fixtureLayout, groups, selectedFixtures, dmxChannels: liveDmxChannels, setSelectedFixtures } = useStore(
    (s) => ({
      fixtures: s.fixtures,
      fixtureLayout: s.fixtureLayout,
      groups: s.groups,
      selectedFixtures: s.selectedFixtures,
      dmxChannels: s.dmxChannels,
      setSelectedFixtures: s.setSelectedFixtures,
    })
  );

  const dmxChannels = dmxOverride ?? liveDmxChannels;

  const layout = useMemo(
    () => normalizeFixtureLayout(fixtures, fixtureLayout),
    [fixtures, fixtureLayout]
  );
  const selectedIdSet = useMemo(() => new Set(selectedFixtures), [selectedFixtures]);

  const highlightedIndices = useMemo(() => {
    const indices = new Set<number>();
    if (highlightGroupId) {
      const g = groups.find((group) => group.id === highlightGroupId);
      (g?.fixtureIndices || []).forEach((idx) => indices.add(idx));
    }
    highlightFixtureIds.forEach((fixtureId) => {
      const idx = fixtures.findIndex((fixture) => fixture.id === fixtureId);
      if (idx >= 0) indices.add(idx);
    });
    return indices;
  }, [fixtures, groups, highlightFixtureIds, highlightGroupId]);

  const activeCount = useMemo(() => {
    if (!dmxChannels?.length) return 0;
    return fixtures.filter((fixture) =>
      fixture.channels.some((_, i) => (dmxChannels[fixture.startAddress + i - 1] || 0) > 0)
    ).length;
  }, [dmxChannels, fixtures]);

  const handleFixtureClick = (event: React.MouseEvent, fixtureId: string) => {
    event.stopPropagation();
    if (event.shiftKey) {
      setSelectedFixtures(
        selectedFixtures.includes(fixtureId)
          ? selectedFixtures.filter((id) => id !== fixtureId)
          : [...selectedFixtures, fixtureId]
      );
    } else {
      setSelectedFixtures([fixtureId]);
    }
  };

  const handleGroupClick = (groupId: string, indices: number[]) => {
    const ids = indices
      .map((idx) => fixtures[idx]?.id)
      .filter((id): id is string => Boolean(id));
    setSelectedFixtures(ids);
    onSelectGroup?.(groupId);
  };

  const subtitleText =
    subtitle ?? `${fixtures.length} fixtures · ${selectedFixtures.length} selected · ${activeCount} lit`;
  const apcHighlightText = highlightLabel || (highlightedIndices.size > 0 ? `${highlightedIndices.size} APC-targeted` : null);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <strong>{title}</strong>
          <span>{subtitleText}</span>
          {apcHighlightText && <em className={styles.apcTargetLabel}>APC target: {apcHighlightText}</em>}
        </div>
        {selectedFixtures.length > 0 && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => setSelectedFixtures([])}
            title="Clear selection"
          >
            <LucideIcon name="X" size={13} />
            Clear
          </button>
        )}
      </div>

      <div className={styles.viewport}>
        <div
          className={styles.surface}
          onClick={() => setSelectedFixtures([])}
          role="application"
          aria-label="Live stage map dashboard"
        >
          {fixtures.length === 0 ? (
            <div className={styles.empty}>
              <LucideIcon name="MapPin" size={28} />
              <span>No fixtures patched yet</span>
              <small>Patch fixtures in the stage map above to see them here.</small>
            </div>
          ) : (
            layout.map((item) => {
              const fixture = fixtures.find((f) => f.id === item.fixtureId);
              if (!fixture) return null;
              const fixtureIndex = fixtures.findIndex((f) => f.id === item.fixtureId);
              const color = getFixtureTypeColor(fixture.type);
              const icon = getFixtureTypeIcon(fixture.type) as any;
              const selected = selectedIdSet.has(fixture.id);
              const apcHighlighted = highlightedIndices.has(fixtureIndex);
              const isLit = fixture.channels.some(
                (_, i) => (dmxChannels?.[fixture.startAddress + i - 1] || 0) > 0
              );
              return (
                <button
                  key={item.fixtureId}
                  type="button"
                  className={[
                    styles.node,
                    selected ? styles.selected : '',
                    apcHighlighted ? styles.apcHighlight : '',
                    isLit ? styles.lit : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    ['--fixture-color' as any]: color,
                    left: `${(item.x / STAGE_MAP_WIDTH) * 100}%`,
                    top: `${(item.y / STAGE_MAP_HEIGHT) * 100}%`,
                  }}
                  onClick={(e) => handleFixtureClick(e, fixture.id)}
                  title={`${fixture.name} · DMX ${fixture.startAddress}${isLit ? ' · LIVE' : ''}`}
                >
                  <LucideIcon name={icon} size={13} />
                  <span className={styles.nodeName}>{fixture.name}</span>
                  <span className={styles.nodeAddr}>{fixture.startAddress}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {showGroupPicker && groups.length > 0 && (
        <div className={styles.groupPicker} aria-label="Quick group select">
          <span className={styles.groupPickerLabel}>Groups:</span>
          <div className={styles.groupChips}>
            {groups.slice(0, maxGroupChips).map((group) => {
              const ids = group.fixtureIndices
                .map((idx) => fixtures[idx]?.id)
                .filter((id): id is string => Boolean(id));
              const allSelected = ids.length > 0 && ids.every((id) => selectedIdSet.has(id));
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`${styles.groupChip} ${allSelected ? styles.groupChipActive : ''}`}
                  onClick={() => handleGroupClick(group.id, group.fixtureIndices)}
                  title={`Select ${group.name} (${group.fixtureIndices.length} fixtures)`}
                >
                  {group.name}
                  <em>{group.fixtureIndices.length}</em>
                </button>
              );
            })}
            {groups.length > maxGroupChips && (
              <span className={styles.groupOverflow}>+{groups.length - maxGroupChips} more</span>
            )}
          </div>
        </div>
      )}

      <div className={styles.legend}>
        <span><i className={styles.legendDotSelected} /> Selected</span>
        <span><i className={styles.legendDotLit} /> Live DMX</span>
        {highlightedIndices.size > 0 && <span><i className={styles.legendDotApc} /> APC target</span>}
      </div>
    </div>
  );
};

export default StageMapDashboard;
