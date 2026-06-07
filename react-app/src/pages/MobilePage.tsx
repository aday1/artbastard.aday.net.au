import React, { Suspense } from 'react';
import { DmxChannelControlPage } from '../components/pages/DmxChannelControlPage';
import SuperControl from '../components/dmx/SuperControl';
import { MobileFixtureRack } from '../components/fixtures/MobileFixtureRack';
import { useTheme } from '../context/ThemeContext';
import { LucideIcon } from '../components/ui/LucideIcon';
import { SkeuoButton } from '../components/ui/SkeuoButton';
import { SiteBrandingLink } from '../components/ui/SiteBrandingLink';
import { DeployLaneBadge } from '../components/layout/DeployLaneBadge';
import { useStore } from '../store';
import styles from './MobilePage.module.scss';

const ActsScenesPage = React.lazy(() => import('./ActsScenesPage'));
const ActsPage = React.lazy(() => import('./ActsPage'));
const SettingsPage = React.lazy(() => import('./SettingsPage'));

type MobileTab = 'dmx' | 'supercontrol' | 'fixture' | 'scenes' | 'acts' | 'settings';

const TabFallback = () => <div className={styles.tabFallback}>Chargement...</div>;

const MobilePage: React.FC = () => {
  const { theme } = useTheme();
  const fixtureCount = useStore((state) => state.fixtures.length);
  const [activeTab, setActiveTab] = React.useState<MobileTab>(() =>
    fixtureCount === 0 ? 'fixture' : 'supercontrol'
  );

  const activateTab = React.useCallback((tab: MobileTab) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.add('ab-mobile-page');
    return () => document.documentElement.classList.remove('ab-mobile-page');
  }, []);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'switchTab') return;
      const tab = event.data.tab;
      if (
        tab === 'dmx' ||
        tab === 'supercontrol' ||
        tab === 'control' ||
        tab === 'fixture' ||
        tab === 'scenes' ||
        tab === 'acts' ||
        tab === 'settings'
      ) {
        activateTab(tab === 'control' ? 'supercontrol' : tab);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activateTab]);

  const tabs: Array<{
    id: MobileTab;
    icon: 'Lightbulb' | 'Zap' | 'LampDesk' | 'Theater' | 'Clapperboard' | 'Settings';
    label: { artsnob: string; standard: string };
  }> = [
    {
      id: 'dmx',
      icon: 'Zap',
      label: { artsnob: 'DMX', standard: 'DMX' },
    },
    {
      id: 'supercontrol',
      icon: 'Lightbulb',
      label: { artsnob: 'Maître', standard: 'Control' },
    },
    {
      id: 'fixture',
      icon: 'LampDesk',
      label: { artsnob: 'Fixtures', standard: 'Fixtures' },
    },
    {
      id: 'scenes',
      icon: 'Theater',
      label: { artsnob: 'Scènes', standard: 'Scenes' },
    },
    {
      id: 'acts',
      icon: 'Clapperboard',
      label: { artsnob: 'Actes', standard: 'Acts' },
    },
    {
      id: 'settings',
      icon: 'Settings',
      label: { artsnob: 'Réglages', standard: 'Settings' },
    },
  ];

  return (
    <div className={styles.mobilePage}>
      <div className={styles.mobileHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.mobileTitle}>
            <SiteBrandingLink brand="artbastard">ArtBastard</SiteBrandingLink>
          </h1>
          <DeployLaneBadge placement="inline" className={styles.laneBadge} />
        </div>
        <div className={`${styles.tabNavigation} ab-view-tabs`} role="tablist" aria-label="Mobile control tabs">
          {tabs.map((tab) => (
            <SkeuoButton
              key={tab.id}
              id={`mobile-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`mobile-panel-${tab.id}`}
              active={activeTab === tab.id}
              variant="pill"
              className={styles.tab}
              onClick={() => activateTab(tab.id)}
            >
              <span className={styles.tabIcon} aria-hidden="true">
                <LucideIcon name={tab.icon} size={18} />
              </span>
              <span className={styles.tabLabel}>
                {theme === 'artsnob' ? tab.label.artsnob : tab.label.standard}
              </span>
            </SkeuoButton>
          ))}
        </div>
      </div>

      <div className={styles.mobileContent}>
        {activeTab === 'supercontrol' && (
          <div
            id="mobile-panel-supercontrol"
            className={styles.tabContent}
            role="tabpanel"
            aria-labelledby="mobile-tab-supercontrol"
          >
            <SuperControl preferTouchLayout />
          </div>
        )}
        {activeTab === 'dmx' && (
          <div
            id="mobile-panel-dmx"
            className={styles.tabContent}
            role="tabpanel"
            aria-labelledby="mobile-tab-dmx"
          >
            <DmxChannelControlPage embedded />
          </div>
        )}
        {activeTab === 'fixture' && (
          <div
            id="mobile-panel-fixture"
            className={styles.tabContent}
            role="tabpanel"
            aria-labelledby="mobile-tab-fixture"
          >
            <MobileFixtureRack />
          </div>
        )}
        {activeTab === 'scenes' && (
          <div
            id="mobile-panel-scenes"
            className={styles.tabContent}
            role="tabpanel"
            aria-labelledby="mobile-tab-scenes"
          >
            <Suspense fallback={<TabFallback />}>
              <ActsScenesPage />
            </Suspense>
          </div>
        )}
        {activeTab === 'acts' && (
          <div
            id="mobile-panel-acts"
            className={styles.tabContent}
            role="tabpanel"
            aria-labelledby="mobile-tab-acts"
          >
            <Suspense fallback={<TabFallback />}>
              <ActsPage />
            </Suspense>
          </div>
        )}
        {activeTab === 'settings' && (
          <div
            id="mobile-panel-settings"
            className={styles.tabContent}
            role="tabpanel"
            aria-labelledby="mobile-tab-settings"
          >
            <Suspense fallback={<TabFallback />}>
              <SettingsPage />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobilePage;
