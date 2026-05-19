import React, { useState, useEffect } from 'react';
import styles from './ColorPickerPanel.module.scss';
import { ColorPicker } from './ColorPicker';
import { useStore, Fixture } from '../../store';

export const ColorPickerPanel: React.FC = () => {
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);
  const fixtures = useStore((state) => state.fixtures);
  
  // Find RGB and Pan/Tilt channels for the selected fixture
  const getFixtureChannels = (fixtureId: string) => {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) return { rgbChannels: {}, movementChannels: {} };
    
    const rgbChannels: {
      redChannel?: number;
      greenChannel?: number;
      blueChannel?: number;
    } = {};
    
    const movementChannels: {
      panChannel?: number;
      tiltChannel?: number;
    } = {};
    
    // Find the channel indices based on channel types
    fixture.channels.forEach((channel, index) => {
      const dmxAddress = fixture.startAddress + index;
      
      switch (channel.type) {
        case 'red':
          rgbChannels.redChannel = dmxAddress - 1; // 0-indexed
          break;
        case 'green':
          rgbChannels.greenChannel = dmxAddress - 1;
          break;
        case 'blue':
          rgbChannels.blueChannel = dmxAddress - 1;
          break;
        case 'pan':
          movementChannels.panChannel = dmxAddress - 1;
          break;
        case 'tilt':
          movementChannels.tiltChannel = dmxAddress - 1;
          break;
      }
    });
    
    return { rgbChannels, movementChannels };
  };
  
  // Check if a fixture has RGB or Pan/Tilt channels
  const hasColorOrMovementControls = (fixture: Fixture) => {
    const hasRGB = fixture.channels.some(ch => ['red', 'green', 'blue'].includes(ch.type));
    const hasMovement = fixture.channels.some(ch => ['pan', 'tilt'].includes(ch.type));
    return hasRGB || hasMovement;
  };
  
  // Filter fixtures that have RGB or movement controls
  const compatibleFixtures = fixtures.filter(hasColorOrMovementControls);
  
  // Auto-select the first fixture if none selected and compatible fixtures exist
  useEffect(() => {
    if (!selectedFixture && compatibleFixtures.length > 0) {
      setSelectedFixture(compatibleFixtures[0].id);
    }
  }, [selectedFixture, compatibleFixtures]);
  
  // Get the channels for the currently selected fixture
  const { rgbChannels, movementChannels } = selectedFixture ? 
    getFixtureChannels(selectedFixture) : 
    { rgbChannels: {}, movementChannels: {} };
  
  // Check if the selected fixture has any compatible channels
  const hasCompatibleChannels = Object.keys(rgbChannels).length > 0 || Object.keys(movementChannels).length > 0;
  
  const { theme } = useStore((state) => ({ theme: state.theme }));
  
  return (
    <div className={styles.colorPickerPanel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {theme === 'artsnob' && '🎨 Chromatic Energy Manipulator'}
          {theme === 'standard' && 'Color & Movement Control'}
          {theme === 'minimal' && 'Color & Movement'}
        </h3>
        
        <div className={styles.fixtureSelector}>
          <label>
            {theme === 'artsnob' && 'Select Illumination Vessel:'}
            {theme === 'standard' && 'Select Fixture:'}
            {theme === 'minimal' && 'Fixture:'}
          </label>
          <select 
            value={selectedFixture || ''} 
            onChange={(e) => setSelectedFixture(e.target.value)}
          >
            <option value="">-- Select a fixture --</option>
            {compatibleFixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {selectedFixture ? (
        hasCompatibleChannels ? (
          <ColorPicker
            fixtureId={selectedFixture}
            rgbChannels={rgbChannels}
            movementChannels={movementChannels}
          />
        ) : (
          <div className={styles.noCompatibleChannels}>
            This fixture does not have RGB or Pan/Tilt channels configured.
          </div>
        )
      ) : (
        <div className={styles.noFixtureSelected}>
          {compatibleFixtures.length > 0 ? (
            <p>Please select a fixture to control its colors and movement.</p>
          ) : (
            <div>
              <p>No compatible fixtures found.</p>
              <p className={styles.hint}>Create a fixture with RGB or Pan/Tilt channels first.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
