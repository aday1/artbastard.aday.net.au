/**
 * Universe Selector Component
 * UI for selecting and managing DMX universes
 */

import React, { useState } from 'react';
import { useStore } from '../../store';
import { getButtonAriaLabel } from '../../utils/accessibility';
import { validateUniverse } from '../../utils/inputValidation';
import styles from './UniverseSelector.module.scss';

const UniverseSelector: React.FC = () => {
  const [showAddUniverse, setShowAddUniverse] = useState(false);
  const [newUniverseNumber, setNewUniverseNumber] = useState(1);
  
  // Get universe state from store
  // Note: When universeSlice is fully integrated into main store, use:
  // const { activeUniverse, universes, setActiveUniverse, addUniverse } = useStore(state => state.universeSlice);
  // For now, using local state until integration is complete
  const [activeUniverse, setActiveUniverse] = useState(0);
  const universes: Record<number, { universe: number; name: string; enabled: boolean }> = {
    0: { universe: 0, name: 'Universe 1', enabled: true }
  };
  
  const handleAddUniverse = () => {
    // When universeSlice is integrated, this will call:
    // addUniverse(newUniverseNumber, { name: `Universe ${newUniverseNumber + 1}`, enabled: true });
    // For now, show notification that integration is pending
    console.log(`[UniverseSelector] Add universe ${newUniverseNumber} - Integration pending`);
    setShowAddUniverse(false);
    setNewUniverseNumber(1);
  };

  return (
    <div className={styles.universeSelector}>
      <div className={styles.header}>
        <h3>DMX Universe</h3>
        <button
          className={styles.addButton}
          onClick={() => setShowAddUniverse(true)}
          title="Add new universe"
          aria-label={getButtonAriaLabel('Add', 'new DMX universe')}
        >
          <i className="fas fa-plus" aria-hidden="true"></i>
          Add Universe
        </button>
      </div>

      <div className={styles.universeList}>
        <button
          className={`${styles.universeButton} ${activeUniverse === 0 ? styles.active : ''}`}
          onClick={() => setActiveUniverse(0)}
        >
          <span className={styles.universeNumber}>Universe 1</span>
          <span className={styles.universeInfo}>0-511</span>
        </button>

        {/* Additional universes would be rendered here when integrated */}
      </div>

      {showAddUniverse && (
        <div className={styles.addUniverseModal}>
          <div className={styles.modalContent}>
            <h4>Add New Universe</h4>
            <label>
              Universe Number (0-32767):
              <input
                type="number"
                min="0"
                max="32767"
                value={newUniverseNumber}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  const validation = validateUniverse(value);
                  if (validation.valid) {
                    setNewUniverseNumber(value);
                  }
                }}
                aria-invalid={newUniverseNumber < 0 || newUniverseNumber > 32767}
              />
            </label>
            <div className={styles.modalActions}>
              <button onClick={handleAddUniverse} className={styles.confirmButton}>
                Add
              </button>
              <button onClick={() => setShowAddUniverse(false)} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.universeInfo}>
        <p className={styles.infoText}>
          <i className="fas fa-info-circle"></i>
          Currently viewing Universe {activeUniverse + 1} (channels {activeUniverse * 512}-{(activeUniverse + 1) * 512 - 1})
        </p>
      </div>
    </div>
  );
};

export default UniverseSelector;

