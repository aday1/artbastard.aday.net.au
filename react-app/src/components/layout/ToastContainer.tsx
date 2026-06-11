import React from 'react'
import { useStore } from '../../store'
import { StatusMessage } from './StatusMessage'
import styles from './ToastContainer.module.scss'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  priority?: 'low' | 'normal' | 'high'
  persistent?: boolean
  dismissible?: boolean
  timestamp: number
}

export const ToastContainer: React.FC = () => {
  const notifications = useStore((state) => state.notifications)

  if (!notifications || notifications.length === 0) {
    return null
  }

  return (
    <div className={styles.toastContainer}>
      {notifications.map((notification, index) => (
        <div 
          key={notification.id}
          className={styles.toastWrapper}
          style={{ 
            '--toast-index': index,
            '--total-toasts': notifications.length 
          } as React.CSSProperties}
        >
          <StatusMessage
            id={notification.id}
            message={notification.message}
            type={notification.type}
            priority={notification.priority}
            persistent={notification.persistent}
            dismissible={notification.dismissible}
          />
        </div>
      ))}
    </div>
  )
}
