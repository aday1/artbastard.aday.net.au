import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { HorizontalFader } from '../ui/controls';
import { MetronomePanel } from '../audio/MetronomePanel';
import styles from './BPMDashboard.module.scss';
import { debugLog } from '../../utils/debugLog';
import { useSuperControlMidiLearn } from '../../hooks/useSuperControlMidiLearn';
import { useMetronomeAudio } from '../../hooks/useMetronomeAudio';
import { APC40_GRID_SLOT_COUNT, apc40DeckSceneName } from '../../midi/apc40WorkflowHelpers';


interface BPMDashboardProps {
  className?: string;
}

export const BPMDashboard: React.FC<BPMDashboardProps> = ({ className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedMidiKeyRef = useRef<string | null>(null);
  const lastAutopilotMidiToggleAtRef = useRef(0);
  const lastClockBeatAtRef = useRef(0);
  const skipNextClockBeatStampRef = useRef(false);

  const {
    midiClockBpm,
    midiClockIsPlaying,
    midiClockCurrentBeat,
    midiClockCurrentBar,
    autoSceneTempoSource,
    autoSceneManualBpm,
    autoSceneTapTempoBpm,
    setAutoSceneTempoSource,
    requestMasterClockSourceChange,
    abletonLinkPeers,
    abletonLinkAvailable,
    selectedMidiClockHostId,
    midiClockInputs,
    selectedMidiClockInputName,
    lastMidiClockInputName,
    lastMidiClockInputAt,
    midiClockInputStatus,
    requestMidiClockInputList,
    requestSetMidiClockInput,
    setManualBpm,
    recordTapTempo,
    requestToggleMasterClockPlayPause,
    setMidiClockBpm,
    setMidiClockIsPlaying,
    setMidiClockBeatBar,
    socket,
    // Autopilot controls
    autopilotTrackEnabled,
    autopilotTrackAutoPlay,
    panTiltAutopilot,
    channelAutopilots,
    colorSliderAutopilot,
    setAutopilotTrackEnabled,
    setAutopilotTrackAutoPlay,
    setAutopilotTrackSpeed,
    togglePanTiltAutopilot,
    toggleColorSliderAutopilot,
    setPanTiltAutopilot,
    setColorSliderAutopilot,
    debugAutopilotState,
    midiMessages,
    // Scene controls
    scenes,
    saveScene,
    loadScene,
    quickSceneSaveA,
    quickSceneLoadA,
    quickSceneSaveB,
    quickSceneLoadB,
    quickSceneSaveMidiMapping,
    quickSceneMidiMapping,
    quickSceneSaveBMidiMapping,
    quickSceneLoadBMidiMapping,
    addNotification,
    // Transition controls
    transitionDuration,
    transitionEasing,
    setTransitionDuration,
    setTransitionEasing,
  } = useStore();

  const {
    isLearning: isSuperControlLearning,
    currentLearningControlName,
    startLearn: startSuperControlLearn,
    cancelLearn: cancelSuperControlLearn,
    processMidiForControl,
  } = useSuperControlMidiLearn();


  // Handle toggle collapse/expand
  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };

  useEffect(() => {
    if (!midiMessages.length) return;
    const latestMessage = midiMessages[midiMessages.length - 1];
    const messageType = latestMessage.type || latestMessage._type || 'unknown';
    const messageKey = [
      latestMessage.timestamp ?? '',
      messageType,
      latestMessage.channel,
      latestMessage.controller ?? '',
      latestMessage.note ?? '',
      latestMessage.value ?? '',
      latestMessage.velocity ?? '',
    ].join(':');
    if (lastProcessedMidiKeyRef.current === messageKey) return;
    lastProcessedMidiKeyRef.current = messageKey;
    processMidiForControl(latestMessage, {
      autopilotTrackToggle: (value) => {
        if (value <= 0) return;
        const now = Date.now();
        if (now - lastAutopilotMidiToggleAtRef.current < 350) return;
        lastAutopilotMidiToggleAtRef.current = now;
        const nextEnabled = !useStore.getState().autopilotTrackEnabled;
        setAutopilotTrackEnabled(nextEnabled);
        if (nextEnabled) {
          setAutopilotTrackAutoPlay(true);
        }
      },
    });
  }, [midiMessages, processMidiForControl, setAutopilotTrackEnabled, setAutopilotTrackAutoPlay]);

  // Handle header click (but allow button clicks to propagate)
  const handleHeaderClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on the expand button directly
    if ((e.target as HTMLElement).closest(`.${styles.expandButton}`)) {
      return;
    }
    toggleExpanded();
  };

  // Handle play/pause with better feedback
  const handlePlayPause = () => {
    debugLog.log('BPM Dashboard: Play/Pause clicked', { 
      currentlyPlaying: midiClockIsPlaying, 
      socketExists: !!socket,
      currentBPM: autoSceneTempoSource === 'tap_tempo' ? autoSceneTapTempoBpm : autoSceneManualBpm 
    });
    
    if (!midiClockIsPlaying && (autoSceneTempoSource === 'manual_bpm' || autoSceneTempoSource === 'tap_tempo')) {
      requestMasterClockSourceChange('internal');
      setMidiClockBpm(currentBpm || 120);
    }

    const socketIsConnected = Boolean((socket as unknown as { connected?: boolean } | null)?.connected);
    if (socketIsConnected) {
      // Use server-side toggle
      requestToggleMasterClockPlayPause();
    } else {
      // Local fallback - directly toggle the state
      debugLog.log('BPM Dashboard: Using local fallback for play/pause');
      setMidiClockIsPlaying(!midiClockIsPlaying);
      
      // Also set BPM if we're starting
      const currentBpm = autoSceneTempoSource === 'tap_tempo' ? autoSceneTapTempoBpm : autoSceneManualBpm;
      if (!midiClockIsPlaying && currentBpm > 0) {
        setMidiClockBpm(currentBpm);
      }
    }
  };

  const currentBpm =
    autoSceneTempoSource === 'tap_tempo'
      ? autoSceneTapTempoBpm
      : autoSceneTempoSource === 'manual_bpm'
        ? autoSceneManualBpm
        : midiClockBpm;
  const isPlaying = midiClockIsPlaying;
  const beatIntervalMs = currentBpm > 0 ? 60000 / currentBpm : 600;
  const socketIsConnected = Boolean((socket as unknown as { connected?: boolean } | null)?.connected);
  const quickSceneSlotIndex = APC40_GRID_SLOT_COUNT - 1;
  const quickSceneAName = apc40DeckSceneName('A', quickSceneSlotIndex);
  const quickSceneBName = apc40DeckSceneName('B', quickSceneSlotIndex);
  const quickSceneAReady = scenes.some((scene) => scene.name === quickSceneAName);
  const quickSceneBReady = scenes.some((scene) => scene.name === quickSceneBName);
  const externalMidiClockDevice = lastMidiClockInputName || selectedMidiClockInputName;
  const lastMidiClockSeenLabel = lastMidiClockInputAt
    ? new Date(lastMidiClockInputAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'No clock seen';
  const midiClockStatusLabel =
    midiClockInputStatus === 'receiving'
      ? 'Receiving'
      : midiClockInputStatus === 'listening'
        ? 'Listening'
        : midiClockInputStatus === 'selected'
          ? 'Selected'
          : 'No input';
  const sourceLabel =
    autoSceneTempoSource === 'ableton_link'
      ? `Ableton Link${abletonLinkAvailable ? ` (${abletonLinkPeers})` : ' unavailable'}`
      : autoSceneTempoSource === 'tap_tempo'
        ? 'Tap Tempo'
        : autoSceneTempoSource === 'internal_clock'
          ? selectedMidiClockHostId === 'ableton-link'
            ? `Ableton Link${abletonLinkAvailable ? ` (${abletonLinkPeers})` : ''}`
            : selectedMidiClockHostId === 'midi-input'
              ? `MIDI In${externalMidiClockDevice ? `: ${externalMidiClockDevice}` : ''}`
              : 'Server Clock'
          : 'Manual BPM';

  useEffect(() => {
    if (!socketIsConnected) return;
    requestMidiClockInputList();
  }, [socketIsConnected, requestMidiClockInputList]);

  useEffect(() => {
    if (!midiClockIsPlaying) return;
    if (skipNextClockBeatStampRef.current) {
      skipNextClockBeatStampRef.current = false;
      return;
    }
    lastClockBeatAtRef.current = Date.now();
  }, [midiClockCurrentBeat, midiClockCurrentBar, midiClockIsPlaying]);

  useMetronomeAudio(
    midiClockIsPlaying,
    currentBpm,
    4,
    (beatIndex) => {
      const serverBeatFresh = socketIsConnected && Date.now() - lastClockBeatAtRef.current < beatIntervalMs * 1.8;
      if (serverBeatFresh) return;

      const nextBeat = beatIndex + 1;
      const currentBeat = useStore.getState().midiClockCurrentBeat || 1;
      const currentBar = useStore.getState().midiClockCurrentBar || 1;
      const nextBar = nextBeat === 1 && currentBeat === 4
        ? currentBar + 1
        : currentBar;
      skipNextClockBeatStampRef.current = true;
      setMidiClockBeatBar(nextBeat, nextBar);
    },
    false
  );

  const selectTempoSource = (source: 'internal_clock' | 'manual_bpm' | 'tap_tempo' | 'ableton_link') => {
    setAutoSceneTempoSource(source);
    if (source === 'ableton_link') {
      requestMasterClockSourceChange('ableton-link');
    } else if (source === 'internal_clock' || source === 'tap_tempo') {
      requestMasterClockSourceChange('internal');
    }
  };

  const selectExternalMidiClock = () => {
    setAutoSceneTempoSource('internal_clock');
    requestMidiClockInputList();
    if (selectedMidiClockInputName) {
      requestMasterClockSourceChange('midi-input');
    } else {
      addNotification({
        message: 'Pick a MIDI clock input in Settings > MIDI & OSC first',
        type: 'warning',
        priority: 'normal',
      });
    }
  };

  // Handle tap tempo
  const handleTap = () => {
    debugLog.log('BPM Dashboard: TAP button pressed');
    
    // Use the store's tap tempo function
    recordTapTempo();
    
    // Set source to tap tempo when tapping
    setAutoSceneTempoSource('tap_tempo');
    
    // Local state for UI feedback
    const currentTime = Date.now();
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    
    if (lastTapTime > 0 && (currentTime - lastTapTime) < 2000) {
      // Valid tap within 2 seconds
      setTapCount(prev => prev + 1);
    } else {
      // First tap or reset after timeout
      setTapCount(0);
    }
    
    setLastTapTime(currentTime);
    
    // Reset tap count after 3 seconds of inactivity
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
      setLastTapTime(0);
    }, 3000);
  };

  // Handle BPM input change
  const handleBpmChange = (value: number) => {
    const newBpm = Math.max(60, Math.min(200, value));
    debugLog.log('BPM Dashboard: BPM changed to', newBpm);
    setManualBpm(newBpm);
    setAutoSceneTempoSource('manual_bpm');
    
    // If we're currently playing, update the active BPM immediately
    if (midiClockIsPlaying) {
      setMidiClockBpm(newBpm);
    }
  };

  // Handle reset
  const handleReset = () => {
    setTapCount(0);
    setLastTapTime(0);
    setMidiClockBpm(120);
    setMidiClockIsPlaying(false);
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
  };

  return (
    <div className={`${styles.bpmDashboard} ${className || ''} ${isExpanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.header} onClick={handleHeaderClick}>
        <div className={styles.titleSection}>
          <h3 className={styles.title}>BPM</h3>
          <span className={styles.sourceBadge} title={`Tempo source: ${sourceLabel}`}>
            {sourceLabel}
          </span>
          <div className={styles.sourceSelectWrap} onClick={e=>e.stopPropagation()}>
            <select value={autoSceneTempoSource} onChange={(e)=>{
              const v = e.target.value as any; selectTempoSource(v);
            }} className={styles.sourceSelect}>
              <option value="manual_bpm">Manual</option>
              <option value="tap_tempo">Tap</option>
              <option value="internal_clock">Server</option>
              <option value="ableton_link">Link</option>
            </select>
          </div>
          <div className={`${styles.quickStatus} ${isPlaying ? styles.playing : ''}`}>
            <span className={styles.bpmValue}>{Math.round(currentBpm)}</span>
            <span className={styles.beatReadout}>{midiClockCurrentBar || 1}.{midiClockCurrentBeat || 1}</span>
            <span className={styles.playStatus}>{isPlaying ? 'Playing' : 'Stopped'}</span>
          </div>
        </div>
        <button
          type="button"
          className={`${styles.transportButton} ${isPlaying ? styles.transportStop : styles.transportPlay}`}
          onClick={(event) => {
            event.stopPropagation();
            handlePlayPause();
          }}
          title={isPlaying ? 'Stop tempo clock' : 'Start tempo clock'}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        <button className={styles.expandButton} onClick={toggleExpanded} aria-label={isExpanded ? 'Collapse BPM controls' : 'Expand BPM controls'}>
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {isExpanded && (
        <div className={styles.controls}>
          <div className={styles.sourceSection}>
            <label className={styles.sectionLabel}>Clock Source</label>
            <div className={styles.sourceButtons}>
              <button
                className={`${styles.sourceButton} ${autoSceneTempoSource === 'manual_bpm' ? styles.active : ''}`}
                onClick={() => selectTempoSource('manual_bpm')}
              >
                Manual
              </button>
              <button
                className={`${styles.sourceButton} ${autoSceneTempoSource === 'tap_tempo' ? styles.active : ''}`}
                onClick={() => selectTempoSource('tap_tempo')}
              >
                Tap
              </button>
              <button
                className={`${styles.sourceButton} ${autoSceneTempoSource === 'internal_clock' && selectedMidiClockHostId !== 'midi-input' ? styles.active : ''}`}
                onClick={() => selectTempoSource('internal_clock')}
              >
                Server
              </button>
              <button
                className={`${styles.sourceButton} ${selectedMidiClockHostId === 'midi-input' ? styles.active : ''}`}
                onClick={selectExternalMidiClock}
                title={externalMidiClockDevice ? `Use external MIDI clock from ${externalMidiClockDevice}` : 'Pick a MIDI clock input in MIDI & OSC settings'}
              >
                MIDI In
              </button>
              <button
                className={`${styles.sourceButton} ${autoSceneTempoSource === 'ableton_link' ? styles.active : ''}`}
                onClick={() => selectTempoSource('ableton_link')}
                title={abletonLinkAvailable ? `Ableton Link (${abletonLinkPeers} peers)` : 'Ableton Link requires server native module'}
              >
                Link{abletonLinkAvailable ? ` (${abletonLinkPeers})` : ''}
              </button>
            </div>
            {selectedMidiClockHostId === 'ableton-link' && (
              <p className={styles.linkHint}>
                Session tempo from Ableton Link. Install optional dependency on the Node server if unavailable.
              </p>
            )}
            <div className={styles.clockDeviceRow}>
              <label htmlFor="bpm-midi-clock-input">Clock input</label>
              <select
                id="bpm-midi-clock-input"
                value={selectedMidiClockInputName || ''}
                onChange={(event) => {
                  const inputName = event.target.value;
                  if (!inputName) return;
                  setAutoSceneTempoSource('internal_clock');
                  requestSetMidiClockInput(inputName);
                }}
                disabled={midiClockInputs.length === 0}
                title="Server MIDI input used for external MIDI clock"
              >
                <option value="">
                  {midiClockInputs.length === 0 ? 'No inputs' : 'Select input'}
                </option>
                {midiClockInputs.map((inputName) => (
                  <option key={inputName} value={inputName}>
                    {inputName}
                  </option>
                ))}
              </select>
              <span className={`${styles.clockDeviceStatus} ${styles[midiClockInputStatus]}`}>
                {midiClockStatusLabel}
              </span>
            </div>
            <p className={styles.linkHint}>
              {externalMidiClockDevice
                ? `External source ${externalMidiClockDevice} · ${lastMidiClockSeenLabel}`
                : 'No external MIDI clock input selected.'}
            </p>
          </div>

          <div className={styles.transportSection}>
            <label className={styles.sectionLabel}>Tempo Transport</label>
            <div className={styles.transportControls}>
              <button
                type="button"
                className={`${styles.transportButtonLarge} ${isPlaying ? styles.transportStop : styles.transportPlay}`}
                onClick={handlePlayPause}
              >
                {isPlaying ? 'Stop Tempo' : 'Play Tempo'}
              </button>
              <button
                type="button"
                className={styles.tapTempoButton}
                onClick={handleTap}
              >
                Tap{tapCount > 0 ? ` (${tapCount})` : ''}
              </button>
              <button
                type="button"
                className={styles.resetTempoButton}
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
            <div className={styles.transportReadout}>
              <span>{midiClockCurrentBar || 1}.{midiClockCurrentBeat || 1}</span>
              <span>{Math.round(currentBpm)} BPM</span>
              <span>{sourceLabel}</span>
              {selectedMidiClockHostId === 'midi-input' && (
                <span>{midiClockStatusLabel}</span>
              )}
            </div>
          </div>

          <MetronomePanel compact showBpmInput={false} />

          <div className={styles.bpmSection}>
            <label className={styles.sectionLabel}>BPM Setting</label>
            <div className={styles.bpmControls}>
              <div className={styles.bpmInput}>
                <input
                  type="number"
                  min="60"
                  max="200"
                  value={autoSceneManualBpm}
                  onChange={(e) => handleBpmChange(parseInt(e.target.value) || 120)}
                  className={styles.bpmNumberInput}
                />
                <span className={styles.bpmLabel}>BPM</span>
              </div>
              <div className={styles.bpmSlider}>
                <HorizontalFader
                  min={60}
                  max={200}
                  value={autoSceneManualBpm}
                  onChange={(v) => handleBpmChange(Math.round(v))}
                />
              </div>
            </div>
          </div>

          <div className={styles.autopilotSection}>
            <label className={styles.sectionLabel}>Autopilot Controls</label>
            <div className={styles.autopilotControls}>
              <button
                className={`${styles.autopilotButton} ${autopilotTrackEnabled ? styles.active : ''}`}
                onClick={() => {
                  const newEnabled = !autopilotTrackEnabled;
                  setAutopilotTrackEnabled(newEnabled);
                  // Also enable auto-play when enabling track autopilot
                  if (newEnabled) {
                    setAutopilotTrackAutoPlay(true);
                  }
                }}
                title={autopilotTrackEnabled ? 'Disable Pan/Tilt Track Autopilot' : 'Enable Pan/Tilt Track Autopilot'}
              >
                <span className={styles.autopilotIcon}>🤖</span>
                Track {autopilotTrackEnabled ? 'ON' : 'OFF'}
              </button>
              <div className={styles.midiLearnContainer}>
                <button
                  className={`${styles.midiLearnButton} ${isSuperControlLearning && currentLearningControlName === 'autopilotTrackToggle' ? styles.learning : ''}`}
                  onClick={() => {
                    if (isSuperControlLearning && currentLearningControlName === 'autopilotTrackToggle') {
                      cancelSuperControlLearn();
                    } else {
                      startSuperControlLearn('autopilotTrackToggle');
                    }
                  }}
                >
                  {isSuperControlLearning && currentLearningControlName === 'autopilotTrackToggle' ? 'Listening' : 'Learn'}
                </button>
                <span className={styles.oscAddress}>Track toggle</span>
              </div>
              <button
                className={`${styles.autopilotButton} ${panTiltAutopilot.enabled ? styles.active : ''}`}
                onClick={togglePanTiltAutopilot}
                title={panTiltAutopilot.enabled ? 'Disable General Autopilot' : 'Enable General Autopilot'}
              >
                <span className={styles.autopilotIcon}>⚡</span>
                General {panTiltAutopilot.enabled ? 'ON' : 'OFF'}
              </button>
              
              <button
                className={`${styles.autopilotButton} ${colorSliderAutopilot.enabled ? styles.active : ''}`}
                onClick={toggleColorSliderAutopilot}
                title={colorSliderAutopilot.enabled ? 'Disable Color Autopilot' : 'Enable Color Autopilot'}
              >
                <span className={styles.autopilotIcon}>🎨</span>
                Color {colorSliderAutopilot.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className={styles.autopilotSpeedControls}>
              <div className={styles.speedControl}>
                <label>P/T Speed</label>
                <HorizontalFader
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={panTiltAutopilot.speed}
                  onChange={(v) => setPanTiltAutopilot({ speed: v })}
                />
                <span>{panTiltAutopilot.speed.toFixed(1)}x</span>
              </div>
              <div className={styles.speedControl}>
                <label>Color Speed</label>
                <HorizontalFader
                  min={0.1}
                  max={1.0}
                  step={0.1}
                  value={colorSliderAutopilot.speed}
                  onChange={(v) => setColorSliderAutopilot({ speed: v })}
                />
                <span>{colorSliderAutopilot.speed.toFixed(1)}x</span>
              </div>
            </div>

            {(autopilotTrackEnabled || panTiltAutopilot.enabled || colorSliderAutopilot.enabled || Object.keys(channelAutopilots).length > 0) && (
              <div className={styles.autopilotStatus}>
                <div className={styles.statusIndicators}>
                  {autopilotTrackEnabled && (
                    <span className={styles.statusBadge}>
                      Track {autopilotTrackAutoPlay ? '(Moving)' : '(Static)'}
                    </span>
                  )}
                  {panTiltAutopilot.enabled && (
                    <span className={styles.statusBadge}>General ({panTiltAutopilot.pathType})</span>
                  )}
                  {colorSliderAutopilot.enabled && (
                    <span className={styles.statusBadge}>Color ({colorSliderAutopilot.type})</span>
                  )}
                  {Object.keys(channelAutopilots).length > 0 && (
                    <span className={styles.statusBadge}>{Object.keys(channelAutopilots).length} Channels</span>
                  )}
                </div>
                <button 
                  className={styles.debugButton}
                  onClick={() => {
                    debugLog.log('🔍 AUTOPILOT DEBUG INFO:');
                    debugLog.log('Track Autopilot Enabled:', autopilotTrackEnabled);
                    debugLog.log('Track Auto-Play Enabled:', autopilotTrackAutoPlay);
                    debugLog.log('General Autopilot Enabled:', panTiltAutopilot.enabled);
                    debugLog.log('Color Autopilot Enabled:', colorSliderAutopilot.enabled);
                    debugLog.log('Color Autopilot Type:', colorSliderAutopilot.type);
                    debugLog.log('Color Autopilot Speed:', colorSliderAutopilot.speed);
                    debugLog.log('Color Autopilot Sync to BPM:', colorSliderAutopilot.syncToBPM);
                    debugLog.log('Channel Autopilots:', Object.keys(channelAutopilots).length);
                    
                    // Trigger comprehensive debug
                    debugAutopilotState();
                  }}
                  title="Debug autopilot status to console"
                >
                  🐛 Debug
                </button>
              </div>
            )}
          </div>

          <div className={styles.quickSceneSection}>
            <label className={styles.sectionLabel}>Quick Scene Controls</label>
            <div className={styles.quickSceneControls}>
              <button
                className={styles.quickSceneButton}
                onClick={quickSceneSaveA}
                title="Save current DMX state to Deck A clip 40"
              >
                <span className={styles.sceneIcon}>📸</span>
                Save A
              </button>
              
              <div className={styles.midiLearnContainer}>
                <button
                  className={`${styles.midiLearnButton} ${isSuperControlLearning && currentLearningControlName === 'quickSceneSaveA' ? styles.learning : ''}`}
                  onClick={() => {
                    if (isSuperControlLearning && currentLearningControlName === 'quickSceneSaveA') {
                      cancelSuperControlLearn();
                    } else {
                      startSuperControlLearn('quickSceneSaveA');
                    }
                  }}
                  title={quickSceneSaveMidiMapping ? 'Re-learn MIDI control for Quick Scene Save A' : 'Learn MIDI control for Quick Scene Save A'}
                >
                  {isSuperControlLearning && currentLearningControlName === 'quickSceneSaveA'
                    ? 'Listening'
                    : quickSceneSaveMidiMapping
                      ? 'Mapped'
                      : 'Learn'}
                </button>
                <span className={styles.oscAddress}>Save A</span>
              </div>
              <button
                className={styles.quickSceneButton}
                onClick={quickSceneLoadA}
                title="Load Deck A clip 40 and arm it for crossfade"
                disabled={!quickSceneAReady}
              >
                <span className={styles.sceneIcon}>⚡</span>
                Load A
              </button>
              
              <div className={styles.midiLearnContainer}>
                <button
                  className={`${styles.midiLearnButton} ${isSuperControlLearning && currentLearningControlName === 'quickSceneLoadA' ? styles.learning : ''}`}
                  onClick={() => {
                    if (isSuperControlLearning && currentLearningControlName === 'quickSceneLoadA') {
                      cancelSuperControlLearn();
                    } else {
                      startSuperControlLearn('quickSceneLoadA');
                    }
                  }}
                  title={quickSceneMidiMapping ? 'Re-learn MIDI control for Quick Scene Load A' : 'Learn MIDI control for Quick Scene Load A'}
                >
                  {isSuperControlLearning && currentLearningControlName === 'quickSceneLoadA'
                    ? 'Listening'
                    : quickSceneMidiMapping
                      ? 'Mapped'
                      : 'Learn'}
                </button>
                <span className={styles.oscAddress}>Load A</span>
              </div>

              <button
                className={styles.quickSceneButton}
                onClick={quickSceneSaveB}
                title="Save current DMX state to Deck B clip 40"
              >
                <span className={styles.sceneIcon}>📸</span>
                Save B
              </button>

              <div className={styles.midiLearnContainer}>
                <button
                  className={`${styles.midiLearnButton} ${isSuperControlLearning && currentLearningControlName === 'quickSceneSaveB' ? styles.learning : ''}`}
                  onClick={() => {
                    if (isSuperControlLearning && currentLearningControlName === 'quickSceneSaveB') {
                      cancelSuperControlLearn();
                    } else {
                      startSuperControlLearn('quickSceneSaveB');
                    }
                  }}
                  title={quickSceneSaveBMidiMapping ? 'Re-learn MIDI control for Quick Scene Save B' : 'Learn MIDI control for Quick Scene Save B'}
                >
                  {isSuperControlLearning && currentLearningControlName === 'quickSceneSaveB'
                    ? 'Listening'
                    : quickSceneSaveBMidiMapping
                      ? 'Mapped'
                      : 'Learn'}
                </button>
                <span className={styles.oscAddress}>Save B</span>
              </div>

              <button
                className={styles.quickSceneButton}
                onClick={quickSceneLoadB}
                title="Load Deck B clip 40 and arm it for crossfade"
                disabled={!quickSceneBReady}
              >
                <span className={styles.sceneIcon}>⚡</span>
                Load B
              </button>

              <div className={styles.midiLearnContainer}>
                <button
                  className={`${styles.midiLearnButton} ${isSuperControlLearning && currentLearningControlName === 'quickSceneLoadB' ? styles.learning : ''}`}
                  onClick={() => {
                    if (isSuperControlLearning && currentLearningControlName === 'quickSceneLoadB') {
                      cancelSuperControlLearn();
                    } else {
                      startSuperControlLearn('quickSceneLoadB');
                    }
                  }}
                  title={quickSceneLoadBMidiMapping ? 'Re-learn MIDI control for Quick Scene Load B' : 'Learn MIDI control for Quick Scene Load B'}
                >
                  {isSuperControlLearning && currentLearningControlName === 'quickSceneLoadB'
                    ? 'Listening'
                    : quickSceneLoadBMidiMapping
                      ? 'Mapped'
                      : 'Learn'}
                </button>
                <span className={styles.oscAddress}>Load B</span>
              </div>
            </div>
            
            {scenes.length > 0 && (
              <div className={styles.sceneStatus}>
                <span className={styles.sceneCount}>
                  Recall slots: A {quickSceneAReady ? 'ready' : 'empty'} / B {quickSceneBReady ? 'ready' : 'empty'}
                </span>
                <span className={styles.latestScene}>
                  Deck clip 40 is reserved for quick recall and APC40 crossfade.
                </span>
              </div>
            )}
          </div>

          <div className={styles.transitionSection}>
            <label className={styles.sectionLabel}>Scene Transition Settings</label>
            <div className={styles.transitionControls}>
              <div className={styles.transitionDuration}>
                <label>Duration (ms)</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={transitionDuration}
                  onChange={(e) => setTransitionDuration(parseInt(e.target.value) || 1000)}
                  className={styles.transitionInput}
                />
              </div>
              
              <div className={styles.transitionEasing}>
                <label>Easing</label>
                <select
                  value={transitionEasing}
                  onChange={(e) => setTransitionEasing(e.target.value as any)}
                  className={styles.transitionSelect}
                >
                  <option value="linear">Linear</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOutCubic">Ease In/Out Cubic</option>
                  <option value="easeInOutQuart">Ease In/Out Quart</option>
                  <option value="easeInOutSine">Ease In/Out Sine</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.statusSection}>
            <div className={styles.statusGrid}>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Source:</span>
                <span className={styles.statusValue}>
                  {sourceLabel}
                </span>
              </div>
              {selectedMidiClockHostId === 'midi-input' && (
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>Clock Input:</span>
                  <span className={styles.statusValue}>
                    {externalMidiClockDevice || 'None'} · {midiClockStatusLabel}
                  </span>
                </div>
              )}
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Current BPM:</span>
                <span className={`${styles.statusValue} ${styles.bpmHighlight}`}>{currentBpm}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Status:</span>
                <span className={`${styles.statusValue} ${isPlaying ? styles.playingText : styles.stoppedText}`}>
                  {isPlaying ? 'Playing' : 'Stopped'}
                </span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Automation:</span>
                <span className={`${styles.statusValue} ${isPlaying ? styles.activeText : styles.pausedText}`}>
                  {isPlaying ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BPMDashboard;
