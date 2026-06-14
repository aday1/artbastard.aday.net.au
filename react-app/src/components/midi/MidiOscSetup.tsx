import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../../store'
import { useSocket } from '../../context/SocketContext'
import { useTheme } from '../../context/ThemeContext'
import { useGlobalBrowserMidi } from '../../hooks/useGlobalBrowserMidi'
import { MIDI_CONTROLLER_TEMPLATES, detectTemplateForMidiInterface, MidiControllerTemplateId } from './midiControllerTemplates'
import { Apc40Manual } from './Apc40Manual'
import { Apc40SurfaceDiagram } from './Apc40SurfaceDiagram'
import { Apc40Demoscene } from './Apc40Demoscene'
import { RoliDebugPanel } from '../settings/RoliDebugPanel'
import { groupMidiInterfaces, BUCKET_LABELS, BUCKET_ORDER, type MidiBucket, bucketFor } from '../../midi/midiInterfaceGrouping'
import { buildSmartControllers } from '../../midi/smartControllers'
import { isRoliblockLike } from '../../engines/roliLightpad'
import styles from './MidiOscSetup.module.scss'
import { debugLog } from '../../utils/debugLog';

const readStoredBool = (key: string, fallback: boolean): boolean => {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  return raw === '1';
};

const writeStoredBool = (key: string, value: boolean): void => {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* ignore quota */ }
};

