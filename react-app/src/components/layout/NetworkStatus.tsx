import React, { useEffect, useState, useRef } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useTheme } from '../../context/ThemeContext'
import { useBrowserMidi } from '../../hooks/useBrowserMidi'
import { useStore } from '../../store'
import styles from './NetworkStatus.module.scss'

interface HealthStatus {
  status: 'ok' | 'degraded'
  serverStatus: string
  socketConnections: number
  socketStatus: string
  uptime: number
  timestamp: string
  memoryUsage: {
    heapUsed: number
    heapTotal: number
  }
  midiDevicesConnected: number
  artnetStatus: string // This will now receive more detailed statuses
}

interface Props {
  isModal?: boolean
  onClose?: () => void
  compact?: boolean // Add compact prop for top bar display
  navbar?: boolean // Add navbar prop to indicate it's in the navbar
}

interface DmxMessage {
  timestamp: Date;
  channel: number;
  value: number;
  previousValue: number;
}

export const NetworkStatus: React.FC<Props> = ({ isModal = false, onClose, compact = false, navbar = false }) => {
  const { socket, connected } = useSocket()
  const { theme } = useTheme()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [dmxMessages, setDmxMessages] = useState<DmxMessage[]>([])
  const [showDmxLog, setShowDmxLog] = useState(false)
  const dmxChannels = useStore(state => state.dmxChannels)
  const prevDmxChannelsRef = useRef<number[]>(dmxChannels)
  
  // Get MIDI devices directly from browser to supplement server health data
  const { browserInputs, activeBrowserInputs } = useBrowserMidi()
  const midiMessages = useStore(state => state.midiMessages)
  const [midiActivity, setMidiActivity] = useState(false)

  // Flash MIDI indicator on new messages
  useEffect(() => {
    if (midiMessages && midiMessages.length > 0) {
      setMidiActivity(true);
      const timer = setTimeout(() => setMidiActivity(false), 300);
      return () => clearTimeout(timer);
    }
  }, [midiMessages]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        setHealth(data)
        setLastUpdate(new Date())
      } catch (error) {
        console.error('Failed to fetch health status:', error)
      }
    }

    // Initial fetch
    fetchHealth()

    // Poll every 10 seconds
    const interval = setInterval(fetchHealth, 10000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isModal) {
      setShowModal(true)
    }
  }, [isModal])

  // Listen for DMX updates and log them
  useEffect(() => {
    if (!socket || !connected) return;

    const handleDmxUpdate = (data: { channel: number; value: number }) => {
      const prevValue = prevDmxChannelsRef.current[data.channel] || 0;
      if (prevValue !== data.value) {
        setDmxMessages(prev => {
          const newMessages = [
            ...prev,
            {
              timestamp: new Date(),
              channel: data.channel,
              value: data.value,
              previousValue: prevValue
            }
          ];
          // Keep only last 100 messages
          return newMessages.slice(-100);
        });
        prevDmxChannelsRef.current[data.channel] = data.value;
      }
    };

    socket.on('dmxUpdate', handleDmxUpdate);

    return () => {
      socket.off('dmxUpdate', handleDmxUpdate);
    };
  }, [socket, connected])

  // Update prevDmxChannelsRef when dmxChannels change
  useEffect(() => {
    prevDmxChannelsRef.current = [...dmxChannels];
  }, [dmxChannels])

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const formatMemory = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const handleClose = () => {
    setShowModal(false)
    onClose?.()
  }

  // Helper function to determine ArtNet display text and style
  const getArtNetDisplayDetails = (status: string | undefined) => {
    let fullText = status || 'Unknown';
    let shortText = status || 'Unknown';
    let styleKey: 'statusOk' | 'statusDegraded' | 'statusUnknown' = 'statusUnknown';

    switch (status) {
      case 'alive':
        fullText = 'ICMP Reply to Artnet'; // User's requested text
        shortText = 'ArtNet OK';
        styleKey = 'statusOk';
        break;
      case 'initialized_pending_ping':
        fullText = 'ArtNet Initialized, Pinging...';
        shortText = 'Pinging...';
        styleKey = 'statusUnknown'; // Or 'statusPending' if you add specific styles
        break;
      case 'init_failed':
        fullText = 'ArtNet Initialization Failed';
        shortText = 'Init Fail';
        styleKey = 'statusDegraded';
        break;
      case 'tcp_timeout':
        fullText = 'ArtNet TCP Port Timeout';
        shortText = 'Timeout';
        styleKey = 'statusDegraded';
        break;
      case 'unreachable':
        fullText = 'ArtNet Device Unreachable';
        shortText = 'Unreachable';
        styleKey = 'statusDegraded';
        break;
      default:
        fullText = status ? `ArtNet: ${status}` : 'ArtNet: Unknown';
        shortText = status || 'Unknown';
        styleKey = 'statusUnknown';
    }
    return { fullText, shortText, styleKey };
  }
  const content = (
    <div className={`${styles.networkStatus} ${navbar ? styles.navbarVersion : ''}`}>
      <div className={styles.header}>
        <h3>
          {theme === 'artsnob' && (navbar ? 'Telemetry' : 'Network Telemetry')}
          {theme === 'standard' && (navbar ? 'Network' : 'Network Status')}
          {theme === 'minimal' && 'Status'}
        </h3>
        {lastUpdate && !navbar && (
          <span className={styles.lastUpdate}>
            Updated: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
        {isModal && (
          <button className={styles.closeButton} onClick={handleClose}>
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>

      <div className={navbar ? styles.navbarStatusGrid : styles.statusGrid}>
        <div className={`${styles.statusItem} ${styles[health?.status || 'unknown']}`}>
          <i className="fas fa-server"></i>
          <div className={styles.statusInfo}>
            <span className={styles.label}>{navbar ? 'Srv' : 'Server'}</span>
            <span className={styles.value}>{navbar ? (health?.serverStatus === 'running' ? 'OK' : 'ERR') : (health?.serverStatus || 'Unknown')}</span>
          </div>
        </div>

        <div className={`${styles.statusItem} ${styles[connected ? 'ok' : 'degraded']}`}>
          <i className="fas fa-plug"></i>
          <div className={styles.statusInfo}>
            <span className={styles.label}>{navbar ? 'WS' : 'WebSocket'}</span>
            <span className={styles.value}>
              {navbar ? (connected ? 'OK' : 'OFF') : (connected ? `Connected (${health?.socketConnections || 0} clients)` : 'Disconnected')}
            </span>
          </div>
        </div>

        <div className={`${styles.statusItem} ${styles[health?.midiDevicesConnected ? 'ok' : 'unknown']}`}>
          <i className="fas fa-music"></i>
          <div className={styles.statusInfo}>
            <span className={styles.label}>MIDI</span>
            <span className={styles.value}>
              {navbar ? `${(health?.midiDevicesConnected || 0) + (activeBrowserInputs?.size || 0)}` : `Server: ${health?.midiDevicesConnected || 0}, Browser: ${activeBrowserInputs?.size || 0}`}
            </span>
          </div>
        </div>

        <div className={`${styles.statusItem} ${styles[getArtNetDisplayDetails(health?.artnetStatus).styleKey]}`}>
          <i className="fas fa-network-wired"></i>
          <div className={styles.statusInfo}>
            <span className={styles.label}>ArtNet</span>
            <span className={styles.value}>{navbar ? getArtNetDisplayDetails(health?.artnetStatus).shortText : getArtNetDisplayDetails(health?.artnetStatus).fullText}</span>
          </div>
        </div>

        {!navbar && (
          <>
            <div className={styles.statsSection}>
              <div className={styles.stat}>
                <span className={styles.label}>Uptime</span>
                <span className={styles.value}>{health ? formatUptime(health.uptime) : 'Unknown'}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Memory</span>
                <span className={styles.value}>
                  {health?.memoryUsage ? formatMemory(health.memoryUsage.heapUsed) : 'Unknown'}
                </span>
              </div>
            </div>

            {/* DMX Message Log */}
            <div className={styles.dmxLogSection}>
              <div className={styles.dmxLogHeader}>
                <h4>
                  <i className="fas fa-broadcast-tower"></i>
                  DMX/ArtNet Message Log
                </h4>
                <button
                  className={styles.toggleLogButton}
                  onClick={() => setShowDmxLog(!showDmxLog)}
                  title={showDmxLog ? 'Hide DMX log' : 'Show DMX log'}
                >
                  <i className={`fas fa-chevron-${showDmxLog ? 'up' : 'down'}`}></i>
                </button>
              </div>
              {showDmxLog && (
                <div className={styles.dmxLogContainer}>
                  {dmxMessages.length === 0 ? (
                    <div className={styles.dmxLogEmpty}>
                      <i className="fas fa-info-circle"></i>
                      <span>No DMX messages yet. Messages will appear here when DMX channels are updated.</span>
                    </div>
                  ) : (
                    <div className={styles.dmxLogMessages}>
                      {dmxMessages.slice().reverse().map((msg, idx) => (
                        <div key={idx} className={styles.dmxLogMessage}>
                          <span className={styles.dmxLogTime}>
                            {msg.timestamp.toLocaleTimeString()}
                          </span>
                          <span className={styles.dmxLogChannel}>
                            CH{msg.channel + 1}
                          </span>
                          <span className={styles.dmxLogValue}>
                            {msg.previousValue} → {msg.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {dmxMessages.length > 0 && (
                    <button
                      className={styles.clearLogButton}
                      onClick={() => setDmxMessages([])}
                      title="Clear DMX log"
                    >
                      <i className="fas fa-trash"></i>
                      Clear Log
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );  if (compact) {
    // Show compact view with essential telemetry data
    const artNetDetails = getArtNetDisplayDetails(health?.artnetStatus);
    const midiCount = (health?.midiDevicesConnected || 0) + (activeBrowserInputs?.size || 0);
    
    return (
      <div className={styles.compactView}>
        <div className={`${styles.compactItem} ${styles.connectionIndicator} ${styles[connected ? 'statusOkBackground' : 'statusWarningBackground']}`}>
          <i className={`fas fa-wifi ${styles[connected ? 'statusOk' : 'statusWarning']}`}></i>
          <span>{connected ? 'Online' : 'Offline'}</span>
        </div>
        
        <div className={`${styles.compactItem} ${styles.midiIndicator} ${styles[midiCount > 0 ? 'statusOkBackground' : 'statusUnknownBackground']}`}>
          <i className={`fas fa-music ${midiActivity ? styles.midiActive : styles[midiCount > 0 ? 'statusOk' : 'statusUnknown']}`}></i>
          <span>{midiCount}</span>
        </div>
        
        <div className={`${styles.compactItem} ${styles.artnetIndicator} ${styles[artNetDetails.styleKey + 'Background']}`}>
          <i className={`fas fa-network-wired ${styles[artNetDetails.styleKey]}`}></i>
          <span>{artNetDetails.shortText}</span>
        </div>
        
        <button 
          className={`${styles.compactIcon} ${styles[health?.status === 'ok' && connected ? 'ok' : 'degraded']}`}
          title={`Network Telemetry Details\nServer: ${health?.serverStatus || 'Unknown'}\nSocket: ${connected ? 'Connected' : 'Disconnected'}\nMIDI: ${midiCount} devices\nArtNet: ${artNetDetails.fullText}\nClick for full details`}
          onClick={() => setShowModal(true)}
        >
          <i className="fas fa-chart-line"></i>
        </button>
      </div>
    )
  }

  if (isModal) {
    return showModal ? (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          {content}
        </div>
      </div>
    ) : null
  }

  return content
}