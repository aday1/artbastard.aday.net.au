import React from 'react'
import UnifiedSettings from '../components/settings/UnifiedSettings';
import { PageHeader } from '../components/ui/PageHeader'
import styles from './Pages.module.scss'

const SettingsPage: React.FC = () => {
  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title={{
          artsnob: 'Le Panneau de Configuration Sophistiqué',
          standard: 'Settings & Configuration',
          minimal: 'Settings'
        }}
        description={{
          artsnob: 'Configure your DMX512 system preferences and advanced settings',
          standard: 'Configure system preferences, themes, and advanced settings',
          minimal: 'System configuration'
        }}
      />
      
      <div className={styles.pageContent}>
        <UnifiedSettings />
      </div>
    </div>
  )
}

export default SettingsPage
