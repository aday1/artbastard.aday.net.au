import React, { useMemo } from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import { DmxFaderRow } from '../ui/controls';
import styles from './SceneChannelValueEditor.module.scss';

export interface SceneChannelValueEditorProps {
  originalValues: number[];
  values: number[];
  onChange: (channelIndex: number, value: number) => void;
  onSave: () => void;
  /** Optional per-channel labels (0-based index). */
  channelNames?: Record<number, string> | string[];
  controlIdPrefix?: string;
}

export const SceneChannelValueEditor: React.FC<SceneChannelValueEditorProps> = ({
  originalValues,
  values,
  onChange,
  onSave,
  channelNames = {},
  controlIdPrefix = 'scene-edit',
}) => {
  const modifiedCount = useMemo(
    () => values.filter((val, idx) => val !== originalValues[idx]).length,
    [values, originalValues]
  );

  const hasChanges = modifiedCount > 0;

  const visibleIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] > 0 || originalValues[i] > 0) {
        indices.push(i);
      }
    }
    return indices;
  }, [values, originalValues]);

  const labelFor = (index: number) => {
    const custom = Array.isArray(channelNames) ? channelNames[index] : channelNames[index];
    if (custom && custom !== `CH ${index + 1}` && custom !== `Channel ${index + 1}`) {
      return custom;
    }
    return `CH ${index + 1}`;
  };

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h5 className={styles.title}>
          Edit channel values
          {hasChanges && (
            <span className={styles.pendingBadge}>{modifiedCount} pending</span>
          )}
        </h5>
        <button
          type="button"
          className={`${styles.saveButton} ${hasChanges ? styles.dirty : ''}`}
          onClick={onSave}
          disabled={!hasChanges}
        >
          <LucideIcon name="Save" size={16} />
          {hasChanges ? 'Save changes' : 'No changes'}
        </button>
      </div>

      <div className={styles.grid}>
        {visibleIndices.map((index) => {
          const value = values[index];
          const modified = value !== originalValues[index];
          return (
            <div key={index} className={styles.channelCard}>
              <div className={styles.channelMeta}>
                <span>{labelFor(index)}</span>
                <span className={`${styles.channelValue} ${modified ? styles.modified : ''}`}>
                  {value}
                </span>
              </div>
              <DmxFaderRow
                compact
                label={labelFor(index)}
                controlName={`${controlIdPrefix}-ch-${index}`}
                value={value}
                showOsc={false}
                showMidi={false}
                onChange={(v) => onChange(index, Math.round(v))}
              />
            </div>
          );
        })}
      </div>

      <p className={styles.tip}>
        Modified channels are highlighted. Only channels with a saved level or a non-zero edit are shown.
      </p>
    </div>
  );
};

export default SceneChannelValueEditor;
