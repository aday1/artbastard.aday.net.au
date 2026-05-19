import React, { useState } from 'react';
import { useStore } from '../../store';
import styles from './MidiLearnButton.module.scss';

const MidiDebugger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);  const midiMessages = useStore(state => state.midiMessages);
  const midiMappings = useStore(state => state.midiMappings);
  const midiLearnTarget = useStore(state => state.midiLearnTarget);

  const toggleDebugger = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={styles.midiDebugger}>
      <button onClick={toggleDebugger} className={styles.debuggerButton}>
        {isOpen ? 'Hide MIDI Debug' : 'Show MIDI Debug'}
      </button>
      
      {isOpen && (
        <div className={styles.debuggerContent}>
          <h3>MIDI Debug Information</h3>
          
          <div className={styles.debugSection}>
            <h4>Current Learn Status</h4>
            <p>Learning Target: {midiLearnTarget !== null ? JSON.stringify(midiLearnTarget) : 'None'}</p>
          </div>
          
          <div className={styles.debugSection}>
            <h4>MIDI Mappings ({Object.keys(midiMappings).length})</h4>
            <ul>
              {Object.entries(midiMappings).map(([channel, mapping]) => (
                <li key={channel}>
                  Channel {channel}: {mapping.controller !== undefined 
                    ? `CC ${mapping.channel}:${mapping.controller}` 
                    : `Note ${mapping.channel}:${mapping.note}`}
                </li>
              ))}
            </ul>
          </div>
          
          <div className={styles.debugSection}>
            <h4>Recent MIDI Messages ({midiMessages.length})</h4>
            <div className={styles.messagesContainer}>
              {midiMessages.slice(-10).map((message, idx) => (
                <pre key={idx}>
                  {JSON.stringify(message, null, 2)}
                </pre>
              ))}
            </div>
          </div>        </div>
      )}
    </div>
  );
};

export default MidiDebugger;
