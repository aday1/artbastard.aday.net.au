import React, { useState } from 'react';
import {
  useStore,
  ChannelEnvelope,
  WaveformType,
  EnvelopeRepeatMode,
  EnvelopeLoopDirection,
} from '../../store';
import { useTheme } from '../../context/ThemeContext';
import { LucideIcon } from '../ui/LucideIcon';
import { MasterStyledSlider, RangeWindowControl } from '../ui/controls';
import { RemasterPanel } from '../ui/remaster/RemasterPanel';
import { EnvelopeDrawCanvas } from './EnvelopeDrawCanvas';
import { defaultEnvelopeDraft, bakeWaveformToPoints } from '../../utils/envelopeDefaults';
import styles from './EnvelopeAutomation.module.scss';

export const EnvelopeAutomation: React.FC = () => {
  const { theme } = useTheme();
  const {
    envelopeAutomation,
    bpm,
    selectedChannels,
    addEnvelope,
    updateEnvelope,
    removeEnvelope,
    toggleEnvelope,
    toggleGlobalEnvelope,
    setEnvelopeSpeed,
    channelNames,
    envelopeSpeedMidiMapping,
    midiLearnTarget,
    startMidiLearn,
    cancelMidiLearn,
    removeEnvelopeSpeedMidiMapping
  } = useStore(state => ({
    envelopeAutomation: state.envelopeAutomation,
    bpm: state.bpm,
    selectedChannels: state.selectedChannels,
    addEnvelope: state.addEnvelope,
    updateEnvelope: state.updateEnvelope,
    removeEnvelope: state.removeEnvelope,
    toggleEnvelope: state.toggleEnvelope,
    toggleGlobalEnvelope: state.toggleGlobalEnvelope,
    setEnvelopeSpeed: state.setEnvelopeSpeed,
    channelNames: state.channelNames,
    envelopeSpeedMidiMapping: state.envelopeSpeedMidiMapping,
    midiLearnTarget: state.midiLearnTarget,
    startMidiLearn: state.startMidiLearn,
    cancelMidiLearn: state.cancelMidiLearn,
    removeEnvelopeSpeedMidiMapping: state.removeEnvelopeSpeedMidiMapping
  }));

  const [editingEnvelope, setEditingEnvelope] = useState<ChannelEnvelope | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [newEnvelope, setNewEnvelope] = useState<Omit<ChannelEnvelope, 'id'>>(() =>
    defaultEnvelopeDraft(selectedChannels[0] || 0)
  );

  const handleAddEnvelope = () => {
    // Use first selected channel if available, otherwise default to channel 0
    const defaultChannel = selectedChannels.length > 0 ? selectedChannels[0] : 0;
    setNewEnvelope(prev => ({ ...prev, channel: defaultChannel }));
    setEditingEnvelope(null);
    setShowEditor(true);
  };

  const handleEditEnvelope = (envelope: ChannelEnvelope) => {
    const { id: _id, ...draft } = envelope;
    setNewEnvelope({
      ...draft,
      min: envelope.min ?? 0,
      max: envelope.max ?? 255,
      speed: envelope.speed ?? 1.0,
      repeatMode: envelope.repeatMode ?? 'loop',
      loopDirection: envelope.loopDirection ?? 'forward',
    });
    setEditingEnvelope(envelope);
    setShowEditor(true);
  };

  const handleSaveEnvelope = () => {
    if (editingEnvelope) {
      updateEnvelope(editingEnvelope.id, newEnvelope);
    } else {
      addEnvelope(newEnvelope);
    }
    setShowEditor(false);
    setEditingEnvelope(null);
    // Reset to default values for next envelope
    const defaultChannel = selectedChannels.length > 0 ? selectedChannels[0] : 0;
    setNewEnvelope(defaultEnvelopeDraft(defaultChannel));
  };

  const handleCancel = () => {
    setShowEditor(false);
    setEditingEnvelope(null);
    const defaultChannel = selectedChannels.length > 0 ? selectedChannels[0] : 0;
    setNewEnvelope(defaultEnvelopeDraft(defaultChannel));
  };

  return (
    <div className={styles.envelopeAutomation}>
      <RemasterPanel
        className={styles.remasterRoot}
        title={
          <>
            <LucideIcon name="Activity" />
            {theme === 'artsnob' && 'Envelope Automation: The Rhythm of Light'}
            {theme === 'standard' && 'Envelope Automation'}
            {theme === 'minimal' && 'Envelopes'}
            <span className={styles.easeBadge}>outExpo</span>
          </>
        }
        actions={
          <button
            type="button"
            className={`${styles.toggleButton} ${envelopeAutomation.globalEnabled ? styles.active : ''}`}
            onClick={toggleGlobalEnvelope}
          >
            <LucideIcon name={envelopeAutomation.globalEnabled ? 'Square' : 'Play'} />
            {envelopeAutomation.globalEnabled ? 'Stop' : 'Start'}
          </button>
        }
      >

      <div className={styles.content}>
        {/* Speed/Timer Control */}
        <div className={styles.speedControl}>
          <div className={styles.speedControlHeader}>
            <label>
              <LucideIcon name="Gauge" size={16} />
              Global speed: {envelopeAutomation.speed.toFixed(2)}x
            </label>
            <div className={styles.midiControls}>
              {(() => {
                const isLearning = midiLearnTarget?.type === 'envelopeSpeed';
                const hasMapping = !!envelopeSpeedMidiMapping;
                
                return (
                  <>
                    <button
                      className={`${styles.midiLearnButton} ${isLearning ? styles.learning : ''} ${hasMapping ? styles.mapped : ''}`}
                      onClick={() => {
                        if (isLearning) {
                          cancelMidiLearn();
                        } else {
                          startMidiLearn({ type: 'envelopeSpeed' });
                        }
                      }}
                      title={isLearning ? 'Cancel MIDI Learn' : hasMapping ? 'Remap MIDI' : 'Learn MIDI'}
                    >
                      <LucideIcon name={isLearning ? "Radio" : hasMapping ? "Unlink" : "Link"} />
                      {isLearning ? 'Learning...' : hasMapping ? 'Mapped' : 'Learn'}
                    </button>
                    
                    {hasMapping && !isLearning && (
                      <button
                        className={styles.midiForgetButton}
                        onClick={removeEnvelopeSpeedMidiMapping}
                        title="Remove MIDI mapping"
                      >
                        <LucideIcon name="Trash2" />
                        Forget
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          <MasterStyledSlider
            vertical={false}
            min={0.1}
            max={2}
            step={0.1}
            value={envelopeAutomation.speed}
            onChange={setEnvelopeSpeed}
          />
          {envelopeSpeedMidiMapping && (
            <div className={styles.midiMappingDisplay}>
              <span className={styles.midiMappingText}>
                {envelopeSpeedMidiMapping.controller !== undefined 
                  ? `CC ${envelopeSpeedMidiMapping.controller} (Ch ${envelopeSpeedMidiMapping.channel + 1})`
                  : `Note ${envelopeSpeedMidiMapping.note} (Ch ${envelopeSpeedMidiMapping.channel + 1})`
                }
              </span>
            </div>
          )}
        </div>
        <div className={styles.envelopeList}>
          <div className={styles.listHeader}>
            <h3>Active Envelopes ({envelopeAutomation.envelopes.length})</h3>
            <button className={styles.addButton} onClick={handleAddEnvelope}>
              <LucideIcon name="Plus" />
              Add Envelope
            </button>
          </div>

          {envelopeAutomation.envelopes.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No envelopes configured. Click "Add Envelope" to create one.</p>
            </div>
          ) : (
            <div className={styles.envelopes}>
              {envelopeAutomation.envelopes.map(envelope => (
                <EnvelopeCard
                  key={envelope.id}
                  envelope={envelope}
                  bpm={bpm}
                  channelName={channelNames[envelope.channel] || `CH ${envelope.channel + 1}`}
                  onEdit={() => handleEditEnvelope(envelope)}
                  onToggle={() => toggleEnvelope(envelope.id)}
                  onDelete={() => removeEnvelope(envelope.id)}
                  onSpeedChange={(speed) => updateEnvelope(envelope.id, { speed })}
                  globalEnabled={envelopeAutomation.globalEnabled}
                  globalSpeed={envelopeAutomation.speed}
                />
              ))}
            </div>
          )}
        </div>

        {showEditor && (
          <EnvelopeEditor
            envelope={newEnvelope}
            onChange={setNewEnvelope}
            onSave={handleSaveEnvelope}
            onCancel={handleCancel}
            selectedChannels={selectedChannels}
            bpm={bpm}
            channelNames={channelNames}
          />
        )}
      </div>
      </RemasterPanel>
    </div>
  );
};

interface EnvelopeCardProps {
  envelope: ChannelEnvelope;
  bpm: number;
  channelName: string;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onSpeedChange: (speed: number) => void;
  globalEnabled: boolean;
  globalSpeed: number;
}

const EnvelopeCard: React.FC<EnvelopeCardProps> = ({
  envelope,
  bpm,
  channelName,
  onEdit,
  onToggle,
  onDelete,
  onSpeedChange,
  globalEnabled,
  globalSpeed,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const waveformIcons: Record<WaveformType, 'Activity' | 'TrendingUp' | 'Square' | 'Triangle' | 'Edit'> = {
    sine: 'Activity',
    saw: 'TrendingUp',
    square: 'Square',
    triangle: 'Triangle',
    custom: 'Edit'
  };

  return (
    <div className={`${styles.envelopeCard} ${envelope.enabled ? styles.enabled : ''} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.channelInfo}>
          <button
            className={styles.collapseButton}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <LucideIcon name={isCollapsed ? "ChevronRight" : "ChevronDown"} />
          </button>
          <span className={styles.channelName}>{channelName}</span>
          <span className={styles.channelNumber}>CH {envelope.channel + 1}</span>
        </div>
        <div className={styles.cardActions}>
          <button
            className={`${styles.toggleButton} ${envelope.enabled ? styles.active : ''}`}
            onClick={onToggle}
            title={envelope.enabled ? 'Stop' : 'Start'}
            disabled={!globalEnabled}
          >
            <LucideIcon name={envelope.enabled ? "Square" : "Play"} />
            {envelope.enabled ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className={styles.cardBody}>
          <EnvelopeDrawCanvas
            envelope={envelope}
            bpm={bpm}
            globalSpeed={globalSpeed * (envelope.speed ?? 1)}
            animatePlayhead={globalEnabled && envelope.enabled}
            className={styles.cardCanvas}
          />
          <div className={styles.waveformInfo}>
            <LucideIcon name={waveformIcons[envelope.waveform]} />
            <span className={styles.waveformName}>{envelope.waveform.toUpperCase()}</span>
            <span className={styles.playbackBadge}>
              {envelope.repeatMode === 'once' ? 'once' : envelope.loopDirection}
            </span>
          </div>

          <div className={styles.envelopeParams}>
            <div className={styles.param}>
              <span className={styles.paramLabel}>Amplitude:</span>
              <span className={styles.paramValue}>{envelope.amplitude}%</span>
            </div>
            <div className={styles.param}>
              <span className={styles.paramLabel}>Offset:</span>
              <span className={styles.paramValue}>{envelope.offset}</span>
            </div>
            <div className={styles.param}>
              <span className={styles.paramLabel}>Range:</span>
              <span className={styles.paramValue}>{envelope.min ?? 0} - {envelope.max ?? 255}</span>
            </div>
            {envelope.tempoSync && (
              <div className={styles.param}>
                <span className={styles.paramLabel}>Tempo:</span>
                <span className={styles.paramValue}>
                  {bpm} BPM / {envelope.tempoMultiplier}x
                </span>
              </div>
            )}
            <div className={styles.param}>
              <span className={styles.paramLabel}>Speed:</span>
              <span className={styles.paramValue}>{(envelope.speed ?? 1.0).toFixed(2)}x</span>
            </div>
          </div>
          
          <div className={styles.speedControl}>
            <div className={styles.speedControlHeader}>
              <label>Speed: {(envelope.speed ?? 1.0).toFixed(2)}x</label>
              <div className={styles.speedControlActions}>
                <button
                  className={`${styles.toggleButton} ${envelope.enabled ? styles.active : ''}`}
                  onClick={onToggle}
                  title={envelope.enabled ? 'Stop' : 'Start'}
                  disabled={!globalEnabled}
                >
                  <LucideIcon name={envelope.enabled ? "Square" : "Play"} />
                  {envelope.enabled ? 'Stop' : 'Start'}
                </button>
              </div>
            </div>
            <MasterStyledSlider
              vertical={false}
              min={0.1}
              max={2}
              step={0.1}
              value={envelope.speed ?? 1.0}
              onChange={onSpeedChange}
              disabled={!globalEnabled}
            />
          </div>
        </div>
      )}

      <div className={styles.cardActions}>
        <button className={styles.editButton} onClick={onEdit}>
          <LucideIcon name="Edit" />
          Edit
        </button>
        <button className={styles.deleteButton} onClick={onDelete}>
          <LucideIcon name="Trash2" />
          Delete
        </button>
      </div>
    </div>
  );
};

interface EnvelopeEditorProps {
  envelope: Omit<ChannelEnvelope, 'id'>;
  onChange: (envelope: Omit<ChannelEnvelope, 'id'>) => void;
  onSave: () => void;
  onCancel: () => void;
  selectedChannels: number[];
  bpm: number;
  channelNames: string[];
}

const SegmentButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    className={`${styles.segmentBtn} ${active ? styles.segmentActive : ''}`}
    onClick={onClick}
  >
    {children}
  </button>
);

const EnvelopeEditor: React.FC<EnvelopeEditorProps> = ({
  envelope,
  onChange,
  onSave,
  onCancel,
  selectedChannels,
  bpm,
  channelNames
}) => {
  const setWaveform = (waveform: WaveformType) => {
    if (waveform === 'custom' && envelope.waveform !== 'custom') {
      onChange({
        ...envelope,
        waveform: 'custom',
        customPoints: bakeWaveformToPoints(envelope.waveform, 48),
      });
      return;
    }
    onChange({ ...envelope, waveform });
  };

  return (
    <div className={styles.editor}>
      <h3>Envelope editor</h3>

      <div className={styles.editorLayout}>
        <div className={styles.drawStage}>
          <EnvelopeDrawCanvas
            envelope={envelope}
            bpm={bpm}
            globalSpeed={envelope.speed ?? 1}
            editable
            animatePlayhead
            onPointsChange={(customPoints) =>
              onChange({ ...envelope, waveform: 'custom', customPoints })
            }
            onWaveformChange={(waveform) => onChange({ ...envelope, waveform })}
          />
          {envelope.waveform === 'custom' && (
            <div className={styles.customControls}>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...envelope,
                    customPoints: bakeWaveformToPoints('sine', 32),
                  })
                }
              >
                Reset curve
              </button>
            </div>
          )}
        </div>

        <div className={styles.editorSidebar}>
        <div className={styles.formGroup}>
          <label>Channel:</label>
          <select
            value={envelope.channel}
            onChange={(e) => onChange({ ...envelope, channel: parseInt(e.target.value) })}
          >
            {selectedChannels.length > 0 ? (
              selectedChannels.map(ch => {
                const channelName = channelNames[ch];
                const hasCustomName = channelName && channelName !== `CH ${ch + 1}` && channelName !== `Channel ${ch + 1}` && channelName.trim() !== '';
                const displayName = hasCustomName ? `${channelName} (CH ${ch + 1})` : `CH ${ch + 1}`;
                return (
                  <option key={ch} value={ch}>{displayName}</option>
                );
              })
            ) : (
              Array.from({ length: 512 }, (_, i) => {
                const channelName = channelNames[i];
                const hasCustomName = channelName && channelName !== `CH ${i + 1}` && channelName !== `Channel ${i + 1}` && channelName.trim() !== '';
                const displayName = hasCustomName ? `${channelName} (CH ${i + 1})` : `CH ${i + 1}`;
                return (
                  <option key={i} value={i}>{displayName}</option>
                );
              })
            )}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Waveform</label>
          <select value={envelope.waveform} onChange={(e) => setWaveform(e.target.value as WaveformType)}>
            <option value="sine">Sine</option>
            <option value="saw">Saw</option>
            <option value="square">Square</option>
            <option value="triangle">Triangle</option>
            <option value="custom">Draw custom</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Playback</label>
          <div className={styles.segmentRow}>
            <SegmentButton
              active={envelope.repeatMode === 'once'}
              onClick={() => onChange({ ...envelope, repeatMode: 'once' as EnvelopeRepeatMode })}
            >
              Once
            </SegmentButton>
            <SegmentButton
              active={envelope.repeatMode === 'loop'}
              onClick={() => onChange({ ...envelope, repeatMode: 'loop' as EnvelopeRepeatMode })}
            >
              Repeat
            </SegmentButton>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Direction</label>
          <div className={styles.segmentRow}>
            <SegmentButton
              active={envelope.loopDirection === 'forward'}
              onClick={() => onChange({ ...envelope, loopDirection: 'forward' as EnvelopeLoopDirection })}
            >
              Forward
            </SegmentButton>
            <SegmentButton
              active={envelope.loopDirection === 'reverse'}
              onClick={() => onChange({ ...envelope, loopDirection: 'reverse' as EnvelopeLoopDirection })}
            >
              Reverse
            </SegmentButton>
            <SegmentButton
              active={envelope.loopDirection === 'pingpong'}
              onClick={() => onChange({ ...envelope, loopDirection: 'pingpong' as EnvelopeLoopDirection })}
            >
              Ping-pong
            </SegmentButton>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Amplitude: {envelope.amplitude}%</label>
          <MasterStyledSlider
            vertical={false}
            min={0}
            max={100}
            value={envelope.amplitude}
            onChange={(v) => onChange({ ...envelope, amplitude: Math.round(v) })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Offset: {envelope.offset}</label>
          <MasterStyledSlider
            vertical={false}
            min={0}
            max={255}
            value={envelope.offset}
            onChange={(v) => onChange({ ...envelope, offset: Math.round(v) })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>DMX window</label>
          <RangeWindowControl
            min={0}
            max={255}
            minValue={envelope.min ?? 0}
            maxValue={envelope.max ?? 255}
            onChange={(newMin, newMax) => onChange({ ...envelope, min: newMin, max: newMax })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Phase: {envelope.phase}°</label>
          <MasterStyledSlider
            vertical={false}
            min={0}
            max={360}
            value={envelope.phase}
            onChange={(v) => onChange({ ...envelope, phase: Math.round(v) })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Speed: {(envelope.speed ?? 1.0).toFixed(2)}x</label>
          <MasterStyledSlider
            vertical={false}
            min={0.1}
            max={2}
            step={0.1}
            value={envelope.speed ?? 1.0}
            onChange={(v) => onChange({ ...envelope, speed: v })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              checked={envelope.tempoSync}
              onChange={(e) => onChange({ ...envelope, tempoSync: e.target.checked })}
            />
            Sync to Tempo ({bpm} BPM)
          </label>
        </div>

        {envelope.tempoSync && (
          <div className={styles.formGroup}>
            <label>Tempo Multiplier:</label>
            <select
              value={envelope.tempoMultiplier}
              onChange={(e) => onChange({ ...envelope, tempoMultiplier: parseFloat(e.target.value) })}
            >
              <option value="1">Whole Note (1x)</option>
              <option value="2">Half Note (2x)</option>
              <option value="4">Quarter Note (4x)</option>
              <option value="8">Eighth Note (8x)</option>
              <option value="16">Sixteenth Note (16x)</option>
            </select>
          </div>
        )}

        </div>
      </div>

      <div className={styles.editorActions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.saveButton} onClick={onSave}>
          Save
        </button>
      </div>
    </div>
  );
};

