"use client";

import React from 'react';
import { Fixture, useDmxStore } from '../../store/dmxStore';
import styles from './FixtureListItem.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faTrashAlt, faEdit, faSquare, faCheckSquare } from '@fortawesome/free-solid-svg-icons';

interface FixtureListItemProps {
  fixture: Fixture;
  onEdit: (fixture: Fixture) => void; // Callback to open edit modal/form
}

const FixtureListItem: React.FC<FixtureListItemProps> = ({ fixture, onEdit }) => {
  const { selectedFixtureIds, toggleFixtureSelection, removeFixture } = useDmxStore(state => ({
    selectedFixtureIds: state.selectedFixtureIds,
    toggleFixtureSelection: state.toggleFixtureSelection,
    removeFixture: state.removeFixture,
  }));

  const isSelected = selectedFixtureIds.includes(fixture.id);

  const handleSelect = (event: React.MouseEvent) => {
    // Allow additive selection with Shift or Ctrl/Meta key
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    toggleFixtureSelection(fixture.id, additive);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection when clicking delete
    if (window.confirm(`Are you sure you want to delete fixture "${fixture.name}"?`)) {
      removeFixture(fixture.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection
    onEdit(fixture);
  };

  return (
    <div
      className={`${styles.fixtureListItem} ${isSelected ? styles.selected : ''}`}
      onClick={handleSelect}
      title={`ID: ${fixture.id}\nChannels: ${fixture.channels.length}\nClick to select. Shift/Ctrl+Click for multi-select.`}
    >
      <div className={styles.selectionIndicator}>
        <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} />
      </div>
      <div className={styles.icon}>
        <FontAwesomeIcon icon={faLightbulb} />
      </div>
      <div className={styles.details}>
        <h4 className={styles.name}>{fixture.name}</h4>
        <p className={styles.info}>
          Addr: {fixture.startAddress} | Ch: {fixture.channels.length}
          {/* Można dodać typ fixture.typeName jeśli istnieje */}
        </p>
      </div>
      <div className={styles.actions}>
        <button onClick={handleEdit} className={styles.actionButton} title="Edit Fixture">
          <FontAwesomeIcon icon={faEdit} />
        </button>
        <button onClick={handleDelete} className={`${styles.actionButton} ${styles.deleteButton}`} title="Delete Fixture">
          <FontAwesomeIcon icon={faTrashAlt} />
        </button>
      </div>
    </div>
  );
};

export default FixtureListItem;
