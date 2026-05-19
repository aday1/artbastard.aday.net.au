import React, { useCallback, useMemo, useState } from 'react';
import {
  useStore,
  type ChannelEnvelope,
  type EnvelopeLoopDirection,
  type EnvelopeRepeatMode,
  type WaveformType,
} from '../../store';
import { defaultEnvelopeDraft, bakeWaveformToPoints } from '../../utils/envelopeDefaults';
import { EnvelopeDrawCanvas } from '../automation/EnvelopeDrawCanvas';
import { MasterStyledSlider } from '../ui/controls';
import styles from './ChannelEnvelopeStrip.module.scss';

interface ChannelEnvelopeStripProps {
  channelIndex: number;
}

const WAVEFORMS: WaveformType[] = ['sine', 'saw', 'square', 'triangle'];

function modeLabel(repeatMode: EnvelopeRepeatMode, loopDirection: EnvelopeLoopDirection): string {
  const once = repeatMode === 'once' ? '1x' : 'loop';
  const dir =
    loopDirection === 'pingpong' ? 'ping' : loopDirection === 'reverse' ? 'rev' : 'fwd';
  return `${once} ${dir}`;
}

export const ChannelEnvelopeStrip: React.FC<ChannelEnvelopeStripProps> = ({ channelIndex }) => {
  const [editOpen, setEditOpen] = useState(false);

  const {
    envelopeAutomation,
    bpm,
    addEnvelope,
    updateEnvelope,
    removeEnvelope,
    toggleEnvelope,
    toggleGlobalEnvelope,
  } = useStore((state) => ({
    envelopeAutomation: state.envelopeAutomation,
    bpm: state.bpm,
    addEnvelope: state.addEnvelope,
    updateEnvelope: state.updateEnvelope,
    removeEnvelope: state.removeEnvelope,
    toggleEnvelope: state.toggleEnvelope,
    toggleGlobalEnvelope: state.toggleGlobalEnvelope,
  }));

  const envelope = useMemo(
    () => envelopeAutomation.envelopes.find((e) => e.channel === channelIndex),
    [envelopeAutomation.envelopes, channelIndex],
  );

  const ensureGlobal = useCallback(() => {
    if (!envelopeAutomation.globalEnabled) {
      toggleGlobalEnvelope();
    }
  }, [envelopeAutomation.globalEnabled, toggleGlobalEnvelope]);

  const getOrCreateEnvelope = useCallback(
    (enabled: boolean): ChannelEnvelope | undefined => {
      const existing = useStore
        .getState()
        .envelopeAutomation.envelopes.find((e) => e.channel === channelIndex);
      if (existing) return existing;
      addEnvelope({
        ...defaultEnvelopeDraft(channelIndex),
        enabled,
      });
      return useStore
        .getState()
        .envelopeAutomation.envelopes.find((e) => e.channel === channelIndex);
    },
    [addEnvelope, channelIndex],
  );

  const patchEnvelope = useCallback(
    (updates: Partial<ChannelEnvelope>) => {
      const env = getOrCreateEnvelope(false);
      if (env) updateEnvelope(env.id, updates);
    },
    [getOrCreateEnvelope, updateEnvelope],
  );

  /** Set playback mode only — does not start automation. */
  const setModeOnly = useCallback(
    (repeatMode: EnvelopeRepeatMode, loopDirection: EnvelopeLoopDirection) => {
      patchEnvelope({ repeatMode, loopDirection });
    },
    [patchEnvelope],
  );

  /** Shift+click: set mode and start immediately. */
  const setModeAndPlay = useCallback(
    (repeatMode: EnvelopeRepeatMode, loopDirection: EnvelopeLoopDirection) => {
      let env = getOrCreateEnvelope(true);
      if (!env) return;
      updateEnvelope(env.id, { repeatMode, loopDirection, enabled: true });
      ensureGlobal();
      env = useStore.getState().envelopeAutomation.envelopes.find((e) => e.id === env!.id);
      if (env && !env.enabled) toggleEnvelope(env.id);
    },
    [ensureGlobal, getOrCreateEnvelope, toggleEnvelope, updateEnvelope],
  );

  const handleModeClick = (
    e: React.MouseEvent,
    repeatMode: EnvelopeRepeatMode,
    loopDirection: EnvelopeLoopDirection,
  ) => {
    if (e.shiftKey) {
      setModeAndPlay(repeatMode, loopDirection);
    } else {
      setModeOnly(repeatMode, loopDirection);
    }
  };

  const handlePlayToggle = useCallback(() => {
    if (!envelope) {
      const created = getOrCreateEnvelope(true);
      if (created) ensureGlobal();
      return;
    }
    ensureGlobal();
    toggleEnvelope(envelope.id);
  }, [envelope, ensureGlobal, getOrCreateEnvelope, toggleEnvelope]);

  const cycleWaveform = () => {
    const current = envelope?.waveform ?? 'sine';
    const idx = WAVEFORMS.indexOf(current as WaveformType);
    const next = WAVEFORMS[(idx + 1) % WAVEFORMS.length];
    if (next === 'custom') {
      patchEnvelope({ waveform: 'sine' });
      return;
    }
    const env = getOrCreateEnvelope(false);
    if (!env) return;
    updateEnvelope(env.id, {
      waveform: next,
      customPoints: bakeWaveformToPoints(next, 48),
    });
  };

  const running = Boolean(envelope?.enabled) && envelopeAutomation.globalEnabled;
  const hasEnvelope = Boolean(envelope);
  const repeatMode = envelope?.repeatMode ?? 'loop';
  const loopDirection = envelope?.loopDirection ?? 'forward';
  const globalOff = !envelopeAutomation.globalEnabled;
  const waveform = envelope?.waveform ?? 'sine';

  const btnClass = (active: boolean) =>
    [styles.btn, active ? styles.btnModeActive : ''].filter(Boolean).join(' ');

  return (
    <div
      className={styles.strip}
      role="group"
      aria-label={`Envelope automation for channel ${channelIndex + 1}`}
    >
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPlay} ${running ? styles.btnRunning : hasEnvelope ? styles.btnActive : ''}`}
          onClick={handlePlayToggle}
          title={
            !hasEnvelope
              ? 'Create envelope and start (enables global automation)'
              : running
                ? 'Stop envelope on this channel'
                : 'Start envelope on this channel'
          }
        >
          {!hasEnvelope ? 'ENV' : running ? 'STOP' : 'PLAY'}
        </button>
        <button
          type="button"
          className={btnClass(editOpen)}
          onClick={() => setEditOpen((v) => !v)}
          title="Edit waveform, speed, and amplitude under this fader"
        >
          EDIT
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={cycleWaveform}
          title="Cycle waveform: sine, saw, square, triangle"
        >
          {waveform.slice(0, 3).toUpperCase()}
        </button>
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={btnClass(repeatMode === 'once')}
          onClick={(e) => handleModeClick(e, 'once', loopDirection)}
          title="Once (no play). Shift+click: set and start."
        >
          1x
        </button>
        <button
          type="button"
          className={btnClass(repeatMode === 'loop')}
          onClick={(e) => handleModeClick(e, 'loop', loopDirection)}
          title="Loop (no play). Shift+click: set and start."
        >
          Loop
        </button>
        <button
          type="button"
          className={btnClass(loopDirection === 'forward')}
          onClick={(e) => handleModeClick(e, repeatMode, 'forward')}
          title="Forward. Shift+click: set and start."
        >
          Fwd
        </button>
        <button
          type="button"
          className={btnClass(loopDirection === 'reverse')}
          onClick={(e) => handleModeClick(e, repeatMode, 'reverse')}
          title="Reverse. Shift+click: set and start."
        >
          Rev
        </button>
        <button
          type="button"
          className={btnClass(loopDirection === 'pingpong')}
          onClick={(e) => handleModeClick(e, repeatMode, 'pingpong')}
          title="Ping-pong. Shift+click: set and start."
        >
          Ping
        </button>
      </div>

      {hasEnvelope && (
        <div className={styles.hint} aria-live="polite">
          {modeLabel(repeatMode, loopDirection)}
          {globalOff ? ' (global off)' : running ? ' running' : ' armed'}
        </div>
      )}

      {editOpen && hasEnvelope && envelope && (
        <div className={styles.quickEdit}>
          <div className={styles.quickDraw}>
            <EnvelopeDrawCanvas
              envelope={envelope}
              bpm={bpm}
              globalSpeed={(envelope.speed ?? 1) * envelopeAutomation.speed}
              editable
              animatePlayhead={running}
              onPointsChange={(customPoints) =>
                updateEnvelope(envelope.id, { waveform: 'custom', customPoints })
              }
              onWaveformChange={(wf) => {
                if (wf === 'custom') {
                  updateEnvelope(envelope.id, { waveform: 'custom' });
                } else {
                  updateEnvelope(envelope.id, {
                    waveform: wf,
                    customPoints: bakeWaveformToPoints(wf, 48),
                  });
                }
              }}
            />
          </div>
          <label className={styles.quickLabel}>
            Spd {(envelope.speed ?? 1).toFixed(1)}x
            <MasterStyledSlider
              vertical={false}
              min={0.1}
              max={4}
              step={0.1}
              value={envelope.speed ?? 1}
              onChange={(v) => updateEnvelope(envelope.id, { speed: v })}
            />
          </label>
          <label className={styles.quickLabel}>
            Amp {envelope.amplitude}%
            <MasterStyledSlider
              vertical={false}
              min={0}
              max={100}
              value={envelope.amplitude}
              onChange={(v) => updateEnvelope(envelope.id, { amplitude: Math.round(v) })}
            />
          </label>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              removeEnvelope(envelope.id);
              setEditOpen(false);
            }}
            title="Remove envelope from this channel"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