export const MidiOscSetup: React.FC = () => {
  const { theme } = useTheme()
  const { socket, connected } = useSocket()
  const {
    isSupported: browserMidiSupported,
    error: browserMidiError,
    browserInputs,
    activeBrowserInputs,
    connectBrowserInput,
    disconnectBrowserInput,
    releaseBrowserInput,
    refreshDevices
  } = useGlobalBrowserMidi()

  const [oscConfig, setOscConfig] = useState({
    host: '127.0.0.1',
    port: 8000,
    sendEnabled: true,
    sendHost: '127.0.0.1',
    sendPort: 57120
  })
  // Add OSC status state
  const [oscReceiveStatus, setOscReceiveStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')
  const [oscSendStatus, setOscSendStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [connectingInterfaces, setConnectingInterfaces] = useState<Set<string>>(new Set())
  const [applyingTemplateId, setApplyingTemplateId] = useState<MidiControllerTemplateId | null>(null)
  const [serverMidiExpanded, setServerMidiExpanded] = useState(() => readStoredBool('midi-osc-server-expanded', true))
  const [browserMidiExpanded, setBrowserMidiExpanded] = useState(() => readStoredBool('midi-osc-browser-expanded', true))
  const [apc40ManualExpanded, setApc40ManualExpanded] = useState(false)
  const [oscExpanded, setOscExpanded] = useState(() => readStoredBool('midi-osc-osc-expanded', false))
  const [bucketOpen, setBucketOpen] = useState<Record<MidiBucket, boolean>>(() => ({
    hardware: readStoredBool('midi-osc-bucket-hardware', true),
    virtual: readStoredBool('midi-osc-bucket-virtual', false),
    network: readStoredBool('midi-osc-bucket-network', false),
    other: readStoredBool('midi-osc-bucket-other', false),
  }))
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => writeStoredBool('midi-osc-server-expanded', serverMidiExpanded), [serverMidiExpanded])
  useEffect(() => writeStoredBool('midi-osc-browser-expanded', browserMidiExpanded), [browserMidiExpanded])
  useEffect(() => writeStoredBool('midi-osc-osc-expanded', oscExpanded), [oscExpanded])

  const toggleBucket = (b: MidiBucket) => {
    setBucketOpen((prev) => {
      const next = { ...prev, [b]: !prev[b] };
      writeStoredBool(`midi-osc-bucket-${b}`, next[b])
      return next
    })
  }
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const {
    midiMessages,
    clearAllMidiMappings,
    midiMappings,
    oscAssignments,
    superControlOscAddresses,
    removeMidiMapping,
    setOscAssignment,
    setSuperControlOscAddress,
    applyMidiControllerTemplate
  } = useStore(state => ({
    midiMessages: state.midiMessages,
    clearAllMidiMappings: state.clearAllMidiMappings,
    midiMappings: state.midiMappings,
    oscAssignments: state.oscAssignments,
    superControlOscAddresses: state.superControlOscAddresses,
    removeMidiMapping: state.removeMidiMapping,
    setOscAssignment: state.setOscAssignment,
    setSuperControlOscAddress: state.setSuperControlOscAddress,
    applyMidiControllerTemplate: state.applyMidiControllerTemplate
  }))

  // Get MIDI interfaces and active interfaces from global state
  const midiInterfaces = useStore(state => state.midiInterfaces)
  const activeInterfaces = useStore(state => state.activeInterfaces)
  const setMidiInterfaces = useStore(state => state.setMidiInterfaces)
  const setActiveInterfaces = useStore(state => state.setActiveInterfaces)
  const {
    midiClockInputs,
    selectedMidiClockInputName,
    lastMidiClockInputName,
    lastMidiClockInputAt,
    midiClockInputStatus,
    selectedMidiClockHostId,
    midiClockBpm,
    midiClockIsPlaying,
    requestMidiClockInputList,
    requestSetMidiClockInput,
    requestMasterClockSourceChange,
  } = useStore(state => ({
    midiClockInputs: state.midiClockInputs,
    selectedMidiClockInputName: state.selectedMidiClockInputName,
    lastMidiClockInputName: state.lastMidiClockInputName,
    lastMidiClockInputAt: state.lastMidiClockInputAt,
    midiClockInputStatus: state.midiClockInputStatus,
    selectedMidiClockHostId: state.selectedMidiClockHostId,
    midiClockBpm: state.midiClockBpm,
    midiClockIsPlaying: state.midiClockIsPlaying,
    requestMidiClockInputList: state.requestMidiClockInputList,
    requestSetMidiClockInput: state.requestSetMidiClockInput,
    requestMasterClockSourceChange: state.requestMasterClockSourceChange,
  }))
  const { connectMidiInterface, disconnectMidiInterface, refreshMidiInterfaces } = useStore(state => ({
    connectMidiInterface: (name: string) => {
      if (socket && connected) {
        socket.emit('selectMidiInterface', name)
      }
    },
    disconnectMidiInterface: (name: string) => {
      if (socket && connected) {
        socket.emit('disconnectMidiInterface', name)
      }
    },
    refreshMidiInterfaces: () => {
      if (socket && connected) {
        socket.emit('getMidiInterfaces')
      }
    }
  }))

  // Listen for server MIDI interface updates
  useEffect(() => {
    if (socket && connected) {
      const handleMidiInterfaces = (interfaces: string[]) => {
        debugLog.log('[MidiOscSetup] Received MIDI interfaces from server:', interfaces)
        setMidiInterfaces(interfaces)
      }

      const handleActiveMidiInterfaces = (interfaces: string[]) => {
        debugLog.log('[MidiOscSetup] Received active MIDI interfaces:', interfaces)
        setActiveInterfaces(interfaces)
        // Clear connecting state for any interfaces that are now active
        setConnectingInterfaces(prev => {
          const next = new Set(prev)
          interfaces.forEach(iface => next.delete(iface))
          return next
        })
      }

      const handleMidiInterfaceError = (errorMessage: string) => {
        console.error('[MidiOscSetup] MIDI interface error:', errorMessage)
        useStore.getState().addNotification({
          message: `MIDI Connection Error: ${errorMessage}`,
          type: 'error',
          priority: 'high'
        })
        // Clear connecting state on error
        setConnectingInterfaces(new Set())
      }

      const handleMidiInterfaceSelected = (interfaceName: string) => {
        debugLog.log('[MidiOscSetup] MIDI interface selected:', interfaceName)
        useStore.getState().addNotification({
          message: `Connected to MIDI device: ${interfaceName}`,
          type: 'success',
          priority: 'normal'
        })
        // Clear connecting state for this interface
        setConnectingInterfaces(prev => {
          const next = new Set(prev)
          next.delete(interfaceName)
          return next
        })
      }

      socket.on('midiInterfaces', handleMidiInterfaces)
      socket.on('midiInputsActive', handleActiveMidiInterfaces) // Server emits 'midiInputsActive'
      socket.on('midiInterfaceError', handleMidiInterfaceError) // Listen for errors
      socket.on('midiInterfaceSelected', handleMidiInterfaceSelected) // Listen for success

      // Request MIDI interfaces on mount
      socket.emit('getMidiInterfaces')

      return () => {
        socket.off('midiInterfaces', handleMidiInterfaces)
        socket.off('midiInputsActive', handleActiveMidiInterfaces)
        socket.off('midiInterfaceError', handleMidiInterfaceError)
        socket.off('midiInterfaceSelected', handleMidiInterfaceSelected)
      }
    }
  }, [socket, connected, setMidiInterfaces, setActiveInterfaces])

  useEffect(() => {
    if (!connected) return;
    requestMidiClockInputList();
  }, [connected, requestMidiClockInputList])

  // Listen for OSC status updates
  useEffect(() => {
    if (socket && connected) {
      // Listen for OSC status updates
      const handleOscStatus = (status: { status: string, receivePort?: number, message?: string }) => {
        if (status.status === 'connected') {
          setOscReceiveStatus('connected')
        } else if (status.status === 'error') {
          setOscReceiveStatus('error')
        } else {
          setOscReceiveStatus('disconnected')
        }
      }

      const handleOscSendStatus = (status: { status: string, sendHost?: string, sendPort?: number, message?: string }) => {
        if (status.status === 'connected') {
          setOscSendStatus('connected')
        } else if (status.status === 'error') {
          setOscSendStatus('error')
        } else {
          setOscSendStatus('disconnected')
        }
      }

      socket.on('oscStatus', handleOscStatus)
      socket.on('oscSendStatus', handleOscSendStatus)

      return () => {
        socket.off('oscStatus', handleOscStatus)
        socket.off('oscSendStatus', handleOscSendStatus)
      }
    }
  }, [socket, connected])

  useEffect(() => {
    if (!socket || !connected) return;

    const handleTemplateApplied = (payload: any) => {
      if (payload?.midiMappings && typeof payload.midiMappings === 'object') {
        useStore.setState({ midiMappings: payload.midiMappings });
      }
      useStore.getState().addNotification({
        message: `MIDI template applied: ${payload?.templateId || 'unknown'}`,
        type: 'info',
        priority: 'normal'
      });
    };

    const handleMidiMappingUpdate = (mappings: any) => {
      if (mappings && typeof mappings === 'object') {
        useStore.setState({ midiMappings: mappings });
      }
    };

    socket.on('midiControllerTemplateApplied', handleTemplateApplied);
    socket.on('midiMappingUpdate', handleMidiMappingUpdate);

    return () => {
      socket.off('midiControllerTemplateApplied', handleTemplateApplied);
      socket.off('midiMappingUpdate', handleMidiMappingUpdate);
    };
  }, [socket, connected]);

  // Refresh all MIDI interfaces
  const handleRefreshMidi = () => {
    setIsRefreshing(true)
    refreshMidiInterfaces()

    // Also refresh browser MIDI devices
    if (browserMidiSupported) {
      refreshDevices()
    }

    // Reset refreshing state after a short delay
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Connect to server MIDI interface
  const handleConnectMidi = (interfaceName: string) => {
    if (!socket || !connected) {
      useStore.getState().addNotification({
        message: 'Cannot connect: Socket not connected to server',
        type: 'error',
        priority: 'high'
      })
      return
    }
    
    // Set connecting state
    setConnectingInterfaces(prev => new Set(prev).add(interfaceName))
    
    // Emit connection request
    connectMidiInterface(interfaceName)
    
    // Clear connecting state after timeout if no response (5 seconds)
    setTimeout(() => {
      setConnectingInterfaces(prev => {
        const next = new Set(prev)
        if (next.has(interfaceName) && !activeInterfaces.includes(interfaceName)) {
          // Still connecting and not active - might be an issue
          next.delete(interfaceName)
          return next
        }
        return next
      })
    }, 5000)
  }

  // Disconnect from server MIDI interface
  const handleDisconnectMidi = (interfaceName: string) => {
    disconnectMidiInterface(interfaceName)
  }
  // Save OSC configuration
  const handleSaveOscConfig = () => {
    if (socket && connected) {
      socket.emit('saveOscConfig', oscConfig)
      useStore.getState().addNotification({
        message: 'OSC configuration saved',
        type: 'success',
        priority: 'normal'
      })
    }
  }

  // Clear all MIDI messages
  const handleClearMidiMessages = () => {
    useStore.setState({ midiMessages: [] })
  }

  // Forget all MIDI mappings with confirmation
  const handleForgetAllMappings = () => {
    if (window.confirm('Are you sure you want to forget all MIDI mappings? This cannot be undone.')) {
      clearAllMidiMappings()
    }
  }

  const getPreferredTemplateDevice = (templateId: MidiControllerTemplateId): string | undefined => {
    const detectedServer = activeInterfaces.find((interfaceName) => detectTemplateForMidiInterface(interfaceName) === templateId)
    if (detectedServer) return detectedServer
    const detectedBrowser = browserInputs.find((input) => detectTemplateForMidiInterface(input.name || '') === templateId)
    return detectedBrowser?.name || undefined
  }

  const handleApplyControllerTemplate = async (templateId: MidiControllerTemplateId) => {
    setApplyingTemplateId(templateId)
    try {
      const preferredDevice = getPreferredTemplateDevice(templateId)
      await applyMidiControllerTemplate(templateId, preferredDevice)
    } finally {
      setApplyingTemplateId(null)
    }
  }

  const groupedServerMidi = useMemo(() => groupMidiInterfaces(midiInterfaces), [midiInterfaces])
  const groupedBrowserMidi = useMemo(() => {
    // ROLI Lightpads are owned by the roliLightpad engine — hide them from the
    // generic Browser MIDI list so the user doesn't try to Connect them here
    // (which would steal the engine's onmidimessage handler).
    const nonRoli = browserInputs.filter((i) => !isRoliblockLike(i.name || ''))
    const names = nonRoli.map((i) => i.name || '(unnamed)')
    const groups = groupMidiInterfaces(names)
    const byName = new Map<string, WebMidi.MIDIInput[]>()
    for (const input of nonRoli) {
      const name = input.name || '(unnamed)'
      const arr = byName.get(name) || []
      arr.push(input)
      byName.set(name, arr)
    }
    return { groups, byName }
  }, [browserInputs])
  const hasRoliBlock = useMemo(
    () => browserInputs.some((i) => isRoliblockLike(i.name || '')),
    [browserInputs],
  )
  const smartControllers = useMemo(
    () => buildSmartControllers(midiInterfaces, activeInterfaces, browserInputs, activeBrowserInputs),
    [midiInterfaces, activeInterfaces, browserInputs, activeBrowserInputs],
  )
  const totalConnected = activeInterfaces.length + activeBrowserInputs.length
  const isExternalMidiClockSelected = selectedMidiClockHostId === 'midi-input'
  const activeClockInputName = lastMidiClockInputName || selectedMidiClockInputName
  const lastClockSeenLabel = lastMidiClockInputAt
    ? new Date(lastMidiClockInputAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'No clock seen'
  const midiClockStatusLabel =
    midiClockInputStatus === 'receiving'
      ? 'Receiving clock'
      : midiClockInputStatus === 'listening'
        ? 'Listening'
        : midiClockInputStatus === 'selected'
          ? 'Selected'
          : 'No input selected'
  const selectMidiClockInput = (inputName: string) => {
    if (!inputName) return
    requestSetMidiClockInput(inputName)
  }

  return (
    <div className={styles.midiOscSetup}>
      <div
        className={styles.connectedDevicesSummary}
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <h2 className={styles.sectionTitle} style={{ margin: 0, fontSize: '1.1rem' }}>
          {theme === 'artsnob' ? 'MIDI/OSC Atelier' : 'MIDI / OSC'}
        </h2>
        <span style={{ fontSize: '0.85rem' }}>
          Server <b>{activeInterfaces.length}</b>/<b>{midiInterfaces.length}</b> ·
          Browser <b>{activeBrowserInputs.length}</b>/<b>{browserInputs.length}</b> ·
          <b> {totalConnected}</b> connected
        </span>
      </div>

      {smartControllers.length > 0 && (
        <div className={styles.card} style={{ marginBottom: '0.75rem' }}>
          <div className={styles.cardHeaderToggle} style={{ cursor: 'default' }}>
            <h3 title="Physical hardware controllers detected across Server MIDI and Browser MIDI">
              <i className="fas fa-bolt" style={{ marginRight: 6, color: 'rgba(34,197,94,0.9)' }} />
              Smart Controllers
            </h3>
            <span className={styles.cardHeaderMeta}>
              {smartControllers.length} physical device{smartControllers.length === 1 ? '' : 's'} detected
            </span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDescription} style={{ fontSize: '0.78rem', margin: '0 0 0.5rem' }}>
              One row per physical box. On Windows, pick ONE transport per device — the OS won't let Server and Browser MIDI hold the same port at once. Use <b>Release</b> on a browser row to hand a device back to Server MIDI.
            </p>
            {hasRoliBlock && (
              <p
                style={{
                  fontSize: '0.72rem',
                  margin: '0 0 0.5rem',
                  padding: '0.4rem 0.55rem',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 4,
                  color: 'rgba(199,210,254,0.95)',
                }}
              >
                <b>ROLI Lightpad:</b> routed through the ROLI engine — use the <b>ROLI Debug</b> panel below to assign Primary (PAN/TILT) vs Colour (COLOR WHEEL) roles. Don't Connect them via the Browser MIDI list.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {smartControllers.map((ctrl) => {
                const isAnyConnected = ctrl.isConnectedServer || ctrl.isConnectedBrowser
                const transportLabel = ctrl.isConnectedServer && ctrl.isConnectedBrowser
                  ? 'Server + Browser'
                  : ctrl.isConnectedServer
                  ? 'Server'
                  : ctrl.isConnectedBrowser
                  ? 'Browser'
                  : '—'
                return (
                  <div
                    key={`${ctrl.tag}:${ctrl.serverPort || ''}:${ctrl.browserInput?.id || ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '0.5rem 0.65rem',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 4,
                      background: isAnyConnected ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.15)',
                    }}
                  >
                    <span
                      title={`Session tag for ${ctrl.baseName}`}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 3,
                        background: 'rgba(99,102,241,0.18)',
                        color: 'rgba(199,210,254,0.95)',
                        minWidth: 80,
                        textAlign: 'center',
                      }}
                    >
                      {ctrl.tag}
                    </span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ctrl.baseName}</span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>
                        {ctrl.serverPort && <>Server port: <code>{ctrl.serverPort}</code></>}
                        {ctrl.serverPort && ctrl.browserInput && ' · '}
                        {ctrl.browserInput && <>Browser id: <code>{ctrl.browserInput.id.slice(0, 8)}…</code></>}
                      </span>
                      {ctrl.transportHint !== 'both' && (
                        <span style={{ fontSize: '0.68rem', color: 'rgba(251,191,36,0.85)' }}>
                          {ctrl.transportHint === 'browser-only'
                            ? '⚠ Only visible on Browser — backend may not have enumerated this port. Restart server if you need Server access.'
                            : '⚠ Only visible on Server — Chrome may not have enumerated this port. Hard-refresh after granting MIDI/SysEx.'}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 999,
                        background: isAnyConnected ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.2)',
                        color: isAnyConnected ? 'rgba(187,247,208,0.95)' : 'rgba(148,163,184,0.9)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {transportLabel}
                    </span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {ctrl.serverPort && (
                        ctrl.isConnectedServer ? (
                          <button
                            className={`${styles.actionButton} ${styles.disconnectButton}`}
                            onClick={() => handleDisconnectMidi(ctrl.serverPort!)}
                            title={`Disconnect ${ctrl.serverPort} from backend`}
                          >
                            <i className="fas fa-unlink"></i>Server
                          </button>
                        ) : (
                          <button
                            className={`${styles.actionButton} ${styles.connectButton}`}
                            onClick={() => handleConnectMidi(ctrl.serverPort!)}
                            disabled={connectingInterfaces.has(ctrl.serverPort)}
                            title={ctrl.isConnectedBrowser
                              ? `${ctrl.serverPort} is held by Browser MIDI — click Release first`
                              : `Connect ${ctrl.serverPort} to backend (RtMidi)`}
                          >
                            <i className="fas fa-link"></i>Server
                          </button>
                        )
                      )}
                      {ctrl.browserInput && (
                        ctrl.isConnectedBrowser ? (
                          <>
                            <button
                              className={`${styles.actionButton} ${styles.disconnectButton}`}
                              onClick={() => disconnectBrowserInput(ctrl.browserInput!.id)}
                              title="Disconnect this device from Browser MIDI"
                            >
                              <i className="fas fa-unlink"></i>Browser
                            </button>
                            <button
                              className={styles.actionButton}
                              onClick={() => releaseBrowserInput(ctrl.browserInput!.id)}
                              title="Release the OS lock so Server MIDI can claim this device"
                              style={{ background: 'rgba(234,179,8,0.18)', borderColor: 'rgba(234,179,8,0.35)' }}
                            >
                              <i className="fas fa-eject"></i>Release
                            </button>
                          </>
                        ) : (
                          <button
                            className={`${styles.actionButton} ${styles.connectButton}`}
                            onClick={() => connectBrowserInput(ctrl.browserInput!.id)}
                            title={`Connect ${ctrl.browserInput.name} to Browser MIDI`}
                          >
                            <i className="fas fa-link"></i>Browser
                          </button>
                        )
                      )}
                      {ctrl.templateId && (
                        <button
                          className={styles.actionButton}
                          onClick={() => handleApplyControllerTemplate(ctrl.templateId!)}
                          disabled={applyingTemplateId === ctrl.templateId}
                          title="Apply the default mapping template for this controller"
                          style={{ background: 'rgba(99,102,241,0.18)', borderColor: 'rgba(99,102,241,0.35)' }}
                        >
                          {applyingTemplateId === ctrl.templateId ? (
                            <><i className="fas fa-spinner fa-spin"></i>Applying</>
                          ) : (
                            <><i className="fas fa-magic"></i>Map</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className={styles.setupGrid}>
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <div className={styles.cardHeader}>
            <h3 title="External MIDI clock input used by the master tempo clock">
              MIDI Clock Input
            </h3>
            <span className={styles.cardHeaderMeta}>
              {midiClockStatusLabel}
              {activeClockInputName ? ` · ${activeClockInputName}` : ''}
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.clockSourcePanel}>
              <div className={styles.clockSourceReadout}>
                <span className={`${styles.clockStatusPill} ${styles[midiClockInputStatus]}`}>
                  {midiClockStatusLabel}
                </span>
                <span>
                  Source: <b>{activeClockInputName || 'None'}</b>
                </span>
                <span>
                  Master: <b>{isExternalMidiClockSelected ? 'External MIDI' : 'Not using external MIDI'}</b>
                </span>
                <span>
                  BPM: <b>{Number.isFinite(midiClockBpm) ? midiClockBpm.toFixed(1) : '—'}</b>
                  {midiClockIsPlaying ? ' · running' : ' · stopped'}
                </span>
                <span>Last seen: <b>{lastClockSeenLabel}</b></span>
              </div>

              <div className={styles.clockSourceControls}>
                <label htmlFor="midi-clock-input-select">Read clock from</label>
                <select
                  id="midi-clock-input-select"
                  value={selectedMidiClockInputName || ''}
                  onChange={(event) => selectMidiClockInput(event.target.value)}
                  disabled={!connected || midiClockInputs.length === 0}
                  title="Choose the server MIDI input that should provide external MIDI clock"
                >
                  <option value="">
                    {midiClockInputs.length === 0 ? 'No server MIDI inputs found' : 'Select MIDI clock input'}
                  </option>
                  {midiClockInputs.map((inputName) => (
                    <option key={inputName} value={inputName}>
                      {inputName}
                    </option>
                  ))}
                </select>
                <button
                  className={styles.refreshButton}
                  onClick={() => {
                    handleRefreshMidi()
                    requestMidiClockInputList()
                  }}
                  disabled={isRefreshing}
                  title="Refresh server MIDI devices and clock-capable inputs"
                >
                  {isRefreshing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>}
                  Refresh
                </button>
                <button
                  className={`${styles.actionButton} ${styles.connectButton}`}
                  onClick={() => {
                    if (selectedMidiClockInputName) {
                      requestMasterClockSourceChange('midi-input')
                    }
                  }}
                  disabled={!connected || !selectedMidiClockInputName}
                  title="Switch the master clock to the selected external MIDI input"
                >
                  <i className="fas fa-clock"></i>
                  Use for Clock
                </button>
              </div>

              <p className={styles.cardDescription}>
                This is the dedicated MIDI clock reader. Pick the input that sends timing messages; it does not need to be connected as a controller above.
                Browser-only Web MIDI devices cannot drive the server clock until they also appear under Server MIDI.
              </p>
            </div>
          </div>
        </div>

        {/* Server MIDI Interface Card */}
        <div className={styles.card}>
          <button
            type="button"
            className={styles.cardHeaderToggle}
            onClick={() => setServerMidiExpanded((v) => !v)}
            aria-expanded={serverMidiExpanded}
          >
            <h3 title="MIDI interfaces visible to the backend server">
              Server MIDI
            </h3>
            <span className={styles.cardHeaderMeta}>
              {midiInterfaces.length} found, {activeInterfaces.length} connected
            </span>
            <i className={`fas fa-chevron-${serverMidiExpanded ? 'up' : 'down'}`} />
          </button>
          {serverMidiExpanded && (
          <div className={styles.cardBody}>
            <p className={styles.cardDescription} style={{ fontSize: '0.78rem', margin: '0 0 0.5rem' }}>
              Hardware controllers (APC40, ROLI, etc.) are pinned to the top. Virtual + network MIDI are collapsed; click to expand.
              On Windows, Server MIDI and Browser MIDI can't share the same device — disconnect one before the other.
            </p>
            <div className={styles.interfaceList}>
              {midiInterfaces.length === 0 ? (
                <div className={styles.emptyState}>
                  <i className="fas fa-music"></i>
                  <p>No server MIDI interfaces detected</p>
                  <button
                    className={styles.refreshButton}
                    onClick={handleRefreshMidi}
                    disabled={isRefreshing}
                    title="Scan for new MIDI devices connected to the server"
                  >
                    {isRefreshing ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fas fa-sync-alt"></i>
                    )}
                    Refresh
                  </button>
                </div>
              ) : (
                <>
                  {BUCKET_ORDER.map((bucket) => {
                    const groups = groupedServerMidi[bucket]
                    if (groups.length === 0) return null
                    const open = bucketOpen[bucket]
                    const totalPorts = groups.reduce((acc, g) => acc + g.ports.length, 0)
                    const activeInBucket = groups.reduce(
                      (acc, g) => acc + g.ports.filter((p) => activeInterfaces.includes(p)).length,
                      0,
                    )
                    return (
                      <div key={bucket} style={{ marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => toggleBucket(bucket)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.55rem',
                            background: bucket === 'hardware'
                              ? 'rgba(34, 197, 94, 0.12)'
                              : 'rgba(148, 163, 184, 0.08)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: 4,
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                          }}
                          aria-expanded={open}
                        >
                          <span>
                            {BUCKET_LABELS[bucket]} · {groups.length} group{groups.length === 1 ? '' : 's'} ({totalPorts} port{totalPorts === 1 ? '' : 's'})
                          </span>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '0.05rem 0.4rem',
                              borderRadius: 999,
                              background: activeInBucket > 0
                                ? 'rgba(34, 197, 94, 0.3)'
                                : 'rgba(148, 163, 184, 0.2)',
                            }}>
                              {activeInBucket} active
                            </span>
                            <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} />
                          </span>
                        </button>

                        {open && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                            {groups.map((group) => {
                              const groupKey = `${bucket}:${group.baseName}`
                              const expanded = expandedGroups.has(groupKey) || group.ports.length === 1
                              const groupActive = group.ports.some((p) => activeInterfaces.includes(p))
                              return (
                                <div
                                  key={groupKey}
                                  style={{
                                    border: '1px solid rgba(148, 163, 184, 0.15)',
                                    borderRadius: 4,
                                    background: 'rgba(0,0,0,0.15)',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 6,
                                      padding: '0.35rem 0.5rem',
                                      fontSize: '0.78rem',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => group.ports.length > 1 && toggleGroup(groupKey)}
                                      style={{
                                        flex: 1,
                                        textAlign: 'left',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'inherit',
                                        cursor: group.ports.length > 1 ? 'pointer' : 'default',
                                        padding: 0,
                                        fontSize: '0.78rem',
                                      }}
                                    >
                                      {group.ports.length > 1 && (
                                        <i className={`fas fa-chevron-${expanded ? 'down' : 'right'}`} style={{ marginRight: 6, fontSize: '0.65rem', opacity: 0.7 }} />
                                      )}
                                      <span style={{ fontWeight: 600 }}>{group.baseName}</span>
                                      {group.ports.length > 1 && (
                                        <span style={{
                                          marginLeft: 8,
                                          fontSize: '0.65rem',
                                          padding: '0.05rem 0.4rem',
                                          borderRadius: 999,
                                          background: 'rgba(148, 163, 184, 0.25)',
                                        }}>
                                          ×{group.ports.length}
                                        </span>
                                      )}
                                    </button>
                                    {group.ports.length === 1 && (() => {
                                      const interfaceName = group.ports[0]
                                      const isActive = activeInterfaces.includes(interfaceName)
                                      return (
                                        <div className={styles.interfaceActions}>
                                          {isActive ? (
                                            <button
                                              className={`${styles.actionButton} ${styles.disconnectButton}`}
                                              onClick={() => handleDisconnectMidi(interfaceName)}
                                              title={`Disconnect ${interfaceName}`}
                                            >
                                              <i className="fas fa-unlink"></i>
                                              {theme !== 'minimal' && 'Disconnect'}
                                            </button>
                                          ) : (
                                            <button
                                              className={`${styles.actionButton} ${styles.connectButton}`}
                                              onClick={() => handleConnectMidi(interfaceName)}
                                              disabled={connectingInterfaces.has(interfaceName)}
                                              title={`Connect ${interfaceName}`}
                                            >
                                              {connectingInterfaces.has(interfaceName) ? (
                                                <><i className="fas fa-spinner fa-spin"></i>{theme !== 'minimal' && 'Connecting...'}</>
                                              ) : (
                                                <><i className="fas fa-link"></i>{theme !== 'minimal' && 'Connect'}</>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    {group.ports.length > 1 && (
                                      <span style={{
                                        fontSize: '0.65rem',
                                        color: groupActive ? 'rgba(187,247,208,0.95)' : 'rgba(148,163,184,0.8)',
                                      }}>
                                        {group.ports.filter((p) => activeInterfaces.includes(p)).length} of {group.ports.length} active
                                      </span>
                                    )}
                                  </div>
                                  {expanded && group.ports.length > 1 && (
                                    <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                                      {group.ports.map((interfaceName) => {
                                        const isActive = activeInterfaces.includes(interfaceName)
                                        return (
                                          <div key={interfaceName} className={styles.interfaceItem} style={{ paddingLeft: '1.4rem' }}>
                                            <span className={styles.interfaceName}>{interfaceName}</span>
                                            <span className={`${styles.interfaceStatus} ${isActive ? styles.active : ''}`}>
                                              {isActive ? 'Connected' : 'Disconnected'}
                                            </span>
                                            <div className={styles.interfaceActions}>
                                              {isActive ? (
                                                <button
                                                  className={`${styles.actionButton} ${styles.disconnectButton}`}
                                                  onClick={() => handleDisconnectMidi(interfaceName)}
                                                  title={`Disconnect ${interfaceName}`}
                                                >
                                                  <i className="fas fa-unlink"></i>
                                                  {theme !== 'minimal' && 'Disconnect'}
                                                </button>
                                              ) : (
                                                <button
                                                  className={`${styles.actionButton} ${styles.connectButton}`}
                                                  onClick={() => handleConnectMidi(interfaceName)}
                                                  disabled={connectingInterfaces.has(interfaceName)}
                                                  title={`Connect ${interfaceName}`}
                                                >
                                                  {connectingInterfaces.has(interfaceName) ? (
                                                    <><i className="fas fa-spinner fa-spin"></i>{theme !== 'minimal' && 'Connecting...'}</>
                                                  ) : (
                                                    <><i className="fas fa-link"></i>{theme !== 'minimal' && 'Connect'}</>
                                                  )}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <button
                    className={styles.refreshButton}
                    onClick={handleRefreshMidi}
                    disabled={isRefreshing}
                    title="Scan for new MIDI devices connected to the server"
                  >
                    {isRefreshing ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fas fa-sync-alt"></i>
                    )}
                    Refresh
                  </button>
                </>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Browser MIDI Interface Card */}
        <div className={styles.card}>
          <button
            type="button"
            className={styles.cardHeaderToggle}
            onClick={() => setBrowserMidiExpanded((v) => !v)}
            aria-expanded={browserMidiExpanded}
          >
            <h3 title="MIDI devices visible to the browser via Web MIDI">
              Browser MIDI
            </h3>
            <span className={styles.cardHeaderMeta}>
              {browserInputs.length} found, {activeBrowserInputs.length} connected
            </span>
            <i className={`fas fa-chevron-${browserMidiExpanded ? 'up' : 'down'}`} />
          </button>
          {browserMidiExpanded && (
          <div className={styles.cardBody}>
            <p className={styles.cardDescription} style={{ fontSize: '0.78rem', margin: '0 0 0.5rem' }}>
              Web MIDI API — Chrome/Edge only. Hardware controllers (APC40, ROLI, etc.) are pinned to the top. Connections auto-restore across navigation.
            </p>
            <div className={styles.interfaceList}>
              {!browserMidiSupported ? (
                <div className={styles.emptyState}>
                  <i className="fas fa-exclamation-triangle"></i>
                  <p>Web MIDI API is not supported in this browser.</p>
                  <p className={styles.browserMidiError}>{browserMidiError || 'Try using Chrome or Edge instead.'}</p>
                </div>
              ) : browserInputs.length === 0 ? (
                <div className={styles.emptyState}>
                  <i className="fas fa-music"></i>
                  <p>No browser MIDI devices detected</p>
                  <button
                    className={styles.refreshButton}
                    onClick={refreshDevices}
                    disabled={isRefreshing}
                    title="Scan for MIDI devices accessible in your browser"
                  >
                    {isRefreshing ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fas fa-sync-alt"></i>
                    )}
                    Refresh
                  </button>
                </div>
              ) : (
                <>
                  {BUCKET_ORDER.map((bucket) => {
                    const groups = groupedBrowserMidi.groups[bucket]
                    if (groups.length === 0) return null
                    const open = bucketOpen[bucket]
                    const groupInputs = (g: typeof groups[number]): WebMidi.MIDIInput[] =>
                      g.ports.flatMap((portName) => groupedBrowserMidi.byName.get(portName) || [])
                    const totalPorts = groups.reduce((acc, g) => acc + groupInputs(g).length, 0)
                    const activeInBucket = groups.reduce(
                      (acc, g) => acc + groupInputs(g).filter((i) => activeBrowserInputs.includes(i.id)).length,
                      0,
                    )
                    return (
                      <div key={`browser-${bucket}`} style={{ marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => toggleBucket(bucket)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.55rem',
                            background: bucket === 'hardware'
                              ? 'rgba(34, 197, 94, 0.12)'
                              : 'rgba(148, 163, 184, 0.08)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: 4,
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                          }}
                          aria-expanded={open}
                        >
                          <span>
                            {BUCKET_LABELS[bucket]} · {groups.length} group{groups.length === 1 ? '' : 's'} ({totalPorts} port{totalPorts === 1 ? '' : 's'})
                          </span>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '0.05rem 0.4rem',
                              borderRadius: 999,
                              background: activeInBucket > 0
                                ? 'rgba(34, 197, 94, 0.3)'
                                : 'rgba(148, 163, 184, 0.2)',
                            }}>
                              {activeInBucket} active
                            </span>
                            <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} />
                          </span>
                        </button>

                        {open && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                            {groups.map((group) => {
                              const inputs = groupInputs(group)
                              const groupKey = `browser:${bucket}:${group.baseName}`
                              const expanded = expandedGroups.has(groupKey) || inputs.length === 1
                              return (
                                <div
                                  key={groupKey}
                                  style={{
                                    border: '1px solid rgba(148, 163, 184, 0.15)',
                                    borderRadius: 4,
                                    background: 'rgba(0,0,0,0.15)',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 6,
                                      padding: '0.35rem 0.5rem',
                                      fontSize: '0.78rem',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => inputs.length > 1 && toggleGroup(groupKey)}
                                      style={{
                                        flex: 1,
                                        textAlign: 'left',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'inherit',
                                        cursor: inputs.length > 1 ? 'pointer' : 'default',
                                        padding: 0,
                                        fontSize: '0.78rem',
                                      }}
                                    >
                                      {inputs.length > 1 && (
                                        <i className={`fas fa-chevron-${expanded ? 'down' : 'right'}`} style={{ marginRight: 6, fontSize: '0.65rem', opacity: 0.7 }} />
                                      )}
                                      <span style={{ fontWeight: 600 }}>{group.baseName}</span>
                                      {inputs.length > 1 && (
                                        <span style={{
                                          marginLeft: 8,
                                          fontSize: '0.65rem',
                                          padding: '0.05rem 0.4rem',
                                          borderRadius: 999,
                                          background: 'rgba(148, 163, 184, 0.25)',
                                        }}>
                                          ×{inputs.length}
                                        </span>
                                      )}
                                    </button>
                                    {inputs.length > 1 && (
                                      <span style={{
                                        fontSize: '0.65rem',
                                        color: inputs.some((i) => activeBrowserInputs.includes(i.id)) ? 'rgba(187,247,208,0.95)' : 'rgba(148,163,184,0.8)',
                                      }}>
                                        {inputs.filter((i) => activeBrowserInputs.includes(i.id)).length} of {inputs.length} active
                                      </span>
                                    )}
                                  </div>
                                  {expanded && inputs.map((input) => {
                                    const isActive = activeBrowserInputs.includes(input.id)
                                    const isHardware = bucketFor(input.name || '') === 'hardware'
                                    return (
                                      <div
                                        key={input.id}
                                        className={styles.interfaceItem}
                                        style={inputs.length > 1 ? { paddingLeft: '1.4rem', borderTop: '1px solid rgba(148,163,184,0.1)' } : undefined}
                                      >
                                        <span className={styles.interfaceName}>
                                          {input.name}
                                          <span className={styles.interfaceManufacturer}>{input.manufacturer}</span>
                                        </span>
                                        <span className={`${styles.interfaceStatus} ${isActive ? styles.active : ''}`}>
                                          {isActive ? 'Connected' : 'Disconnected'}
                                        </span>
                                        <div className={styles.interfaceActions}>
                                          {isActive ? (
                                            <button
                                              className={`${styles.actionButton} ${styles.disconnectButton}`}
                                              onClick={() => disconnectBrowserInput(input.id)}
                                              title={`Disconnect from ${input.name} - Browser MIDI data will stop flowing`}
                                            >
                                              <i className="fas fa-unlink"></i>
                                              {theme !== 'minimal' && 'Disconnect'}
                                            </button>
                                          ) : (
                                            <button
                                              className={`${styles.actionButton} ${styles.connectButton}`}
                                              onClick={() => connectBrowserInput(input.id)}
                                              title={`Connect to ${input.name} - Enable browser MIDI data flow`}
                                            >
                                              <i className="fas fa-link"></i>
                                              {theme !== 'minimal' && 'Connect'}
                                            </button>
                                          )}
                                          {isHardware && (
                                            <button
                                              className={styles.actionButton}
                                              onClick={() => releaseBrowserInput(input.id)}
                                              title="Release the Windows MIDI lock so the backend / other apps can use this device"
                                              style={{ background: 'rgba(234,179,8,0.18)', borderColor: 'rgba(234,179,8,0.35)' }}
                                            >
                                              <i className="fas fa-eject"></i>
                                              {theme !== 'minimal' && 'Release'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <button
                    className={styles.refreshButton}
                    onClick={refreshDevices}
                    disabled={isRefreshing}
                    title="Scan for MIDI devices accessible in your browser"
                  >
                    {isRefreshing ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fas fa-sync-alt"></i>
                    )}
                    Refresh
                  </button>
                </>
              )}
            </div>
          </div>
          )}
        </div>

        {/* OSC Configuration Card */}
        <div className={styles.card}>
          <button
            type="button"
            className={styles.cardHeaderToggle}
            onClick={() => setOscExpanded((v) => !v)}
            aria-expanded={oscExpanded}
          >
            <h3 title="Open Sound Control - network protocol for real-time control">
              OSC
            </h3>
            <span className={styles.cardHeaderMeta}>
              recv {oscConfig.host}:{oscConfig.port}{oscConfig.sendEnabled ? ` · send ${oscConfig.sendHost}:${oscConfig.sendPort}` : ' · send off'}
            </span>
            <i className={`fas fa-chevron-${oscExpanded ? 'up' : 'down'}`} />
          </button>
          {oscExpanded && (
          <div className={styles.cardBody}>
            <h4>OSC Receiving (Incoming Messages)</h4>
            <div className={styles.formGroup}>
              <label htmlFor="oscHost" title="IP address where OSC messages will be received. Use 127.0.0.1 for local connections or your network IP for remote devices">
                Receive Host Address:
              </label>
              <input
                type="text"
                id="oscHost"
                value={oscConfig.host}
                onChange={(e) => setOscConfig({ ...oscConfig, host: e.target.value })}
                placeholder="127.0.0.1"
                title="Enter the IP address for OSC communication. 127.0.0.1 for local apps, your LAN IP for network devices"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="oscPort" title="Network port number for receiving OSC messages. Common values: 8000 (default), 57121, 9000">
                Receive Port:
              </label>
              <input
                type="number"
                id="oscPort"
                value={oscConfig.port}
                onChange={(e) => setOscConfig({ ...oscConfig, port: parseInt(e.target.value) })}
                placeholder="8000"
                title="Network port for receiving OSC messages. Default: 8000"
              />
            </div>

            <h4>OSC Sending (Outgoing Messages)</h4>
            <div className={styles.formGroup}>
              <label htmlFor="oscSendEnabled" title="Enable sending OSC messages to OSC interfaces for bidirectional communication">
                <input
                  type="checkbox"
                  id="oscSendEnabled"
                  checked={oscConfig.sendEnabled}
                  onChange={(e) => setOscConfig({ ...oscConfig, sendEnabled: e.target.checked })}
                />
                Enable OSC Sending
              </label>
            </div>

            {oscConfig.sendEnabled && (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="oscSendHost" title="IP address where OSC messages will be sent. Use 127.0.0.1 for local OSC or the device IP for remote OSC">
                    Send Host Address:
                  </label>
                  <input
                    type="text"
                    id="oscSendHost"
                    value={oscConfig.sendHost}
                    onChange={(e) => setOscConfig({ ...oscConfig, sendHost: e.target.value })}
                    placeholder="127.0.0.1"
                    title="Enter the IP address where OSC messages will be sent (OSC device)"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="oscSendPort" title="Network port number for sending OSC messages">
                    Send Port:
                  </label>
                  <input
                    type="number"
                    id="oscSendPort"
                    value={oscConfig.sendPort}
                    onChange={(e) => setOscConfig({ ...oscConfig, sendPort: parseInt(e.target.value) })}
                    placeholder="57120"
                    title="Network port for sending OSC messages"
                  />
                </div>
              </>
            )}

            {/* OSC Status Indicators */}
            <div className={styles.oscStatus}>
              <div className={styles.oscStatusItem}>
                <span className={styles.oscStatusLabel}>Receive Status:</span>
                <span className={`${styles.oscStatusValue} ${styles[oscReceiveStatus]}`}>
                  {oscReceiveStatus.charAt(0).toUpperCase() + oscReceiveStatus.slice(1)}
                </span>
              </div>

              <div className={styles.oscStatusItem}>
                <span className={styles.oscStatusLabel}>Send Status:</span>
                <span className={`${styles.oscStatusValue} ${styles[oscSendStatus]}`}>
                  {oscSendStatus.charAt(0).toUpperCase() + oscSendStatus.slice(1)}
                </span>
              </div>
            </div>

            {/* OSC Connection Status */}
            <div className={styles.oscStatusSection}>
              <h4>OSC Connection Status</h4>
              <div className={styles.statusGrid}>
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>Receive Port:</span>
                  <span className={`${styles.statusIndicator} ${styles[oscReceiveStatus]}`}>
                    {oscReceiveStatus === 'connected' && <><i className="fas fa-check-circle"></i> Connected</>}
                    {oscReceiveStatus === 'disconnected' && <><i className="fas fa-times-circle"></i> Disconnected</>}
                    {oscReceiveStatus === 'error' && <><i className="fas fa-exclamation-triangle"></i> Error</>}
                  </span>
                </div>
                {oscConfig.sendEnabled && (
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Send Port:</span>
                    <span className={`${styles.statusIndicator} ${styles[oscSendStatus]}`}>
                      {oscSendStatus === 'connected' && <><i className="fas fa-check-circle"></i> Connected</>}
                      {oscSendStatus === 'disconnected' && <><i className="fas fa-times-circle"></i> Disconnected</>}
                      {oscSendStatus === 'error' && <><i className="fas fa-exclamation-triangle"></i> Error</>}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              className={styles.saveButton}
              onClick={handleSaveOscConfig}
              title="Save OSC configuration and restart the OSC server with new settings"
            >
              <i className="fas fa-save"></i>
              {theme === 'artsnob' && 'Commit to Memory'}
              {theme === 'standard' && 'Save Configuration'}
              {theme === 'minimal' && 'Save'}
            </button>

            {/* OSC Mappings Table */}
            <div className={styles.mappingsSection}>
              <h4>OSC Address Mappings</h4>
              {oscAssignments.filter(addr => addr && addr.trim() !== '').length === 0 && 
               Object.keys(superControlOscAddresses).length === 0 ? (
                <p className={styles.emptyMappings}>No OSC mappings configured yet. Assign OSC addresses to DMX channels or SuperControl parameters.</p>
              ) : (
                <>
                  {/* DMX Channel OSC Mappings */}
                  {oscAssignments.some(addr => addr && addr.trim() !== '') && (
                    <div className={styles.mappingsTable}>
                      <h5>DMX Channel OSC Mappings</h5>
                      <div className={styles.mappingsHeader}>
                        <span>DMX Channel</span>
                        <span>OSC Address</span>
                        <span>Actions</span>
                      </div>
                      {oscAssignments.map((address, index) => {
                        if (!address || address.trim() === '') return null;
                        return (
                          <div key={index} className={styles.mappingRow}>
                            <span className={styles.mappingTarget}>Channel {index + 1}</span>
                            <span className={styles.mappingValue}>{address}</span>
                            <button
                              className={styles.removeMappingButton}
                              onClick={() => setOscAssignment(index, '')}
                              title="Remove OSC mapping"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        );
                      }).filter(Boolean)}
                    </div>
                  )}

                  {/* SuperControl OSC Mappings */}
                  {Object.keys(superControlOscAddresses).length > 0 && (
                    <div className={styles.mappingsTable}>
                      <h5>SuperControl OSC Mappings</h5>
                      <div className={styles.mappingsHeader}>
                        <span>Control</span>
                        <span>OSC Address</span>
                        <span>Actions</span>
                      </div>
                      {Object.entries(superControlOscAddresses).map(([controlName, address]) => (
                        <div key={controlName} className={styles.mappingRow}>
                          <span className={styles.mappingTarget}>{controlName}</span>
                          <span className={styles.mappingValue}>{address}</span>
                          <button
                            className={styles.removeMappingButton}
                            onClick={() => setSuperControlOscAddress(controlName, '')}
                            title="Remove OSC mapping"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          )}
        </div>

        {/* MIDI Mappings Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 title="MIDI Learn system - create connections between MIDI controls and DMX channels">
              {theme === 'artsnob' && 'MIDI Mappings: The Digital Correspondences'}
              {theme === 'standard' && 'MIDI Mappings'}
              {theme === 'minimal' && 'Mappings'}
            </h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.controllerTemplatesSection}>
              <h4>Controller Templates</h4>
              <p className={styles.mappingInstructions}>
                Apply prebuilt mappings for supported controllers to get immediate DMX control.
              </p>
              <div className={styles.templateButtons}>
                {MIDI_CONTROLLER_TEMPLATES.map((template) => {
                  const preferredDevice = getPreferredTemplateDevice(template.id)
                  return (
                    <button
                      key={template.id}
                      className={`${styles.actionButton} ${styles.connectButton} ${styles.templateApplyButton}`}
                      onClick={() => handleApplyControllerTemplate(template.id)}
                      disabled={applyingTemplateId === template.id}
                      title={template.details}
                    >
                      <span className={styles.templateTitle}>{template.title}</span>
                      <span className={styles.templateDescription}>{template.description}</span>
                      <span className={styles.templateDetails}>{template.details}</span>
                      {preferredDevice && (
                        <span className={styles.templateDevice}>Detected Device: {preferredDevice}</span>
                      )}
                      {applyingTemplateId === template.id && (
                        <span className={styles.templateApplying}>Applying template...</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              className={styles.forgetAllButton}
              onClick={handleForgetAllMappings}
              title="Remove all MIDI mappings and reset the learn system. This cannot be undone!"
            >
              <i className="fas fa-trash-alt"></i>
              {theme === 'artsnob' && 'Dissolve All Correspondences'}
              {theme === 'standard' && 'Remove All Mappings'}
              {theme === 'minimal' && 'Clear All'}
            </button>

            <p className={styles.mappingInstructions}>
              {theme === 'artsnob' && 'To establish a digital correspondence, click "MIDI Learn" on any DMX channel and move a control on your MIDI device.'}
              {theme === 'standard' && 'Click "MIDI Learn" on any DMX channel and move a control on your MIDI device to create a mapping.'}
              {theme === 'minimal' && 'Use MIDI Learn on DMX channels to map controls.'}
            </p>
            <p className={styles.mappingHint}>
              💡 Tip: You can map knobs, faders, buttons, and even keyboard keys to control different lighting parameters.
            </p>

            {/* MIDI Mappings Table */}
            <div className={styles.mappingsSection}>
              <h4>All MIDI Controller Mappings</h4>
              {Object.keys(midiMappings).length === 0 ? (
                <p className={styles.emptyMappings}>No MIDI mappings configured yet. Use MIDI Learn on DMX channels or scenes to create mappings.</p>
              ) : (
                <div className={styles.mappingsTable}>
                  <div className={styles.mappingsHeader}>
                    <span>Target</span>
                    <span>Type</span>
                    <span>Channel</span>
                    <span>CC/Note</span>
                    <span>Actions</span>
                  </div>
                  {Object.entries(midiMappings).map(([target, mapping]: [string, any]) => {
                    const isDmxChannel = !isNaN(parseInt(target));
                    const channelIndex = isDmxChannel ? parseInt(target) : null;
                    const targetName = isDmxChannel 
                      ? `DMX Channel ${channelIndex! + 1}`
                      : target === 'scene' 
                        ? `Scene: ${mapping.sceneName || 'Unknown'}`
                        : target;
                    
                    return (
                      <div key={target} className={styles.mappingRow}>
                        <span className={styles.mappingTarget}>{targetName}</span>
                        <span className={styles.mappingType}>
                          {mapping.pitch ? 'Pitch' : mapping.controller !== undefined ? 'CC' : 'Note'}
                        </span>
                        <span className={styles.mappingChannel}>CH {mapping.channel + 1}</span>
                        <span className={styles.mappingValue}>
                          {mapping.pitch
                            ? 'Pitch Bend'
                            : mapping.controller !== undefined
                            ? `CC ${mapping.controller}` 
                            : `Note ${mapping.note}`}
                        </span>
                        <button
                          className={styles.removeMappingButton}
                          onClick={() => {
                            if (channelIndex !== null) {
                              removeMidiMapping(channelIndex);
                            } else {
                              clearAllMidiMappings();
                            }
                          }}
                          title="Remove this MIDI mapping"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* APC40 Surface Diagram — physical hardware layout with live bindings */}
        <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <Apc40SurfaceDiagram mode="view" title="hardware surface" />
        </div>

        {/* APC40 Demoscene easter egg — LED animations for the clip grid */}
        <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <Apc40Demoscene />
        </div>

        {/* ROLI debug + diagnostics — surfaces handshake state, touch readout, SysEx ring */}
        <div className={styles.card} style={{ gridColumn: '1 / -1', padding: '0.75rem' }}>
          <RoliDebugPanel />
        </div>

        {/* APC40 Manual Card */}
        <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <button
            type="button"
            className={styles.cardHeaderToggle}
            onClick={() => setApc40ManualExpanded((v) => !v)}
            aria-expanded={apc40ManualExpanded}
          >
            <h3 title="Visual reference for the AKAI APC40 controller showing what each knob, fader, and button does">
              {theme === 'artsnob' && 'APC40 Manual: The Tactile Codex'}
              {theme === 'standard' && 'APC40 Visual Manual'}
              {theme === 'minimal' && 'APC40 Manual'}
            </h3>
            <span className={styles.cardHeaderMeta}>
              Hardware reference + live MIDI activity
            </span>
            <i className={`fas fa-chevron-${apc40ManualExpanded ? 'up' : 'down'}`} />
          </button>
          {apc40ManualExpanded && (
            <div className={styles.cardBody}>
              <Apc40Manual />
            </div>
          )}
        </div>


      </div>
    </div>
  )
}
