import React, { useState, useEffect } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useTheme } from '../../context/ThemeContext'
import { OscWebGLVisualizer } from './OscWebGLVisualizer'
import styles from './OscDebug.module.scss'

interface OscMessage {
  address: string
  args: Array<{ type: string; value: any }>
  timestamp: number
  direction: 'in' | 'out'
}

interface MessageTypes {
  incoming: boolean
  outgoing: boolean
}

export const OscDebug: React.FC = () => {
  const { theme } = useTheme()
  const { socket, connected } = useSocket()
  
  const [messages, setMessages] = useState<OscMessage[]>([])
  const [messageTypes, setMessageTypes] = useState<MessageTypes>({
    incoming: true,
    outgoing: true
  })
  const [maxMessages, setMaxMessages] = useState(100)
  const [paused, setPaused] = useState(false)
  
  useEffect(() => {
    if (!socket || !connected) return
    
    const handleOscMessage = (msg: OscMessage) => {
      if (paused) return
      
      setMessages(prev => {
        const newMessages = [...prev, { ...msg, timestamp: Date.now() }]
        return newMessages.slice(-maxMessages)
      })
    }
    
    socket.on('oscMessage', handleOscMessage)
    socket.on('oscOutgoing', (msg: OscMessage) => handleOscMessage({ ...msg, direction: 'out' }))
    
    return () => {
      socket.off('oscMessage', handleOscMessage)
      socket.off('oscOutgoing')
    }
  }, [socket, connected, maxMessages, paused])
  
  const formatTimestamp = (timestamp: number) => {
    // Format without fractional seconds since it's not supported in toLocaleTimeString
    const timeStr = new Date(timestamp).toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    // Add milliseconds manually
    const ms = String(timestamp % 1000).padStart(3, '0')
    return `${timeStr}.${ms}`
  }
  
  const filterMessage = (msg: OscMessage) => {
    if (msg.direction === 'out' && !messageTypes.outgoing) return false
    if (msg.direction === 'in' && !messageTypes.incoming) return false
    return true
  }
  
  const clearMessages = () => {
    setMessages([])
  }
  
  return (
    <div className={styles.oscDebug}>
      <h2 className={styles.sectionTitle}>
        {theme === 'artsnob' && 'OSC Message Observatory'}
        {theme === 'standard' && 'OSC Debug Console'}
        {theme === 'minimal' && 'OSC Debug'}
      </h2>
      
      {/* OSC Activity Visualization */}
      <OscWebGLVisualizer />
      
      <div className={styles.controls}>
        <div className={styles.messageTypes}>
          <label>
            <input
              type="checkbox"
              checked={messageTypes.incoming}
              onChange={() => setMessageTypes(prev => ({
                ...prev,
                incoming: !prev.incoming
              }))}
            />
            Incoming
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={messageTypes.outgoing}
              onChange={() => setMessageTypes(prev => ({
                ...prev,
                outgoing: !prev.outgoing
              }))}
            />
            Outgoing
          </label>
        </div>
        
        <div className={styles.messageControls}>
          <button
            className={styles.clearButton}
            onClick={clearMessages}
          >
            <i className="fas fa-eraser"></i>
            Clear
          </button>
          
          <button
            className={`${styles.pauseButton} ${paused ? styles.paused : ''}`}
            onClick={() => setPaused(!paused)}
          >
            <i className={`fas fa-${paused ? 'play' : 'pause'}`}></i>
            {paused ? 'Resume' : 'Pause'}
          </button>
          
          <div className={styles.maxMessages}>
            <label>Max Messages:</label>
            <input
              type="number"
              value={maxMessages}
              onChange={(e) => setMaxMessages(Math.max(1, parseInt(e.target.value) || 100))}
              min="1"
            />
          </div>
        </div>
      </div>
      
      <div className={styles.messageList}>
        {messages.filter(filterMessage).map((msg, index) => (
          <div
            key={index}
            className={`${styles.oscMessage} ${msg.direction === 'out' ? styles.outgoing : styles.incoming}`}
          >
            <div className={styles.messageHeader}>
              <span className={styles.direction}>
                {msg.direction === 'out' ? 'OUT' : 'IN'}
              </span>
              <span className={styles.timestamp}>
                {formatTimestamp(msg.timestamp)}
              </span>
            </div>
            
            <div className={styles.messageContent}>
              <div className={styles.address}>{msg.address}</div>
              <div className={styles.args}>
                {msg.args.map((arg, i) => (
                  <div key={i} className={styles.arg}>
                    <span className={styles.argType}>{arg.type}:</span>
                    <span className={styles.argValue}>{JSON.stringify(arg.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}