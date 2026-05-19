import React, { useMemo } from 'react';
import {
  useStore,
  ChannelEnvelope,
  WaveformType,
  EnvelopeRepeatMode,
  EnvelopeLoopDirection,
} from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { MasterStyledSlider } from '../ui/controls';
import { EnvelopeDrawCanvas } from './EnvelopeDrawCanvas';
import { EnvelopePlaybackControls } from './EnvelopePlaybackControls';
import { defaultEnvelopeDraft, bakeWaveformToPoints } from '../../utils/envelopeDefaults';
import styles from './EnvelopeShared.module.scss';

export interface EnvelopeChannelPanelProps {
  channel: number;
  channelLabel?: string;
  compact?: boolean;
}

export const EnvelopeChannelPanel: React.FC<EnvelopeChannelPanelProps> = ({
  channel,
  channelLabel,
  compact = false,
}) => {
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
    () => envelopeAutomation.envelopes.find((e) => e.channel === channel),
    [envelopeAutomation.envelopes, channel]
  );

  const label = channelLabel ?? `CH ${channel + 1}`;

  const patch = (updates: Partial<ChannelEnvelope>) => {
    if (!envelope) return;
    updateEnvelope(envelope.id, updates);
  };

  const setWaveform = (waveform: WaveformType) => {
    if (!envelope) return;
    if (waveform === 'custom' && envelope.waveform !== 'custom') {
      patch({
        waveform: 'custom',
        customPoints: bakeWaveformToPoints(envelope.waveform, 48),
      });
      return;
    }
    patch({ waveform });
  };

  const handleAdd = () => {
    addEnvelope({ ...defaultEnvelopeDraft(channel), enabled: true });
    if (!envelopeAutomation.globalEnabled) {
      toggleGlobalEnvelope();
    }
  };

  if (!envelope) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.channelTitle}>{label}</span>
        </div>
        <p className={styles.emptyState}>No envelope on this channel.</p>
        <button type="button" className={styles.addBtn} onClick={handleAdd}>
          Add envelope automation
        </button>
      </div>
    );
  }

  const draft = envelope;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.channelTitle}>{label}</span>
        <div className={styles.headerActions}>
          {!envelopeAutomation.globalEnabled && (
            <button type="button" className={styles.iconBtn} onClick={toggleGlobalEnvelope}>
              Start global
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${draft.enabled ? styles.active : ''}`}
            onClick={() => toggleEnvelope(envelope.id)}
            disabled={!envelopeAutomation.globalEnabled}
            title={draft.enabled ? 'Stop envelope' : 'Start envelope'}
          >
            <LucideIcon name={draft.enabled ? 'Square' : 'Play'} size={14} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => removeEnvelope(envelope.id)}
            title="Remove envelope"
          >
            <LucideIcon name="Trash2" size={14} />
          </button>
        </div>
      </div>

      {!envelopeAutomation.globalEnabled && (
        <p className={styles.globalHint}>Global envelope automation is off.</p>
      )}

      <div className={styles.drawWrap}>
        <EnvelopeDrawCanvas
          envelope={draft}
          bpm={bpm}
          globalSpeed={(draft.speed ?? 1) * envelopeAutomation.speed}
          editable
          animatePlayhead={envelopeAutomation.globalEnabled && draft.enabled}
          onPointsChange={(customPoints) => patch({ waveform: 'custom', customPoints })}
          onWaveformChange={(waveform) => patch({ waveform })}
        />
      </div>

      <div className={styles.formRow}>
        <label>Waveform</label>
        <select value={draft.waveform} onChange={(e) => setWaveform(e.target.value as WaveformType)}>
          <option value="sine">Sine</option>
          <option value="saw">Saw</option>
          <option value="square">Square</option>
          <option value="triangle">Triangle</option>
          <option value="custom">Draw custom</option>
        </select>
      </div>

      <EnvelopePlaybackControls
        repeatMode={draft.repeatMode}
        loopDirection={draft.loopDirection}
        onRepeatModeChange={(repeatMode: EnvelopeRepeatMode) => patch({ repeatMode })}
        onLoopDirectionChange={(loopDirection: EnvelopeLoopDirection) => patch({ loopDirection })}
      />

      <div className={styles.sliderRow}>
        <div className={styles.formRow}>
          <label>Amplitude {draft.amplitude}%</label>
          <MasterStyledSlider
            vertical={false}
            min={0}
            max={100}
            value={draft.amplitude}
            onChange={(v) => patch({ amplitude: Math.round(v) })}
          />
        </div>
        {!compact && (
          <div className={styles.formRow}>
            <label>Speed {(draft.speed ?? 1).toFixed(2)}x</label>
            <MasterStyledSlider
              vertical={false}
              min={0.1}
              max={2}
              step={0.1}
              value={draft.speed ?? 1}
              onChange={(v) => patch({ speed: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
};
