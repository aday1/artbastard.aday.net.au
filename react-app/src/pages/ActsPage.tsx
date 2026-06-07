import React from 'react'
import { ActsPanel } from '../components/acts/ActsPanel'
import { PageHeader } from '../components/ui/PageHeader'
import styles from './ActsScenesPage.module.scss'

const ActsPage: React.FC = () => {
  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title={{
          artsnob: 'Les Actes Dramatiques',
          standard: 'Acts',
          minimal: 'Acts'
        }}
        description={{
          artsnob: 'Arrange saved scenes into performable lighting timelines',
          standard: 'Arrange saved scenes into performable lighting timelines',
          minimal: 'Scene timelines for shows'
        }}
      />

      <div className={styles.pageContent}>
        <div className={styles.actsContent}>
          <ActsPanel />
        </div>
      </div>
    </div>
  )
}

export default ActsPage
