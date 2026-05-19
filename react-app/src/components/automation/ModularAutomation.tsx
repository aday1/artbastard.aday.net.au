import React, { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/store';
import styles from './ModularAutomation.module.scss';

const ModularAutomation: React.FC = () => {
  const {
    modularAutomation,
    setColorAutomation,
    setDimmerAutomation,
    setPanTiltAutomation,
    setEffectsAutomation,
    toggleColorAutomation,
    toggleDimmerAutomation,
    togglePanTiltAutomation,
    toggleEffectsAutomation,
    selectedFixtures,
    fixtures,
    setDmxChannelValue,
    // BPM and timing from ClockManager
    midiClockBpm,
    midiClockIsPlaying,
    midiClockCurrentBeat,
    midiClockCurrentBar
  } = useStore();

  // Animation refs
  const animationFrameRefs = useRef<{
    color?: number;
    dimmer?: number;
    panTilt?: number;
    effects?: number;
  }>({});
  
  const animationStateRefs = useRef<{
    colorPhase: number;
    dimmerPhase: number;
    panTiltPhase: number;
    effectsPhase: number;
    lastUpdateTime: number;
  }>({
    colorPhase: 0,
    dimmerPhase: 0,
    panTiltPhase: 0,
    effectsPhase: 0,
    lastUpdateTime: performance.now()
  });

  // Get selected fixture data with their DMX channels
  const getSelectedFixtureData = useCallback(() => {
    return selectedFixtures.map(fixtureId => {
      const fixture = fixtures.find(f => f.id === fixtureId);
      if (!fixture) return null;
      
      return {
        fixture,
        channels: {
          red: fixture.channels?.find(ch => ch.type === 'red')?.dmxAddress || 
               ((fixture.channels?.findIndex(ch => ch.type === 'red') !== -1) ? 
               (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'red')) : undefined),
          green: fixture.channels?.find(ch => ch.type === 'green')?.dmxAddress || 
                 ((fixture.channels?.findIndex(ch => ch.type === 'green') !== -1) ? 
                 (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'green')) : undefined),
          blue: fixture.channels?.find(ch => ch.type === 'blue')?.dmxAddress || 
                ((fixture.channels?.findIndex(ch => ch.type === 'blue') !== -1) ? 
                (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'blue')) : undefined),
          dimmer: fixture.channels?.find(ch => ch.type === 'dimmer' || ch.type === 'intensity')?.dmxAddress || 
                  ((fixture.channels?.findIndex(ch => ch.type === 'dimmer' || ch.type === 'intensity') !== -1) ? 
                  (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'dimmer' || ch.type === 'intensity')) : undefined),
          pan: fixture.channels?.find(ch => ch.type === 'pan')?.dmxAddress || 
               ((fixture.channels?.findIndex(ch => ch.type === 'pan') !== -1) ? 
               (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'pan')) : undefined),
          tilt: fixture.channels?.find(ch => ch.type === 'tilt')?.dmxAddress || 
                ((fixture.channels?.findIndex(ch => ch.type === 'tilt') !== -1) ? 
                (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'tilt')) : undefined),
          strobe: fixture.channels?.find(ch => ch.type === 'strobe')?.dmxAddress || 
                  ((fixture.channels?.findIndex(ch => ch.type === 'strobe') !== -1) ? 
                  (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'strobe')) : undefined),
          gobo: fixture.channels?.find(ch => ch.type === 'gobo_wheel' || ch.type === 'gobo')?.dmxAddress || 
                ((fixture.channels?.findIndex(ch => ch.type === 'gobo_wheel' || ch.type === 'gobo') !== -1) ? 
                (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'gobo_wheel' || ch.type === 'gobo')) : undefined),
          prism: fixture.channels?.find(ch => ch.type === 'prism')?.dmxAddress || 
                 ((fixture.channels?.findIndex(ch => ch.type === 'prism') !== -1) ? 
                 (fixture.startAddress + fixture.channels.findIndex(ch => ch.type === 'prism')) : undefined)
        }
      };
    }).filter(Boolean);
  }, [selectedFixtures, fixtures]);

  // Calculate timing based on BPM and sync settings
  const getEffectiveSpeed = useCallback((moduleConfig: any) => {
    if (moduleConfig.syncToBPM && midiClockIsPlaying && midiClockBpm > 0) {
      // Convert BPM to Hz (beats per second)
      const beatsPerSecond = midiClockBpm / 60;
      return beatsPerSecond * moduleConfig.speed;
    }
    return moduleConfig.speed;
  }, [midiClockBpm, midiClockIsPlaying]);

  // Color Animation Loop
  const animateColor = useCallback(() => {
    if (!modularAutomation.color.enabled || selectedFixtures.length === 0) {
      if (animationFrameRefs.current.color) {
        cancelAnimationFrame(animationFrameRefs.current.color);
        animationFrameRefs.current.color = undefined;
      }
      return;
    }

    const fixtureData = getSelectedFixtureData();
    const now = performance.now();
    const deltaTime = now - animationStateRefs.current.lastUpdateTime;
    
    const effectiveSpeed = getEffectiveSpeed(modularAutomation.color);
    const phaseIncrement = (deltaTime / 1000) * effectiveSpeed;
    animationStateRefs.current.colorPhase += phaseIncrement;
    
    // Keep phase within reasonable bounds
    if (animationStateRefs.current.colorPhase > Math.PI * 4) {
      animationStateRefs.current.colorPhase -= Math.PI * 4;
    }

    const phase = animationStateRefs.current.colorPhase;
    const intensity = modularAutomation.color.intensity / 100;

    fixtureData.forEach((data, index) => {
      if (!data?.channels.red || !data?.channels.green || !data?.channels.blue) return;

      let r = 0, g = 0, b = 0;
      const fixturePhase = phase + (index * Math.PI * 2 / fixtureData.length); // Offset for wave effects

      switch (modularAutomation.color.type) {
        case 'rainbow':
          r = Math.round((Math.sin(fixturePhase) * 0.5 + 0.5) * 255 * intensity);
          g = Math.round((Math.sin(fixturePhase + Math.PI * 2/3) * 0.5 + 0.5) * 255 * intensity);
          b = Math.round((Math.sin(fixturePhase + Math.PI * 4/3) * 0.5 + 0.5) * 255 * intensity);
          break;
          
        case 'pulse':
          const pulseBrightness = (Math.sin(phase) * 0.5 + 0.5) * intensity;
          r = Math.round(255 * pulseBrightness);
          g = Math.round(128 * pulseBrightness);
          b = Math.round(64 * pulseBrightness);
          break;
          
        case 'wave':
          const waveBrightness = (Math.sin(fixturePhase) * 0.5 + 0.5) * intensity;
          r = Math.round(255 * waveBrightness);
          g = Math.round(200 * waveBrightness);
          b = Math.round(100 * waveBrightness);
          break;
          
        case 'strobe':
          if (midiClockIsPlaying && modularAutomation.color.syncToBPM) {
            // Strobe on beat
            const onBeat = (midiClockCurrentBeat === 1) || (midiClockCurrentBeat === 3);
            const brightness = onBeat ? intensity : 0;
            r = g = b = Math.round(255 * brightness);
          } else {
            const brightness = (Math.sin(phase * 4) > 0.5) ? intensity : 0;
            r = g = b = Math.round(255 * brightness);
          }
          break;
          
        case 'random':
          if (Math.random() < 0.02) { // Change colors randomly
            r = Math.round(Math.random() * 255 * intensity);
            g = Math.round(Math.random() * 255 * intensity);
            b = Math.round(Math.random() * 255 * intensity);
          } else {
            // Keep previous values (would need state tracking for this)
            return;
          }
          break;
          
        default: // cycle
          const cyclePosition = (phase % (Math.PI * 2)) / (Math.PI * 2);
          if (cyclePosition < 1/3) {
            r = Math.round(255 * intensity);
            g = b = 0;
          } else if (cyclePosition < 2/3) {
            g = Math.round(255 * intensity);
            r = b = 0;
          } else {
            b = Math.round(255 * intensity);
            r = g = 0;
          }
      }

      setDmxChannelValue(data.channels.red, r);
      setDmxChannelValue(data.channels.green, g);
      setDmxChannelValue(data.channels.blue, b);
    });

    animationFrameRefs.current.color = requestAnimationFrame(animateColor);
  }, [
    modularAutomation.color,
    selectedFixtures,
    getSelectedFixtureData,
    getEffectiveSpeed,
    setDmxChannelValue,
    midiClockIsPlaying,
    midiClockCurrentBeat
  ]);

  // Dimmer Animation Loop
  const animateDimmer = useCallback(() => {
    if (!modularAutomation.dimmer.enabled || selectedFixtures.length === 0) {
      if (animationFrameRefs.current.dimmer) {
        cancelAnimationFrame(animationFrameRefs.current.dimmer);
        animationFrameRefs.current.dimmer = undefined;
      }
      return;
    }

    const fixtureData = getSelectedFixtureData();
    const now = performance.now();
    const deltaTime = now - animationStateRefs.current.lastUpdateTime;
    
    const effectiveSpeed = getEffectiveSpeed(modularAutomation.dimmer);
    const phaseIncrement = (deltaTime / 1000) * effectiveSpeed;
    animationStateRefs.current.dimmerPhase += phaseIncrement;
    
    const phase = animationStateRefs.current.dimmerPhase;
    const { range } = modularAutomation.dimmer;
    const rangeSize = range.max - range.min;

    fixtureData.forEach((data, index) => {
      if (!data?.channels.dimmer) return;

      let dimmerValue = 0;
      const fixturePhase = phase + (index * Math.PI / fixtureData.length);

      switch (modularAutomation.dimmer.type) {
        case 'pulse':
          dimmerValue = range.min + ((Math.sin(phase) * 0.5 + 0.5) * rangeSize);
          break;
          
        case 'strobe':
          if (midiClockIsPlaying && modularAutomation.dimmer.syncToBPM) {
            const onBeat = (midiClockCurrentBeat === 1);
            dimmerValue = onBeat ? range.max : range.min;
          } else {
            dimmerValue = (Math.sin(phase * 8) > 0) ? range.max : range.min;
          }
          break;
          
        case 'breathe':
          const breatheValue = Math.pow(Math.sin(phase) * 0.5 + 0.5, 2);
          dimmerValue = range.min + (breatheValue * rangeSize);
          break;
          
        default: // ramp
          dimmerValue = range.min + ((Math.sin(phase) * 0.5 + 0.5) * rangeSize);
      }

      setDmxChannelValue(data.channels.dimmer, Math.round(dimmerValue));
    });

    animationFrameRefs.current.dimmer = requestAnimationFrame(animateDimmer);
  }, [
    modularAutomation.dimmer,
    selectedFixtures,
    getSelectedFixtureData,
    getEffectiveSpeed,
    setDmxChannelValue,
    midiClockIsPlaying,
    midiClockCurrentBeat
  ]);

  // Pan/Tilt Animation Loop  
  const animatePanTilt = useCallback(() => {
    if (!modularAutomation.panTilt.enabled || selectedFixtures.length === 0) {
      if (animationFrameRefs.current.panTilt) {
        cancelAnimationFrame(animationFrameRefs.current.panTilt);
        animationFrameRefs.current.panTilt = undefined;
      }
      return;
    }

    const fixtureData = getSelectedFixtureData();
    const now = performance.now();
    const deltaTime = now - animationStateRefs.current.lastUpdateTime;
    
    const effectiveSpeed = getEffectiveSpeed(modularAutomation.panTilt);
    const phaseIncrement = (deltaTime / 1000) * effectiveSpeed;
    animationStateRefs.current.panTiltPhase += phaseIncrement;
    
    const phase = animationStateRefs.current.panTiltPhase;
    const { centerX, centerY, size } = modularAutomation.panTilt;

    fixtureData.forEach((data, index) => {
      if (!data?.channels.pan || !data?.channels.tilt) return;

      let panValue = 0, tiltValue = 0;
      const fixturePhase = phase + (index * Math.PI * 2 / fixtureData.length);

      switch (modularAutomation.panTilt.pathType) {
        case 'circle':
          panValue = centerX + Math.cos(phase) * size;
          tiltValue = centerY + Math.sin(phase) * size;
          break;
          
        case 'figure8':
          panValue = centerX + Math.sin(phase * 2) * size;
          tiltValue = centerY + Math.sin(phase) * size;
          break;
          
        case 'square':
          const squarePos = (phase % (Math.PI * 2)) / (Math.PI * 2);
          if (squarePos < 0.25) {
            panValue = centerX + size;
            tiltValue = centerY + (squarePos * 4 - 0.5) * 2 * size;
          } else if (squarePos < 0.5) {
            panValue = centerX + (0.75 - squarePos * 4) * 2 * size;
            tiltValue = centerY + size;
          } else if (squarePos < 0.75) {
            panValue = centerX - size;
            tiltValue = centerY + (1.25 - squarePos * 4) * 2 * size;
          } else {
            panValue = centerX + (squarePos * 4 - 1.5) * 2 * size;
            tiltValue = centerY - size;
          }
          break;
          
        default: // linear or other
          const linearPos = (phase % (Math.PI * 2)) / (Math.PI * 2);
          panValue = centerX + (linearPos - 0.5) * 2 * size;
          tiltValue = centerY;
      }

      // Clamp values to DMX range
      panValue = Math.max(0, Math.min(255, panValue));
      tiltValue = Math.max(0, Math.min(255, tiltValue));

      setDmxChannelValue(data.channels.pan, Math.round(panValue));
      setDmxChannelValue(data.channels.tilt, Math.round(tiltValue));
    });

    animationFrameRefs.current.panTilt = requestAnimationFrame(animatePanTilt);
  }, [
    modularAutomation.panTilt,
    selectedFixtures,
    getSelectedFixtureData,
    getEffectiveSpeed,
    setDmxChannelValue
  ]);

  // Effects Animation Loop
  const animateEffects = useCallback(() => {
    if (!modularAutomation.effects.enabled || selectedFixtures.length === 0) {
      if (animationFrameRefs.current.effects) {
        cancelAnimationFrame(animationFrameRefs.current.effects);
        animationFrameRefs.current.effects = undefined;
      }
      return;
    }

    const fixtureData = getSelectedFixtureData();
    const now = performance.now();
    const deltaTime = now - animationStateRefs.current.lastUpdateTime;
    
    const effectiveSpeed = getEffectiveSpeed(modularAutomation.effects);
    const phaseIncrement = (deltaTime / 1000) * effectiveSpeed;
    animationStateRefs.current.effectsPhase += phaseIncrement;
    
    const phase = animationStateRefs.current.effectsPhase;
    const effectsRange = modularAutomation.effects.range || { min: 0, max: 255 };
    const rangeSize = effectsRange.max - effectsRange.min;

    fixtureData.forEach((data, index) => {
      switch (modularAutomation.effects.type) {
        case 'gobo_cycle':
          if (data?.channels.gobo) {
            const goboValue = Math.round(effectsRange.min + ((Math.sin(phase) * 0.5 + 0.5) * rangeSize));
            setDmxChannelValue(data.channels.gobo, goboValue);
          }
          break;
          
        case 'prism_rotate':
          if (data?.channels.prism) {
            const prismValue = Math.round(effectsRange.min + ((Math.sin(phase) * 0.5 + 0.5) * rangeSize));
            setDmxChannelValue(data.channels.prism, prismValue);
          }
          break;
          
        case 'iris_breathe':
        case 'zoom_bounce':
        case 'focus_sweep':
          // Handle other effects generically
          const effectValue = Math.round(effectsRange.min + ((Math.sin(phase) * 0.5 + 0.5) * rangeSize));
          if (data?.channels.strobe) {
            setDmxChannelValue(data.channels.strobe, effectValue);
          }
          break;
      }
    });

    animationFrameRefs.current.effects = requestAnimationFrame(animateEffects);
  }, [
    modularAutomation.effects,
    selectedFixtures,
    getSelectedFixtureData,
    getEffectiveSpeed,
    setDmxChannelValue,
    midiClockIsPlaying,
    midiClockCurrentBeat
  ]);

  // Start/stop animations when modules are enabled/disabled
  useEffect(() => {
    if (modularAutomation.color.enabled) {
      animateColor();
    }
  }, [modularAutomation.color.enabled, animateColor]);

  useEffect(() => {
    if (modularAutomation.dimmer.enabled) {
      animateDimmer();
    }
  }, [modularAutomation.dimmer.enabled, animateDimmer]);

  useEffect(() => {
    if (modularAutomation.panTilt.enabled) {
      animatePanTilt();
    }
  }, [modularAutomation.panTilt.enabled, animatePanTilt]);

  useEffect(() => {
    if (modularAutomation.effects.enabled) {
      animateEffects();
    }
  }, [modularAutomation.effects.enabled, animateEffects]);

  // Update lastUpdateTime for all animations
  useEffect(() => {
    const updateTime = () => {
      animationStateRefs.current.lastUpdateTime = performance.now();
      requestAnimationFrame(updateTime);
    };
    updateTime();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(animationFrameRefs.current).forEach(frameId => {
        if (frameId) cancelAnimationFrame(frameId);
      });
    };
  }, []);

  return (
    <div className={styles.modularAutomation}>
      <div className={styles.header}>
        <h3>Modular Automation</h3>
        <div className={styles.subtitle}>
          Control different aspects independently • BPM: {midiClockBpm} • Playing: {midiClockIsPlaying ? '▶️' : '⏸️'}
        </div>
      </div>

      {selectedFixtures.length === 0 && (
        <div className={styles.noSelection}>
          Select fixtures to enable automation
        </div>
      )}

      <div className={styles.automationGrid}>
        {/* Color Automation */}
        <div className={`${styles.automationModule} ${modularAutomation.color.enabled ? styles.active : ''}`}>
          <div className={styles.moduleHeader}>
            <div className={styles.moduleTitle}>
              <span className={styles.colorIcon}>🎨</span>
              Color Automation
            </div>
            <button
              className={`${styles.toggleButton} ${modularAutomation.color.enabled ? styles.enabled : ''}`}
              onClick={toggleColorAutomation}
              disabled={selectedFixtures.length === 0}
              title={modularAutomation.color.enabled ? 'Stop color automation' : 'Start color automation'}
            >
              {modularAutomation.color.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className={styles.moduleControls}>
            <div className={styles.controlRow}>
              <label>Type:</label>
              <select
                value={modularAutomation.color.type}
                onChange={(e) => setColorAutomation({ type: e.target.value as any })}
                disabled={selectedFixtures.length === 0}
              >
                <option value="rainbow">Rainbow</option>
                <option value="cycle">Color Cycle</option>
                <option value="pulse">Pulse</option>
                <option value="strobe">Strobe</option>
                <option value="breathe">Breathe</option>
                <option value="wave">Wave</option>
                <option value="random">Random</option>
              </select>
            </div>

            <div className={styles.controlRow}>
              <label>Speed:</label>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={modularAutomation.color.speed}
                onChange={(e) => setColorAutomation({ speed: parseFloat(e.target.value) })}
                disabled={selectedFixtures.length === 0}
              />
              <span className={styles.value}>{modularAutomation.color.speed.toFixed(1)}x</span>
            </div>

            <div className={styles.controlRow}>
              <label>Intensity:</label>
              <input
                type="range"
                min="0"
                max="100"
                value={modularAutomation.color.intensity}
                onChange={(e) => setColorAutomation({ intensity: parseInt(e.target.value) })}
                disabled={selectedFixtures.length === 0}
              />
              <span className={styles.value}>{modularAutomation.color.intensity}%</span>
            </div>

            <div className={styles.controlRow}>
              <label>Sync to BPM:</label>
              <input
                type="checkbox"
                checked={modularAutomation.color.syncToBPM}
                onChange={(e) => setColorAutomation({ syncToBPM: e.target.checked })}
                disabled={selectedFixtures.length === 0}
              />
            </div>
          </div>
        </div>

        {/* Dimmer Automation */}
        <div className={`${styles.automationModule} ${modularAutomation.dimmer.enabled ? styles.active : ''}`}>
          <div className={styles.moduleHeader}>
            <div className={styles.moduleTitle}>
              <span className={styles.dimmerIcon}>💡</span>
              Dimmer Automation
            </div>
            <button
              className={`${styles.toggleButton} ${modularAutomation.dimmer.enabled ? styles.enabled : ''}`}
              onClick={toggleDimmerAutomation}
              disabled={selectedFixtures.length === 0}
              title={modularAutomation.dimmer.enabled ? 'Stop dimmer automation' : 'Start dimmer automation'}
            >
              {modularAutomation.dimmer.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className={styles.moduleControls}>
            <div className={styles.controlRow}>
              <label>Type:</label>
              <select
                value={modularAutomation.dimmer.type}
                onChange={(e) => setDimmerAutomation({ type: e.target.value as any })}
                disabled={selectedFixtures.length === 0}
              >
                <option value="breathe">Breathe</option>
                <option value="pulse">Pulse</option>
                <option value="strobe">Strobe</option>
                <option value="ramp">Ramp</option>
                <option value="random">Random</option>
                <option value="chase">Chase</option>
              </select>
            </div>

            <div className={styles.controlRow}>
              <label>Speed:</label>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={modularAutomation.dimmer.speed}
                onChange={(e) => setDimmerAutomation({ speed: parseFloat(e.target.value) })}
                disabled={selectedFixtures.length === 0}
              />
              <span className={styles.value}>{modularAutomation.dimmer.speed.toFixed(1)}x</span>
            </div>

            <div className={styles.controlRow}>
              <label>Range:</label>
              <div className={styles.rangeControls}>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={modularAutomation.dimmer.range.min}
                  onChange={(e) => setDimmerAutomation({ 
                    range: { ...modularAutomation.dimmer.range, min: parseInt(e.target.value) }
                  })}
                  disabled={selectedFixtures.length === 0}
                  className={styles.rangeInput}
                />
                <span>to</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={modularAutomation.dimmer.range.max}
                  onChange={(e) => setDimmerAutomation({ 
                    range: { ...modularAutomation.dimmer.range, max: parseInt(e.target.value) }
                  })}
                  disabled={selectedFixtures.length === 0}
                  className={styles.rangeInput}
                />
              </div>
            </div>

            <div className={styles.controlRow}>
              <label>Sync to BPM:</label>
              <input
                type="checkbox"
                checked={modularAutomation.dimmer.syncToBPM}
                onChange={(e) => setDimmerAutomation({ syncToBPM: e.target.checked })}
                disabled={selectedFixtures.length === 0}
              />
            </div>
          </div>
        </div>

        {/* Pan/Tilt Automation */}
        <div className={`${styles.automationModule} ${modularAutomation.panTilt.enabled ? styles.active : ''}`}>
          <div className={styles.moduleHeader}>
            <div className={styles.moduleTitle}>
              <span className={styles.panTiltIcon}>🔄</span>
              Pan/Tilt Automation
            </div>
            <button
              className={`${styles.toggleButton} ${modularAutomation.panTilt.enabled ? styles.enabled : ''}`}
              onClick={togglePanTiltAutomation}
              disabled={selectedFixtures.length === 0}
              title={modularAutomation.panTilt.enabled ? 'Stop pan/tilt automation' : 'Start pan/tilt automation'}
            >
              {modularAutomation.panTilt.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className={styles.moduleControls}>
            <div className={styles.controlRow}>
              <label>Pattern:</label>
              <select
                value={modularAutomation.panTilt.pathType}
                onChange={(e) => setPanTiltAutomation({ pathType: e.target.value as any })}
                disabled={selectedFixtures.length === 0}
              >
                <option value="circle">Circle</option>
                <option value="figure8">Figure 8</option>
                <option value="square">Square</option>
                <option value="triangle">Triangle</option>
                <option value="linear">Linear</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className={styles.controlRow}>
              <label>Speed:</label>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={modularAutomation.panTilt.speed}
                onChange={(e) => setPanTiltAutomation({ speed: parseFloat(e.target.value) })}
                disabled={selectedFixtures.length === 0}
              />
              <span className={styles.value}>{modularAutomation.panTilt.speed.toFixed(1)}x</span>
            </div>

            <div className={styles.controlRow}>
              <label>Size:</label>
              <input
                type="range"
                min="10"
                max="100"
                value={modularAutomation.panTilt.size}
                onChange={(e) => setPanTiltAutomation({ size: parseInt(e.target.value) })}
                disabled={selectedFixtures.length === 0}
              />
              <span className={styles.value}>{modularAutomation.panTilt.size}%</span>
            </div>

            <div className={styles.controlRow}>
              <label>Sync to BPM:</label>
              <input
                type="checkbox"
                checked={modularAutomation.panTilt.syncToBPM}
                onChange={(e) => setPanTiltAutomation({ syncToBPM: e.target.checked })}
                disabled={selectedFixtures.length === 0}
              />
            </div>
          </div>
        </div>

        {/* Effects Automation */}
        <div className={`${styles.automationModule} ${modularAutomation.effects.enabled ? styles.active : ''}`}>
          <div className={styles.moduleHeader}>
            <div className={styles.moduleTitle}>
              <span className={styles.effectsIcon}>✨</span>
              Effects Automation
            </div>
            <button
              className={`${styles.toggleButton} ${modularAutomation.effects.enabled ? styles.enabled : ''}`}
              onClick={toggleEffectsAutomation}
              disabled={selectedFixtures.length === 0}
              title={modularAutomation.effects.enabled ? 'Stop effects automation' : 'Start effects automation'}
            >
              {modularAutomation.effects.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className={styles.moduleControls}>
            <div className={styles.controlRow}>
              <label>Effect:</label>
              <select
                value={modularAutomation.effects.type}
                onChange={(e) => setEffectsAutomation({ type: e.target.value as any })}
                disabled={selectedFixtures.length === 0}
              >
                <option value="gobo_cycle">GOBO Cycle</option>
                <option value="prism_rotate">Prism Rotate</option>
                <option value="iris_breathe">Iris Breathe</option>
                <option value="zoom_bounce">Zoom Bounce</option>
                <option value="focus_sweep">Focus Sweep</option>
              </select>
            </div>

            <div className={styles.controlRow}>
              <label>Speed:</label>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={modularAutomation.effects.speed}
                onChange={(e) => setEffectsAutomation({ speed: parseFloat(e.target.value) })}
                disabled={selectedFixtures.length === 0}
              />
              <span className={styles.value}>{modularAutomation.effects.speed.toFixed(1)}x</span>
            </div>

            <div className={styles.controlRow}>
              <label>Direction:</label>
              <select
                value={modularAutomation.effects.direction}
                onChange={(e) => setEffectsAutomation({ direction: e.target.value as any })}
                disabled={selectedFixtures.length === 0}
              >
                <option value="forward">Forward</option>
                <option value="reverse">Reverse</option>
                <option value="ping-pong">Ping-Pong</option>
              </select>
            </div>

            <div className={styles.controlRow}>
              <label>Sync to BPM:</label>
              <input
                type="checkbox"
                checked={modularAutomation.effects.syncToBPM}
                onChange={(e) => setEffectsAutomation({ syncToBPM: e.target.checked })}
                disabled={selectedFixtures.length === 0}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.globalControls}>
        {/* BPM Controls */}
        <div className={styles.bpmControls}>
          <div className={styles.bpmDisplay}>
            <span className={styles.bpmValue}>{midiClockBpm}</span>
            <span className={styles.bpmLabel}>BPM</span>
            <span className={styles.playStatus}>
              {midiClockIsPlaying ? '▶️' : '⏸️'}
            </span>
          </div>
          
          <div className={styles.bpmActions}>
            <button
              className={styles.tapButton}
              onClick={() => {
                // This should trigger tap tempo in the store
                if (typeof useStore.getState().recordTapTempo === 'function') {
                  useStore.getState().recordTapTempo();
                }
              }}
            >
              TAP
            </button>
          </div>
        </div>
        
        <div className={styles.sceneInfo}>
          <span className={styles.sceneIcon}>💾</span>
          <span className={styles.sceneText}>
            Automation states are saved with scenes
          </span>
        </div>
        
        <div className={styles.activeCount}>
          Active: {Object.values(modularAutomation).filter(config => 
            typeof config === 'object' && config.enabled
          ).length} / 4
        </div>
        
        <button 
          className={styles.stopAllButton}
          onClick={() => {
            setColorAutomation({ enabled: false });
            setDimmerAutomation({ enabled: false });
            setPanTiltAutomation({ enabled: false });
            setEffectsAutomation({ enabled: false });
          }}
          disabled={selectedFixtures.length === 0}
        >
          Stop All
        </button>
      </div>
    </div>
  );
};

export default ModularAutomation;
