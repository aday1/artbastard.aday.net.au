import React, { useState } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './TimelineEventTargetSelector.module.scss';

interface TimelineEventTargetSelectorProps {
  eventType: 'midi' | 'osc';
  onSelect: (targetType: 'fixture' | 'scene' | 'dmxChannel' | 'group', targetId: string, targetValue?: number) => void;
  onCancel: () => void;
}

export const TimelineEventTargetSelector: React.FC<TimelineEventTargetSelectorProps> = ({
  eventType,
  onSelect,
  onCancel
}) => {
  const { fixtures, scenes, groups } = useStore();
  const [selectedType, setSelectedType] = useState<'fixture' | 'scene' | 'dmxChannel' | 'group'>('fixture');
  const [selectedId, setSelectedId] = useState<string>('');
  const [targetValue, setTargetValue] = useState<number>(255);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedType, selectedId, targetValue);
    }
  };

  return (
    <div className={styles.targetSelector}>
      <div className={styles.selectorHeader}>
        <h4>
          <LucideIcon name={eventType === 'midi' ? 'Music' : 'Radio'} />
          Select Target for {eventType.toUpperCase()} Event
        </h4>
        <button className={styles.closeButton} onClick={onCancel}>
          <LucideIcon name="X" />
        </button>
      </div>

      <div className={styles.selectorContent}>
        {/* Target Type Selection */}
        <div className={styles.typeSelector}>
          <button
            className={`${styles.typeButton} ${selectedType === 'fixture' ? styles.active : ''}`}
            onClick={() => {
              setSelectedType('fixture');
              setSelectedId('');
            }}
          >
            <LucideIcon name="Lightbulb" />
            Fixture
          </button>
          <button
            className={`${styles.typeButton} ${selectedType === 'scene' ? styles.active : ''}`}
            onClick={() => {
              setSelectedType('scene');
              setSelectedId('');
            }}
          >
            <LucideIcon name="Film" />
            Scene
          </button>
          <button
            className={`${styles.typeButton} ${selectedType === 'dmxChannel' ? styles.active : ''}`}
            onClick={() => {
              setSelectedType('dmxChannel');
              setSelectedId('');
            }}
          >
            <LucideIcon name="Sliders" />
            DMX Channel
          </button>
          <button
            className={`${styles.typeButton} ${selectedType === 'group' ? styles.active : ''}`}
            onClick={() => {
              setSelectedType('group');
              setSelectedId('');
            }}
          >
            <LucideIcon name="Users" />
            Group
          </button>
        </div>

        {/* Target Selection */}
        <div className={styles.targetSelection}>
          {selectedType === 'fixture' && (
            <div className={styles.targetList}>
              <label>Select Fixture:</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={styles.targetSelect}
              >
                <option value="">Choose a fixture...</option>
                {fixtures.map(fixture => (
                  <option key={fixture.id} value={fixture.id}>
                    {fixture.name} (DMX {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1})
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedType === 'scene' && (
            <div className={styles.targetList}>
              <label>Select Scene:</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={styles.targetSelect}
              >
                <option value="">Choose a scene...</option>
                {scenes.map(scene => (
                  <option key={scene.name} value={scene.name}>
                    {scene.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedType === 'dmxChannel' && (
            <div className={styles.targetList}>
              <label>Select DMX Channel:</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={styles.targetSelect}
              >
                <option value="">Choose a channel...</option>
                {Array.from({ length: 512 }, (_, i) => i + 1).map(channel => (
                  <option key={channel} value={channel.toString()}>
                    Channel {channel}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedType === 'group' && (
            <div className={styles.targetList}>
              <label>Select Group:</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={styles.targetSelect}
              >
                <option value="">Choose a group...</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.fixtureIndices.length} fixtures)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Value Input (for fixtures, channels, groups) */}
          {(selectedType === 'fixture' || selectedType === 'dmxChannel' || selectedType === 'group') && selectedId && (
            <div className={styles.valueInput}>
              <label>Target Value (0-255):</label>
              <div className={styles.valueControls}>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={targetValue}
                  onChange={(e) => setTargetValue(Number(e.target.value))}
                  className={styles.valueSlider}
                />
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={targetValue}
                  onChange={(e) => setTargetValue(Math.max(0, Math.min(255, Number(e.target.value))))}
                  className={styles.valueNumber}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.selectorActions}>
          <button
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={!selectedId}
          >
            <LucideIcon name="Check" />
            Apply Target
          </button>
          <button
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
