import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { MidiLearnButton } from '../midi/MidiLearnButton';
import styles from './DmxChannelEditor.module.scss';

interface DmxChannelEditorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChannels?: number[];
  onChannelsChange?: (channels: number[]) => void;
}

interface ChannelGroup {
  id: string;
  name: string;
  channels: number[];
  color: string;
}

export const DmxChannelEditor: React.FC<DmxChannelEditorProps> = ({
  isOpen,
  onClose,
  selectedChannels = [],
  onChannelsChange
}) => {
  const {
    dmxChannels,
    channelNames,
    selectedChannels: globalSelectedChannels,
    toggleChannelSelection,
    setDmxChannel,
    oscAssignments,
    setOscAssignment,
    oscActivity,
    fixtures,
    groups
  } = useStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'groups'>('grid');
  const [filterText, setFilterText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [localSelectedChannels, setLocalSelectedChannels] = useState<number[]>(selectedChannels);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [masterFader, setMasterFader] = useState(255);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Update local selection when prop changes
  useEffect(() => {
    setLocalSelectedChannels(selectedChannels);
  }, [selectedChannels]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onChannelsChange) {
      onChannelsChange(localSelectedChannels);
    }
  }, [localSelectedChannels, onChannelsChange]);

  // Create channel groups based on fixtures
  const channelGroups: ChannelGroup[] = React.useMemo(() => {
    const groups: ChannelGroup[] = [];
    const usedChannels = new Set<number>();

    // Add fixture-based groups
    fixtures.forEach((fixture, index) => {
      if (fixture.startAddress && fixture.channels) {
        const channels: number[] = [];
        for (let i = 0; i < fixture.channels.length; i++) {
          const channelIndex = fixture.startAddress - 1 + i;
          if (channelIndex >= 0 && channelIndex < 512) {
            channels.push(channelIndex);
            usedChannels.add(channelIndex);
          }
        }

        if (channels.length > 0) {
          groups.push({
            id: `fixture-${fixture.id}`,
            name: fixture.name || `Fixture ${index + 1}`,
            channels,
            color: getFixtureColor(fixture.type)
          });
        }
      }
    });

    // Add unused channels group
    const unusedChannels: number[] = [];
    for (let i = 0; i < 512; i++) {
      if (!usedChannels.has(i)) {
        unusedChannels.push(i);
      }
    }

    if (unusedChannels.length > 0) {
      groups.push({
        id: 'unused',
        name: 'Unused Channels',
        channels: unusedChannels,
        color: '#6b7280'
      });
    }

    return groups;
  }, [fixtures]);

  const getFixtureColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      'moving-head': '#ff6b6b',
      'par': '#4ecdc4',
      'strip': '#45b7d1',
      'laser': '#96ceb4',
      'strobe': '#feca57',
      'smoke': '#a55eea',
      default: '#fd79a8',
    };
    return colorMap[type.toLowerCase()] || colorMap.default;
  };

  const getFixtureInfoForChannel = (channelIndex: number) => {
    const dmxAddress = channelIndex + 1;
    
    for (const fixture of fixtures) {
      const fixtureStartAddress = fixture.startAddress;
      const fixtureEndAddress = fixtureStartAddress + fixture.channels.length - 1;
      
      if (dmxAddress >= fixtureStartAddress && dmxAddress <= fixtureEndAddress) {
        const channelOffset = dmxAddress - fixtureStartAddress;
        const channel = fixture.channels[channelOffset];
        
        if (channel) {
          return {
            fixtureName: fixture.name,
            channelFunction: channel.name || `${channel.type} Channel`,
            channelType: channel.type,
            shortFunction: getShortFunctionName(channel.type)
          };
        }
      }
    }
    
    return null;
  };

  const getShortFunctionName = (type: string): string => {
    switch (type) {
      case 'red': case 'green': case 'blue': case 'white': case 'amber': case 'uv': 
        return type.toUpperCase();
      case 'pan': case 'tilt': return type.toUpperCase();
      case 'pan_fine': return 'PAN-F';
      case 'tilt_fine': return 'TILT-F';
      case 'dimmer': return 'DIM';
      case 'shutter': return 'SHUT';
      case 'strobe': return 'STRB';
      case 'color_wheel': return 'CW';
      case 'gobo_wheel': return 'GOBO';
      case 'gobo_rotation': return 'G-ROT';
      case 'zoom': return 'ZOOM';
      case 'focus': return 'FOCUS';
      case 'prism': return 'PRISM';
      case 'iris': return 'IRIS';
      case 'speed': return 'SPEED';
      case 'macro': return 'MACRO';
      case 'effect': return 'FX';
      default: return type.toUpperCase();
    }
  };

  const filteredChannels = React.useMemo(() => {
    let channels = Array.from({ length: 512 }, (_, i) => i);
    
    // Filter by text
    if (filterText) {
      channels = channels.filter(i => {
        const name = channelNames[i] || `CH ${i + 1}`;
        const fixtureInfo = getFixtureInfoForChannel(i);
        const searchText = filterText.toLowerCase();
        
        return name.toLowerCase().includes(searchText) ||
               (fixtureInfo && (
                 fixtureInfo.fixtureName?.toLowerCase().includes(searchText) ||
                 fixtureInfo.channelFunction?.toLowerCase().includes(searchText) ||
                 fixtureInfo.shortFunction?.toLowerCase().includes(searchText)
               ));
      });
    }
    
    // Filter by active/inactive
    if (!showInactive) {
      channels = channels.filter(i => dmxChannels[i] > 0);
    }
    
    // Filter by group
    if (selectedGroup) {
      const group = channelGroups.find(g => g.id === selectedGroup);
      if (group) {
        channels = channels.filter(i => group.channels.includes(i));
      }
    }
    
    return channels;
  }, [filterText, showInactive, selectedGroup, channelGroups, channelNames, dmxChannels]);

  const handleChannelClick = (channelIndex: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      setLocalSelectedChannels(prev => 
        prev.includes(channelIndex) 
          ? prev.filter(i => i !== channelIndex)
          : [...prev, channelIndex]
      );
    } else if (event.shiftKey && localSelectedChannels.length > 0) {
      // Range select
      const lastSelected = localSelectedChannels[localSelectedChannels.length - 1];
      const start = Math.min(lastSelected, channelIndex);
      const end = Math.max(lastSelected, channelIndex);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setLocalSelectedChannels(prev => [...new Set([...prev, ...range])]);
    } else {
      // Single select
      setLocalSelectedChannels([channelIndex]);
    }
  };

  const handleChannelValueChange = (channelIndex: number, value: number) => {
    const adjustedValue = Math.round((value * masterFader) / 255);
    setDmxChannel(channelIndex, adjustedValue);
  };

  const handleMasterFaderChange = (value: number) => {
    setMasterFader(value);
    
    // Apply master fader to all selected channels
    localSelectedChannels.forEach(channelIndex => {
      const currentValue = dmxChannels[channelIndex] || 0;
      const adjustedValue = Math.round((currentValue * value) / 255);
      setDmxChannel(channelIndex, adjustedValue);
    });
  };

  const handleSelectAll = () => {
    setLocalSelectedChannels(filteredChannels);
  };

  const handleSelectNone = () => {
    setLocalSelectedChannels([]);
  };

  const handleSelectInvert = () => {
    setLocalSelectedChannels(prev => 
      filteredChannels.filter(i => !prev.includes(i))
    );
  };

  const handleSelectGroup = (group: ChannelGroup) => {
    setLocalSelectedChannels(group.channels);
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.target === gridRef.current) {
      setIsDragging(true);
      setDragStart({ x: event.clientX, y: event.clientY });
      setSelectionBox({ x: event.clientX, y: event.clientY, width: 0, height: 0 });
    }
  };

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isDragging && dragStart) {
      const x = Math.min(dragStart.x, event.clientX);
      const y = Math.min(dragStart.y, event.clientY);
      const width = Math.abs(event.clientX - dragStart.x);
      const height = Math.abs(event.clientY - dragStart.y);
      setSelectionBox({ x, y, width, height });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && selectionBox) {
      // Find channels within selection box
      const selectedChannels: number[] = [];
      const gridRect = gridRef.current?.getBoundingClientRect();
      
      if (gridRect) {
        filteredChannels.forEach(channelIndex => {
          const channelElement = document.querySelector(`[data-channel="${channelIndex}"]`) as HTMLElement;
          if (channelElement) {
            const channelRect = channelElement.getBoundingClientRect();
            if (
              channelRect.left < selectionBox.x + selectionBox.width &&
              channelRect.right > selectionBox.x &&
              channelRect.top < selectionBox.y + selectionBox.height &&
              channelRect.bottom > selectionBox.y
            ) {
              selectedChannels.push(channelIndex);
            }
          }
        });
      }
      
      setLocalSelectedChannels(selectedChannels);
    }
    
    setIsDragging(false);
    setDragStart(null);
    setSelectionBox(null);
  }, [isDragging, selectionBox, filteredChannels]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.editor} onClick={(e) => e.stopPropagation()} ref={editorRef}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <LucideIcon name="Sliders" className={styles.titleIcon} />
            <h2>DMX Channel Editor</h2>
            <div className={styles.channelCount}>
              {localSelectedChannels.length} selected
            </div>
          </div>
          <div className={styles.headerControls}>
            <button
              className={styles.closeButton}
              onClick={onClose}
              title="Close Editor"
            >
              <LucideIcon name="X" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolGroup}>
            <div className={styles.viewModeButtons}>
              <button
                className={`${styles.viewModeButton} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <LucideIcon name="Grid3x3" />
              </button>
              <button
                className={`${styles.viewModeButton} ${viewMode === 'list' ? styles.active : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <LucideIcon name="List" />
              </button>
              <button
                className={`${styles.viewModeButton} ${viewMode === 'groups' ? styles.active : ''}`}
                onClick={() => setViewMode('groups')}
                title="Groups View"
              >
                <LucideIcon name="Layers" />
              </button>
            </div>
          </div>

          <div className={styles.toolGroup}>
            <div className={styles.searchBox}>
              <LucideIcon name="Search" className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search channels..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className={styles.toolGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show Inactive
            </label>
          </div>

          <div className={styles.toolGroup}>
            <div className={styles.selectionButtons}>
              <button onClick={handleSelectAll} title="Select All">
                <LucideIcon name="CheckSquare" />
              </button>
              <button onClick={handleSelectNone} title="Select None">
                <LucideIcon name="Square" />
              </button>
              <button onClick={handleSelectInvert} title="Invert Selection">
                <LucideIcon name="RotateCcw" />
              </button>
            </div>
          </div>

          <div className={styles.toolGroup}>
            <button
              className={`${styles.advancedButton} ${showAdvancedControls ? styles.active : ''}`}
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              title="Advanced Controls"
            >
              <LucideIcon name="Settings" />
            </button>
          </div>
        </div>

        {/* Advanced Controls */}
        {showAdvancedControls && (
          <div className={styles.advancedControls}>
            <div className={styles.masterFader}>
              <label>Master Fader</label>
              <div className={styles.faderContainer}>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={masterFader}
                  onChange={(e) => handleMasterFaderChange(parseInt(e.target.value))}
                  className={styles.masterFaderSlider}
                />
                <span className={styles.faderValue}>{masterFader}</span>
              </div>
            </div>

            <div className={styles.groupSelector}>
              <label>Filter by Group</label>
              <select
                value={selectedGroup || ''}
                onChange={(e) => setSelectedGroup(e.target.value || null)}
                className={styles.groupSelect}
              >
                <option value="">All Channels</option>
                {channelGroups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.channels.length} channels)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {viewMode === 'groups' ? (
            <div className={styles.groupsView}>
              {channelGroups.map(group => (
                <div key={group.id} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <div 
                      className={styles.groupColor}
                      style={{ backgroundColor: group.color }}
                    />
                    <h3>{group.name}</h3>
                    <span className={styles.groupChannelCount}>
                      {group.channels.length} channels
                    </span>
                    <button
                      onClick={() => handleSelectGroup(group)}
                      className={styles.selectGroupButton}
                      title="Select Group"
                    >
                      <LucideIcon name="MousePointer" />
                    </button>
                  </div>
                  <div className={styles.groupChannels}>
                    {group.channels.slice(0, 8).map(channelIndex => (
                      <div
                        key={channelIndex}
                        className={`${styles.channelItem} ${
                          localSelectedChannels.includes(channelIndex) ? styles.selected : ''
                        }`}
                        onClick={(e) => handleChannelClick(channelIndex, e)}
                        data-channel={channelIndex}
                      >
                        <div className={styles.channelAddress}>{channelIndex + 1}</div>
                        <div className={styles.channelValue}>
                          {dmxChannels[channelIndex] || 0}
                        </div>
                      </div>
                    ))}
                    {group.channels.length > 8 && (
                      <div className={styles.moreChannels}>
                        +{group.channels.length - 8} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div 
              className={`${styles.channelsGrid} ${viewMode === 'list' ? styles.listView : ''}`}
              ref={gridRef}
              onMouseDown={handleMouseDown}
            >
              {filteredChannels.map(channelIndex => {
                const value = dmxChannels[channelIndex] || 0;
                const name = channelNames[channelIndex] || `CH ${channelIndex + 1}`;
                const fixtureInfo = getFixtureInfoForChannel(channelIndex);
                const isSelected = localSelectedChannels.includes(channelIndex);
                const isActive = value > 0;

                return (
                  <div
                    key={channelIndex}
                    className={`${styles.channelCard} ${isSelected ? styles.selected : ''} ${isActive ? styles.active : ''}`}
                    onClick={(e) => handleChannelClick(channelIndex, e)}
                    data-channel={channelIndex}
                  >
                    <div className={styles.channelHeader}>
                      <div className={styles.channelAddress}>{channelIndex + 1}</div>
                      <div className={styles.channelName}>
                        {fixtureInfo ? (
                          <>
                            <div className={styles.fixtureName}>{fixtureInfo.fixtureName}</div>
                            <div className={styles.channelFunction}>{fixtureInfo.shortFunction}</div>
                          </>
                        ) : (
                          <div className={styles.channelNameText}>{name}</div>
                        )}
                      </div>
                    </div>

                    <div className={styles.channelValue}>
                      <div className={styles.valueDisplay}>{value}</div>
                      <div className={styles.valuePercent}>
                        {Math.round((value / 255) * 100)}%
                      </div>
                    </div>

                    <div className={styles.channelSlider}>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={value}
                        onChange={(e) => handleChannelValueChange(channelIndex, parseInt(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className={styles.slider}
                      />
                    </div>

                    <div className={styles.channelActions}>
                      <MidiLearnButton channelIndex={channelIndex} />
                      <button
                        className={styles.oscButton}
                        title="OSC Assignment"
                      >
                        <LucideIcon name="Radio" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selection Box */}
        {selectionBox && (
          <div
            className={styles.selectionBox}
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default DmxChannelEditor;
