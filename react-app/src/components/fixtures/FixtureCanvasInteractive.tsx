import React, { useState, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Fixture, PlacedFixture, PlacedControl, useStore } from '../../store';
import { useSocket } from '../../context/SocketContext';
import { LucideIcon } from '../ui/LucideIcon';
import DraggableFixturePalette from './DraggableFixturePalette';
import { fixtureTemplates } from './fixtureTemplates';
import styles from './FixtureCanvasInteractive.module.scss';

interface FixtureCanvasInteractiveProps {
  fixtures: Fixture[];
  placedFixturesData: PlacedFixture[];
  onUpdatePlacedFixtures: (fixtures: PlacedFixture[]) => void;
}

interface DraggableFixture extends PlacedFixture {
  isDragging: boolean;
}

export const FixtureCanvasInteractive: React.FC<FixtureCanvasInteractiveProps> = ({
  fixtures,
  placedFixturesData,
  onUpdatePlacedFixtures
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectedTool, setSelectedTool] = useState<'select' | 'add'>('select');
  const [showControls, setShowControls] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [showFixturePalette, setShowFixturePalette] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const { 
    dmxChannels,
    setDmxChannelValue,
    startMidiLearn,
    midiLearnTarget,
    addNotification,
    midiMappings,
    removeMidiMapping
  } = useStore();

  const { socket } = useSocket();

  // Grid constants
  const GRID_SIZE = 50;
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;

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

  const getFixtureIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'moving-head': 'Zap',
      'par': 'Circle',
      'strip': 'Minus',
      'laser': 'Target',
      'strobe': 'Flashlight',
      'smoke': 'Cloud',
      default: 'Lightbulb',
    };
    return iconMap[type.toLowerCase()] || iconMap.default;
  };

  const snapToGridPosition = (x: number, y: number) => {
    if (!snapToGrid) return { x, y };
    return {
      x: Math.round(x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(y / GRID_SIZE) * GRID_SIZE,
    };
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    setSelectedFixture(null);
    setShowControls(false);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const fixtureId = event.dataTransfer.getData('text/plain');
    
    if (!fixtureId) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (event.clientX - rect.left) / zoom - canvasOffset.x;
      const y = (event.clientY - rect.top) / zoom - canvasOffset.y;
      addFixtureToCanvas(fixtureId, x, y);
    }
  };

  const addFixtureToCanvas = (fixtureType: string, x: number, y: number) => {
    // Find template or existing fixture
    let fixtureDef = fixtures.find(f => f.id === fixtureType);
    let template = fixtureTemplates.find(t => t.id === fixtureType);

    if (!fixtureDef && !template) return;

    // Use template if no existing fixture found
    if (!fixtureDef && template) {
      fixtureDef = template as any; // Cast template to fixture format
    }

    if (!fixtureDef) return;

    const { x: snapX, y: snapY } = snapToGridPosition(x, y);

    const newPlacedFixture: PlacedFixture = {
      id: `placed-${Date.now()}`,
      fixtureId: fixtureDef.id,
      fixtureStoreId: fixtureDef.id,
      name: `${fixtureDef.name} ${placedFixturesData.length + 1}`,
      type: fixtureDef.type,
      x: snapX,
      y: snapY,
      color: getFixtureColor(fixtureDef.type),
      radius: 40,
      startAddress: getNextAvailableAddress(),
      dmxAddress: getNextAvailableAddress(),
      scale: 1,
      controls: [], // Initialize empty controls array
    };

    const updatedFixtures = [...placedFixturesData, newPlacedFixture];
    onUpdatePlacedFixtures(updatedFixtures);

    addNotification?.({
      type: 'success',
      message: `Added ${fixtureDef.name} to canvas`,
    });

    // Generate controls immediately after adding the fixture
    setTimeout(() => {
      generateControlsForFixture(newPlacedFixture.id);
    }, 100);
  };

  const getNextAvailableAddress = (): number => {
    if (placedFixturesData.length === 0) return 1;
    const usedAddresses = placedFixturesData.map(f => f.startAddress).sort((a, b) => a - b);
    let nextAddress = 1;
    for (const addr of usedAddresses) {
      if (nextAddress < addr) break;
      nextAddress = addr + 1;
    }
    return nextAddress;
  };

  const handleFixtureDrag = (fixtureId: string, data: any) => {
    const { x, y } = snapToGridPosition(data.x, data.y);
    updatePlacedFixturePosition(fixtureId, x, y);
  };

  const updatePlacedFixturePosition = (fixtureId: string, x: number, y: number) => {
    const updatedFixtures = placedFixturesData.map(f => 
      f.id === fixtureId ? { ...f, x, y } : f
    );
    onUpdatePlacedFixtures(updatedFixtures);
  };

  const deleteSelectedFixture = () => {
    if (!selectedFixture) return;

    const updatedFixtures = placedFixturesData.filter(f => f.id !== selectedFixture);
    onUpdatePlacedFixtures(updatedFixtures);
    setSelectedFixture(null);
    setShowControls(false);

    addNotification?.({
      type: 'info',
      message: 'Fixture removed from canvas',
    });
  };

  const handleChannelChange = (fixtureId: string, channelIndex: number, value: number) => {
    const placedFixture = placedFixturesData.find(f => f.id === fixtureId);
    if (!placedFixture) return;

    const dmxChannel = placedFixture.startAddress + channelIndex;
    setDmxChannelValue(dmxChannel, value);

    if (socket?.emit) {
      socket.emit('dmx:setValue', {
        channel: dmxChannel,
        value,
      });
    }
  };

  const startMidiLearnForControl = (fixtureId: string, controlId: string) => {
    const controlIdentifier = `fixture-${fixtureId}-control-${controlId}`;
    startMidiLearn({ type: 'placedControl', fixtureId, controlId: controlIdentifier });
  };

  const copyOscAddressForControl = (fixtureId: string, controlId: string, channelName?: string) => {
    const placedFixture = placedFixturesData.find(f => f.id === fixtureId);
    if (!placedFixture) return;

    const control = placedFixture.controls?.find(c => c.id === controlId);
    let oscAddress = '';

    if (control && control.type === 'xypad') {
      oscAddress = `/fixture/${placedFixture.name.replace(/\s+/g, '_').toLowerCase()}/pantilt`;
    } else if (control) {
      const safeChannelName = control.channelNameInFixture.replace(/\s+/g, '_').toLowerCase();
      oscAddress = `/fixture/${placedFixture.name.replace(/\s+/g, '_').toLowerCase()}/${safeChannelName}`;
    }
    
    if (oscAddress) {
      navigator.clipboard?.writeText(oscAddress);
      
      addNotification?.({
        type: 'success',
        message: `OSC address copied: ${oscAddress}`,
      });
    }
  };

  const forgetMidiMappingForControl = (fixtureId: string, controlId: string) => {
    const placedFixture = placedFixturesData.find(f => f.id === fixtureId);
    if (!placedFixture) return;

    const control = placedFixture.controls?.find(c => c.id === controlId);
    if (!control) return;

    // Find the DMX channel for this control
    const fixtureDef = fixtures.find(f => f.id === placedFixture.fixtureStoreId);
    if (!fixtureDef) return;

    const channelIndex = fixtureDef.channels.findIndex(ch => ch.name === control.channelNameInFixture);
    if (channelIndex === -1) return;

    const dmxChannel = placedFixture.startAddress + channelIndex;
    removeMidiMapping(dmxChannel);
  };

  const getOscAddressForControl = (fixtureId: string, controlId: string): string => {
    const placedFixture = placedFixturesData.find(f => f.id === fixtureId);
    if (!placedFixture) return '';

    const control = placedFixture.controls?.find(c => c.id === controlId);
    if (!control) return '';

    if (control.type === 'xypad') {
      return `/fixture/${placedFixture.name.replace(/\s+/g, '_').toLowerCase()}/pantilt`;
    } else {
      const safeChannelName = control.channelNameInFixture.replace(/\s+/g, '_').toLowerCase();
      return `/fixture/${placedFixture.name.replace(/\s+/g, '_').toLowerCase()}/${safeChannelName}`;
    }
  };

  const getMidiMappingForControl = (fixtureId: string, controlId: string) => {
    const placedFixture = placedFixturesData.find(f => f.id === fixtureId);
    if (!placedFixture) return null;

    const control = placedFixture.controls?.find(c => c.id === controlId);
    if (!control) return null;

    const fixtureDef = fixtures.find(f => f.id === placedFixture.fixtureStoreId);
    if (!fixtureDef) return null;

    const channelIndex = fixtureDef.channels.findIndex(ch => ch.name === control.channelNameInFixture);
    if (channelIndex === -1) return null;

    const dmxChannel = placedFixture.startAddress + channelIndex;
    return midiMappings[dmxChannel] || null;
  };

  const getSelectedFixtureData = () => {
    if (!selectedFixture) return null;
    return placedFixturesData.find(f => f.id === selectedFixture);
  };

  const getSelectedFixtureDef = () => {
    const placedFixture = getSelectedFixtureData();
    if (!placedFixture) return null;
    return fixtures.find(f => f.id === placedFixture.fixtureStoreId);
  };

  const generateControlsForFixture = (fixtureId: string) => {
    const placedFixture = placedFixturesData.find(f => f.id === fixtureId);
    let fixtureDef = fixtures.find(f => f.id === placedFixture?.fixtureStoreId);
    
    // If not found in fixtures, check if it's a template
    if (!fixtureDef && placedFixture?.fixtureStoreId) {
      const template = fixtureTemplates.find(t => t.id === placedFixture.fixtureStoreId);
      if (template) {
        fixtureDef = template as any; // Cast template to fixture format
      }
    }
    
    if (!placedFixture || !fixtureDef) return;

    // Check if controls are already generated
    if (placedFixture.controls && placedFixture.controls.length > 0) return;

    const controls: PlacedControl[] = [];
    let controlYOffset = 80; // Start below the fixture icon
    let controlXOffset = -150; // Start to the left of the fixture
    let xyPadCreated = false;

    // Look for Pan/Tilt channels to create XY pad
    const panChannel = fixtureDef.channels.findIndex(ch => 
      ch.name.toLowerCase().includes('pan') && !ch.name.toLowerCase().includes('fine')
    );
    const tiltChannel = fixtureDef.channels.findIndex(ch => 
      ch.name.toLowerCase().includes('tilt') && !ch.name.toLowerCase().includes('fine')
    );

    // Create XY pad for Pan/Tilt if both exist
    if (panChannel !== -1 && tiltChannel !== -1) {
      controls.push({
        id: `control-xy-${Date.now()}`,
        channelNameInFixture: 'Pan/Tilt',
        type: 'xypad',
        label: 'Pan/Tilt XY',
        xOffset: controlXOffset,
        yOffset: controlYOffset,
        currentValue: 127, // Middle position
        panValue: dmxChannels[placedFixture.startAddress + panChannel] || 127,
        tiltValue: dmxChannels[placedFixture.startAddress + tiltChannel] || 127,
        panChannelName: fixtureDef.channels[panChannel].name,
        tiltChannelName: fixtureDef.channels[tiltChannel].name,
      });
      controlXOffset += 120; // Move next control to the right
      xyPadCreated = true;
    }

    // Create sliders for other channels
    let sliderCount = 0;
    fixtureDef.channels.forEach((channel, index) => {
      // Skip pan/tilt if XY pad was created
      if (xyPadCreated && (index === panChannel || index === tiltChannel)) {
        return;
      }

      // Skip fine channels for now (could be added later)
      if (channel.name.toLowerCase().includes('fine')) {
        return;
      }

      // Arrange sliders in a grid pattern
      const sliderX = controlXOffset + (sliderCount % 4) * 70;
      const sliderY = controlYOffset + Math.floor(sliderCount / 4) * 90;

      // Special handling for common channel types
      let orientation: 'vertical' | 'horizontal' = 'vertical';
      let controlLabel = channel.name;

      // Color channels could be horizontal
      if (channel.name.toLowerCase().includes('color') || 
          channel.name.toLowerCase().includes('gobo') ||
          channel.name.toLowerCase().includes('speed')) {
        orientation = 'horizontal';
      }

      controls.push({
        id: `control-slider-${index}-${Date.now()}`,
        channelNameInFixture: channel.name,
        type: 'slider',
        label: controlLabel,
        xOffset: sliderX,
        yOffset: sliderY,
        currentValue: dmxChannels[placedFixture.startAddress + index] || 0,
        orientation: orientation,
      });

      sliderCount++;
    });

    // Update the fixture with the generated controls
    const updatedFixtures = placedFixturesData.map(f => 
      f.id === fixtureId ? { ...f, controls } : f
    );
    onUpdatePlacedFixtures(updatedFixtures);

    addNotification?.({
      type: 'success',
      message: `Generated ${controls.length} controls for ${placedFixture.name}`,
    });
  };

  const handleControlValueChange = (fixtureId: string, controlId: string, value: number, controlType?: 'pan' | 'tilt') => {
    const placedFixture = placedFixturesData.find(f => f.id === fixtureId);
    
    // First try to find existing fixture
    let fixtureDef = fixtures.find(f => f.id === placedFixture?.fixtureStoreId);
    
    // If not found, look in templates
    if (!fixtureDef && placedFixture) {
      const template = fixtureTemplates.find(t => t.id === placedFixture.fixtureStoreId);
      if (template) {
        fixtureDef = template as any; // Cast template to fixture format
      }
    }
    
    if (!placedFixture || !fixtureDef) return;

    // Update the control value in state
    const updatedFixtures = placedFixturesData.map(fixture => {
      if (fixture.id === fixtureId && fixture.controls) {
        const updatedControls = fixture.controls.map(control => {
          if (control.id === controlId) {
            if (control.type === 'xypad') {
              if (controlType === 'pan') {
                return { ...control, panValue: value };
              } else if (controlType === 'tilt') {
                return { ...control, tiltValue: value };
              }
            } else {
              return { ...control, currentValue: value };
            }
          }
          return control;
        });
        return { ...fixture, controls: updatedControls };
      }
      return fixture;
    });
    onUpdatePlacedFixtures(updatedFixtures);

    // Find the channel index and set DMX value
    let channelIndex = -1;
    
    if (controlType === 'pan') {
      channelIndex = fixtureDef.channels.findIndex(ch => 
        ch.name.toLowerCase().includes('pan') && !ch.name.toLowerCase().includes('fine')
      );
    } else if (controlType === 'tilt') {
      channelIndex = fixtureDef.channels.findIndex(ch => 
        ch.name.toLowerCase().includes('tilt') && !ch.name.toLowerCase().includes('fine')
      );
    } else {
      // Find control to get channel name
      const control = placedFixture.controls?.find(c => c.id === controlId);
      if (control) {
        channelIndex = fixtureDef.channels.findIndex(ch => ch.name === control.channelNameInFixture);
      }
    }

    if (channelIndex !== -1) {
      const dmxChannel = placedFixture.startAddress + channelIndex;
      setDmxChannelValue(dmxChannel, value);

      if (socket?.emit) {
        socket.emit('dmx:setValue', {
          channel: dmxChannel,
          value,
        });
      }
    }
  };

  const handleControlDrag = (fixtureId: string, controlId: string, data: any) => {
    const { x, y } = data;
    const updatedFixtures = placedFixturesData.map(fixture => {
      if (fixture.id === fixtureId && fixture.controls) {
        const updatedControls = fixture.controls.map(control => 
          control.id === controlId 
            ? { ...control, xOffset: x, yOffset: y }
            : control
        );
        return { ...fixture, controls: updatedControls };
      }
      return fixture;
    });
    onUpdatePlacedFixtures(updatedFixtures);
  };

  const removeControlsForFixture = (fixtureId: string) => {
    const updatedFixtures = placedFixturesData.map(f => 
      f.id === fixtureId ? { ...f, controls: [] } : f
    );
    onUpdatePlacedFixtures(updatedFixtures);

    addNotification?.({
      type: 'info',
      message: 'Controls removed from canvas',
    });
  };

  return (
    <div className={styles.canvasContainer}>
      {/* Professional Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolSection}>
          <div className={styles.toolGroup}>
            <button
              className={`${styles.toolButton} ${selectedTool === 'select' ? styles.active : ''}`}
              onClick={() => setSelectedTool('select')}
              title="Select and move fixtures"
            >
              <LucideIcon name="MousePointer" />
              Select
            </button>
            <button
              className={`${styles.toolButton} ${showFixturePalette ? styles.active : ''}`}
              onClick={() => setShowFixturePalette(!showFixturePalette)}
              title="Show/hide fixture palette"
            >
              <LucideIcon name="Package" />
              Fixture Library
            </button>
          </div>
        </div>

        <div className={styles.toolSection}>
          <div className={styles.toolGroup}>
            <button
              className={`${styles.toggleButton} ${gridEnabled ? styles.active : ''}`}
              onClick={() => setGridEnabled(!gridEnabled)}
              title="Show/hide grid"
            >
              <LucideIcon name="Grid3x3" />
              Grid
            </button>
            <button
              className={`${styles.toggleButton} ${snapToGrid ? styles.active : ''}`}
              onClick={() => setSnapToGrid(!snapToGrid)}
              title="Snap to grid"
            >
              <LucideIcon name="Magnet" />
              Snap
            </button>
          </div>

          <div className={styles.toolGroup}>
            <button
              className={styles.zoomButton}
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              title="Zoom out"
            >
              <LucideIcon name="ZoomOut" />
            </button>
            <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
            <button
              className={styles.zoomButton}
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              title="Zoom in"
            >
              <LucideIcon name="ZoomIn" />
            </button>
          </div>

          {selectedFixture && (
            <div className={styles.toolGroup}>
              <button
                className={styles.controlsButton}
                onClick={() => {
                  const placedFixture = getSelectedFixtureData();
                  if (placedFixture?.controls && placedFixture.controls.length > 0) {
                    removeControlsForFixture(selectedFixture);
                  } else {
                    generateControlsForFixture(selectedFixture);
                  }
                }}
                title={getSelectedFixtureData()?.controls?.length ? "Hide controls" : "Show controls"}
              >
                <LucideIcon name="Sliders" />
                {getSelectedFixtureData()?.controls?.length ? "Hide" : "Show"} Controls
              </button>
              <button
                className={styles.deleteButton}
                onClick={deleteSelectedFixture}
                title="Delete selected fixture"
              >
                <LucideIcon name="Trash2" />
                Delete
              </button>
            </div>
          )}
        </div>

        <div className={styles.statusSection}>
          <span className={styles.fixtureCount}>
            {placedFixturesData.length} fixtures
          </span>
        </div>
      </div>

      {/* Interactive Canvas */}
      <div 
        ref={canvasRef}
        className={`${styles.canvasWrapper} ${isDragOver ? styles.dragOver : ''}`}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ 
          transform: `scale(${zoom})`,
          transformOrigin: 'top left'
        }}
      >
        {/* Grid Background */}
        {gridEnabled && (
          <div className={styles.gridBackground}>
            <svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className={styles.gridSvg}>
              <defs>
                <pattern
                  id="grid"
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                    fill="none"
                    stroke="#333"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        )}

        {/* Draggable Fixtures */}
        {placedFixturesData.map(placedFixture => {
          // First try to find existing fixture
          let fixtureDef = fixtures.find(f => f.id === placedFixture.fixtureStoreId);
          
          // If not found, look in templates
          if (!fixtureDef) {
            const template = fixtureTemplates.find(t => t.id === placedFixture.fixtureStoreId);
            if (template) {
              fixtureDef = template as any; // Cast template to fixture format
            }
          }
          
          if (!fixtureDef) return null;

          return (
            <Draggable
              key={placedFixture.id}
              position={{ x: placedFixture.x, y: placedFixture.y }}
              grid={snapToGrid ? [GRID_SIZE, GRID_SIZE] : undefined}
              onStop={(e, data) => handleFixtureDrag(placedFixture.id, data)}
              disabled={selectedTool !== 'select'}
            >
              <div
                className={`${styles.fixtureItem} ${
                  selectedFixture === placedFixture.id ? styles.selected : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFixture(placedFixture.id);
                  setShowControls(true);
                  // Generate controls if they don't exist
                  if (!placedFixture.controls || placedFixture.controls.length === 0) {
                    generateControlsForFixture(placedFixture.id);
                  }
                }}
                style={{
                  borderColor: getFixtureColor(fixtureDef.type),
                }}
              >
                {/* Fixture Visual */}
                <div 
                  className={styles.fixtureIcon}
                  style={{ backgroundColor: getFixtureColor(fixtureDef.type) }}
                >
                  <LucideIcon name={getFixtureIcon(fixtureDef.type) as any} />
                </div>

                {/* Fixture Info */}
                <div className={styles.fixtureInfo}>
                  <div className={styles.fixtureName}>{fixtureDef.name}</div>
                  <div className={styles.fixtureAddress}>@{placedFixture.startAddress}</div>
                </div>

                {/* Status Light */}
                <div className={styles.statusLight} />

                {/* Quick MIDI/OSC Actions */}
                <div className={styles.quickActions}>
                  <button
                    className={styles.miniButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      startMidiLearnForControl(placedFixture.id, 'quick-midi');
                    }}
                    title="MIDI Learn"
                  >
                    M
                  </button>
                  <button
                    className={styles.miniButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyOscAddressForControl(placedFixture.id, 'quick-osc');
                    }}
                    title="Copy OSC"
                  >
                    O
                  </button>
                </div>
              </div>
            </Draggable>
          );
        })}

        {/* Render Controls for Fixtures */}
        {placedFixturesData.map(placedFixture => {
          if (!placedFixture.controls || placedFixture.controls.length === 0) return null;

          // First try to find existing fixture
          let fixtureDef = fixtures.find(f => f.id === placedFixture.fixtureStoreId);
          
          // If not found, look in templates
          if (!fixtureDef) {
            const template = fixtureTemplates.find(t => t.id === placedFixture.fixtureStoreId);
            if (template) {
              fixtureDef = template as any; // Cast template to fixture format
            }
          }
          
          if (!fixtureDef) return null;

          return (
            <React.Fragment key={`${placedFixture.id}-controls`}>
              {/* Connection Lines */}
              {placedFixture.controls.map(control => (
                <svg
                  key={`line-${control.id}`}
                  className={styles.connectionLine}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <line
                    x1={placedFixture.x + 20} // Center of fixture icon
                    y1={placedFixture.y + 20}
                    x2={placedFixture.x + control.xOffset + (control.type === 'xypad' ? 50 : 30)} // Center of control
                    y2={placedFixture.y + control.yOffset + (control.type === 'xypad' ? 50 : 30)}
                    stroke="rgba(0, 212, 255, 0.3)"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                </svg>
              ))}
              
              {/* Controls */}
              {placedFixture.controls.map(control => (
                <Draggable
                  key={control.id}
                  position={{ 
                    x: placedFixture.x + control.xOffset, 
                    y: placedFixture.y + control.yOffset 
                  }}
                  grid={snapToGrid ? [GRID_SIZE, GRID_SIZE] : undefined}
                  onStop={(e, data) => handleControlDrag(placedFixture.id, control.id, {
                    x: data.x - placedFixture.x,
                    y: data.y - placedFixture.y
                  })}
                  disabled={selectedTool !== 'select'}
                >
                  <div 
                    className={`${styles.controlWrapper} ${
                      selectedFixture === placedFixture.id ? styles.highlighted : ''
                    }`}
                  >
                    {control.type === 'slider' ? (
                      <div 
                        className={`${styles.canvasSlider} ${control.orientation === 'horizontal' ? styles.horizontal : styles.vertical}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className={styles.controlLabel}>{control.label}</label>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={control.currentValue}
                          className={styles.sliderInput}
                          style={{ 
                            writingMode: control.orientation === 'horizontal' ? 'initial' : 'bt-lr' as any,
                            width: control.orientation === 'horizontal' ? '80px' : '6px',
                            height: control.orientation === 'horizontal' ? '6px' : '80px',
                          }}
                          onChange={(e) => handleControlValueChange(
                            placedFixture.id, 
                            control.id, 
                            parseInt(e.target.value)
                          )}
                        />
                        <div className={styles.sliderValue}>{control.currentValue}</div>
                        <div className={styles.controlActions}>
                          <button
                            className={`${styles.miniButton} ${
                              midiLearnTarget?.type === 'placedControl' &&
                              midiLearnTarget.fixtureId === placedFixture.id &&
                              midiLearnTarget.controlId === `fixture-${placedFixture.id}-control-${control.id}`
                                ? styles.learning
                                : ''
                            }`}
                            onClick={() => startMidiLearnForControl(placedFixture.id, control.id)}
                            title="MIDI Learn"
                          >
                            M
                          </button>
                          <button
                            className={styles.miniButton}
                            onClick={() => copyOscAddressForControl(placedFixture.id, control.id)}
                            title="Copy OSC"
                          >
                            O
                          </button>
                          {getMidiMappingForControl(placedFixture.id, control.id) && (
                            <button
                              className={styles.miniButton}
                              onClick={() => forgetMidiMappingForControl(placedFixture.id, control.id)}
                              title="Forget MIDI"
                            >
                              F
                            </button>
                          )}
                        </div>
                        <div className={styles.oscAddress}>
                          {getOscAddressForControl(placedFixture.id, control.id)}
                        </div>
                      </div>
                    ) : control.type === 'xypad' ? (
                      <div 
                        className={styles.canvasXYPad}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className={styles.controlLabel}>{control.label}</label>
                        <div 
                          className={styles.xyPadArea}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              const x = Math.max(0, Math.min(255, ((moveEvent.clientX - rect.left) / rect.width) * 255));
                              const y = Math.max(0, Math.min(255, (1 - (moveEvent.clientY - rect.top) / rect.height) * 255));
                              
                              handleControlValueChange(placedFixture.id, control.id, Math.round(x), 'pan');
                              handleControlValueChange(placedFixture.id, control.id, Math.round(y), 'tilt');
                            };
                            
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };
                            
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                            handleMouseMove(e.nativeEvent);
                          }}
                        >
                          <div className={styles.xyGridLines} />
                          <div 
                            className={styles.xyHandle}
                            style={{
                              left: `${((control.panValue || 127) / 255) * 100}%`,
                              top: `${(1 - (control.tiltValue || 127) / 255) * 100}%`
                            }}
                          />
                        </div>
                        <div className={styles.xyValues}>
                          <span>Pan: {control.panValue || 127}</span>
                          <span>Tilt: {control.tiltValue || 127}</span>
                        </div>
                        <div className={styles.controlActions}>
                          <button
                            className={`${styles.miniButton} ${
                              midiLearnTarget?.type === 'placedControl' &&
                              midiLearnTarget.fixtureId === placedFixture.id &&
                              midiLearnTarget.controlId === `fixture-${placedFixture.id}-control-${control.id}`
                                ? styles.learning
                                : ''
                            }`}
                            onClick={() => startMidiLearnForControl(placedFixture.id, control.id)}
                            title="MIDI Learn Pan"
                          >
                            M
                          </button>
                          <button
                            className={styles.miniButton}
                            onClick={() => copyOscAddressForControl(placedFixture.id, control.id)}
                            title="Copy OSC"
                          >
                            O
                          </button>
                          {getMidiMappingForControl(placedFixture.id, control.id) && (
                            <button
                              className={styles.miniButton}
                              onClick={() => forgetMidiMappingForControl(placedFixture.id, control.id)}
                              title="Forget MIDI"
                            >
                              F
                            </button>
                          )}
                        </div>
                        <div className={styles.oscAddress}>
                          {getOscAddressForControl(placedFixture.id, control.id)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Draggable>
              ))}
            </React.Fragment>
          );
        })}

        {/* Canvas Instructions */}
        {placedFixturesData.length === 0 && (
          <div className={styles.emptyState}>
            <LucideIcon name="Layout" />
            <h3>Professional 2D Lighting Canvas</h3>
            <p>Select "Add Fixture" and choose a fixture type, then click on the canvas to place it.</p>
            <p>Click on fixtures to generate and show their controls on the canvas.</p>
          </div>
        )}
      </div>

      {/* Advanced Control Panel */}
      {showControls && selectedFixture && (
        <div className={styles.controlsPanel}>
          <div className={styles.controlsHeader}>
            <h3>
              {getSelectedFixtureDef()?.name}
              <span className={styles.address}>@{getSelectedFixtureData()?.startAddress}</span>
            </h3>
            <button
              className={styles.closeButton}
              onClick={() => setShowControls(false)}
            >
              <LucideIcon name="X" />
            </button>
          </div>

          <div className={styles.channelControls}>
            {getSelectedFixtureDef()?.channels.map((channel, index) => {
              const placedFixture = getSelectedFixtureData();
              if (!placedFixture) return null;

              const dmxChannel = placedFixture.startAddress + index;
              const currentValue = dmxChannels[dmxChannel] || 0;

              return (
                <div key={index} className={styles.channelControl}>
                  <div className={styles.channelHeader}>
                    <span className={styles.channelName}>
                      {channel.name || `Ch ${index + 1}`}
                    </span>
                    <span className={styles.channelValue}>{currentValue}</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={currentValue}
                    className={styles.channelSlider}
                    onChange={(e) => handleChannelChange(selectedFixture, index, parseInt(e.target.value))}
                  />

                  <div className={styles.channelActions}>
                    <button
                      className={`${styles.midiButton} ${
                        midiLearnTarget?.type === 'placedControl' &&
                        midiLearnTarget.fixtureId === selectedFixture &&
                        midiLearnTarget.controlId === `fixture-${selectedFixture}-control-channel-${index}`
                          ? styles.learning
                          : ''
                      }`}
                      onClick={() => startMidiLearnForControl(selectedFixture, `channel-${index}`)}
                      title="MIDI Learn"
                    >
                      <LucideIcon name="Music" />
                      MIDI
                    </button>
                    <button
                      className={styles.oscButton}
                      onClick={() => copyOscAddressForControl(selectedFixture, `channel-${index}`, channel.name)}
                      title="Copy OSC Address"
                    >
                      <LucideIcon name="Copy" />
                      OSC
                    </button>
                    {getMidiMappingForControl(selectedFixture, `channel-${index}`) && (
                      <button
                        className={styles.forgetButton}
                        onClick={() => forgetMidiMappingForControl(selectedFixture, `channel-${index}`)}
                        title="Forget MIDI Mapping"
                      >
                        <LucideIcon name="X" />
                        Forget
                      </button>
                    )}
                  </div>
                  <div className={styles.oscAddress}>
                    {getOscAddressForControl(selectedFixture, `channel-${index}`)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Advanced Controls */}
          <div className={styles.advancedControls}>
            <h4>Advanced</h4>
            <div className={styles.advancedGrid}>
              <label>
                DMX Address:
                <input
                  type="number"
                  min="1"
                  max="512"
                  value={getSelectedFixtureData()?.startAddress || 1}
                  className={styles.addressInput}
                  onChange={(e) => {
                    const newAddress = parseInt(e.target.value);
                    if (selectedFixture) {
                      const updatedFixtures = placedFixturesData.map(f => 
                        f.id === selectedFixture ? { ...f, startAddress: newAddress } : f
                      );
                      onUpdatePlacedFixtures(updatedFixtures);
                    }
                  }}
                />
              </label>
              <button
                className={styles.duplicateButton}
                onClick={() => {
                  const current = getSelectedFixtureData();
                  if (current) {
                    addFixtureToCanvas(current.fixtureStoreId, current.x + 100, current.y + 100);
                  }
                }}
                title="Duplicate fixture"
              >
                <LucideIcon name="Copy" />
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draggable Fixture Palette */}
      {showFixturePalette && (
        <DraggableFixturePalette
          fixtures={fixtures}
          onFixtureDrop={addFixtureToCanvas}
          canvasRef={canvasRef}
        />
      )}
    </div>
  );
};

export default FixtureCanvasInteractive;
