import React, { useEffect, useState } from 'react'
import { useStore } from '../../store'
import styles from './StatusMessage.module.scss'

interface StatusMessageProps {
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  priority?: 'low' | 'normal' | 'high'
  persistent?: boolean
  dismissible?: boolean
  id: string // Changed from optional to required
}

export const StatusMessage: React.FC<StatusMessageProps> = ({ 
  message, 
  type, 
  priority = 'normal',
  persistent = false,
  dismissible = true,
  id // Now required
}) => {
  const [visible, setVisible] = useState(true)
  // const clearStatusMessage = useStore((state) => state.clearStatusMessage) // Old store action
  const removeNotification = useStore((state) => state.removeNotification) // New store action
  const [isHovered, setIsHovered] = useState(false)
  
  const duration = priority === 'high' ? 5000 : priority === 'low' ? 2000 : 3000

  useEffect(() => {
    setVisible(true)
    
    if (!persistent) {
      const timer = setTimeout(() => {
        if (!isHovered) {
          setVisible(false)
          
          // Allow time for fade out animation before removing from DOM
          setTimeout(() => {
            // clearStatusMessage() // Old store action
            if (id) removeNotification(id) // Use new action with id
          }, 300)
        }
      }, duration)
      
      return () => clearTimeout(timer)
    }
  // }, [message, clearStatusMessage, persistent, duration, isHovered]) // Old dependencies
  }, [id, message, removeNotification, persistent, duration, isHovered]) // Updated dependencies

  const handleDismiss = () => {
    if (dismissible) {
      setVisible(false)
      setTimeout(() => {
        // clearStatusMessage() // Old store action
        if (id) removeNotification(id) // Use new action with id
      }, 300)
    }
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    // Restart timer if not persistent
    if (!persistent) {
      setTimeout(() => {
        if (!isHovered) {
          setVisible(false)
          setTimeout(() => {
            // clearStatusMessage() // Old store action
            if (id) removeNotification(id) // Use new action with id
          }, 300)
        }
      }, 1000) // Short delay before auto-dismiss resumes
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success': return 'fas fa-check-circle'
      case 'error': return 'fas fa-exclamation-circle'
      case 'warning': return 'fas fa-exclamation-triangle'
      case 'info': return 'fas fa-info-circle'
      default: return 'fas fa-info-circle'
    }
  }

  return (
    <div 
      className={`${styles.statusMessage} ${styles[type]} ${styles[priority]} ${visible ? styles.visible : styles.hidden}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-notification-id={id}
    >
      <div className={styles.content}>
        <i className={getIcon()}></i>
        <span className={styles.text}>{message}</span>
        {dismissible && (
          <button 
            className={styles.dismissButton}
            onClick={handleDismiss}
            title="Dismiss notification"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
      {priority === 'high' && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ animationDuration: `${duration}ms` }}></div>
        </div>
      )}
    </div>
  )
}