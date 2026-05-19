"use client";

import React, { useState, useEffect } from 'react';
import { Fixture, useDmxStore } from '../../store/dmxStore';
import FixtureListItem from './FixtureListItem';
import styles from './FixtureList.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTimes, faSave } from '@fortawesome/free-solid-svg-icons';

// Basic Modal Component (can be extracted and improved later)
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
};

const FixtureList: React.FC = () => {
  const { fixtures, addFixture, updateFixture, loadInitialState } = useDmxStore(state => ({
    fixtures: state.fixtures,
    addFixture: state.addFixture,
    updateFixture: state.updateFixture,
    loadInitialState: state.loadInitialState, // To load fixtures from /api/state
  }));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);
  const [fixtureForm, setFixtureForm] = useState<Partial<Fixture>>({
    name: '',
    startAddress: 1,
    channels: [{ name: 'Dimmer', type: 'dimmer' }], // Default with one dimmer channel
  });

  useEffect(() => {
    // Fetch initial fixtures if not already loaded (e.g. by DMXChannelGrid)
    // This is a simplified fetch; ideally, a shared service or effect handles this.
    if (fixtures.length === 0) {
      const fetchInitialFixtures = async () => {
        try {
          const response = await fetch('/api/state'); // /api/state includes fixtures
          if (!response.ok) throw new Error('Failed to fetch initial state');
          const data = await response.json();
          if (data.fixtures) {
            loadInitialState({ fixtures: data.fixtures });
          }
        } catch (error) {
          console.error("Error fetching fixtures:", error);
        }
      };
      fetchInitialFixtures();
    }
  }, [fixtures.length, loadInitialState]);


  const openAddModal = () => {
    setEditingFixture(null);
    setFixtureForm({
      id: `fixture_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // Simple unique ID
      name: '',
      startAddress: (fixtures.length > 0
        ? (fixtures[fixtures.length -1].startAddress + fixtures[fixtures.length -1].channels.length)
        : 1
      ),
      channels: [{ name: 'Dimmer', type: 'dimmer' }],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (fixture: Fixture) => {
    setEditingFixture(fixture);
    setFixtureForm({ ...fixture });
    setIsModalOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFixtureForm(prev => ({
      ...prev,
      [name]: name === 'startAddress' || name === 'channelCount' ? parseInt(value, 10) : value,
    }));
  };

  const handleChannelDefinitionChange = (index: number, field: 'name' | 'type', value: string) => {
    setFixtureForm(prev => {
      const newChannels = [...(prev.channels || [])];
      if (newChannels[index]) {
        newChannels[index] = { ...newChannels[index], [field]: value };
      }
      return { ...prev, channels: newChannels };
    });
  };

  const addChannelToForm = () => {
    setFixtureForm(prev => ({
      ...prev,
      channels: [...(prev.channels || []), { name: `Channel ${(prev.channels?.length || 0) + 1}`, type: 'generic'}]
    }));
  };

  const removeChannelFromForm = (index: number) => {
     setFixtureForm(prev => ({
      ...prev,
      channels: (prev.channels || []).filter((_, i) => i !== index)
    }));
  };


  const handleSubmitFixture = async () => {
    if (!fixtureForm.name || !fixtureForm.startAddress || !fixtureForm.channels || fixtureForm.channels.length === 0) {
      alert('Please fill in all required fields (Name, Start Address, At least one channel).');
      return;
    }

    const finalFixture: Fixture = {
      id: editingFixture?.id || fixtureForm.id || `fixture_${Date.now()}`, // Ensure ID
      name: fixtureForm.name,
      startAddress: fixtureForm.startAddress,
      channels: fixtureForm.channels,
    };

    if (editingFixture) {
      await updateFixture(finalFixture);
    } else {
      await addFixture(finalFixture);
    }
    setIsModalOpen(false);
  };

  const commonChannelTypes = [
    "dimmer", "red", "green", "blue", "white", "amber", "uv",
    "pan", "tilt", "pan_fine", "tilt_fine",
    "shutter", "strobe", "speed", "zoom", "focus", "iris",
    "gobo_wheel", "gobo_rotation", "color_wheel", "prism", "effect", "macro",
    "frost", "animation", "animation_speed", "cto", "ctb",
    "reset", "lamp_control", "fan_control", "display", "function", "generic"
  ];


  return (
    <div className={styles.fixtureListContainer}>
      <div className={styles.listHeader}>
        <h3>Fixtures ({fixtures.length})</h3>
        <button onClick={openAddModal} className={styles.addButton}>
          <FontAwesomeIcon icon={faPlus} /> Add Fixture
        </button>
      </div>
      {fixtures.length === 0 ? (
        <p className={styles.emptyMessage}>No fixtures defined yet. Click "Add Fixture" to get started.</p>
      ) : (
        <div className={styles.list}>
          {fixtures.map(fixture => (
            <FixtureListItem key={fixture.id} fixture={fixture} onEdit={openEditModal} />
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingFixture ? 'Edit Fixture' : 'Add New Fixture'}>
        <form className={styles.fixtureForm} onSubmit={(e) => { e.preventDefault(); handleSubmitFixture(); }}>
          <div className={styles.formGroup}>
            <label htmlFor="fixtureName">Name:</label>
            <input type="text" id="fixtureName" name="name" value={fixtureForm.name || ''} onChange={handleFormChange} required />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="startAddress">Start Address (1-512):</label>
            <input type="number" id="startAddress" name="startAddress" min="1" max="512" value={fixtureForm.startAddress || 1} onChange={handleFormChange} required />
          </div>

          <h4>Channels:</h4>
          {fixtureForm.channels?.map((channel, index) => (
            <div key={index} className={styles.channelDefinition}>
              <input
                type="text"
                placeholder="Ch Name (e.g., Red)"
                value={channel.name}
                onChange={(e) => handleChannelDefinitionChange(index, 'name', e.target.value)}
                className={styles.channelNameInput}
              />
              <select
                value={channel.type}
                onChange={(e) => handleChannelDefinitionChange(index, 'type', e.target.value)}
                className={styles.channelTypeSelect}
              >
                {commonChannelTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <button type="button" onClick={() => removeChannelFromForm(index)} className={styles.removeChannelButton}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addChannelToForm} className={styles.addChannelButton}>
            <FontAwesomeIcon icon={faPlus} /> Add Channel
          </button>

          <div className={styles.modalActions}>
            <button type="submit" className={styles.saveButton}>
              <FontAwesomeIcon icon={faSave} /> {editingFixture ? 'Save Changes' : 'Add Fixture'}
            </button>
            <button type="button" onClick={() => setIsModalOpen(false)} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FixtureList;
