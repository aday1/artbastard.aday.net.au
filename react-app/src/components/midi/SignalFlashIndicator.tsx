import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import styles from './SignalFlashIndicator.module.scss'

interface SignalFlashIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export const SignalFlashIndicator: React.FC<SignalFlashIndicatorProps> = ({ 
  position = 'bottom-left' 
}) => {
  const [midiFlash, setMidiFlash] = useState(false)
  const [oscFlash, setOscFlash] = useState(false)
  const midiFlashTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const oscFlashTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Get MIDI/OSC activity from store (adjust based on your store structure)
  const midiActivity = useStore(state => state.midiActivity || 0)
  const oscActivity = useStore(state => state.oscActivity || 0)
  const lastMidiActivityRef = useRef(midiActivity)
  const lastOscActivityRef = useRef(oscActivity)

  // Flash effect for MIDI activity
  useEffect(() => {
    if (midiActivity !== lastMidiActivityRef.current) {
      setMidiFlash(true)
      
      // Clear existing timeout
      if (midiFlashTimeoutRef.current) {
        clearTimeout(midiFlashTimeoutRef.current)
      }
      
      // Set new timeout to turn off flash
      midiFlashTimeoutRef.current = setTimeout(() => {
        setMidiFlash(false)
      }, 150)
      
      lastMidiActivityRef.current = midiActivity
    }
  }, [midiActivity])

  // Flash effect for OSC activity
  useEffect(() => {
    if (oscActivity !== lastOscActivityRef.current) {
      setOscFlash(true)
      
      // Clear existing timeout
      if (oscFlashTimeoutRef.current) {
        clearTimeout(oscFlashTimeoutRef.current)
      }
      
      // Set new timeout to turn off flash
      oscFlashTimeoutRef.current = setTimeout(() => {
        setOscFlash(false)
      }, 150)
      
      lastOscActivityRef.current = oscActivity
    }
  }, [oscActivity])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (midiFlashTimeoutRef.current) clearTimeout(midiFlashTimeoutRef.current)
      if (oscFlashTimeoutRef.current) clearTimeout(oscFlashTimeoutRef.current)
    }
  }, [])

  return (
    <div className={`${styles.signalContainer} ${styles[position]}`}>
      <div className={`${styles.signalIndicator} ${midiFlash ? styles.midiFlash : ''}`}>
        <span className={styles.signalLabel}>MIDI</span>
        <div className={`${styles.signalDot} ${midiFlash ? styles.active : ''}`} />
      </div>
      
      <div className={`${styles.signalIndicator} ${oscFlash ? styles.oscFlash : ''}`}>
        <span className={styles.signalLabel}>OSC</span>
        <div className={`${styles.signalDot} ${oscFlash ? styles.active : ''}`} />
      </div>
    </div>
  )
}

export default SignalFlashIndicator
