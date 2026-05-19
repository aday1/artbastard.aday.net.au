import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { useSuperControlMidiLearn } from '../../hooks/useSuperControlMidiLearn';
import DraggablePanel from './DraggablePanel';
import EnhancedSlider from './EnhancedSlider';
import styles from './SuperControl.module.scss';

interface SuperControlDraggableProps {
  isDockable?: boolean;
}

type PanelConfig = {
  id: string;
  title: string;
  icon: string;
  visible: boolean;
  position: { x: number; y: number };
  minimized: boolean;
};

const SuperControlDraggable: React.FC<SuperControlDraggableProps> = ({ isDockable = false }) => {
  const {
    fixtures,
    selectedFixtures,
    getDmxChannelValue,
    setDmxChannelValue,
    // Autopilot
    autopilotTrackEnabled,
    autopilotTrackType,
    autopilotTrackPosition,
    autopilotTrackSize,
    autopilotTrackSpeed,
    autopilotTrackCenterX,
    autopilotTrackCenterY,
    setAutopilotTrackEnabled,
    setAutopilotTrackType,
    setAutopilotTrackPosition,
    setAutopilotTrackSize,
    setAutopilotTrackSpeed,
    setAutopilotTrackCenter,
    updatePanTiltFromTrack,
  } = useStore();
  // MIDI Learn functionality
  const {
    startLearn: startMidiLearn,
    cancelLearn: cancelMidiLearn,
    forgetMapping: forgetMidiMapping,
    isLearning: isMidiLearning,
    learnStatus: superControlLearnStatus,
    currentLearningControlName,
    mappings: midiMappings
  } = useSuperControlMidiLearn();

  // Panel configuration
  const [panels, setPanels] = useState<PanelConfig[]>([
    { id: 'basic', title: 'Basic Controls', icon: 'Sliders', visible: true, position: { x: 50, y: 50 }, minimized: false },
    { id: 'pantilt', title: 'Pan/Tilt', icon: 'Move', visible: true, position: { x: 400, y: 50 }, minimized: false },
    { id: 'color', title: 'Color Controls', icon: 'Palette', visible: true, position: { x: 50, y: 300 }, minimized: false },
    { id: 'effects', title: 'Effects', icon: 'Zap', visible: true, position: { x: 400, y: 300 }, minimized: false },
    { id: 'autopilot', title: 'Autopilot', icon: 'Navigation', visible: true, position: { x: 750, y: 50 }, minimized: false },
  ]);

  // Control states
  const [dimmer, setDimmer] = useState(255);
  const [panValue, setPanValue] = useState(127);
  const [tiltValue, setTiltValue] = useState(127);
  const [red, setRed] = useState(255);
  const [green, setGreen] = useState(255);
  const [blue, setBlue] = useState(255);
  const [gobo, setGobo] = useState(0);
  const [shutter, setShutter] = useState(255);
  const [strobe, setStrobe] = useState(0);
  const [focus, setFocus] = useState(127);
  const [zoom, setZoom] = useState(127);
  const [iris, setIris] = useState(255);
  const [prism, setPrism] = useState(0);

  // OSC addresses
  const [oscAddresses, setOscAddresses] = useState<Record<string, string>>({
    dimmer: '/supercontrol/dimmer',
    pan: '/supercontrol/pan',
    tilt: '/supercontrol/tilt',
    red: '/supercontrol/red',
    green: '/supercontrol/green',
    blue: '/supercontrol/blue',
    gobo: '/supercontrol/gobo',
    shutter: '/supercontrol/shutter',
    strobe: '/supercontrol/strobe',
    focus: '/supercontrol/focus',
    zoom: '/supercontrol/zoom',
    iris: '/supercontrol/iris',
    prism: '/supercontrol/prism',
    autopilotPosition: '/supercontrol/autopilot/position',
    autopilotSize: '/supercontrol/autopilot/size',
    autopilotSpeed: '/supercontrol/autopilot/speed',
  });

  // Layout toggle
  const [useDraggableLayout, setUseDraggableLayout] = useState(true);

  // Autopilot animation is now handled in the centralized store
  // This was removed to prevent conflicts with the store-based animation system

  // Apply DMX control
  const applyControl = (type: string, value: number) => {
    console.log(`[SuperControl] Applying ${type} control with value ${value}`);
    
    let affectedFixtures: any[] = [];
    if (selectedFixtures.length > 0) {
      affectedFixtures = fixtures.filter(f => selectedFixtures.includes(f.id));
    } else {
      affectedFixtures = fixtures;
    }

    affectedFixtures.forEach(fixture => {
      fixture.channels.forEach(channel => {
        if (channel.type.toLowerCase() === type.toLowerCase() && typeof channel.dmxAddress === 'number') {
          setDmxChannelValue(channel.dmxAddress, value);
        }
      });
    });
  };

  // Panel management
  const updatePanelPosition = (panelId: string, position: { x: number; y: number }) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, position } : panel
    ));
  };

  const togglePanelMinimized = (panelId: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, minimized: !panel.minimized } : panel
    ));
  };

  const togglePanelVisible = (panelId: string) => {
    setPanels(prev => prev.map(panel => 
      panel.id === panelId ? { ...panel, visible: !panel.visible } : panel
    ));
  };

  // MIDI Learn handlers
  const handleMidiLearn = (controlName: string) => {
    if (isMidiLearning) {
      cancelMidiLearn();
    } else {
      startMidiLearn(controlName);
    }
  };

  const handleMidiForget = (controlName: string) => {
    forgetMidiMapping(controlName);
  };

  const handleOscAddressChange = (controlName: string, address: string) => {
    setOscAddresses(prev => ({ ...prev, [controlName]: address }));
  };

  // Render Basic Controls Panel
  const renderBasicControlsPanel = () => (
    <DraggablePanel
      title="Basic Controls"
      icon="Sliders"
      initialPosition={panels.find(p => p.id === 'basic')?.position}
      onPositionChange={(pos) => updatePanelPosition('basic', pos)}
      onMinimize={() => togglePanelMinimized('basic')}
      isMinimized={panels.find(p => p.id === 'basic')?.minimized}
    >
      <EnhancedSlider
        label="Dimmer"
        value={dimmer}
        onChange={(value) => {
          setDimmer(value);
          applyControl('dimmer', value);
        }}
        min={0}
        max={255}
        icon="Sun"        midiMapping={midiMappings.dimmer ? {
          channel: midiMappings.dimmer.channel,
          note: midiMappings.dimmer.note,
          cc: midiMappings.dimmer.controller,
          minValue: midiMappings.dimmer.minValue || 0,
          maxValue: midiMappings.dimmer.maxValue || 255
        } : undefined}
        oscAddress={oscAddresses.dimmer}
        onMidiLearn={() => handleMidiLearn('dimmer')}
        onMidiForget={() => handleMidiForget('dimmer')}
        onOscAddressChange={(address) => handleOscAddressChange('dimmer', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'dimmer'}
      />

      <EnhancedSlider
        label="Shutter"
        value={shutter}
        onChange={(value) => {
          setShutter(value);
          applyControl('shutter', value);
        }}
        min={0}
        max={255}
        icon="Camera"
        midiMapping={midiMappings.shutter}
        oscAddress={oscAddresses.shutter}
        onMidiLearn={() => handleMidiLearn('shutter')}
        onMidiForget={() => handleMidiForget('shutter')}
        onOscAddressChange={(address) => handleOscAddressChange('shutter', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'shutter'}
      />

      <EnhancedSlider
        label="Strobe"
        value={strobe}
        onChange={(value) => {
          setStrobe(value);
          applyControl('strobe', value);
        }}
        min={0}
        max={255}
        icon="Zap"
        midiMapping={midiMappings.strobe}
        oscAddress={oscAddresses.strobe}
        onMidiLearn={() => handleMidiLearn('strobe')}
        onMidiForget={() => handleMidiForget('strobe')}
        onOscAddressChange={(address) => handleOscAddressChange('strobe', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'strobe'}
      />
    </DraggablePanel>
  );

  // Render Pan/Tilt Panel
  const renderPanTiltPanel = () => (
    <DraggablePanel
      title="Pan/Tilt"
      icon="Move"
      initialPosition={panels.find(p => p.id === 'pantilt')?.position}
      onPositionChange={(pos) => updatePanelPosition('pantilt', pos)}
      onMinimize={() => togglePanelMinimized('pantilt')}
      isMinimized={panels.find(p => p.id === 'pantilt')?.minimized}
    >
      <EnhancedSlider
        label="Pan"
        value={panValue}
        onChange={(value) => {
          setPanValue(value);
          applyControl('pan', value);
        }}
        min={0}
        max={255}
        icon="ArrowLeftRight"
        midiMapping={midiMappings.pan}
        oscAddress={oscAddresses.pan}
        onMidiLearn={() => handleMidiLearn('pan')}
        onMidiForget={() => handleMidiForget('pan')}
        onOscAddressChange={(address) => handleOscAddressChange('pan', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'pan'}
      />

      <EnhancedSlider
        label="Tilt"
        value={tiltValue}
        onChange={(value) => {
          setTiltValue(value);
          applyControl('tilt', value);
        }}
        min={0}
        max={255}
        icon="ArrowUpDown"
        midiMapping={midiMappings.tilt}
        oscAddress={oscAddresses.tilt}
        onMidiLearn={() => handleMidiLearn('tilt')}
        onMidiForget={() => handleMidiForget('tilt')}
        onOscAddressChange={(address) => handleOscAddressChange('tilt', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'tilt'}
      />
    </DraggablePanel>
  );

  // Render Color Panel
  const renderColorPanel = () => (
    <DraggablePanel
      title="Color Controls"
      icon="Palette"
      initialPosition={panels.find(p => p.id === 'color')?.position}
      onPositionChange={(pos) => updatePanelPosition('color', pos)}
      onMinimize={() => togglePanelMinimized('color')}
      isMinimized={panels.find(p => p.id === 'color')?.minimized}
    >
      <EnhancedSlider
        label="Red"
        value={red}
        onChange={(value) => {
          setRed(value);
          applyControl('red', value);
        }}
        min={0}
        max={255}
        icon="Circle"
        midiMapping={midiMappings.red}
        oscAddress={oscAddresses.red}
        onMidiLearn={() => handleMidiLearn('red')}
        onMidiForget={() => handleMidiForget('red')}
        onOscAddressChange={(address) => handleOscAddressChange('red', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'red'}
      />

      <EnhancedSlider
        label="Green"
        value={green}
        onChange={(value) => {
          setGreen(value);
          applyControl('green', value);
        }}
        min={0}
        max={255}
        icon="Circle"
        midiMapping={midiMappings.green}
        oscAddress={oscAddresses.green}
        onMidiLearn={() => handleMidiLearn('green')}
        onMidiForget={() => handleMidiForget('green')}
        onOscAddressChange={(address) => handleOscAddressChange('green', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'green'}
      />

      <EnhancedSlider
        label="Blue"
        value={blue}
        onChange={(value) => {
          setBlue(value);
          applyControl('blue', value);
        }}
        min={0}
        max={255}
        icon="Circle"
        midiMapping={midiMappings.blue}
        oscAddress={oscAddresses.blue}
        onMidiLearn={() => handleMidiLearn('blue')}
        onMidiForget={() => handleMidiForget('blue')}
        onOscAddressChange={(address) => handleOscAddressChange('blue', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'blue'}
      />
    </DraggablePanel>
  );

  // Render Effects Panel
  const renderEffectsPanel = () => (
    <DraggablePanel
      title="Effects"
      icon="Zap"
      initialPosition={panels.find(p => p.id === 'effects')?.position}
      onPositionChange={(pos) => updatePanelPosition('effects', pos)}
      onMinimize={() => togglePanelMinimized('effects')}
      isMinimized={panels.find(p => p.id === 'effects')?.minimized}
    >
      <EnhancedSlider
        label="Gobo"
        value={gobo}
        onChange={(value) => {
          setGobo(value);
          applyControl('gobo', value);
        }}
        min={0}
        max={255}
        icon="Disc"
        midiMapping={midiMappings.gobo}
        oscAddress={oscAddresses.gobo}
        onMidiLearn={() => handleMidiLearn('gobo')}
        onMidiForget={() => handleMidiForget('gobo')}
        onOscAddressChange={(address) => handleOscAddressChange('gobo', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'gobo'}
      />

      <EnhancedSlider
        label="Focus"
        value={focus}
        onChange={(value) => {
          setFocus(value);
          applyControl('focus', value);
        }}
        min={0}
        max={255}
        icon="Focus"
        midiMapping={midiMappings.focus}
        oscAddress={oscAddresses.focus}
        onMidiLearn={() => handleMidiLearn('focus')}
        onMidiForget={() => handleMidiForget('focus')}
        onOscAddressChange={(address) => handleOscAddressChange('focus', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'focus'}
      />

      <EnhancedSlider
        label="Zoom"
        value={zoom}
        onChange={(value) => {
          setZoom(value);
          applyControl('zoom', value);
        }}
        min={0}
        max={255}
        icon="ZoomIn"
        midiMapping={midiMappings.zoom}
        oscAddress={oscAddresses.zoom}
        onMidiLearn={() => handleMidiLearn('zoom')}
        onMidiForget={() => handleMidiForget('zoom')}
        onOscAddressChange={(address) => handleOscAddressChange('zoom', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'zoom'}
      />

      <EnhancedSlider
        label="Iris"
        value={iris}
        onChange={(value) => {
          setIris(value);
          applyControl('iris', value);
        }}
        min={0}
        max={255}
        icon="Aperture"
        midiMapping={midiMappings.iris}
        oscAddress={oscAddresses.iris}
        onMidiLearn={() => handleMidiLearn('iris')}
        onMidiForget={() => handleMidiForget('iris')}
        onOscAddressChange={(address) => handleOscAddressChange('iris', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'iris'}
      />

      <EnhancedSlider
        label="Prism"
        value={prism}
        onChange={(value) => {
          setPrism(value);
          applyControl('prism', value);
        }}
        min={0}
        max={255}
        icon="Triangle"
        midiMapping={midiMappings.prism}
        oscAddress={oscAddresses.prism}
        onMidiLearn={() => handleMidiLearn('prism')}
        onMidiForget={() => handleMidiForget('prism')}
        onOscAddressChange={(address) => handleOscAddressChange('prism', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'prism'}
      />
    </DraggablePanel>
  );

  // Render Autopilot Panel
  const renderAutopilotPanel = () => (
    <DraggablePanel
      title="Autopilot"
      icon="Navigation"
      initialPosition={panels.find(p => p.id === 'autopilot')?.position}
      onPositionChange={(pos) => updatePanelPosition('autopilot', pos)}
      onMinimize={() => togglePanelMinimized('autopilot')}
      isMinimized={panels.find(p => p.id === 'autopilot')?.minimized}
    >
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => {
            const newState = !autopilotTrackEnabled;
            setAutopilotTrackEnabled(newState);
            
            // If enabling autopilot, immediately apply current position
            if (newState) {
              console.log('🤖 Autopilot enabled - applying initial position');
              setTimeout(() => {
                updatePanTiltFromTrack();
              }, 100);
            } else {
              console.log('🛑 Autopilot disabled');
            }
          }}
          style={{
            background: autopilotTrackEnabled ? '#28a745' : '#6c757d',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 16px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            justifyContent: 'center'
          }}
        >
          <LucideIcon name={autopilotTrackEnabled ? "Play" : "Pause"} />
          {autopilotTrackEnabled ? 'Autopilot ON' : 'Autopilot OFF'}
        </button>
      </div>

      {/* Track Type Selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#ccc' }}>
          Track Pattern
        </label>
        <select
          value={autopilotTrackType}
          onChange={(e) => {
            setAutopilotTrackType(e.target.value as any);
            // Apply new pattern immediately if autopilot is enabled
            if (autopilotTrackEnabled) {
              setTimeout(() => updatePanTiltFromTrack(), 50);
            }
          }}
          style={{
            width: '100%',
            padding: '6px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: '#2a2a2a',
            color: '#fff'
          }}
        >
          <option value="circle">Circle</option>
          <option value="square">Square</option>
          <option value="figure8">Figure 8</option>
          <option value="triangle">Triangle</option>
          <option value="linear">Linear</option>
          <option value="random">Random</option>
        </select>
      </div>

      <EnhancedSlider
        label="Position"
        value={autopilotTrackPosition}
        onChange={(value) => {
          setAutopilotTrackPosition(value);
          // Apply position change immediately if autopilot is enabled
          if (autopilotTrackEnabled) {
            setTimeout(() => updatePanTiltFromTrack(), 10);
          }
        }}
        min={0}
        max={100}
        icon="MapPin"
        midiMapping={midiMappings.autopilotPosition}
        oscAddress={oscAddresses.autopilotPosition}
        onMidiLearn={() => handleMidiLearn('autopilotPosition')}
        onMidiForget={() => handleMidiForget('autopilotPosition')}
        onOscAddressChange={(address) => handleOscAddressChange('autopilotPosition', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'autopilotPosition'}
        disabled={!autopilotTrackEnabled}
      />

      <EnhancedSlider
        label="Size"
        value={autopilotTrackSize}
        onChange={(value) => {
          setAutopilotTrackSize(value);
        }}
        min={0}
        max={100}
        icon="Maximize"
        midiMapping={midiMappings.autopilotSize}
        oscAddress={oscAddresses.autopilotSize}
        onMidiLearn={() => handleMidiLearn('autopilotSize')}
        onMidiForget={() => handleMidiForget('autopilotSize')}
        onOscAddressChange={(address) => handleOscAddressChange('autopilotSize', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'autopilotSize'}
        disabled={!autopilotTrackEnabled}
      />

      <EnhancedSlider
        label="Track Size"
        value={autopilotTrackSize}
        onChange={(value) => {
          setAutopilotTrackSize(value);
          // Apply size change immediately if autopilot is enabled
          if (autopilotTrackEnabled) {
            setTimeout(() => updatePanTiltFromTrack(), 10);
          }
        }}
        min={10}
        max={100}
        icon="Maximize"
        midiMapping={midiMappings.autopilotSize}
        oscAddress={oscAddresses.autopilotSize}
        onMidiLearn={() => handleMidiLearn('autopilotSize')}
        onMidiForget={() => handleMidiForget('autopilotSize')}
        onOscAddressChange={(address) => handleOscAddressChange('autopilotSize', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'autopilotSize'}
        disabled={!autopilotTrackEnabled}
      />

      <EnhancedSlider
        label="Speed"
        value={autopilotTrackSpeed}
        onChange={(value) => {
          setAutopilotTrackSpeed(value);
        }}
        min={1}
        max={100}
        icon="Gauge"
        midiMapping={midiMappings.autopilotSpeed}
        oscAddress={oscAddresses.autopilotSpeed}
        onMidiLearn={() => handleMidiLearn('autopilotSpeed')}
        onMidiForget={() => handleMidiForget('autopilotSpeed')}
        onOscAddressChange={(address) => handleOscAddressChange('autopilotSpeed', address)}
        isMidiLearning={isMidiLearning && currentLearningControlName === 'autopilotSpeed'}
        disabled={!autopilotTrackEnabled}
      />

      {/* Center Position Controls */}
      <div style={{ marginTop: '16px', marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#ccc' }}>
          Center Position
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#aaa' }}>X (Pan)</label>
            <input
              type="range"
              min="0"
              max="255"
              value={autopilotTrackCenterX}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setAutopilotTrackCenter(value, autopilotTrackCenterY);
                if (autopilotTrackEnabled) {
                  setTimeout(() => updatePanTiltFromTrack(), 10);
                }
              }}
              style={{ width: '100%' }}
              disabled={!autopilotTrackEnabled}
            />
            <span style={{ fontSize: '10px', color: '#888' }}>{autopilotTrackCenterX}</span>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#aaa' }}>Y (Tilt)</label>
            <input
              type="range"
              min="0"
              max="255"
              value={autopilotTrackCenterY}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setAutopilotTrackCenter(autopilotTrackCenterX, value);
                if (autopilotTrackEnabled) {
                  setTimeout(() => updatePanTiltFromTrack(), 10);
                }
              }}
              style={{ width: '100%' }}
              disabled={!autopilotTrackEnabled}
            />
            <span style={{ fontSize: '10px', color: '#888' }}>{autopilotTrackCenterY}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <button
          onClick={() => {
            console.log('🎯 Testing Autopilot DMX Updates');
            console.log('Current autopilot state:', {
              enabled: autopilotTrackEnabled,
              type: autopilotTrackType,
              position: autopilotTrackPosition,
              size: autopilotTrackSize,
              centerX: autopilotTrackCenterX,
              centerY: autopilotTrackCenterY,
              selectedFixtures: selectedFixtures.length
            });
            updatePanTiltFromTrack();
          }}
          style={{
            background: 'rgba(0, 212, 255, 0.2)',
            border: '1px solid rgba(0, 212, 255, 0.5)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#00d4ff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            justifyContent: 'center'
          }}
        >
          <LucideIcon name="Zap" />
          Test DMX
        </button>
      </div>
    </DraggablePanel>
  );

  return (
    <div className={styles.superControl}>
      {/* Panel Toggle Controls */}
      <div className={styles.panelToggle}>
        <button
          className={useDraggableLayout ? styles.active : ''}
          onClick={() => setUseDraggableLayout(!useDraggableLayout)}
        >
          <LucideIcon name={useDraggableLayout ? "Grid3X3" : "Layout"} />
          {useDraggableLayout ? 'Grid Layout' : 'Draggable'}
        </button>
        
        {panels.map(panel => (
          <button
            key={panel.id}
            onClick={() => togglePanelVisible(panel.id)}
            style={{ 
              background: panel.visible ? 'rgba(40, 167, 69, 0.9)' : 'rgba(108, 117, 125, 0.9)' 
            }}
          >
            <LucideIcon name={panel.icon as any} />
            {panel.title}
          </button>
        ))}
      </div>

      {useDraggableLayout ? (
        <div className={styles.draggableContainer}>
          {panels.find(p => p.id === 'basic')?.visible && renderBasicControlsPanel()}
          {panels.find(p => p.id === 'pantilt')?.visible && renderPanTiltPanel()}
          {panels.find(p => p.id === 'color')?.visible && renderColorPanel()}
          {panels.find(p => p.id === 'effects')?.visible && renderEffectsPanel()}
          {panels.find(p => p.id === 'autopilot')?.visible && renderAutopilotPanel()}
        </div>
      ) : (
        <div className={styles.gridLayout}>
          {panels.find(p => p.id === 'basic')?.visible && renderBasicControlsPanel()}
          {panels.find(p => p.id === 'pantilt')?.visible && renderPanTiltPanel()}
          {panels.find(p => p.id === 'color')?.visible && renderColorPanel()}
          {panels.find(p => p.id === 'effects')?.visible && renderEffectsPanel()}
          {panels.find(p => p.id === 'autopilot')?.visible && renderAutopilotPanel()}
        </div>
      )}
    </div>
  );
};

export default SuperControlDraggable;
