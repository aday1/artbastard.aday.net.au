import React, { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { useSocket } from '../../context/SocketContext'
import { useTheme } from '../../context/ThemeContext'
import { NetworkStatus } from './NetworkStatus'
import styles from './StatusBar.module.scss'

export const StatusBar: React.FC = () => {
  const artNetStatus = useStore((state) => state.artNetStatus)
  const { connected } = useSocket()
  const { theme } = useTheme()
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  
  // Local state for MIDI activity indicators
  const [midiInActive, setMidiInActive] = useState(false)
  const [midiOutActive, setMidiOutActive] = useState(false)
  const [oscInActive, setOscInActive] = useState(false)
  const [oscOutActive, setOscOutActive] = useState(false)
  
  // Monitor MIDI messages to show activity
  const midiMessages = useStore((state) => state.midiMessages)
  
  useEffect(() => {
    if (midiMessages.length > 0) {
      const lastMessage = midiMessages[midiMessages.length - 1]
      // Flash the MIDI in indicator
      setMidiInActive(true)
      setTimeout(() => setMidiInActive(false), 300)
    }
  }, [midiMessages])

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

        <div className={styles.right}></div>
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