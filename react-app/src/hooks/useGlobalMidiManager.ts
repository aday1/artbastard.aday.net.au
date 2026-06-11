import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useSocket } from '../context/SocketContext';
import { detectTemplateForMidiInterface, getTemplateById } from '../components/midi/midiControllerTemplates';
import { debugLog } from '../utils/debugLog';
import {
  DetectedMidiController,
  MIDI_CONNECT_SERVER_EVENT,
  describeDetectedMidiController,
  dispatchConnectedMidiController,
  dispatchDetectedMidiController,
} from '../midi/detectedMidiController';

export const useGlobalMidiManager = () => {
  const { socket, connected } = useSocket();
  const [midiInterfaces, setMidiInterfaces] = useState<string[]>([]);
  const [activeInterfaces, setActiveInterfaces] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
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

  const maybePromptController = (interfaceName: string) => {
    const controller = describeDetectedMidiController(interfaceName, 'server');
    if (!controller) return;
    dispatchDetectedMidiController(controller);
  };

  useEffect(() => {
    const handleConnectServer = (event: Event) => {
      const controller = (event as CustomEvent<DetectedMidiController>).detail;
      if (!socket || !connected || !controller || controller.transport !== 'server') return;
      debugLog.log('[GlobalMidiManager] Connecting detected MIDI controller:', controller.name);
      socket.emit('selectMidiInterface', controller.name);
      if (controller.templateId) void maybeAutoApplyTemplate(controller.name);
      dispatchConnectedMidiController(controller);
    };

    window.addEventListener(MIDI_CONNECT_SERVER_EVENT, handleConnectServer);
    return () => window.removeEventListener(MIDI_CONNECT_SERVER_EVENT, handleConnectServer);
  }, [socket, connected]);
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
        interfaces.forEach(maybePromptController);
      };

      const handleActiveInterfaces = (interfaces: string[]) => {
        debugLog.log('[GlobalMidiManager] Received active MIDI interfaces:', interfaces);
        setActiveInterfaces(interfaces);
        setStoreActiveInterfaces(interfaces);
        interfaces.forEach((interfaceName) => {
          const controller = describeDetectedMidiController(interfaceName, 'server');
          if (controller) dispatchConnectedMidiController(controller);
        });
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
