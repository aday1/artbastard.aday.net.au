import React from 'react'
import { useTheme } from '../../context/ThemeContext'
import styles from './PageHeader.module.scss'

interface PageHeaderProps {
  title: {
    artsnob: string
    standard: string
    minimal: string
  }
  description: {
    artsnob: string
    standard: string
    minimal: string
  }
  children?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  children,
  className = ''
}) => {
  const { theme } = useTheme()

  return (
    <div className={`${styles.pageHeader} ${className}`}>
      <div className={styles.headerContent}>
        <h2>
          {theme === 'artsnob' && title.artsnob}
          {theme === 'standard' && title.standard}
          {theme === 'minimal' && title.minimal}
        </h2>
        <p>
          {theme === 'artsnob' && description.artsnob}
          {theme === 'standard' && description.standard}
          {theme === 'minimal' && description.minimal}
        </p>
      </div>
      {children && (
        <div className={styles.headerActions}>
          {children}
        </div>
      )}
    </div>
  )
}

export default PageHeader
