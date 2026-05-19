import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useSocket } from '../context/SocketContext';

export const useGlobalMidiManager = () => {
  const { socket, connected } = useSocket();
  const [midiInterfaces, setMidiInterfaces] = useState<string[]>([]);
  const [activeInterfaces, setActiveInterfaces] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
    setMidiInterfaces: setStoreMidiInterfaces,
    setActiveInterfaces: setStoreActiveInterfaces,
    addNotification,
  } = useStore(state => ({
    setMidiInterfaces: state.setMidiInterfaces,
    setActiveInterfaces: state.setActiveInterfaces,
    addNotification: state.addNotification,
  }));

  // Initialize MIDI interfaces when socket connects
  useEffect(() => {
    if (socket && connected && !isInitialized) {
      console.log('[GlobalMidiManager] Initializing MIDI interfaces');
      setIsInitialized(true);
      
      // Request MIDI interfaces
      socket.emit('getMidiInterfaces');
      
      // Listen for MIDI interface updates
      const handleMidiInterfaces = (interfaces: string[]) => {
        console.log('[GlobalMidiManager] Received MIDI interfaces:', interfaces);
        setMidiInterfaces(interfaces);
        setStoreMidiInterfaces(interfaces);
      };

      const handleActiveInterfaces = (interfaces: string[]) => {
        console.log('[GlobalMidiManager] Received active MIDI interfaces:', interfaces);
        setActiveInterfaces(interfaces);
        setStoreActiveInterfaces(interfaces);
      };

      socket.on('midiInterfaces', handleMidiInterfaces);
      socket.on('activeMidiInterfaces', handleActiveInterfaces);

      return () => {
        socket.off('midiInterfaces', handleMidiInterfaces);
        socket.off('activeMidiInterfaces', handleActiveInterfaces);
      };
    }
  }, [socket, connected, isInitialized, setStoreMidiInterfaces, setStoreActiveInterfaces]);

  // Connect to MIDI interface
  const connectMidiInterface = (interfaceName: string) => {
    if (socket && connected) {
      console.log('[GlobalMidiManager] Connecting to MIDI interface:', interfaceName);
      socket.emit('selectMidiInterface', interfaceName);
      
      addNotification({
        message: `Connecting to MIDI interface: ${interfaceName}`,
        type: 'info',
        priority: 'normal'
      });
    }
  };

  // Disconnect from MIDI interface
  const disconnectMidiInterface = (interfaceName: string) => {
    if (socket && connected) {
      console.log('[GlobalMidiManager] Disconnecting from MIDI interface:', interfaceName);
      socket.emit('disconnectMidiInterface', interfaceName);
      
      addNotification({
        message: `Disconnected from MIDI interface: ${interfaceName}`,
        type: 'info',
        priority: 'normal'
      });
    }
  };

  // Refresh MIDI interfaces
  const refreshMidiInterfaces = () => {
    if (socket && connected) {
      console.log('[GlobalMidiManager] Refreshing MIDI interfaces');
      socket.emit('getMidiInterfaces');
      
      addNotification({
        message: 'Refreshing MIDI interfaces...',
        type: 'info',
        priority: 'normal'
      });
    }
  };

  return {
    midiInterfaces,
    activeInterfaces,
    isInitialized,
    connectMidiInterface,
    disconnectMidiInterface,
    refreshMidiInterfaces,
  };
};
