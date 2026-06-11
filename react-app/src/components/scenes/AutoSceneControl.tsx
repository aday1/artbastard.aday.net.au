import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, Scene } from '../../store'; // Assuming Scene type might be needed for selection
import styles from './AutoSceneControl.module.scss';

interface AutoSceneControlProps {
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
}

export const AutoSceneControl: React.FC<AutoSceneControlProps> = ({
  isMinimized = false,
  onMinimizedChange,
}) => {
  // Retrieve all scenes for selection purposes
  const allScenes = useStore(state => state.scenes);  // Auto-Scene state from the store
  const {
    autoSceneEnabled,
    autoSceneList,
    autoSceneMode,
    autoSceneBeatDivision,
    autoSceneManualBpm,
    autoSceneTapTempoBpm,
    autoSceneTempoSource,
    autoSceneCurrentIndex, // For display
    selectedMidiClockHostId, // To know if main clock is internal
    midiClockBpm, // To display main clock BPM
    midiClockIsPlaying, // Needed for effects
    midiClockCurrentBeat, // Needed for effects
    autoSceneIsFlashing, // Shared flashing state
  } = useStore(state => ({
    autoSceneEnabled: state.autoSceneEnabled,
    autoSceneList: state.autoSceneList,
    autoSceneMode: state.autoSceneMode,
    autoSceneBeatDivision: state.autoSceneBeatDivision,
    autoSceneManualBpm: state.autoSceneManualBpm,
    autoSceneTapTempoBpm: state.autoSceneTapTempoBpm,
    autoSceneTempoSource: state.autoSceneTempoSource,
    autoSceneCurrentIndex: state.autoSceneCurrentIndex,
    selectedMidiClockHostId: state.selectedMidiClockHostId,
    midiClockBpm: state.midiClockBpm,
    midiClockIsPlaying: state.midiClockIsPlaying, // Added this line
    midiClockCurrentBeat: state.midiClockCurrentBeat, // Added this line
    autoSceneIsFlashing: state.autoSceneIsFlashing, // Shared flashing state
  }));
  // Auto-Scene actions from the store
  const {
    setAutoSceneEnabled,
    setAutoSceneList,
    setAutoSceneMode,
    setAutoSceneBeatDivision,
    setAutoSceneTempoSource,
    setManualBpm,
    recordTapTempo,
    loadScene, // Needed for effects
    setNextAutoSceneIndex, // Needed for effects
    requestToggleMasterClockPlayPause, // Added for PLAY button
    triggerAutoSceneFlash, // Shared flashing trigger
  } = useStore(state => ({
    setAutoSceneEnabled: state.setAutoSceneEnabled,
    setAutoSceneList: state.setAutoSceneList,
    setAutoSceneMode: state.setAutoSceneMode,
    setAutoSceneBeatDivision: state.setAutoSceneBeatDivision,
    setAutoSceneTempoSource: state.setAutoSceneTempoSource,
    setManualBpm: state.setManualBpm,
    recordTapTempo: state.recordTapTempo,
    loadScene: state.loadScene, // Added this line
    setNextAutoSceneIndex: state.setNextAutoSceneIndex, // Added this line
    requestToggleMasterClockPlayPause: state.requestToggleMasterClockPlayPause, // Added for PLAY button
    triggerAutoSceneFlash: state.triggerAutoSceneFlash, // Shared flashing trigger
  }));  // Local state for UI, e.g., for multi-select interaction if needed
  const [selectedScenesForList, setSelectedScenesForList] = useState<string[]>(autoSceneList);
  // Local state for beat tracking and refs
  const [localBeatCounter, setLocalBeatCounter] = useState(0);
  const [isLocalClockPlaying, setIsLocalClockPlaying] = useState(false);
  const prevBeatRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to update local selectedScenesForList when autoSceneList changes from store (e.g. loaded state)
  useEffect(() => {
    setSelectedScenesForList(autoSceneList);
  }, [autoSceneList]);
  // Independent clock management for manual_bpm and tap_tempo modes
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!autoSceneEnabled || autoSceneList.length === 0 || autoSceneBeatDivision <= 0) {
      setLocalBeatCounter(0);
      setIsLocalClockPlaying(false);
      return;
    }

    // Reset local clock playing state when tempo source changes
    if (autoSceneTempoSource === 'internal_clock') {
      setIsLocalClockPlaying(false);
      setLocalBeatCounter(0);
      return;
    }

    if (autoSceneTempoSource === 'manual_bpm' || autoSceneTempoSource === 'tap_tempo') {
      // Use independent clock for manual BPM and tap tempo
      if (isLocalClockPlaying) {
        const bpm = autoSceneTempoSource === 'manual_bpm' ? autoSceneManualBpm : autoSceneTapTempoBpm;
        const intervalMs = (60000 / bpm); // Milliseconds per beat
        
        intervalRef.current = setInterval(() => {
          setLocalBeatCounter(current => current + 1);
        }, intervalMs);
      }
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoSceneEnabled, autoSceneList.length, autoSceneBeatDivision, autoSceneTempoSource, autoSceneManualBpm, autoSceneTapTempoBpm, isLocalClockPlaying]);

  // Reset local clock when tempo source changes
  useEffect(() => {
    if (autoSceneTempoSource === 'internal_clock') {
      setIsLocalClockPlaying(false);
      setLocalBeatCounter(0);
    }
  }, [autoSceneTempoSource]);

  // Beat tracking for internal_clock mode (syncs with master clock)
  useEffect(() => {
    if (autoSceneTempoSource !== 'internal_clock') {
      // Reset master clock tracking when not using internal clock
      prevBeatRef.current = null;
      return;
    }

    if (!autoSceneEnabled || !midiClockIsPlaying || autoSceneList.length === 0 || autoSceneBeatDivision <= 0) {
      setLocalBeatCounter(0);
      prevBeatRef.current = null;
      return;
    }

    if (midiClockCurrentBeat !== prevBeatRef.current) {
      if (prevBeatRef.current !== null) { // Only increment if it's not the very first beat detection cycle
        setLocalBeatCounter(current => current + 1);
      }
      prevBeatRef.current = midiClockCurrentBeat;
    }
  }, [autoSceneEnabled, midiClockIsPlaying, midiClockCurrentBeat, autoSceneList, autoSceneBeatDivision, autoSceneTempoSource]);
  // Scene change triggering logic
  useEffect(() => {
    const shouldTriggerChange = localBeatCounter >= autoSceneBeatDivision && 
                               autoSceneEnabled && 
                               autoSceneList.length > 0 &&
                               ((autoSceneTempoSource === 'internal_clock' && midiClockIsPlaying) ||
                                (autoSceneTempoSource !== 'internal_clock' && isLocalClockPlaying));    if (shouldTriggerChange) {
      // Flash the border on downbeat using shared state
      triggerAutoSceneFlash();
      
      setNextAutoSceneIndex();
      setLocalBeatCounter(0); // Reset counter for the next cycle
    }
  }, [localBeatCounter, autoSceneBeatDivision, autoSceneEnabled, autoSceneList, setNextAutoSceneIndex, autoSceneTempoSource, midiClockIsPlaying, isLocalClockPlaying]);

  // Scene loading logic
  useEffect(() => {
    const shouldLoadScene = autoSceneEnabled && 
                           autoSceneCurrentIndex !== -1 && 
                           autoSceneList.length > 0 &&
                           ((autoSceneTempoSource === 'internal_clock' && midiClockIsPlaying) ||
                            (autoSceneTempoSource !== 'internal_clock' && isLocalClockPlaying));

    if (shouldLoadScene) {
      const sceneToLoad = autoSceneList[autoSceneCurrentIndex];
      if (sceneToLoad) {
        loadScene(sceneToLoad);
        console.log(`Auto-Scene: Loading scene "${sceneToLoad}" (Index: ${autoSceneCurrentIndex})`);
      }
    }
  }, [autoSceneEnabled, autoSceneCurrentIndex, autoSceneList, loadScene, autoSceneTempoSource, midiClockIsPlaying, isLocalClockPlaying]);
  const handleToggleSceneInList = (sceneName: string) => {
    const newSelectedScenes = selectedScenesForList.includes(sceneName)
      ? selectedScenesForList.filter(name => name !== sceneName)
      : [...selectedScenesForList, sceneName];
    setSelectedScenesForList(newSelectedScenes);
    setAutoSceneList(newSelectedScenes); // Update store
  };
  const handlePlayPauseToggle = () => {
    if (autoSceneTempoSource === 'internal_clock') {
      // Use master clock for internal clock mode
      requestToggleMasterClockPlayPause();
    } else {
      // Use local clock for manual_bpm and tap_tempo modes
      setIsLocalClockPlaying(!isLocalClockPlaying);
      if (!isLocalClockPlaying) {
        // Starting: reset beat counter
        setLocalBeatCounter(0);
      }
    }
  };
  const handleResetDownbeat = () => {
    setLocalBeatCounter(0);
    // Flash briefly to indicate reset using shared state
    triggerAutoSceneFlash();
  };const isPlaying = autoSceneTempoSource === 'internal_clock' ? midiClockIsPlaying : isLocalClockPlaying;

  const effectiveBpm =
    autoSceneTempoSource === 'internal_clock' ? midiClockBpm :
    autoSceneTempoSource === 'manual_bpm'     ? autoSceneManualBpm :
                                                autoSceneTapTempoBpm;
  const beatsToNext = autoSceneEnabled && isPlaying && autoSceneList.length > 0
    ? Math.max(autoSceneBeatDivision - localBeatCounter, 0)
    : null;
  const tempoLabel =
    autoSceneTempoSource === 'internal_clock' ? 'Master' :
    autoSceneTempoSource === 'manual_bpm'     ? 'Manual' :
                                                'Tap';
  const currentSceneName = autoSceneList[autoSceneCurrentIndex] || null;
  const autoSceneTooltip = 'Auto-Scene does not save new scenes. It auto-loads the saved scenes in this sequence on the selected beat interval, using the chosen tempo source.';

  return (
    <div
      className={`${styles.autoSceneControl} ${autoSceneIsFlashing ? styles.flashing : ''}`}
      title={autoSceneTooltip}
    >
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2 title={autoSceneTooltip}>Auto-Scene</h2>
          <label className={styles.enableToggle} title={`${autoSceneTooltip} Toggle automatic scene loading.`}>
            <input
              type="checkbox"
              checked={autoSceneEnabled}
              onChange={(e) => setAutoSceneEnabled(e.target.checked)}
            />
            <span>{autoSceneEnabled ? 'ON' : 'OFF'}</span>
          </label>
        </div>
        <div className={styles.summaryChips}>
          <span
            className={`${styles.summaryChip} ${autoSceneEnabled && isPlaying ? styles.summaryRunning : ''}`}
            title="Auto-Scene status: enabled plus playing means it is actively loading scenes from the selected sequence."
          >
            <span className={`${styles.statusDot} ${autoSceneEnabled && isPlaying ? styles.active : ''}`} />
            {!autoSceneEnabled ? 'DISABLED' : !isPlaying ? 'STOPPED' : 'RUNNING'}
          </span>
          <span className={styles.summaryChip} title="Scene order mode: forward, ping-pong, or random">{autoSceneMode}</span>
          <span className={styles.summaryChip} title="How many beats Auto-Scene waits before loading the next queued scene">{autoSceneBeatDivision}b</span>
          <span className={styles.summaryChip} title={`${tempoLabel} clock driving Auto-Scene scene changes`}>{effectiveBpm.toFixed(1)} bpm</span>
          {beatsToNext !== null && (
            <span className={styles.summaryChip} title="Beats until next scene change">→ {beatsToNext}b</span>
          )}
          {currentSceneName && (
            <span className={`${styles.summaryChip} ${styles.summarySceneChip}`} title="Scene currently loaded by Auto-Scene">{currentSceneName}</span>
          )}
        </div>
        <div className={styles.headerControls}>
          <button
            className={styles.transportButton}
            onClick={handlePlayPauseToggle}
            disabled={!autoSceneEnabled || autoSceneList.length === 0}
            title={isPlaying ? 'Pause Auto-Scene scene loading' : 'Start Auto-Scene scene loading'}
          >
            <i className={isPlaying ? 'fas fa-pause' : 'fas fa-play'} />
          </button>
          <button
            className={styles.transportButton}
            onClick={handleResetDownbeat}
            disabled={!autoSceneEnabled}
            title="Reset the beat counter so the next Auto-Scene change waits a full beat interval"
          >
            <i className="fas fa-undo" />
          </button>
          <button
            className={styles.minimizeButton}
            onClick={() => onMinimizedChange?.(!isMinimized)}
            title={isMinimized ? 'Expand Auto-Scene Control' : 'Minimize Auto-Scene Control'}
          >
            <i className={isMinimized ? 'fas fa-expand' : 'fas fa-compress'}></i>
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className={styles.content}>
          <div className={styles.compactGrid}>
            <section className={styles.sequencePanel}>
              <div className={styles.panelHead}>
                <h3 title="These are the saved scenes Auto-Scene will load. Selecting scenes here does not save new scenes.">Sequence</h3>
                <span
                  className={styles.panelHint}
                  title="Click scene chips to add/remove them from the Auto-Scene playback queue."
                >
                  {selectedScenesForList.length}/{allScenes.length} selected · click to toggle
                </span>
              </div>
              {allScenes.length === 0 ? (
                <p className={styles.emptyHint}>No scenes available. Create some scenes first.</p>
              ) : (
                <div className={styles.sceneChipList}>
                  {allScenes.map((scene) => {
                    const idx = selectedScenesForList.indexOf(scene.name);
                    const selected = idx >= 0;
                    return (
                      <button
                        type="button"
                        key={scene.name}
                        className={`${styles.sceneChip} ${selected ? styles.sceneChipSelected : ''} ${currentSceneName === scene.name ? styles.sceneChipCurrent : ''}`}
                        onClick={() => handleToggleSceneInList(scene.name)}
                        title={selected ? `Auto-Scene position ${idx + 1}. Click to remove from automatic loading.` : 'Click to add this saved scene to automatic loading.'}
                      >
                        {selected && <span className={styles.sceneChipIndex}>{idx + 1}</span>}
                        <span className={styles.sceneChipName}>{scene.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={styles.optionsPanel}>
              <div className={styles.panelHead}>
                <h3>Playback</h3>
              </div>
              <div className={styles.controlRow}>
                <label htmlFor="autoSceneModeSelect" title="Controls how Auto-Scene walks through the selected saved scenes.">Mode</label>
                <select
                  id="autoSceneModeSelect"
                  value={autoSceneMode}
                  onChange={(e) => setAutoSceneMode(e.target.value as 'forward' | 'ping-pong' | 'random')}
                  disabled={!autoSceneEnabled}
                  title="Forward plays top-to-bottom, Ping-Pong bounces, Random picks a saved scene from the queue."
                >
                  <option value="forward">Forward</option>
                  <option value="ping-pong">Ping-Pong</option>
                  <option value="random">Random</option>
                </select>
              </div>
              <div className={styles.controlRow}>
                <label htmlFor="autoSceneBeatDivisionInput" title="Number of beats each saved scene stays loaded before Auto-Scene advances.">Beats / scene</label>
                <input
                  type="number"
                  id="autoSceneBeatDivisionInput"
                  value={autoSceneBeatDivision}
                  onChange={(e) => setAutoSceneBeatDivision(parseInt(e.target.value, 10))}
                  min="1"
                  disabled={!autoSceneEnabled}
                  title="Number of beats each saved scene stays loaded before Auto-Scene advances."
                />
              </div>
              <div className={styles.controlRow}>
                <label htmlFor="autoSceneTempoSourceSelect" title="Clock source used to count beats for Auto-Scene changes.">Tempo</label>
                <select
                  id="autoSceneTempoSourceSelect"
                  value={autoSceneTempoSource}
                  onChange={(e) => setAutoSceneTempoSource(e.target.value as 'internal_clock' | 'manual_bpm' | 'tap_tempo')}
                  disabled={!autoSceneEnabled}
                  title="Choose the clock that drives Auto-Scene scene changes."
                >
                  <option value="internal_clock">Master clock</option>
                  <option value="manual_bpm">Manual BPM</option>
                  <option value="tap_tempo">Tap tempo</option>
                </select>
              </div>
              {autoSceneTempoSource === 'manual_bpm' && (
                <div className={styles.controlRow}>
                  <label htmlFor="autoSceneManualBpmInput" title="Manual tempo used when Tempo is Manual BPM.">Manual BPM</label>
                  <input
                    type="number"
                    id="autoSceneManualBpmInput"
                    value={autoSceneManualBpm}
                    onChange={(e) => setManualBpm(parseInt(e.target.value, 10))}
                    min="20"
                    max="300"
                    disabled={!autoSceneEnabled}
                    title="Manual BPM used for Auto-Scene timing."
                  />
                </div>
              )}
              {autoSceneTempoSource === 'tap_tempo' && (
                <div className={styles.controlRow}>
                  <label title="Tap a tempo for Auto-Scene timing.">Tap tempo</label>
                  <div className={styles.tapTempoRow}>
                    <button
                      type="button"
                      className={styles.tapButton}
                      onClick={() => recordTapTempo()}
                      disabled={!autoSceneEnabled}
                      title="Tap repeatedly to set the Auto-Scene tempo."
                    >
                      Tap
                    </button>
                    <span className={styles.tapReadout}>{autoSceneTapTempoBpm.toFixed(2)} bpm</span>
                  </div>
                </div>
              )}
              <div className={styles.metaRow}>
                <span>Source: {selectedMidiClockHostId || '—'}</span>
                <span>Beat: {localBeatCounter}</span>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoSceneControl;
