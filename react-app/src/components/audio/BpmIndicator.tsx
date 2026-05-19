import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './BpmIndicator.module.scss';

const BpmIndicator: React.FC = () => {
  const {
    midiClockBpm,
    midiClockIsPlaying,
    midiClockCurrentBeat,
    midiClockCurrentBar,
    availableMidiClockHosts,
    selectedMidiClockHostId,
    setMidiClockBpm,
    requestToggleMasterClockPlayPause,
    requestMidiClockInputList,
    requestSetMidiClockInput,
    recordTapTempo,
    autoSceneTapTempoBpm
  } = useStore();

  const [manualBpm, setManualBpm] = useState(midiClockBpm);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const tapTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Update manual BPM when MIDI clock BPM changes
  useEffect(() => {
    setManualBpm(midiClockBpm);
  }, [midiClockBpm]);

  // Flash effect when playing
  useEffect(() => {
    if (midiClockIsPlaying) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [midiClockCurrentBeat]);

  // Handle tap tempo
  const handleTap = () => {
    const currentTime = Date.now();
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    
    if (lastTapTime > 0 && (currentTime - lastTapTime) < 2000) {
      setTapCount(prev => prev + 1);
    } else {
      setTapCount(1);
    }
    
    setLastTapTime(currentTime);
    recordTapTempo();
    
    // Reset tap count after 3 seconds
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
      setLastTapTime(0);
    }, 3000);
  };

  // Handle BPM input change
  const handleBpmChange = (value: number) => {
    const newBpm = Math.max(60, Math.min(200, value));
    setManualBpm(newBpm);
    setMidiClockBpm(newBpm);
  };

  // Handle MIDI clock source change
  const handleMidiSourceChange = (sourceId: string) => {
    requestSetMidiClockInput(sourceId);
  };

  // Request MIDI inputs on mount
  useEffect(() => {
    requestMidiClockInputList();
  }, []);

  const currentBpm = autoSceneTapTempoBpm || midiClockBpm;

  return (
    <div className={styles.bpmIndicator}>
      <div className={styles.bpmSection}>
        <div className={styles.bpmDisplay}>
          <div className={`${styles.bpmValue} ${isFlashing ? styles.flash : ''}`}>
            {Math.round(currentBpm)}
          </div>
          <div className={styles.bpmLabel}>BPM</div>
          <div className={`${styles.playStatus} ${midiClockIsPlaying ? styles.playing : styles.stopped}`}>
            <LucideIcon name={midiClockIsPlaying ? 'Play' : 'Pause'} />
          </div>
        </div>
        
        <div className={styles.beatBarDisplay}>
          <span className={styles.beatBar}>
            {midiClockCurrentBar}.{midiClockCurrentBeat}
          </span>
        </div>
      </div>

      <div className={styles.controlsSection}>
        <div className={styles.bpmControls}>
          <input
            type="number"
            min="60"
            max="200"
            value={manualBpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value) || 120)}
            className={styles.bpmInput}
            title="Manual BPM"
          />
          <button
            onClick={handleTap}
            className={styles.tapButton}
            title={`Tap Tempo (${tapCount} taps)`}
          >
            <LucideIcon name="MousePointerClick" />
            TAP
          </button>
        </div>


        <div className={styles.midiSourceControls}>
          <select
            value={selectedMidiClockHostId || 'internal'}
            onChange={(e) => handleMidiSourceChange(e.target.value)}
            className={styles.midiSourceSelect}
            title="MIDI Clock Source"
          >
            <option value="internal">Internal Clock</option>
            {availableMidiClockHosts.map((host) => (
              <option key={host.id} value={host.id}>
                {host.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default BpmIndicator;
