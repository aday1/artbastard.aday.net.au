import React, { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { useSocket } from '../../context/SocketContext'
import { useTheme } from '../../context/ThemeContext'
import { NetworkStatus } from './NetworkStatus'
import { ResetButton } from './ResetButton'
import { ThemeToggleButton } from './ThemeToggleButton'
import { LucideIcon } from '../ui/LucideIcon'
import { OPEN_MONITOR_EVENT } from '../../hooks/useMonitorAutoPop'
import styles from './StatusBar.module.scss'

export const StatusBar: React.FC = () => {
  const { connected } = useSocket()
  const { theme, setTheme } = useTheme()
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const debugTools = useStore((state) => state.debugTools)
  const midiMessages = useStore((state) => state.midiMessages)
  const oscMessages = useStore((state) => state.oscMessages)
  const dmxChannels = useStore((state) => state.dmxChannels)
  const [midiInActive, setMidiInActive] = useState(false)
  const [oscInActive, setOscInActive] = useState(false)
  const [dmxActive, setDmxActive] = useState(false)
  
  useEffect(() => {
    if (midiMessages.length > 0) {
      setMidiInActive(true)
      setTimeout(() => setMidiInActive(false), 300)
    }
  }, [midiMessages])

  useEffect(() => {
    if (oscMessages.length > 0) {
      setOscInActive(true)
      setTimeout(() => setOscInActive(false), 300)
    }
  }, [oscMessages])

  useEffect(() => {
    if (dmxChannels.some((value) => value > 0)) {
      setDmxActive(true)
      setTimeout(() => setDmxActive(false), 700)
    }
  }, [dmxChannels])

  const openMonitor = (key: 'midiMonitor' | 'oscMonitor' | 'dmxMonitor') => {
    window.dispatchEvent(new CustomEvent(OPEN_MONITOR_EVENT, { detail: { key } }))
  }

  const openHelp = () => {
    window.dispatchEvent(new CustomEvent('openHelpOverlay'))
  }

  return (
    <>
      <div className={styles.statusBar}>
        <div className={styles.left}>
          <button 
            onClick={() => setShowNetworkModal(true)}
            className={styles.networkButton}
            title="Show Network Status"
          >
            <i className="fas fa-network-wired"></i>
            {theme !== 'minimal' && <span>Network Status</span>}
          </button>
          <div className={`${styles.connectionStatus} ${connected ? styles.connected : styles.disconnected}`}>
            <i className={`fas fa-${connected ? 'plug' : 'plug-circle-xmark'}`}></i>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        <div className={styles.center} aria-label="Monitor controls">
          {debugTools.midiMonitor && (
            <button
              type="button"
              className={`${styles.statusButton} ${midiInActive ? styles.activePulse : ''}`}
              onClick={() => openMonitor('midiMonitor')}
              title="Open MIDI Monitor"
            >
              <LucideIcon name="Music" />
              <span>MIDI</span>
            </button>
          )}
          {debugTools.oscMonitor && (
            <button
              type="button"
              className={`${styles.statusButton} ${oscInActive ? styles.activePulse : ''}`}
              onClick={() => openMonitor('oscMonitor')}
              title="Open OSC Monitor"
            >
              <LucideIcon name="Radio" />
              <span>OSC</span>
            </button>
          )}
          {debugTools.dmxMonitor !== false && (
            <button
              type="button"
              className={`${styles.statusButton} ${dmxActive ? styles.activePulse : ''}`}
              onClick={() => openMonitor('dmxMonitor')}
              title="Open DMX Activity Monitor"
            >
              <LucideIcon name="Activity" />
              <span>DMX</span>
            </button>
          )}
          <button
            type="button"
            className={styles.statusButton}
            onClick={openHelp}
            title="Open Help"
          >
            <LucideIcon name="HelpCircle" />
            <span>Help</span>
          </button>
        </div>

        <div className={styles.right} aria-label="UI controls">
          <ResetButton showLabels />
          <button
            type="button"
            onClick={() => setTheme(theme === 'artsnob' ? 'standard' : 'artsnob')}
            className={`${styles.statusButton} ${styles.themeButton}`}
            title={`Current: ${theme === 'artsnob' ? 'ArtSnob' : 'Standard'} - Click to switch language`}
          >
            <LucideIcon name={theme === 'artsnob' ? 'Languages' : 'Globe'} />
            <span>{theme === 'artsnob' ? 'ArtSnob' : 'Standard'}</span>
          </button>
          <ThemeToggleButton showLabels />
        </div>
      </div>

      {showNetworkModal && (
        <NetworkStatus 
          isModal
          onClose={() => setShowNetworkModal(false)}
        />
      )}
    </>
  )
}