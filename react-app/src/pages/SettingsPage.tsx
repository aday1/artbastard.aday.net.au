import React from 'react'
import UnifiedSettings from '../components/settings/UnifiedSettings';
import styles from './Pages.module.scss'

const SettingsPage: React.FC = () => {
  return (
    <div className={`${styles.pageContainer} ${styles.settingsPage}`}>
      <UnifiedSettings />
    </div>
  )
}

export default SettingsPage
