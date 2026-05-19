import React, { useState, useRef, useEffect } from 'react';
import { useStore, ChannelEnvelope, WaveformType } from '../../store';
import { useTheme } from '../../context/ThemeContext';
import { LucideIcon } from '../ui/LucideIcon';
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
  const [newEnvelope, setNewEnvelope] = useState<Omit<ChannelEnvelope, 'id'>>({
    channel: selectedChannels[0] || 0,
    enabled: true,
    waveform: 'sine',
    customPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    amplitude: 100,
    offset: 0,
    phase: 0,
    tempoSync: true,
    tempoMultiplier: 4, // Quarter note
    loop: true,
    min: 0,
    max: 255,
    speed: 1.0
  });

  const handleAddEnvelope = () => {
    // Use first selected channel if available, otherwise default to channel 0
    const defaultChannel = selectedChannels.length > 0 ? selectedChannels[0] : 0;
    setNewEnvelope(prev => ({ ...prev, channel: defaultChannel }));
    setEditingEnvelope(null);
    setShowEditor(true);
  };

  const handleEditEnvelope = (envelope: ChannelEnvelope) => {
    // Ensure min/max/speed values exist (for backwards compatibility with old envelopes)
    const envelopeWithDefaults = {
      ...envelope,
      min: envelope.min ?? 0,
      max: envelope.max ?? 255,
      speed: envelope.speed ?? 1.0
    };
    setNewEnvelope(envelopeWithDefaults);
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
    setNewEnvelope({
      channel: defaultChannel,
      enabled: true,
      waveform: 'sine',
      customPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      amplitude: 100,
      offset: 0,
      phase: 0,
      tempoSync: true,
      tempoMultiplier: 4,
      loop: true,
      min: 0,
      max: 255,
      speed: 1.0
    });
  };

  const handleCancel = () => {
    setShowEditor(false);
    setEditingEnvelope(null);
    // Reset to default values when canceling
    const defaultChannel = selectedChannels.length > 0 ? selectedChannels[0] : 0;
    setNewEnvelope({
      channel: defaultChannel,
      enabled: true,
      waveform: 'sine',
      customPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      amplitude: 100,
      offset: 0,
      phase: 0,
      tempoSync: true,
      tempoMultiplier: 4,
      loop: true,
      min: 0,
      max: 255,
      speed: 1.0
    });
  };

  return (
    <div className={styles.envelopeAutomation}>
      <div className={styles.header}>
        <h2>
          <LucideIcon name="Activity" />
          {theme === 'artsnob' && 'Envelope Automation: The Rhythm of Light'}
          {theme === 'standard' && 'Envelope Automation'}
          {theme === 'minimal' && 'Envelopes'}
        </h2>
        <button
          className={`${styles.toggleButton} ${envelopeAutomation.globalEnabled ? styles.active : ''}`}
          onClick={toggleGlobalEnvelope}
        >
          <LucideIcon name={envelopeAutomation.globalEnabled ? "Square" : "Play"} />
          {envelopeAutomation.globalEnabled ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className={styles.content}>
        {/* Speed/Timer Control */}
        <div className={styles.speedControl}>
          <div className={styles.speedControlHeader}>
            <label>
              <LucideIcon name="Gauge" size={16} />
              Speed: {envelopeAutomation.speed.toFixed(2)}x
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
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={envelopeAutomation.speed}
            onChange={(e) => setEnvelopeSpeed(parseFloat(e.target.value))}
            className={styles.speedSlider}
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
}

const EnvelopeCard: React.FC<EnvelopeCardProps> = ({
  envelope,
  bpm,
  channelName,
  onEdit,
  onToggle,
  onDelete,
  onSpeedChange,
  globalEnabled
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
          <div className={styles.waveformInfo}>
            <LucideIcon name={waveformIcons[envelope.waveform]} />
            <span className={styles.waveformName}>{envelope.waveform.toUpperCase()}</span>
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
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={envelope.speed ?? 1.0}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className={styles.speedSlider}
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

const EnvelopeEditor: React.FC<EnvelopeEditorProps> = ({
  envelope,
  onChange,
  onSave,
  onCancel,
  selectedChannels,
  bpm,
  channelNames
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    drawWaveform();
  }, [envelope.waveform, envelope.customPoints, envelope.amplitude, envelope.offset]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw waveform
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const points: Array<{ x: number; y: number }> = [];

    for (let x = 0; x < width; x++) {
      const progress = x / width;
      let value = 0;

      switch (envelope.waveform) {
        case 'sine':
          value = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
          break;
        case 'saw':
          value = progress;
          break;
        case 'square':
          value = progress < 0.5 ? 1 : 0;
          break;
        case 'triangle':
          value = progress < 0.5 ? progress * 2 : 2 - (progress * 2);
          break;
        case 'custom':
          if (envelope.customPoints.length > 0) {
            const sortedPoints = [...envelope.customPoints].sort((a, b) => a.x - b.x);
            let point1 = sortedPoints[0];
            let point2 = sortedPoints[sortedPoints.length - 1];

            for (let i = 0; i < sortedPoints.length - 1; i++) {
              if (progress >= sortedPoints[i].x && progress <= sortedPoints[i + 1].x) {
                point1 = sortedPoints[i];
                point2 = sortedPoints[i + 1];
                break;
              }
            }

            const t = (progress - point1.x) / (point2.x - point1.x || 0.001);
            value = point1.y + (point2.y - point1.y) * t;
          }
          break;
      }

      const y = height - (value * height);
      points.push({ x, y });

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw custom points
    if (envelope.waveform === 'custom') {
      envelope.customPoints.forEach(point => {
        const x = point.x * width;
        const y = height - (point.y * height);
        ctx.fillStyle = '#4a9eff';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (envelope.waveform !== 'custom') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;

    const newPoints = [...envelope.customPoints, { x, y }].sort((a, b) => a.x - b.x);
    onChange({ ...envelope, customPoints: newPoints });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || envelope.waveform !== 'custom') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;

    // Find nearest point and update it
    const sortedPoints = [...envelope.customPoints].sort((a, b) => a.x - b.x);
    let nearestIndex = 0;
    let minDist = Infinity;

    sortedPoints.forEach((point, index) => {
      const dist = Math.abs(point.x - x);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = index;
      }
    });

    if (minDist < 0.05) {
      const newPoints = [...envelope.customPoints];
      newPoints[nearestIndex] = { x, y: Math.max(0, Math.min(1, y)) };
      onChange({ ...envelope, customPoints: newPoints });
    }
  };

  return (
    <div className={styles.editor}>
      <h3>Edit Envelope</h3>

      <div className={styles.editorForm}>
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
          <label>Waveform:</label>
          <select
            value={envelope.waveform}
            onChange={(e) => onChange({ ...envelope, waveform: e.target.value as WaveformType })}
          >
            <option value="sine">Sine</option>
            <option value="saw">Saw</option>
            <option value="square">Square</option>
            <option value="triangle">Triangle</option>
            <option value="custom">Custom (Draw)</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Amplitude: {envelope.amplitude}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={envelope.amplitude}
            onChange={(e) => onChange({ ...envelope, amplitude: parseInt(e.target.value) })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Offset: {envelope.offset}</label>
          <input
            type="range"
            min="0"
            max="255"
            value={envelope.offset}
            onChange={(e) => onChange({ ...envelope, offset: parseInt(e.target.value) })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Min Value: {envelope.min ?? 0}</label>
          <input
            type="range"
            min="0"
            max={envelope.max ?? 255}
            value={envelope.min ?? 0}
            onChange={(e) => {
              const newMin = parseInt(e.target.value);
              const currentMax = envelope.max ?? 255;
              onChange({ ...envelope, min: newMin, max: Math.max(newMin, currentMax) });
            }}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Max Value: {envelope.max ?? 255}</label>
          <input
            type="range"
            min={envelope.min ?? 0}
            max="255"
            value={envelope.max ?? 255}
            onChange={(e) => {
              const newMax = parseInt(e.target.value);
              const currentMin = envelope.min ?? 0;
              onChange({ ...envelope, max: newMax, min: Math.min(newMax, currentMin) });
            }}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Phase: {envelope.phase}°</label>
          <input
            type="range"
            min="0"
            max="360"
            value={envelope.phase}
            onChange={(e) => onChange({ ...envelope, phase: parseInt(e.target.value) })}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Speed: {(envelope.speed ?? 1.0).toFixed(2)}x</label>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={envelope.speed ?? 1.0}
            onChange={(e) => onChange({ ...envelope, speed: parseFloat(e.target.value) })}
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

        <div className={styles.waveformPreview}>
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            onClick={handleCanvasClick}
            onMouseDown={() => setIsDrawing(true)}
            onMouseUp={() => setIsDrawing(false)}
            onMouseLeave={() => setIsDrawing(false)}
            onMouseMove={handleCanvasMouseMove}
            className={styles.canvas}
          />
        </div>

        {envelope.waveform === 'custom' && (
          <div className={styles.customControls}>
            <button
              onClick={() => onChange({ ...envelope, customPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })}
            >
              Reset
            </button>
            <button
              onClick={() => {
                const newPoints = envelope.customPoints.filter((_, i) => i !== envelope.customPoints.length - 1);
                onChange({ ...envelope, customPoints: newPoints });
              }}
            >
              Remove Last Point
            </button>
          </div>
        )}

        <div className={styles.editorActions}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

