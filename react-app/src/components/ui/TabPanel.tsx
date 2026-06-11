import React from 'react'
import styles from './TabPanel.module.scss'

interface TabPanelProps {
  id: string
  isActive: boolean
  children: React.ReactNode
  className?: string
}

export const TabPanel: React.FC<TabPanelProps> = ({
  id,
  isActive,
  children,
  className = ''
}) => {
  if (!isActive) return null

  return (
    <div 
      className={`${styles.tabPanel} ${className}`}
      role="tabpanel"
      aria-labelledby={`${id}-tab`}
      id={`${id}-panel`}
    >
      {children}
    </div>
  )
}

export default TabPanel
