import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useMetronomeAudio } from '../../hooks/useMetronomeAudio';
import styles from './MetronomePanel.module.scss';

export interface MetronomePanelProps {
  compact?: boolean;
  beatsPerBar?: number;
  showTap?: boolean;
  showBpmInput?: boolean;
  showSoundToggle?: boolean;
  className?: string;
  onBpmChange?: (bpm: number) => void;
}

export const MetronomePanel: React.FC<MetronomePanelProps> = ({
  compact = false,
  beatsPerBar = 4,
  showTap = true,
  showBpmInput = true,
  showSoundToggle = true,
  className = '',
  onBpmChange,
}) => {
  const {
    midiClockBpm,
    midiClockIsPlaying,
    midiClockCurrentBeat,
    midiClockCurrentBar,
    autoSceneManualBpm,
    autoSceneTapTempoBpm,
    autoSceneTempoSource,
    recordTapTempo,
    setManualBpm,
    setAutoSceneTempoSource,
    setMidiClockBpm,
    setMidiClockIsPlaying,
    requestToggleMasterClockPlayPause,
    socket,
  } = useStore();

  const [soundOn, setSoundOn] = useState(true);
  const [pulseKey, setPulseKey] = useState(0);
  const [localFlash, setLocalFlash] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [bpmDraft, setBpmDraft] = useState('120');

  const currentBpm = useMemo(() => {
    if (autoSceneTempoSource === 'tap_tempo') return autoSceneTapTempoBpm || midiClockBpm;
    if (autoSceneTempoSource === 'manual_bpm') return autoSceneManualBpm;
    return midiClockBpm;
  }, [autoSceneTempoSource, autoSceneTapTempoBpm, autoSceneManualBpm, midiClockBpm]);

  const activeBeatIndex = Math.max(0, ((midiClockCurrentBeat || 1) - 1) % beatsPerBar);

  const triggerPulse = useCallback(() => {
    setPulseKey((k) => k + 1);
    setLocalFlash(true);
    window.setTimeout(() => setLocalFlash(false), 120);
  }, []);

  useMetronomeAudio(
    midiClockIsPlaying,
    currentBpm,
    beatsPerBar,
    () => {
      triggerPulse();
    },
    soundOn
  );

  useEffect(() => {
    setBpmDraft(String(Math.round(currentBpm)));
  }, [currentBpm]);

  const handleTogglePlay = () => {
    const socketIsConnected = Boolean((socket as unknown as { connected?: boolean } | null)?.connected);
    if (socketIsConnected) {
      requestToggleMasterClockPlayPause();
    } else {
      const next = !midiClockIsPlaying;
      setMidiClockIsPlaying(next);
      if (next && currentBpm > 0) {
        setMidiClockBpm(currentBpm);
      }
    }
  };

  const applyBpm = (value: number) => {
    const bpm = Math.max(40, Math.min(240, Math.round(value)));
    setManualBpm(bpm);
    setAutoSceneTempoSource('manual_bpm');
    setBpmDraft(String(bpm));
    if (midiClockIsPlaying) {
      setMidiClockBpm(bpm);
    }
    onBpmChange?.(bpm);
  };

  const handleTap = () => {
    recordTapTempo();
    setAutoSceneTempoSource('tap_tempo');
    setTapCount((c) => c + 1);
    window.setTimeout(() => setTapCount(0), 3000);
  };

  return (
    <div className={[styles.panel, compact ? styles.compact : '', className].filter(Boolean).join(' ')}>
      <div className={styles.visual}>
        <div className={styles.pulseStage}>
          {midiClockIsPlaying && (
            <div
              key={pulseKey}
              className={[styles.pulseRing, styles.pulseActive].join(' ')}
              aria-hidden
            />
          )}
          <div
            className={[styles.core, localFlash ? styles.coreFlash : ''].filter(Boolean).join(' ')}
          >
            <span className={styles.bpmCore}>{Math.round(currentBpm)}</span>
          </div>
        </div>
        <div className={styles.beatDots} aria-hidden>
          {Array.from({ length: beatsPerBar }, (_, i) => (
            <div
              key={i}
              className={[
                styles.beatDot,
                i === 0 ? styles.beatDotAccent : '',
                activeBeatIndex === i && midiClockIsPlaying ? styles.beatDotActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>
      </div>

      <div className={styles.readoutRow}>
        <span className={styles.barBeat}>
          {midiClockCurrentBar || 1}.{midiClockCurrentBeat || 1}
        </span>
        <span className={[styles.bpmLarge, localFlash ? styles.bpmFlash : ''].filter(Boolean).join(' ')}>
          {Math.round(currentBpm)} BPM
        </span>
      </div>

      <div className={styles.transportRow}>
        <button
          type="button"
          className={[styles.playStopBtn, midiClockIsPlaying ? styles.stopBtn : styles.playBtn].filter(Boolean).join(' ')}
          onClick={handleTogglePlay}
        >
          {midiClockIsPlaying ? 'Stop' : 'Play'}
        </button>
        <label className={styles.powerSwitch}>
          <input
            type="checkbox"
            checked={midiClockIsPlaying}
            onChange={handleTogglePlay}
            aria-label={midiClockIsPlaying ? 'Stop metronome' : 'Start metronome'}
          />
          <span className={[styles.switchBox, midiClockIsPlaying ? styles.switchOn : ''].filter(Boolean).join(' ')} />
          <span className={styles.switchLabel}>{midiClockIsPlaying ? 'On' : 'Off'}</span>
        </label>
        {showTap && (
          <button
            type="button"
            className={[styles.tapBtn, tapCount > 0 ? styles.tapActive : ''].filter(Boolean).join(' ')}
            onClick={handleTap}
          >
            Tap{tapCount > 0 ? ` (${tapCount})` : ''}
          </button>
        )}
      </div>

      {(showBpmInput || showSoundToggle) && (
        <div className={styles.extra}>
          {showBpmInput && (
            <div className={styles.bpmRow}>
              <input
                type="number"
                min={40}
                max={240}
                className={styles.bpmInput}
                value={bpmDraft}
                onChange={(e) => setBpmDraft(e.target.value)}
                onBlur={() => {
                  const v = parseInt(bpmDraft, 10);
                  if (!Number.isNaN(v)) applyBpm(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = parseInt(bpmDraft, 10);
                    if (!Number.isNaN(v)) applyBpm(v);
                  }
                }}
                aria-label="BPM"
              />
            </div>
          )}
          {showSoundToggle && (
            <label className={styles.soundToggle}>
              <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
              Click sound
            </label>
          )}
        </div>
      )}
    </div>
  );
};
