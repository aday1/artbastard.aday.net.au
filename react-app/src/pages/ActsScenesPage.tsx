import React, { useState } from 'react'
import { SceneGallery } from '../components/scenes/SceneGallery'
import { AutoSceneControlMini } from '../components/scenes/AutoSceneControlMini'
import { ActsPanel } from '../components/acts/ActsPanel'
import { PageHeader } from '../components/ui/PageHeader'
import { TabNavigation } from '../components/ui/TabNavigation'
import { TabPanel } from '../components/ui/TabPanel'
import { useStore } from '../store'
import styles from './ActsScenesPage.module.scss'

const ActsScenesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('scenes')
  const { scenes, acts, autoSceneList } = useStore((state) => ({
    scenes: state.scenes,
    acts: state.acts,
    autoSceneList: state.autoSceneList,
  }))

  const tabs = [
    {
      id: 'scenes',
      label: {
        artsnob: 'Les Scènes',
        standard: 'Scenes',
        minimal: 'Scenes'
      },
      icon: 'fas fa-theater-masks',
      ariaLabel: 'Scenes management panel'
    },
    {
      id: 'acts',
      label: {
        artsnob: 'Les Actes',
        standard: 'Acts',
        minimal: 'Acts'
      },
      icon: 'fas fa-play-circle',
      ariaLabel: 'Acts management panel'
    }
  ]
  
  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title={{
          artsnob: 'Les Scènes & Actes Dramatiques',
          standard: 'Scenes & Acts',
          minimal: 'Scenes & Acts'
        }}
        description={{
          artsnob: 'Create, manage, and orchestrate lighting scenes and automated sequences',
          standard: 'Create and manage lighting scenes and automated sequences',
          minimal: 'Scenes and automated sequences'
        }}
      >
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel="Scenes and acts tabs"
        />
      </PageHeader>
      
      <div className={styles.pageContent}>
        <div className={styles.workflowCards} aria-label="Scenes and acts workflow">
          <button
            type="button"
            className={`${styles.workflowCard} ${activeTab === 'scenes' ? styles.activeWorkflowCard : ''}`}
            onClick={() => setActiveTab('scenes')}
          >
            <i className="fas fa-camera" aria-hidden="true"></i>
            <span>
              <strong>Capture scenes</strong>
              <small>Save current DMX looks, edit channel values, and load scenes live.</small>
              <em>{scenes.length} saved scene{scenes.length === 1 ? '' : 's'}</em>
            </span>
          </button>
          <button
            type="button"
            className={`${styles.workflowCard} ${activeTab === 'scenes' ? styles.activeWorkflowCard : ''}`}
            onClick={() => setActiveTab('scenes')}
          >
            <i className="fas fa-sync-alt" aria-hidden="true"></i>
            <span>
              <strong>Auto-cycle scenes</strong>
              <small>Build the quick BPM/tap/Ableton Link scene loop for simple playback.</small>
              <em>{autoSceneList.length} scene{autoSceneList.length === 1 ? '' : 's'} queued</em>
            </span>
          </button>
          <button
            type="button"
            className={`${styles.workflowCard} ${activeTab === 'acts' ? styles.activeWorkflowCard : ''}`}
            onClick={() => setActiveTab('acts')}
          >
            <i className="fas fa-clapperboard" aria-hidden="true"></i>
            <span>
              <strong>Build acts</strong>
              <small>Arrange saved scenes into show timelines with ACT triggers.</small>
              <em>{acts.length} act{acts.length === 1 ? '' : 's'}</em>
            </span>
          </button>
        </div>

        <TabPanel id="scenes" isActive={activeTab === 'scenes'}>
          <div className={styles.scenesContent}>
            {/* Auto Scene Control Panel */}
            <div className={styles.autoControlSection}>
              <div className={styles.autoControlCard}>
                <h3>
                  <i className="fas fa-magic" aria-hidden="true"></i>
                  Auto Scene Control
                </h3>
                <AutoSceneControlMini />
              </div>
            </div>
            
            {/* Scene Gallery */}
            <div className={styles.sceneGallerySection}>
              <SceneGallery />
            </div>
          </div>
        </TabPanel>
        
        <TabPanel id="acts" isActive={activeTab === 'acts'}>
          <div className={styles.actsContent}>
            <ActsPanel />
          </div>
        </TabPanel>
      </div>
    </div>
  )
}

export default ActsScenesPage
