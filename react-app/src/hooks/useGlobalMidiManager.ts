import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useSocket } from '../context/SocketContext';
import { detectTemplateForMidiInterface, getTemplateById } from '../components/midi/midiControllerTemplates';
import { debugLog } from '../utils/debugLog';

export const useGlobalMidiManager = () => {
  const { socket, connected } = useSocket();
  const [midiInterfaces, setMidiInterfaces] = useState<string[]>([]);
  const [activeInterfaces, setActiveInterfaces] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const autoConnectedInterfacesRef = useRef<Set<string>>(new Set());
  const templateApplyInFlightRef = useRef<Set<string>>(new Set());
  
  const {
    setMidiInterfaces: setStoreMidiInterfaces,
    setActiveInterfaces: setStoreActiveInterfaces,
    addNotification,
    applyMidiControllerTemplate,
  } = useStore(state => ({
    setMidiInterfaces: state.setMidiInterfaces,
    setActiveInterfaces: state.setActiveInterfaces,
    addNotification: state.addNotification,
    applyMidiControllerTemplate: state.applyMidiControllerTemplate,
  }));

  const maybeAutoApplyTemplate = async (interfaceName: string) => {
    const templateId = detectTemplateForMidiInterface(interfaceName);
    if (!templateId) return;

    const state = useStore.getState();
    const template = getTemplateById(templateId);
    const expectedSuperControlMappings = template?.superControlMappings ?? [];
    const hasExistingTemplate = expectedSuperControlMappings.length > 0
      ? expectedSuperControlMappings.every((expected) =>
        state.superControlMidiMappings.some((actual) =>
          actual.controlName === expected.controlName &&
          actual.channel === expected.channel &&
          actual.controller === expected.controller &&
          actual.note === expected.note &&
          actual.slotIndex === expected.slotIndex,
        ),
      )
      : Object.keys(state.midiMappings).length > 0;
    if (hasExistingTemplate) return;

    const key = `${templateId}:${interfaceName}`;
    if (templateApplyInFlightRef.current.has(key)) return;
    templateApplyInFlightRef.current.add(key);
    try {
      await applyMidiControllerTemplate(templateId, interfaceName);
    } finally {
      templateApplyInFlightRef.current.delete(key);
    }
  };

  const maybeAutoConnectInterface = (interfaceName: string) => {
    if (!socket || !connected) return;
    if (!detectTemplateForMidiInterface(interfaceName)) return;
    if (autoConnectedInterfacesRef.current.has(interfaceName)) return;

    autoConnectedInterfacesRef.current.add(interfaceName);
    socket.emit('selectMidiInterface', interfaceName);
    void maybeAutoApplyTemplate(interfaceName);
  };

  useEffect(() => {
    if (!connected) {
      setIsInitialized(false);
      setActiveInterfaces([]);
      setStoreActiveInterfaces([]);
    }
  }, [connected, setStoreActiveInterfaces]);

  // Initialize MIDI interfaces when socket connects
  useEffect(() => {
    if (socket && connected && !isInitialized) {
      debugLog.log('[GlobalMidiManager] Initializing MIDI interfaces');
      setIsInitialized(true);
      
      // Request MIDI interfaces
      socket.emit('getMidiInterfaces');
      
      // Listen for MIDI interface updates
      const handleMidiInterfaces = (interfaces: string[]) => {
        debugLog.log('[GlobalMidiManager] Received MIDI interfaces:', interfaces);
        setMidiInterfaces(interfaces);
        setStoreMidiInterfaces(interfaces);
        autoConnectedInterfacesRef.current = new Set(
          [...autoConnectedInterfacesRef.current].filter((interfaceName) => interfaces.includes(interfaceName)),
        );
        interfaces.forEach(maybeAutoConnectInterface);
      };

      const handleActiveInterfaces = (interfaces: string[]) => {
        debugLog.log('[GlobalMidiManager] Received active MIDI interfaces:', interfaces);
        setActiveInterfaces(interfaces);
        setStoreActiveInterfaces(interfaces);
      };

      socket.on('midiInterfaces', handleMidiInterfaces);
      socket.on('activeMidiInterfaces', handleActiveInterfaces);
      socket.on('midiInputsActive', handleActiveInterfaces);

      return () => {
        socket.off('midiInterfaces', handleMidiInterfaces);
        socket.off('activeMidiInterfaces', handleActiveInterfaces);
        socket.off('midiInputsActive', handleActiveInterfaces);
      };
    }
  }, [socket, connected, isInitialized, setStoreMidiInterfaces, setStoreActiveInterfaces, applyMidiControllerTemplate]);

  // Connect to MIDI interface
  const connectMidiInterface = (interfaceName: string) => {
    if (socket && connected) {
      debugLog.log('[GlobalMidiManager] Connecting to MIDI interface:', interfaceName);
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
      debugLog.log('[GlobalMidiManager] Disconnecting from MIDI interface:', interfaceName);
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
      debugLog.log('[GlobalMidiManager] Refreshing MIDI interfaces');
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
