import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { useTheme } from '../../context/ThemeContext';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './GlobalChannelNames.module.scss';

export const GlobalChannelNames: React.FC = () => {
  const { theme } = useTheme();
  const { channelNames, fixtures, setChannelName } = useStore(state => ({
    channelNames: state.channelNames,
    fixtures: state.fixtures,
    setChannelName: state.setChannelName
  }));

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRange, setFilterRange] = useState({ start: 1, end: 512 });
  const [editingChannel, setEditingChannel] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Get fixture info for channels
  const getFixtureInfo = (channelIndex: number) => {
    for (const fixture of fixtures) {
      const startAddress = fixture.startAddress - 1; // Convert to 0-based
      const endAddress = startAddress + fixture.channels.length;
      if (channelIndex >= startAddress && channelIndex < endAddress) {
        const channelOffset = channelIndex - startAddress;
        return {
          fixtureName: fixture.name,
          channelFunction: fixture.channels[channelOffset]?.name || 'Unknown',
          channelType: fixture.channels[channelOffset]?.type || 'Unknown'
        };
      }
    }
    return null;
  };

  // Filter channels based on search and range
  const filteredChannels = useMemo(() => {
    const channels = Array.from({ length: 512 }, (_, i) => i);
    return channels.filter(channelIndex => {
      // Range filter
      if (channelIndex + 1 < filterRange.start || channelIndex + 1 > filterRange.end) {
        return false;
      }
      
      // Search filter
      if (searchTerm) {
        const channelName = channelNames[channelIndex] || `CH ${channelIndex + 1}`;
        const fixtureInfo = getFixtureInfo(channelIndex);
        const searchLower = searchTerm.toLowerCase();
        
        return (
          channelName.toLowerCase().includes(searchLower) ||
          (channelIndex + 1).toString().includes(searchTerm) ||
          (fixtureInfo?.fixtureName.toLowerCase().includes(searchLower)) ||
          (fixtureInfo?.channelFunction.toLowerCase().includes(searchLower))
        );
      }
      
      return true;
    });
  }, [searchTerm, filterRange, channelNames, fixtures]);

  const handleStartEdit = (channelIndex: number) => {
    setEditingChannel(channelIndex);
    setEditingValue(channelNames[channelIndex] || '');
  };

  const handleSave = (channelIndex: number) => {
    setChannelName(channelIndex, editingValue.trim());
    setEditingChannel(null);
    setEditingValue('');
  };

  const handleCancel = () => {
    setEditingChannel(null);
    setEditingValue('');
  };

  const handleBulkSet = () => {
    const prefix = prompt('Enter prefix for channel names (e.g., "LED", "PAR"):');
    if (!prefix) return;
    
    const start = parseInt(prompt('Start channel number:') || '1');
    const end = parseInt(prompt('End channel number:') || '512');
    
    if (isNaN(start) || isNaN(end) || start < 1 || end > 512 || start > end) {
      alert('Invalid range');
      return;
    }

    for (let i = start - 1; i < end; i++) {
      setChannelName(i, `${prefix} ${i + 1}`);
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all custom channel names? This will reset all channels to default names.')) {
      for (let i = 0; i < 512; i++) {
        setChannelName(i, '');
      }
    }
  };

  return (
    <div className={styles.globalChannelNames}>
      <div className={styles.header}>
        <h2>
          <LucideIcon name="Tag" />
          {theme === 'artsnob' && 'Global Channel Names: The Identity of Light'}
          {theme === 'standard' && 'Global Channel Names'}
          {theme === 'minimal' && 'Channel Names'}
        </h2>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <LucideIcon name="Search" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.rangeFilter}>
          <label>Range:</label>
          <input
            type="number"
            min="1"
            max="512"
            value={filterRange.start}
            onChange={(e) => setFilterRange(prev => ({ ...prev, start: parseInt(e.target.value) || 1 }))}
            className={styles.rangeInput}
          />
          <span>to</span>
          <input
            type="number"
            min="1"
            max="512"
            value={filterRange.end}
            onChange={(e) => setFilterRange(prev => ({ ...prev, end: parseInt(e.target.value) || 512 }))}
            className={styles.rangeInput}
          />
        </div>

        <div className={styles.bulkActions}>
          <button onClick={handleBulkSet} className={styles.bulkButton}>
            <LucideIcon name="Edit" />
            Bulk Set
          </button>
          <button onClick={handleClearAll} className={styles.clearButton}>
            <LucideIcon name="X" />
            Clear All
          </button>
        </div>
      </div>

      <div className={styles.channelsList}>
        <div className={styles.listHeader}>
          <span>Channel</span>
          <span>Fixture Info</span>
          <span>Custom Name</span>
          <span>Actions</span>
        </div>

        <div className={styles.channelsGrid}>
          {filteredChannels.map(channelIndex => {
            const fixtureInfo = getFixtureInfo(channelIndex);
            const currentName = channelNames[channelIndex] || '';
            const isEditing = editingChannel === channelIndex;

            return (
              <div key={channelIndex} className={styles.channelRow}>
                <div className={styles.channelNumber}>
                  CH {channelIndex + 1}
                </div>

                <div className={styles.fixtureInfo}>
                  {fixtureInfo ? (
                    <div className={styles.fixtureDetails}>
                      <span className={styles.fixtureName}>{fixtureInfo.fixtureName}</span>
                      <span className={styles.channelFunction}>{fixtureInfo.channelFunction}</span>
                      <span className={styles.channelType}>({fixtureInfo.channelType})</span>
                    </div>
                  ) : (
                    <span className={styles.noFixture}>No fixture</span>
                  )}
                </div>

                <div className={styles.nameCell}>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleSave(channelIndex)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSave(channelIndex);
                        } else if (e.key === 'Escape') {
                          handleCancel();
                        }
                      }}
                      autoFocus
                      className={styles.nameInput}
                      placeholder={`CH ${channelIndex + 1}`}
                    />
                  ) : (
                    <span 
                      className={styles.channelName}
                      onClick={() => handleStartEdit(channelIndex)}
                      title="Click to edit"
                    >
                      {currentName || <em>CH {channelIndex + 1}</em>}
                    </span>
                  )}
                </div>

                <div className={styles.actions}>
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(channelIndex)}
                      className={styles.editButton}
                      title="Edit name"
                    >
                      <LucideIcon name="Edit" size={14} />
                    </button>
                  )}
                  {currentName && (
                    <button
                      onClick={() => {
                        setChannelName(channelIndex, '');
                      }}
                      className={styles.clearButton}
                      title="Clear name"
                    >
                      <LucideIcon name="X" size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <span>Showing {filteredChannels.length} of 512 channels</span>
        {searchTerm && <span>• Filtered by: "{searchTerm}"</span>}
      </div>
    </div>
  );
};

