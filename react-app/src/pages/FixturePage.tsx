import React, { useState } from 'react'
import { FixtureSetup } from '../components/fixtures/FixtureSetup'
import SuperControl from '../components/dmx/SuperControl'
import { PageHeader } from '../components/ui/PageHeader'
import { TabNavigation } from '../components/ui/TabNavigation'
import { TabPanel } from '../components/ui/TabPanel'
import styles from './Pages.module.scss'

const FixturePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('control')

  const tabs = [
    {
      id: 'control',
      label: {
        artsnob: 'Chromatic Energy Control',
        standard: 'Advanced Fixture Control',
        minimal: 'Control'
      },
      icon: 'fas fa-sliders-h',
      ariaLabel: 'Fixture control panel'
    },
    {
      id: 'setup',
      label: {
        artsnob: 'Definition Sanctuary',
        standard: 'Fixture Definitions',
        minimal: 'Setup'
      },
      icon: 'fas fa-cog',
      ariaLabel: 'Fixture setup panel'
    }
  ]

  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title={{
          artsnob: 'Fixture Orchestration: The Instruments of Light',
          standard: 'Fixture Management',
          minimal: 'Fixtures'
        }}
        description={{
          artsnob: 'Define, configure, and control your luminous instruments',
          standard: 'Configure fixture definitions and control lighting equipment',
          minimal: 'Configure and control fixtures'
        }}
      >
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel="Fixture management tabs"
        />
      </PageHeader>
      
      <div className={styles.pageContent}>
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
