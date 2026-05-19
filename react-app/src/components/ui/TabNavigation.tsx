import React, { useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import styles from './TabNavigation.module.scss'

interface Tab {
  id: string
  label: {
    artsnob: string
    standard: string
    minimal: string
  }
  icon?: string
  ariaLabel?: string
}

interface TabNavigationProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  ariaLabel?: string
  className?: string
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = 'Tab navigation',
  className = ''
}) => {
  const { theme } = useTheme()

  // Keyboard navigation for tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
        const nextIndex = e.key === 'ArrowLeft' 
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length
        onTabChange(tabs[nextIndex].id)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTab, onTabChange])

  return (
    <div 
      className={`${styles.tabNavigation} ${className}`} 
      role="tablist" 
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          id={`${tab.id}-tab`}
          aria-label={tab.ariaLabel}
        >
          {tab.icon && <i className={tab.icon} aria-hidden="true"></i>}
          <span>
            {theme === 'artsnob' && tab.label.artsnob}
            {theme === 'standard' && tab.label.standard}
            {theme === 'minimal' && tab.label.minimal}
          </span>
        </button>
      ))}
    </div>
  )
}

export default TabNavigation
