import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import styles from '../pages/DmxChannelControlPage.module.scss';

type FixtureFilter = 'all' | 'active' | 'byType' | 'byRange';

interface DmxFixtureSelectorProps {
  fixtures: any[];
  groups: any[];
  selectedFixtures: string[];
  setSelectedFixtures: (ids: string[]) => void;
  toggleFixtureSelection: (fixtureId: string) => void;
  showFixtureSelector: boolean;
  setShowFixtureSelector: (show: boolean) => void;
  fixtureSelectorRef: React.RefObject<HTMLDivElement>;
  fixtureSearchTerm: string;
  setFixtureSearchTerm: (value: string) => void;
  fixtureFilter: FixtureFilter;
  setFixtureFilter: (filter: FixtureFilter) => void;
  fixtureTypeFilter: string;
  setFixtureTypeFilter: (value: string) => void;
  fixtureAddressRange: { start: number; end: number };
  setFixtureAddressRange: (range: { start: number; end: number }) => void;
  fixtureTypes: string[];
  filteredFixtures: any[];
  isFixtureActive: (fixture: any) => boolean;
  getFixtureColor: (fixtureId: string) => string;
  onFixtureContextMenu?: (event: React.MouseEvent, fixture: { id: string; name: string }) => void;
}

export const DmxFixtureSelector: React.FC<DmxFixtureSelectorProps> = ({
  fixtures,
  groups,
  selectedFixtures,
  setSelectedFixtures,
  toggleFixtureSelection,
  showFixtureSelector,
  setShowFixtureSelector,
  fixtureSelectorRef,
  fixtureSearchTerm,
  setFixtureSearchTerm,
  fixtureFilter,
  setFixtureFilter,
  fixtureTypeFilter,
  setFixtureTypeFilter,
  fixtureAddressRange,
  setFixtureAddressRange,
  fixtureTypes,
  filteredFixtures,
  isFixtureActive,
  getFixtureColor,
  onFixtureContextMenu,
}) => {
  if (fixtures.length === 0) {
    return null;
  }

  const allFilteredSelected =
    filteredFixtures.length > 0 && filteredFixtures.every((fixture) => selectedFixtures.includes(fixture.id));

  return (
    <div className={styles.fixtureSelectorContainer} ref={fixtureSelectorRef}>
      <button
        className={styles.fixtureSelectorButton}
        onClick={() => setShowFixtureSelector(!showFixtureSelector)}
      >
        <LucideIcon name="LampDesk" />
        <span>
          {selectedFixtures.length === 0
            ? 'All Fixtures'
            : selectedFixtures.length === 1
              ? fixtures.find((fixture) => fixture.id === selectedFixtures[0])?.name || 'Select Fixture'
              : `${selectedFixtures.length} Selected`}
        </span>
        {selectedFixtures.length > 0 && (
          <span className={styles.fixtureSelectorBadge}>{selectedFixtures.length}</span>
        )}
        <LucideIcon name={showFixtureSelector ? 'ChevronUp' : 'ChevronDown'} />
      </button>

      {showFixtureSelector && (
        <div className={styles.fixtureSelectorDropdown}>
          <div className={styles.fixtureSelectorSearchSection}>
            <div className={styles.fixtureSearchContainer}>
              <LucideIcon name="Search" size={18} />
              <input
                type="text"
                placeholder="Search fixtures by name, address, or type..."
                value={fixtureSearchTerm}
                onChange={(e) => setFixtureSearchTerm(e.target.value)}
                className={styles.fixtureSearchInput}
                autoFocus
              />
              {fixtureSearchTerm && (
                <button
                  onClick={() => setFixtureSearchTerm('')}
                  className={styles.fixtureSearchClear}
                  title="Clear search"
                >
                  <LucideIcon name="X" size={16} />
                </button>
              )}
            </div>

            <div className={styles.fixtureQuickFilters}>
              <button
                className={`${styles.fixtureQuickFilterButton} ${fixtureFilter === 'all' ? styles.active : ''}`}
                onClick={() => setFixtureFilter('all')}
                title="Show all fixtures"
              >
                <LucideIcon name="List" size={14} />
                All ({fixtures.length})
              </button>
              <button
                className={`${styles.fixtureQuickFilterButton} ${fixtureFilter === 'active' ? styles.active : ''}`}
                onClick={() => setFixtureFilter('active')}
                title="Show only active fixtures"
              >
                <LucideIcon name="Zap" size={14} />
                Active ({fixtures.filter((fixture) => isFixtureActive(fixture)).length})
              </button>
              {fixtureTypes.length > 0 && (
                <select
                  value={fixtureFilter === 'byType' ? fixtureTypeFilter : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setFixtureFilter('byType');
                      setFixtureTypeFilter(e.target.value);
                    } else {
                      setFixtureFilter('all');
                      setFixtureTypeFilter('');
                    }
                  }}
                  className={styles.fixtureTypeSelect}
                  title="Filter by fixture type"
                >
                  <option value="">All Types</option>
                  {fixtureTypes.map((type) => (
                    <option key={type} value={type}>
                      {type} ({fixtures.filter((fixture) => fixture.type === type).length})
                    </option>
                  ))}
                </select>
              )}
              <button
                className={`${styles.fixtureQuickFilterButton} ${fixtureFilter === 'byRange' ? styles.active : ''}`}
                onClick={() => setFixtureFilter(fixtureFilter === 'byRange' ? 'all' : 'byRange')}
                title="Filter by DMX address range"
              >
                <LucideIcon name="Filter" size={14} />
                Range
              </button>
            </div>

            {fixtureFilter === 'byRange' && (
              <div className={styles.fixtureRangeFilter}>
                <label>DMX Address Range:</label>
                <div className={styles.fixtureRangeInputs}>
                  <input
                    type="number"
                    min="1"
                    max="512"
                    value={fixtureAddressRange.start}
                    onChange={(e) => setFixtureAddressRange({ ...fixtureAddressRange, start: parseInt(e.target.value, 10) || 1 })}
                    className={styles.fixtureRangeInput}
                    placeholder="Start"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    min="1"
                    max="512"
                    value={fixtureAddressRange.end}
                    onChange={(e) => setFixtureAddressRange({ ...fixtureAddressRange, end: parseInt(e.target.value, 10) || 512 })}
                    className={styles.fixtureRangeInput}
                    placeholder="End"
                  />
                  <button
                    onClick={() => setFixtureFilter('all')}
                    className={styles.fixtureRangeClose}
                    title="Close range filter"
                  >
                    <LucideIcon name="X" size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.fixtureSelectorHeader}>
            <div className={styles.fixtureSelectorSummary}>
              {selectedFixtures.length > 0 ? (
                <>
                  <span className={styles.fixtureSelectorCount}>
                    {selectedFixtures.length} of {filteredFixtures.length} selected
                  </span>
                  <button
                    className={styles.fixtureSelectorAction}
                    onClick={() => setSelectedFixtures([])}
                    title="Clear selection"
                  >
                    <LucideIcon name="X" size={14} />
                    Clear
                  </button>
                </>
              ) : (
                <span className={styles.fixtureSelectorCount}>
                  {filteredFixtures.length} fixture{filteredFixtures.length !== 1 ? 's' : ''} available
                </span>
              )}
            </div>
            <div className={styles.fixtureSelectorActions}>
              <button
                className={styles.fixtureSelectorAction}
                onClick={() => {
                  const filteredIds = filteredFixtures.map((fixture) => fixture.id);
                  if (allFilteredSelected) {
                    setSelectedFixtures(selectedFixtures.filter((id) => !filteredIds.includes(id)));
                  } else {
                    setSelectedFixtures([...new Set([...selectedFixtures, ...filteredIds])]);
                  }
                }}
                title={allFilteredSelected ? 'Deselect filtered' : 'Select all filtered'}
              >
                <LucideIcon name={allFilteredSelected ? 'Square' : 'CheckSquare'} size={14} />
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {groups && groups.length > 0 && filteredFixtures.length > 0 && (
            <div className={styles.fixtureSelectorSection}>
              <div className={styles.fixtureSelectorSectionTitle}>
                <LucideIcon name="Users" size={16} />
                <span>Fixture Groups</span>
              </div>
              <div className={styles.fixtureSelectorGroupList}>
                {groups.map((group) => {
                  const groupFixtures = group.fixtureIndices
                    .map((index: number) => fixtures[index])
                    .filter(Boolean)
                    .filter((fixture: any) => filteredFixtures.includes(fixture));

                  if (groupFixtures.length === 0) return null;

                  const allGroupFixturesSelected =
                    groupFixtures.length > 0 && groupFixtures.every((fixture: any) => selectedFixtures.includes(fixture.id));
                  const someGroupFixturesSelected = groupFixtures.some((fixture: any) => selectedFixtures.includes(fixture.id));

                  return (
                    <button
                      key={group.id}
                      className={`${styles.fixtureSelectorGroupItem} ${allGroupFixturesSelected ? styles.selected : ''} ${someGroupFixturesSelected ? styles.partial : ''}`}
                      onClick={() => {
                        const groupIds = groupFixtures.map((fixture: any) => fixture.id);
                        if (allGroupFixturesSelected) {
                          setSelectedFixtures(selectedFixtures.filter((id) => !groupIds.includes(id)));
                        } else {
                          setSelectedFixtures([...new Set([...selectedFixtures, ...groupIds])]);
                        }
                      }}
                      title={`${allGroupFixturesSelected ? 'Deselect' : 'Select'} group: ${group.name} (${groupFixtures.length} fixtures)`}
                    >
                      <LucideIcon name="Users" size={14} />
                      <span className={styles.fixtureSelectorGroupName}>{group.name}</span>
                      <span className={styles.fixtureSelectorGroupCount}>
                        {groupFixtures.length} fixture{groupFixtures.length !== 1 ? 's' : ''}
                      </span>
                      {allGroupFixturesSelected && (
                        <LucideIcon name="Check" size={14} className={styles.fixtureCheckIcon} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredFixtures.length > 0 ? (
            <div className={styles.fixtureSelectorSection}>
              <div className={styles.fixtureSelectorSectionTitle}>
                <LucideIcon name="LampDesk" size={16} />
                <span>Fixtures ({filteredFixtures.length})</span>
              </div>
              <div className={styles.fixtureSelectorGrid}>
                {filteredFixtures.map((fixture) => {
                  const isSelected = selectedFixtures.includes(fixture.id);
                  const isActive = isFixtureActive(fixture);
                  const fixtureColor = getFixtureColor(fixture.id);
                  const channelCount = fixture.channels?.length || 0;
                  return (
                    <button
                      key={fixture.id}
                      className={`${styles.fixtureSelectorGridItem} ${isSelected ? styles.selected : ''} ${isActive ? styles.active : ''}`}
                      onClick={() => toggleFixtureSelection(fixture.id)}
                      onContextMenu={
                        onFixtureContextMenu
                          ? (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onFixtureContextMenu(e, { id: fixture.id, name: fixture.name });
                            }
                          : undefined
                      }
                      style={{
                        borderColor: isSelected ? fixtureColor : isActive ? 'rgba(245, 158, 11, 0.6)' : 'rgba(71, 85, 105, 0.5)',
                        backgroundColor: isSelected ? `${fixtureColor}20` : isActive ? 'rgba(245, 158, 11, 0.1)' : 'transparent'
                      }}
                      title={`${fixture.name} - DMX ${fixture.startAddress} (${channelCount} ch)${isActive ? ' - Active' : ''}`}
                    >
                      <div className={styles.fixtureGridHeader}>
                        <div className={styles.fixtureColorDot} style={{ backgroundColor: fixtureColor }} />
                        {isActive && (
                          <div className={styles.fixtureActiveIndicator} title="Active fixture">
                            <LucideIcon name="Zap" size={12} />
                          </div>
                        )}
                        {isSelected && (
                          <LucideIcon name="Check" size={16} className={styles.fixtureCheckIcon} />
                        )}
                      </div>
                      <div className={styles.fixtureGridInfo}>
                        <div className={styles.fixtureName}>{fixture.name}</div>
                        <div className={styles.fixtureGridDetails}>
                          <span className={styles.fixtureAddress}>DMX {fixture.startAddress}</span>
                          <span className={styles.fixtureChannelCount}>{channelCount} ch</span>
                          {fixture.type && <span className={styles.fixtureType}>{fixture.type}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={styles.fixtureSelectorEmpty}>
              <LucideIcon name="SearchX" size={32} />
              <p>No fixtures match your search or filters</p>
              <button
                className={styles.fixtureSelectorAction}
                onClick={() => {
                  setFixtureSearchTerm('');
                  setFixtureFilter('all');
                  setFixtureTypeFilter('');
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
