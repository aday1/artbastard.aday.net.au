import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';

/**
 * A debug component to help diagnose MIDI to DMX communication issues
 */
const MidiDmxDebug: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [lastEvent, setLastEvent] = useState<{channel?: number, value?: number} | null>(null);
  const [testChannel, setTestChannel] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  const midiMappings = useStore((state) => state.midiMappings);
  const midiMessages = useStore((state) => state.midiMessages);
  const dmxChannels = useStore((state) => state.dmxChannels);
  const addMidiMessage = useStore((state) => state.addMidiMessage);

  const addLog = (message: string) => {
    setLogs(prev => [message, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  // Monitor DMX channel updates
  useEffect(() => {
    if (!isActive) return;
    
    const handleDmxChannelUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{channel: number, value: number}>;
      setLastEvent(customEvent.detail);
      addLog(`[${new Date().toLocaleTimeString()}] DMX Update CH ${customEvent.detail.channel}: ${customEvent.detail.value}`);
    };
    
    window.addEventListener('dmxChannelUpdate', handleDmxChannelUpdate);
    addLog('[Debug] Started monitoring dmxChannelUpdate events');
    
    return () => {
      window.removeEventListener('dmxChannelUpdate', handleDmxChannelUpdate);
    };
  }, [isActive]);
  
  // Monitor MIDI messages
  useEffect(() => {
    if (!isActive || midiMessages.length === 0) return;
    
    const latestMessage = midiMessages[midiMessages.length - 1] as any;
    const msgType = latestMessage.type || latestMessage._type;
    addLog(
      `[${new Date().toLocaleTimeString()}] MIDI ${msgType} CH ${latestMessage.channel} ${
        latestMessage.controller !== undefined ? `CC ${latestMessage.controller}` : `Note ${latestMessage.note}`
      } Value ${latestMessage.value || latestMessage.velocity}`
    );
  }, [isActive, midiMessages]);

  // Send a test MIDI message
  const sendTestMessage = () => {
    // Find mapping for this channel
    const mapping = midiMappings[testChannel];
    
    if (!mapping) {
      addLog(`[ERROR] No MIDI mapping found for DMX channel ${testChannel}`);
      return;
    }
    
    if (mapping.controller !== undefined) {
      // Send a CC message
      const testValue = 64; // Middle value
      const message = {
        type: 'cc',
        _type: 'cc',
        channel: mapping.channel,
        controller: mapping.controller,
        value: testValue,
        source: 'Debug Tool'
      };
      
      addLog(`Sending test CC message for DMX ${testChannel}: CH ${mapping.channel} CC ${mapping.controller} Value ${testValue}`);
      addMidiMessage(message);
    } else if (mapping.note !== undefined) {
      // Send a note message
      const testVelocity = 64; // Middle value
      const message = {
        type: 'noteon',
        _type: 'noteon',
        channel: mapping.channel,
        note: mapping.note,
        velocity: testVelocity,
        source: 'Debug Tool'
      };
      
      addLog(`Sending test Note message for DMX ${testChannel}: CH ${mapping.channel} Note ${mapping.note} Vel ${testVelocity}`);
      addMidiMessage(message);
    }
  };
  
  // Send a sequence of values
  const sendSequence = () => {
    const mapping = midiMappings[testChannel];
    
    if (!mapping) {
      addLog(`[ERROR] No MIDI mapping found for DMX channel ${testChannel}`);
      return;
    }
    
    addLog(`Starting value sequence for DMX channel ${testChannel}`);
    
    let step = 0;
    const totalSteps = 10;
    const interval = setInterval(() => {
      if (step > totalSteps) {
        clearInterval(interval);
        addLog('Sequence complete');
        return;
      }
      
      const value = Math.floor((step / totalSteps) * 127);
      
      if (mapping.controller !== undefined) {
        // Send a CC message
        addMidiMessage({
          type: 'cc',
          _type: 'cc',
          channel: mapping.channel,
          controller: mapping.controller,
          value,
          source: 'Debug Sequence'
        });
      } else if (mapping.note !== undefined) {
        // Send a note message
        addMidiMessage({
          type: 'noteon',
          _type: 'noteon',
          channel: mapping.channel,
          note: mapping.note,
          velocity: value,
          source: 'Debug Sequence'
        });
      }
      
      step++;
    }, 200);
  };

  // Toggle debugger state
  const toggleActive = () => {
    setIsActive(!isActive);
    if (!isActive) {
      addLog('[Debug] Debugger activated');
    }
  };
    // Check that MidiDmxProcessor is properly initialized
  const checkMidiDmxProcessor = () => {
    if (!window.midiDmxProcessor) {
      addLog('[ERROR] midiDmxProcessor not found in window object');
      return;
    }
    
    addLog('[OK] midiDmxProcessor is available');
    
    // Check range mappings
    const mappings = window.midiDmxProcessor.getChannelRangeMappings();
    addLog(`Found ${Object.keys(mappings).length} range mappings`);
    
    // Check MIDI mappings
    addLog(`Found ${Object.keys(midiMappings).length} MIDI mappings`);
    Object.entries(midiMappings).forEach(([dmxChannel, mapping]) => {
      if (mapping) {
        addLog(`DMX ${dmxChannel} → ${mapping.controller !== undefined ? 
          `CC ${mapping.channel}:${mapping.controller}` : 
          `Note ${mapping.channel}:${mapping.note}`}`);
      }
    });
    
    // Check element selectors
    const slider = document.querySelector(`[data-dmx-channel="${testChannel}"]`);
    if (slider) {
      addLog(`[OK] Found slider element for channel ${testChannel}`);
    } else {
      addLog(`[ERROR] Can't find slider element for channel ${testChannel}`);
    }
    
    // Test custom event system
    window.addEventListener('debugEvent', (event: any) => {
      addLog(`[OK] Received test event: ${JSON.stringify(event.detail || {})}`);
    }, { once: true });
    
    window.dispatchEvent(new CustomEvent('debugEvent', { 
      detail: { test: 'event system' } 
    }));
  };

  // Test if the event system is working
  const testEventSystem = () => {
    addLog('Dispatching test DMX update event');
    
    window.dispatchEvent(new CustomEvent('dmxChannelUpdate', { 
      detail: { channel: testChannel, value: 127 }
    }));
  };
  
  if (!isActive) {    return (
      <div style={{
        position: 'fixed', 
        bottom: '10px', 
        right: '240px', // Moved to avoid navbar overlap
        zIndex: 1000 // Lower than navbar z-index (1001)
      }}>
        <button onClick={toggleActive} style={{padding: '5px 10px'}}>
          Debug MIDI-DMX
        </button>
      </div>
    );
  }
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '240px', // Moved to avoid navbar overlap
      width: '400px',
      height: '500px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff00',
      fontFamily: 'monospace',
      padding: '10px',
      borderRadius: '5px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000 // Lower than navbar z-index (1001)
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
        <h3 style={{margin: 0}}>MIDI-DMX Debugger</h3>
        <button onClick={toggleActive}>Close</button>
      </div>
      
      <div style={{marginBottom: '10px'}}>
        <div style={{display: 'flex', gap: '10px', marginBottom: '5px'}}>
          <label>
            DMX Channel:
            <input 
              type="number" 
              min="0" 
              max="511" 
              value={testChannel} 
              onChange={(e) => setTestChannel(parseInt(e.target.value, 10))} 
              style={{width: '50px', marginLeft: '5px'}} 
            />
          </label>
          
          <div>
            Value: {dmxChannels[testChannel] || 0}
            {lastEvent?.channel === testChannel && <span style={{color: 'yellow'}}> (Event: {lastEvent.value})</span>}
          </div>
        </div>
        
        <div style={{display: 'flex', gap: '5px'}}>
          <button onClick={sendTestMessage}>Send Test</button>
          <button onClick={sendSequence}>Run Sequence</button>
          <button onClick={checkMidiDmxProcessor}>Check Processor</button>
          <button onClick={testEventSystem}>Test Events</button>
        </div>
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '5px',
        fontSize: '12px'
      }}>
        {logs.map((log, index) => (
          <div key={index} style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '2px',
            marginBottom: '2px'
          }}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MidiDmxDebug;
