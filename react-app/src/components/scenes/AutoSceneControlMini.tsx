import React, { useState, useEffect, useRef } from 'react';
import { DockableComponent } from '../ui/DockableComponent';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './AutoSceneControlMini.module.scss';

interface AutoSceneControlMiniProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isDockable?: boolean;
}

export const AutoSceneControlMini: React.FC<AutoSceneControlMiniProps> = ({
  isCollapsed = false,
  onCollapsedChange,
  isDockable = true,
}) => {// Local state for scene management
  const [showSceneManagement, setShowSceneManagement] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [showDirectionControls, setShowDirectionControls] = useState(false);

  // Local state for manual/tap tempo clock management
  const [localBeatCounter, setLocalBeatCounter] = useState(0);
  const [isLocalClockPlaying, setIsLocalClockPlaying] = useState(false);
  const prevBeatRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);  const {
    autoSceneEnabled,
    autoSceneList,
    autoSceneCurrentIndex,
    autoSceneTempoSource,
    autoSceneManualBpm,
    autoSceneTapTempoBpm,
    autoSceneBeatDivision,
    autoSceneIsFlashing,
    autoSceneMode,
    midiClockIsPlaying,
    midiClockCurrentBeat,
    scenes,
  } = useStore(state => ({
    autoSceneEnabled: state.autoSceneEnabled,
    autoSceneList: state.autoSceneList,
    autoSceneCurrentIndex: state.autoSceneCurrentIndex,
    autoSceneTempoSource: state.autoSceneTempoSource,
    autoSceneManualBpm: state.autoSceneManualBpm,
    autoSceneTapTempoBpm: state.autoSceneTapTempoBpm,
    autoSceneBeatDivision: state.autoSceneBeatDivision,
    autoSceneIsFlashing: state.autoSceneIsFlashing,
    autoSceneMode: state.autoSceneMode || 'forward',
    midiClockIsPlaying: state.midiClockIsPlaying,
    midiClockCurrentBeat: state.midiClockCurrentBeat,
    scenes: state.scenes,
  }));
  const {
    setAutoSceneEnabled,
    setAutoSceneTempoSource,
    setAutoSceneMode,
    setAutoSceneList,
    recordTapTempo,
    requestToggleMasterClockPlayPause,
    setManualBpm,
    setNextAutoSceneIndex,
    loadScene,
    triggerAutoSceneFlash,
  } = useStore(state => ({
    setAutoSceneEnabled: state.setAutoSceneEnabled,
    setAutoSceneTempoSource: state.setAutoSceneTempoSource,
    setAutoSceneMode: state.setAutoSceneMode,
    setAutoSceneList: state.setAutoSceneList,
    recordTapTempo: state.recordTapTempo,
    requestToggleMasterClockPlayPause: state.requestToggleMasterClockPlayPause,
    setManualBpm: state.setManualBpm,
    setNextAutoSceneIndex: state.setNextAutoSceneIndex,
    loadScene: state.loadScene,
    triggerAutoSceneFlash: state.triggerAutoSceneFlash,
  }));

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
      if (prevBeatRef.current !== null) {
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
                                (autoSceneTempoSource !== 'internal_clock' && isLocalClockPlaying));

    if (shouldTriggerChange) {
      triggerAutoSceneFlash();
      setNextAutoSceneIndex();
      setLocalBeatCounter(0);
    }
  }, [localBeatCounter, autoSceneBeatDivision, autoSceneEnabled, autoSceneList, setNextAutoSceneIndex, autoSceneTempoSource, midiClockIsPlaying, isLocalClockPlaying, triggerAutoSceneFlash]);

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
        console.log(`Auto-Scene Mini: Loading scene "${sceneToLoad}" (Index: ${autoSceneCurrentIndex})`);
      }
    }
  }, [autoSceneEnabled, autoSceneCurrentIndex, autoSceneList, loadScene, autoSceneTempoSource, midiClockIsPlaying, isLocalClockPlaying]);

  // Handle play/pause for different tempo sources
  const handlePlayPauseToggle = () => {
    if (autoSceneTempoSource === 'internal_clock') {
      requestToggleMasterClockPlayPause();
    } else {
      setIsLocalClockPlaying(!isLocalClockPlaying);
      if (!isLocalClockPlaying) {
        setLocalBeatCounter(0);
      }
    }
  };
  const getCurrentBpm = () => {
    switch (autoSceneTempoSource) {
      case 'manual_bpm':
        return autoSceneManualBpm;
      case 'tap_tempo':
        return autoSceneTapTempoBpm;
      default:
        return 120;
    }
  };

  // Helper functions for scene management
  const isSceneInAutoList = (sceneName: string) => {
    return autoSceneList.includes(sceneName);
  };

  const toggleSceneInAutoList = (sceneName: string) => {
    const newAutoSceneList = isSceneInAutoList(sceneName)
      ? autoSceneList.filter(name => name !== sceneName)
      : [...autoSceneList, sceneName];
    
    setAutoSceneList(newAutoSceneList);
  };

  const addAllScenesToAutoList = () => {
    const allSceneNames = scenes.map(scene => scene.name);
    setAutoSceneList(allSceneNames);
  };

  const clearAutoSceneList = () => {
    setAutoSceneList([]);
  };

  const renderContent = () => {
    if (isCollapsed) return null;

    return (
      <div className={styles.content}>        <div className={styles.controls}>
          <div className={styles.info}>
            <div className={styles.bpmDisplay}>
              {getCurrentBpm().toFixed(1)} BPM
            </div>
            <div className={styles.sceneCount}>
              {autoSceneList.length} scenes
            </div>
          </div>
        </div>        <div className={styles.tempoControls}>
          <select
            value={autoSceneTempoSource}
            onChange={(e) => setAutoSceneTempoSource(e.target.value as any)}
            className={styles.tempoSelect}
          >
            <option value="internal_clock">Internal Clock</option>
            <option value="manual_bpm">Manual BPM</option>
            <option value="tap_tempo">Tap Tempo</option>
          </select>

          {autoSceneTempoSource === 'manual_bpm' && (
            <input
              type="number"
              value={autoSceneManualBpm}
              onChange={(e) => setManualBpm(parseInt(e.target.value, 10))}
              min="20"
              max="300"
              className={styles.bpmInput}
              title="Manual BPM"
            />
          )}

          {autoSceneTempoSource === 'tap_tempo' && (
            <button
              className={styles.tapButton}
              onClick={() => recordTapTempo()}
              title="Tap Tempo"
            >
              <LucideIcon name="Zap" size={12} />
              TAP
            </button>
          )}
        </div>        {autoSceneList.length > 0 && (
          <div className={styles.currentScene}>
            Scene: {autoSceneCurrentIndex + 1}/{autoSceneList.length}
          </div>
        )}

        {/* Direction Controls */}
        <div className={styles.directionSection}>
          <button
            className={styles.toggleSection}
            onClick={() => setShowDirectionControls(!showDirectionControls)}
            title="Direction Controls"
          >
            <LucideIcon name="ArrowLeftRight" size={12} />
            {autoSceneMode}
          </button>
          
          {showDirectionControls && (
            <div className={styles.directionControls}>
              <select
                value={autoSceneMode}
                onChange={(e) => setAutoSceneMode(e.target.value as 'forward' | 'ping-pong' | 'random')}
                className={styles.directionSelect}
              >
                <option value="forward">Forward</option>
                <option value="ping-pong">Ping-Pong</option>
                <option value="random">Random</option>
              </select>
            </div>
          )}
        </div>

        {/* Scene Management */}
        <div className={styles.sceneManagementSection}>
          <button
            className={styles.toggleSection}
            onClick={() => setShowSceneManagement(!showSceneManagement)}
            title="Scene Management"
          >
            <LucideIcon name="List" size={12} />
            Scenes ({autoSceneList.length})
          </button>
          
          {showSceneManagement && (
            <div className={styles.sceneManagement}>
              <div className={styles.sceneActions}>
                <button
                  className={styles.actionButton}
                  onClick={addAllScenesToAutoList}
                  disabled={scenes.length === 0}
                  title="Add all scenes"
                >
                  <LucideIcon name="Plus" size={10} />
                  All
                </button>
                <button
                  className={styles.actionButton}
                  onClick={clearAutoSceneList}
                  disabled={autoSceneList.length === 0}
                  title="Clear all scenes"
                >
                  <LucideIcon name="X" size={10} />
                  Clear
                </button>
              </div>
              
              {scenes.length > 0 && (
                <div className={styles.sceneList}>
                  {scenes.map((scene) => (
                    <div key={scene.name} className={styles.sceneItem}>
                      <button
                        className={`${styles.sceneToggle} ${isSceneInAutoList(scene.name) ? styles.active : ''}`}
                        onClick={() => toggleSceneInAutoList(scene.name)}
                        title={isSceneInAutoList(scene.name) ? 'Remove from auto-play' : 'Add to auto-play'}
                      >
                        <LucideIcon 
                          name={isSceneInAutoList(scene.name) ? "Check" : "Plus"} 
                          size={10} 
                        />
                        <span className={styles.sceneName}>{scene.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };  const content = (
    <>
      <div className={styles.header}>
        <span className={styles.title}>Scene Auto</span>
        <div className={styles.status}>
          {autoSceneEnabled && (
            <LucideIcon 
              name="Play" 
              size={12} 
              className={`${styles.playingIcon} ${
                (autoSceneTempoSource === 'internal_clock' ? midiClockIsPlaying : isLocalClockPlaying) ? styles.active : ''
              }`} 
            />
          )}
        </div>
      </div>
      {renderContent()}
    </>
  );

  if (!isDockable) {
    return (
      <div className={`${styles.container} ${autoSceneIsFlashing ? styles.flashing : ''}`}>
        {content}
      </div>
    );
  }

  return (
    <DockableComponent
      id="auto-scene-control-mini"
      title="Scene Auto"
      component="midi-clock" // Reusing existing component type
      defaultPosition={{ zone: 'top-left' }}
      defaultZIndex={1025}
      isCollapsed={isCollapsed}
      onCollapsedChange={onCollapsedChange}
      className={`${styles.container} ${autoSceneIsFlashing ? styles.flashing : ''}`}
      isDraggable={false}
    >
      {content}
    </DockableComponent>
  );
};
