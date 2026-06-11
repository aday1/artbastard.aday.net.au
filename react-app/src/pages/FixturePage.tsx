import React, { useState } from 'react'
import { FixtureSetup } from '../components/fixtures/FixtureSetup'
import SuperControl from '../components/dmx/SuperControl'
import { PageHeader } from '../components/ui/PageHeader'
import { TabNavigation } from '../components/ui/TabNavigation'
import { TabPanel } from '../components/ui/TabPanel'
import { Apc40SceneLaunchStrip } from '../components/midi/Apc40SceneLaunchStrip'
import styles from './Pages.module.scss'

const FixturePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('setup')

  const tabs = [
    {
      id: 'setup',
      label: {
        artsnob: 'Patch the Rig',
        standard: 'Build & Patch',
        minimal: 'Patch'
      },
      icon: 'fas fa-cog',
      ariaLabel: 'Fixture setup panel'
    },
    {
      id: 'control',
      label: {
        artsnob: 'Super Contrôle',
        standard: 'Live Control',
        minimal: 'Control'
      },
      icon: 'fas fa-sliders-h',
      ariaLabel: 'Fixture control panel'
    }
  ]

  return (
    <div className={`${styles.pageContainer} ${styles.fixturePage}`}>
      <PageHeader
        className={styles.fixturePageHeader}
        title={{
          artsnob: 'Fixture Orchestration: The Instruments of Light',
          standard: 'Fixture Management',
          minimal: 'Fixtures'
        }}
        description={{
          artsnob: 'Build the rig, patch addresses, then conduct the luminous instruments',
          standard: 'Build a fixture list, generate DMX addresses, then control the show',
          minimal: 'Build, patch, control'
        }}
      >
        <TabNavigation
          className={styles.fixtureTabs}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel="Fixture management tabs"
        />
      </PageHeader>
      
      <div className={styles.pageContent}>
        <Apc40SceneLaunchStrip />
        <TabPanel id="control" isActive={activeTab === 'control'}>
          <div className={`${styles.controlSection} ${styles.fixtureController}`}>
            <SuperControl isDockable={false} />
          </div>
        </TabPanel>
        
        <TabPanel id="setup" isActive={activeTab === 'setup'}>
          <div className={styles.setupSection}>
            <FixtureSetup />
          </div>
        </TabPanel>
      </div>
    </div>
  )
}

export default FixturePage
