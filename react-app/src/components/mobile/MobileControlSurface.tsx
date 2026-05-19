import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store';
import { useSocket } from '../../context/SocketContext';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './MobileControlSurface.module.scss';

interface MobileControlSurfaceProps {
  fixtureId?: string;
  showFixtureSelector?: boolean;
}

export const MobileControlSurface: React.FC<MobileControlSurfaceProps> = ({ 
  fixtureId,
  showFixtureSelector = true 
}) => {
  const socket = useSocket().socket;
  const { connected } = useSocket();
  
  const {
    fixtures,
    selectedFixtures,
    setSelectedFixtures,
    dmxChannels,
    setDmxChannel,
    scenes,
    loadScene,
    getChannelInfo,
    getFixtureColor,
    colorSliderAutopilot,
    panTiltAutopilot,
    toggleColorSliderAutopilot,
    togglePanTiltAutopilot,
  } = useStore();

  const [showFixtureList, setShowFixtureList] = useState(false);

  // Request fixtures on mount if not loaded and socket is connected
  useEffect(() => {
    const loadFixtures = async () => {
      const store = useStore.getState();
      const currentFixtures = store.fixtures;
      
      // Always try to fetch initial state to ensure we have the latest fixtures
      if (connected && socket) {
        console.log('[MobileControlSurface] Connected, fetching fixtures...');
        try {
          // Fetch via HTTP first (more reliable)
          await store.fetchInitialState();
          console.log('[MobileControlSurface] Fetched initial state, fixtures:', store.fixtures.length);
          
          // Also request via socket as backup
          if (store.fixtures.length === 0) {
            console.log('[MobileControlSurface] Still no fixtures, requesting via socket...');
            socket.emit('loadFixtures');
          }
        } catch (err) {
          console.error('[MobileControlSurface] Failed to fetch initial state:', err);
          // Fallback to socket request
          if (socket) {
            socket.emit('loadFixtures');
          }
        }
      } else if (!connected) {
        console.log('[MobileControlSurface] Not connected yet, waiting...');
        // Try HTTP fetch anyway (might work if CORS allows)
        try {
          await store.fetchInitialState();
          console.log('[MobileControlSurface] Fetched via HTTP, fixtures:', store.fixtures.length);
        } catch (err) {
          console.error('[MobileControlSurface] HTTP fetch failed:', err);
        }
      }
    };

    loadFixtures();
  }, [connected, socket]);

  // Also listen for fixture updates from socket
  useEffect(() => {
    if (!socket) return;

    const handleFixturesUpdated = (fixturesData: any[]) => {
      console.log('[MobileControlSurface] Received fixtures update via socket:', fixturesData.length);
      const store = useStore.getState();
      if (Array.isArray(fixturesData)) {
        store.setFixtures(fixturesData);
      }
    };

    const handleFixturesLoaded = (fixturesData: any[]) => {
      console.log('[MobileControlSurface] Received fixtures loaded via socket:', fixturesData.length);
      const store = useStore.getState();
      if (Array.isArray(fixturesData)) {
        store.setFixtures(fixturesData);
      }
    };

    socket.on('fixturesUpdated', handleFixturesUpdated);
    socket.on('fixturesLoaded', handleFixturesLoaded);
    socket.on('fixturesUpdate', handleFixturesUpdated);

    return () => {
      socket.off('fixturesUpdated', handleFixturesUpdated);
      socket.off('fixturesLoaded', handleFixturesLoaded);
      socket.off('fixturesUpdate', handleFixturesUpdated);
    };
  }, [socket]);

  // Debug: Log fixture changes
  useEffect(() => {
    console.log('[MobileControlSurface] Fixtures updated:', fixtures.length, 'fixtures available');
    if (fixtures.length > 0) {
      console.log('[MobileControlSurface] Available fixtures:', fixtures.map(f => ({ 
        id: f.id, 
        name: f.name, 
        startAddress: f.startAddress,
        type: f.type,
        channels: f.channels?.length || 0,
        hasId: !!f.id,
        hasType: !!f.type
      })));
      console.log('[MobileControlSurface] First fixture full object:', JSON.stringify(fixtures[0], null, 2));
    } else {
      console.log('[MobileControlSurface] No fixtures available yet');
      console.log('[MobileControlSurface] Store fixtures state:', useStore.getState().fixtures);
    }
  }, [fixtures]);

  // Get the fixture to control (use selected or first available)
  const activeFixture = React.useMemo(() => {
    if (fixtures.length === 0) {
      console.log('[MobileControlSurface] No fixtures in array');
      return null;
    }
    
    console.log('[MobileControlSurface] Finding active fixture from', fixtures.length, 'fixtures');
    console.log('[MobileControlSurface] Fixture IDs:', fixtures.map(f => f.id));
    console.log('[MobileControlSurface] Selected fixtures:', selectedFixtures);
    
    if (fixtureId) {
      const found = fixtures.find(f => f.id === fixtureId);
      console.log('[MobileControlSurface] Looking for fixtureId:', fixtureId, 'found:', !!found);
      return found || null;
    }
    
    if (selectedFixtures.length > 0) {
      const found = fixtures.find(f => selectedFixtures.includes(f.id));
      console.log('[MobileControlSurface] Looking for selected fixture, found:', !!found);
      return found || null;
    }
    
    console.log('[MobileControlSurface] Using first fixture:', fixtures[0]?.name);
    return fixtures[0] || null;
  }, [fixtureId, fixtures, selectedFixtures]);

  // Find channels for the active fixture
  const getFixtureChannels = useCallback((fixture: typeof fixtures[0]) => {
    if (!fixture) return null;

    const channels: {
      dimmer?: number;
      red?: number;
      green?: number;
      blue?: number;
      pan?: number;
      tilt?: number;
      finePan?: number;
      fineTilt?: number;
      [key: string]: number | undefined;
    } = {};

    fixture.channels.forEach((channel, index) => {
      // Use custom dmxAddress if available, otherwise calculate from startAddress
      const dmxAddress = (channel.dmxAddress !== undefined && channel.dmxAddress >= 1)
        ? channel.dmxAddress - 1 // Convert 1-based to 0-based
        : (fixture.startAddress || 1) + index - 1; // Convert to 0-indexed
      const channelType = channel.type.toLowerCase();

      switch (channelType) {
        case 'dimmer':
        case 'intensity':
          channels.dimmer = dmxAddress;
          break;
        case 'red':
          channels.red = dmxAddress;
          break;
        case 'green':
          channels.green = dmxAddress;
          break;
        case 'blue':
          channels.blue = dmxAddress;
          break;
        case 'pan':
          channels.pan = dmxAddress;
          break;
        case 'tilt':
          channels.tilt = dmxAddress;
          break;
        case 'finepan':
        case 'pan_fine':
        case 'fine_pan':
          channels.finePan = dmxAddress;
          break;
        case 'finetilt':
        case 'tilt_fine':
        case 'fine_tilt':
          channels.fineTilt = dmxAddress;
          break;
      }
    });

    return channels;
  }, []);

  const fixtureChannels = activeFixture ? getFixtureChannels(activeFixture) : null;

  // State for controls
  const [xyPosition, setXYPosition] = useState({ x: 50, y: 50 });
  const [finePan, setFinePan] = useState(0);
  const [fineTilt, setFineTilt] = useState(0);
  const [colorHue, setColorHue] = useState(0);
  const [colorSaturation, setColorSaturation] = useState(100);
  const [colorValue, setColorValue] = useState(100);
  const [dimmer, setDimmer] = useState(255);
  const [isDraggingXY, setIsDraggingXY] = useState(false);
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  const [activeTab, setActiveTab] = useState<'movement' | 'color' | 'scenes'>('movement');

  // Refs for touch handling
  const xyPadRef = useRef<HTMLDivElement>(null);
  const colorWheelRef = useRef<HTMLDivElement>(null);

  // Sync with DMX values when fixture changes
  useEffect(() => {
    if (!fixtureChannels || !activeFixture) return;

    // Sync pan/tilt
    if (fixtureChannels.pan !== undefined) {
      const panVal = dmxChannels[fixtureChannels.pan] || 127;
      const panPercent = (panVal / 255) * 100;
      setXYPosition(prev => ({ ...prev, x: panPercent }));
    }
    if (fixtureChannels.tilt !== undefined) {
      const tiltVal = dmxChannels[fixtureChannels.tilt] || 127;
      const tiltPercent = 100 - ((tiltVal / 255) * 100); // Invert Y axis
      setXYPosition(prev => ({ ...prev, y: tiltPercent }));
    }

    // Sync fine pan/tilt
    if (fixtureChannels.finePan !== undefined) {
      setFinePan(dmxChannels[fixtureChannels.finePan] || 0);
    }
    if (fixtureChannels.fineTilt !== undefined) {
      setFineTilt(dmxChannels[fixtureChannels.fineTilt] || 0);
    }

    // Sync RGB
    if (fixtureChannels.red !== undefined && fixtureChannels.green !== undefined && fixtureChannels.blue !== undefined) {
      const r = dmxChannels[fixtureChannels.red] || 0;
      const g = dmxChannels[fixtureChannels.green] || 0;
      const b = dmxChannels[fixtureChannels.blue] || 0;
      const hsv = rgbToHsv(r, g, b);
      setColorHue(hsv.h);
      setColorSaturation(hsv.s);
      setColorValue(hsv.v);
    }

    // Sync dimmer
    if (fixtureChannels.dimmer !== undefined) {
      setDimmer(dmxChannels[fixtureChannels.dimmer] || 0);
    }
  }, [activeFixture, fixtureChannels, dmxChannels]);

  // Listen for DMX updates from server
  useEffect(() => {
    if (!socket) return;

    const handleDmxUpdate = ({ channel, value }: { channel: number; value: number }) => {
      if (!fixtureChannels) return;

      // Update local state if this channel belongs to our fixture
      Object.entries(fixtureChannels).forEach(([key, ch]) => {
        if (ch === channel) {
          switch (key) {
            case 'pan':
              setXYPosition(prev => ({ ...prev, x: (value / 255) * 100 }));
              break;
            case 'tilt':
              setXYPosition(prev => ({ ...prev, y: 100 - ((value / 255) * 100) }));
              break;
            case 'finePan':
              setFinePan(value);
              break;
            case 'fineTilt':
              setFineTilt(value);
              break;
            case 'red':
            case 'green':
            case 'blue':
              // Recalculate HSV from RGB
              if (fixtureChannels.red !== undefined && fixtureChannels.green !== undefined && fixtureChannels.blue !== undefined) {
                const r = key === 'red' ? value : dmxChannels[fixtureChannels.red] || 0;
                const g = key === 'green' ? value : dmxChannels[fixtureChannels.green] || 0;
                const b = key === 'blue' ? value : dmxChannels[fixtureChannels.blue] || 0;
                const hsv = rgbToHsv(r, g, b);
                setColorHue(hsv.h);
                setColorSaturation(hsv.s);
                setColorValue(hsv.v);
              }
              break;
            case 'dimmer':
              setDimmer(value);
              break;
          }
        }
      });
    };

    socket.on('dmxUpdate', handleDmxUpdate);
    return () => {
      socket.off('dmxUpdate', handleDmxUpdate);
    };
  }, [socket, fixtureChannels, dmxChannels]);

  // RGB to HSV conversion
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff) % 6;
      } else if (max === g) {
        h = (b - r) / diff + 2;
      } else {
        h = (r - g) / diff + 4;
      }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : Math.round((diff / max) * 100);
    const v = Math.round(max * 100);

    return { h, s, v };
  };

  // HSV to RGB conversion
  const hsvToRgb = (h: number, s: number, v: number) => {
    s /= 100;
    v /= 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
      r = c; g = 0; b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  };

  // Update DMX channel via socket
  const updateChannel = useCallback((channel: number, value: number) => {
    if (!socket || !connected) return;
    
    setDmxChannel(channel, value);
    socket.emit('setDmxChannel', { channel, value });
  }, [socket, connected, setDmxChannel]);

  // XY Pad handlers
  const handleXYStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDraggingXY(true);
    updateXYPosition(e);
  };

  const handleXYMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (isDraggingXY) {
      updateXYPosition(e);
    }
  };

  const handleXYEnd = () => {
    setIsDraggingXY(false);
  };

  const updateXYPosition = (e: React.TouchEvent | React.MouseEvent) => {
    if (!xyPadRef.current || !fixtureChannels) return;

    const rect = xyPadRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;

    if (!clientX || !clientY) return;

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    setXYPosition({ x, y });

    // Update pan/tilt channels
    if (fixtureChannels.pan !== undefined) {
      const panValue = Math.round((x / 100) * 255);
      updateChannel(fixtureChannels.pan, panValue);
    }
    if (fixtureChannels.tilt !== undefined) {
      const tiltValue = Math.round(((100 - y) / 100) * 255); // Invert Y
      updateChannel(fixtureChannels.tilt, tiltValue);
    }
  };

  // Color wheel handlers
  const handleColorStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDraggingColor(true);
    updateColorPosition(e);
  };

  const handleColorMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (isDraggingColor) {
      updateColorPosition(e);
    }
  };

  const handleColorEnd = () => {
    setIsDraggingColor(false);
  };

  const updateColorPosition = (e: React.TouchEvent | React.MouseEvent) => {
    if (!colorWheelRef.current || !fixtureChannels) return;

    const rect = colorWheelRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;

    if (!clientX || !clientY) return;

    const x = clientX - rect.left - centerX;
    const y = clientY - rect.top - centerY;

    const angle = Math.atan2(y, x) * (180 / Math.PI);
    const hue = (angle + 360) % 360;
    const distance = Math.min(Math.sqrt(x * x + y * y), centerX);
    const saturation = (distance / centerX) * 100;

    setColorHue(hue);
    setColorSaturation(saturation);

    // Update RGB channels
    const { r, g, b } = hsvToRgb(hue, saturation, colorValue);
    if (fixtureChannels.red !== undefined) updateChannel(fixtureChannels.red, r);
    if (fixtureChannels.green !== undefined) updateChannel(fixtureChannels.green, g);
    if (fixtureChannels.blue !== undefined) updateChannel(fixtureChannels.blue, b);
  };

  // Fine pan/tilt handlers
  const handleFinePanChange = (value: number) => {
    setFinePan(value);
    if (fixtureChannels?.finePan !== undefined) {
      updateChannel(fixtureChannels.finePan, value);
    }
  };

  const handleFineTiltChange = (value: number) => {
    setFineTilt(value);
    if (fixtureChannels?.fineTilt !== undefined) {
      updateChannel(fixtureChannels.fineTilt, value);
    }
  };

  // Dimmer handler
  const handleDimmerChange = (value: number) => {
    setDimmer(value);
    if (fixtureChannels?.dimmer !== undefined) {
      updateChannel(fixtureChannels.dimmer, value);
    }
  };

  // Scene handlers
  const handleLoadScene = (sceneName: string) => {
    loadScene(sceneName);
    if (socket && connected) {
      socket.emit('loadScene', { name: sceneName });
    }
  };

  // Get current RGB color for display
  const currentRgb = hsvToRgb(colorHue, colorSaturation, colorValue);

  if (fixtures.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noFixture}>
          <LucideIcon name="AlertCircle" />
          <p>No fixtures available</p>
          <p className={styles.hint}>
            {connected 
              ? 'Add fixtures in the Fixtures page to control them here'
              : 'Connecting to server...'}
          </p>
          {connected && (
            <>
              <button 
                className={styles.refreshButton}
                onClick={() => {
                  console.log('[MobileControlSurface] Manually requesting fixtures...');
                  console.log('[MobileControlSurface] Current store fixtures:', useStore.getState().fixtures.length);
                  socket?.emit('loadFixtures');
                  // Also try fetching via HTTP
                  const store = useStore.getState();
                  store.fetchInitialState().then(() => {
                    console.log('[MobileControlSurface] After fetchInitialState, fixtures:', store.fixtures.length);
                    console.log('[MobileControlSurface] Fixture data:', store.fixtures);
                  }).catch(err => {
                    console.error('[MobileControlSurface] Failed to fetch initial state:', err);
                  });
                }}
              >
                <LucideIcon name="RefreshCw" />
                Refresh Fixtures
              </button>
              <p className={styles.debugInfo}>
                Connected: {connected ? 'Yes' : 'No'} | 
                Socket: {socket ? 'Yes' : 'No'} | 
                Fixtures: {fixtures.length}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }
  
  // Use fixtures from store
  const effectiveFixtures = fixtures;

  const handleFixtureSelect = (fixtureId: string) => {
    setSelectedFixtures([fixtureId]);
    setShowFixtureList(false);
  };

  // If no fixtures available, show message
  if (effectiveFixtures.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noFixture}>
          <LucideIcon name="AlertCircle" />
          <p>No fixtures available</p>
          <p className={styles.hint}>Add fixtures in the main application</p>
        </div>
      </div>
    );
  }

  // If no active fixture but fixtures exist, show fixture selector
  if (!activeFixture) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.fixtureInfo}>
            <h2 className={styles.fixtureName}>Select a Fixture</h2>
            <p className={styles.fixtureAddress}>{effectiveFixtures.length} fixture{effectiveFixtures.length !== 1 ? 's' : ''} available</p>
          </div>
        </div>
        
        {/* Fixture Selector - Always show when no active fixture */}
        <div className={styles.fixtureList}>
          {effectiveFixtures.map((fixture) => {
            const fixColor = getFixtureColor(fixture.id);
            return (
              <button
                key={fixture.id}
                className={styles.fixtureListItem}
                onClick={() => handleFixtureSelect(fixture.id)}
              >
                <div 
                  className={styles.fixtureListItemColor}
                  style={{ backgroundColor: fixColor }}
                />
                <div className={styles.fixtureListItemInfo}>
                  <div className={styles.fixtureListItemName}>{fixture.name}</div>
                  <div className={styles.fixtureListItemAddress}>DMX {fixture.startAddress}</div>
                </div>
                <LucideIcon name="ChevronRight" size={20} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const fixtureColor = getFixtureColor(activeFixture.id);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div 
          className={styles.fixtureInfo}
          onClick={() => showFixtureSelector && setShowFixtureList(!showFixtureList)}
          style={{ cursor: showFixtureSelector ? 'pointer' : 'default' }}
        >
          <div 
            className={styles.fixtureColorIndicator}
            style={{ backgroundColor: fixtureColor }}
          />
          <div>
            <h2 className={styles.fixtureName}>
              {activeFixture.name}
              {showFixtureSelector && fixtures.length > 1 && (
                <LucideIcon name="ChevronDown" size={16} />
              )}
            </h2>
            <p className={styles.fixtureAddress}>DMX {activeFixture.startAddress}</p>
          </div>
        </div>
        {!connected && (
          <div className={styles.connectionStatus}>
            <LucideIcon name="WifiOff" />
            <span>Disconnected</span>
          </div>
        )}
      </div>

      {/* Fixture Selector */}
      {showFixtureSelector && showFixtureList && effectiveFixtures.length > 0 && (
        <div className={styles.fixtureList}>
          {effectiveFixtures.map((fixture) => {
            const isSelected = fixture.id === activeFixture?.id;
            const fixColor = getFixtureColor(fixture.id);
            return (
              <button
                key={fixture.id}
                className={`${styles.fixtureListItem} ${isSelected ? styles.selected : ''}`}
                onClick={() => handleFixtureSelect(fixture.id)}
              >
                <div 
                  className={styles.fixtureListItemColor}
                  style={{ backgroundColor: fixColor }}
                />
                <div className={styles.fixtureListItemInfo}>
                  <div className={styles.fixtureListItemName}>{fixture.name}</div>
                  <div className={styles.fixtureListItemAddress}>DMX {fixture.startAddress}</div>
                </div>
                {isSelected && <LucideIcon name="Check" size={20} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'movement' ? styles.active : ''}`}
          onClick={() => setActiveTab('movement')}
        >
          <LucideIcon name="Move" />
          Movement
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'color' ? styles.active : ''}`}
          onClick={() => setActiveTab('color')}
        >
          <LucideIcon name="Palette" />
          Color
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'scenes' ? styles.active : ''}`}
          onClick={() => setActiveTab('scenes')}
        >
          <LucideIcon name="Camera" />
          Scenes
        </button>
      </div>

      {/* Movement Tab */}
      {activeTab === 'movement' && (
        <div className={styles.tabContent}>
          {/* XY Pad */}
          {fixtureChannels?.pan !== undefined && fixtureChannels?.tilt !== undefined && (
            <div className={styles.xyPadSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 className={styles.sectionTitle}>Pan / Tilt</h3>
                <button
                  onClick={togglePanTiltAutopilot}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: panTiltAutopilot?.enabled ? '#10b981' : '#475569',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: panTiltAutopilot?.enabled ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none'
                  }}
                  title={panTiltAutopilot?.enabled ? 'Disable Pan/Tilt Autopilot' : 'Enable Pan/Tilt Autopilot'}
                >
                  <LucideIcon name={panTiltAutopilot?.enabled ? "Navigation" : "Navigation"} size={14} />
                  {panTiltAutopilot?.enabled ? 'Autopilot ON' : 'Autopilot OFF'}
                </button>
              </div>
              <div
                ref={xyPadRef}
                className={styles.xyPad}
                onTouchStart={handleXYStart}
                onTouchMove={handleXYMove}
                onTouchEnd={handleXYEnd}
                onMouseDown={handleXYStart}
                onMouseMove={handleXYMove}
                onMouseUp={handleXYEnd}
                onMouseLeave={handleXYEnd}
              >
                <div className={styles.xyGrid}>
                  <div className={styles.xyCenterLine} style={{ left: '50%' }} />
                  <div className={styles.xyCenterLine} style={{ top: '50%' }} />
                </div>
                <div
                  className={styles.xyHandle}
                  style={{
                    left: `${xyPosition.x}%`,
                    top: `${xyPosition.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              </div>
              <div className={styles.xyLabels}>
                <span>Left</span>
                <span>Right</span>
                <span>Down</span>
                <span>Up</span>
              </div>
            </div>
          )}

          {/* Fine Pan/Tilt Controls */}
          {(fixtureChannels?.finePan !== undefined || fixtureChannels?.fineTilt !== undefined) && (
            <div className={styles.fineControlsSection}>
              <h3 className={styles.sectionTitle}>Fine Adjustments</h3>
              <div className={styles.fineControls}>
                {fixtureChannels.finePan !== undefined && (
                  <div className={styles.fineControl}>
                    <label>Fine Pan</label>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={finePan}
                      onChange={(e) => handleFinePanChange(parseInt(e.target.value))}
                      className={styles.fineSlider}
                    />
                    <span className={styles.fineValue}>{finePan}</span>
                  </div>
                )}
                {fixtureChannels.fineTilt !== undefined && (
                  <div className={styles.fineControl}>
                    <label>Fine Tilt</label>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={fineTilt}
                      onChange={(e) => handleFineTiltChange(parseInt(e.target.value))}
                      className={styles.fineSlider}
                    />
                    <span className={styles.fineValue}>{fineTilt}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dimmer Control */}
          {fixtureChannels?.dimmer !== undefined && (
            <div className={styles.dimmerSection}>
              <div style={{ marginBottom: '8px' }}>
                <h3 className={styles.sectionTitle}>Intensity</h3>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#94a3b8', 
                  marginTop: '4px',
                  lineHeight: '1.4'
                }}>
                  Controls the overall brightness of the fixture. 0% = completely off (blackout), 100% = full brightness. 
                  This is also called "Dimmer" or "Master Intensity" in lighting terminology.
                </p>
              </div>
              <div className={styles.dimmerControl}>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={dimmer}
                  onChange={(e) => handleDimmerChange(parseInt(e.target.value))}
                  className={styles.dimmerSlider}
                  title="Intensity: Controls the overall brightness of the fixture (0% = off, 100% = full brightness)"
                />
                <div className={styles.dimmerValue}>
                  <span>{Math.round((dimmer / 255) * 100)}%</span>
                  <span>{dimmer}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Color Tab */}
      {activeTab === 'color' && (
        <div className={styles.tabContent}>
          {fixtureChannels?.red !== undefined && fixtureChannels?.green !== undefined && fixtureChannels?.blue !== undefined ? (
            <>
              {/* Color Wheel */}
              <div className={styles.colorWheelSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 className={styles.sectionTitle}>Color Wheel</h3>
                  <button
                    onClick={toggleColorSliderAutopilot}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: colorSliderAutopilot?.enabled ? '#8b5cf6' : '#475569',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      boxShadow: colorSliderAutopilot?.enabled ? '0 0 12px rgba(139, 92, 246, 0.4)' : 'none'
                    }}
                    title={colorSliderAutopilot?.enabled ? 'Disable Auto Color' : 'Enable Auto Color'}
                  >
                    <LucideIcon name={colorSliderAutopilot?.enabled ? "Palette" : "Palette"} size={14} />
                    {colorSliderAutopilot?.enabled ? 'Auto Color ON' : 'Auto Color OFF'}
                  </button>
                </div>
                <div
                  ref={colorWheelRef}
                  className={styles.colorWheel}
                  onTouchStart={handleColorStart}
                  onTouchMove={handleColorMove}
                  onTouchEnd={handleColorEnd}
                  onMouseDown={handleColorStart}
                  onMouseMove={handleColorMove}
                  onMouseUp={handleColorEnd}
                  onMouseLeave={handleColorEnd}
                >
                  <div
                    className={styles.colorHandle}
                    style={{
                      transform: `rotate(${colorHue}deg) translateX(${colorSaturation}%)`,
                      backgroundColor: `hsl(${colorHue}, ${colorSaturation}%, ${colorValue}%)`
                    }}
                  />
                </div>
                <div className={styles.colorInfo}>
                  <div
                    className={styles.colorPreview}
                    style={{
                      backgroundColor: `rgb(${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b})`
                    }}
                  />
                  <div className={styles.colorValues}>
                    <div>H: {Math.round(colorHue)}°</div>
                    <div>S: {Math.round(colorSaturation)}%</div>
                    <div>V: {Math.round(colorValue)}%</div>
                    <div>R: {currentRgb.r} G: {currentRgb.g} B: {currentRgb.b}</div>
                  </div>
                </div>
              </div>

              {/* Brightness Control */}
              <div className={styles.brightnessSection}>
                <h3 className={styles.sectionTitle}>Brightness</h3>
                <div className={styles.brightnessControl}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={colorValue}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      setColorValue(newValue);
                      const { r, g, b } = hsvToRgb(colorHue, colorSaturation, newValue);
                      if (fixtureChannels.red !== undefined) updateChannel(fixtureChannels.red, r);
                      if (fixtureChannels.green !== undefined) updateChannel(fixtureChannels.green, g);
                      if (fixtureChannels.blue !== undefined) updateChannel(fixtureChannels.blue, b);
                    }}
                    className={styles.brightnessSlider}
                  />
                  <span className={styles.brightnessValue}>{colorValue}%</span>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.noColorControl}>
              <LucideIcon name="Palette" />
              <p>This fixture doesn't have RGB color control</p>
            </div>
          )}
        </div>
      )}

      {/* Scenes Tab */}
      {activeTab === 'scenes' && (
        <div className={styles.tabContent}>
          <div className={styles.scenesSection}>
            <h3 className={styles.sectionTitle}>Scenes</h3>
            {scenes.length > 0 ? (
              <div className={styles.scenesList}>
                {scenes.map((scene, index) => (
                  <button
                    key={index}
                    className={styles.sceneButton}
                    onClick={() => handleLoadScene(scene.name)}
                  >
                    <LucideIcon name="Play" />
                    {scene.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.noScenes}>
                <LucideIcon name="Camera" />
                <p>No scenes available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileControlSurface;
