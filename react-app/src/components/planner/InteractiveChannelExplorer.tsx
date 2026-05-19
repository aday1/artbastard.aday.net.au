import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import styles from './InteractiveChannelExplorer.module.scss';

interface InteractiveChannelExplorerProps {
  fixtureId: string;
  channelCount: number;
  onSave: (fixtureProfile: any) => void;
}

const COMMON_FUNCTIONS = [
  'dimmer', 'red', 'green', 'blue', 'white', 'amber', 'uv', 
  'pan', 'pan_fine', 'tilt', 'tilt_fine', 
  'strobe', 'shutter', 'zoom', 'focus', 
  'gobo_wheel', 'gobo_rotation', 'color_wheel', 'prism',
  'macro', 'reset', 'speed', 'other'
];

export const InteractiveChannelExplorer: React.FC<InteractiveChannelExplorerProps> = ({ fixtureId, channelCount, onSave }) => {
  const { setDmxChannelValue, getDmxChannelValue } = useStore();
  const [channelValues, setChannelValues] = useState<number[]>(Array(channelCount).fill(0));
  const [channelFunctions, setChannelFunctions] = useState<string[]>(Array(channelCount).fill('other'));

  const fixture = useStore(state => state.fixtures.find(f => f.id === fixtureId));
  const startAddress = fixture?.startAddress || 1;

  useEffect(() => {
    // Reset all channels for this fixture to 0 when component mounts
    for (let i = 0; i < channelCount; i++) {
      setDmxChannelValue(startAddress + i, 0);
    }
    return () => {
      // Optional: Reset channels when component unmounts
      for (let i = 0; i < channelCount; i++) {
        setDmxChannelValue(startAddress + i, 0);
      }
    };
  }, [fixtureId, channelCount, startAddress, setDmxChannelValue]);

  const handleSliderChange = (index: number, value: number) => {
    const newValues = [...channelValues];
    newValues[index] = value;
    setChannelValues(newValues);
    setDmxChannelValue(startAddress + index, value);
  };

  const handleFunctionChange = (index: number, func: string) => {
    const newFunctions = [...channelFunctions];
    newFunctions[index] = func;
    setChannelFunctions(newFunctions);
  };

  const handleSave = () => {
    const fixtureProfile = {
      id: fixtureId,
      name: fixture?.name || 'New Fixture',
      channels: channelFunctions.map((func, i) => ({
        type: func,
        dmxAddress: startAddress + i,
        name: `${func.charAt(0).toUpperCase() + func.slice(1)} ${i + 1}`
      }))
    };
    onSave(fixtureProfile);
  };

  return (
    <div className={styles.explorer}>
      <h4>Interactive Channel Explorer</h4>
      <p>Move the sliders to see what each channel does. Then, assign a function to each channel.</p>
      
      {Array.from({ length: channelCount }).map((_, i) => (
        <div key={i} className={styles.channelRow}>
          <div className={styles.channelLabel}>Channel {i + 1}</div>
          <input
            type="range"
            min="0"
            max="255"
            value={channelValues[i]}
            onChange={(e) => handleSliderChange(i, parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.valueDisplay}>{channelValues[i]}</div>
          <select 
            value={channelFunctions[i]} 
            onChange={(e) => handleFunctionChange(i, e.target.value)}
            className={styles.functionSelect}
          >
            {COMMON_FUNCTIONS.map(func => (
              <option key={func} value={func}>{func}</option>
            ))}
          </select>
        </div>
      ))}

      <button onClick={handleSave} className={styles.saveButton}>Save Fixture Profile</button>
    </div>
  );
};
