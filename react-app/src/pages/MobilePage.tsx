import React, { Suspense } from 'react';
import { DmxChannelControlPage } from '../components/pages/DmxChannelControlPage';
import SuperControl from '../components/dmx/SuperControl';
import { useTheme } from '../context/ThemeContext';
import { LucideIcon } from '../components/ui/LucideIcon';
import { SkeuoButton } from '../components/ui/SkeuoButton';
import { SiteBrandingLink } from '../components/ui/SiteBrandingLink';
import { DeployLaneBadge } from '../components/layout/DeployLaneBadge';
import styles from './MobilePage.module.scss';

const FixturePage = React.lazy(() => import('./FixturePage'));
const ActsScenesPage = React.lazy(() => import('./ActsScenesPage'));
const SettingsPage = React.lazy(() => import('./SettingsPage'));

type MobileTab = 'dmx' | 'supercontrol' | 'fixture' | 'scenes' | 'settings';

const TabFallback = () => <div className={styles.tabFallback}>Chargement...</div>;

const MobilePage: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = React.useState<MobileTab>('dmx');

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
        tab === 'settings'
      ) {
        setActiveTab(tab === 'control' ? 'supercontrol' : tab);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const tabs: Array<{
    id: MobileTab;
    icon: 'Lightbulb' | 'Zap' | 'LampDesk' | 'Theater' | 'Settings';
    label: { artsnob: string; standard: string };
  }> = [
    {
      id: 'dmx',
      icon: 'Zap',
      label: { artsnob: 'Canvas DMX', standard: 'Canvas DMX' },
    },
    {
      id: 'supercontrol',
      icon: 'Lightbulb',
      label: { artsnob: 'Super Contrôle', standard: 'Super Control' },
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
              role="tab"
              aria-selected={activeTab === tab.id}
              active={activeTab === tab.id}
              variant="pill"
              className={styles.tab}
              onClick={() => setActiveTab(tab.id)}
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
          <div className={styles.tabContent}>
            <SuperControl preferTouchLayout />
          </div>
        )}
        {activeTab === 'dmx' && (
          <div className={styles.tabContent}>
            <DmxChannelControlPage />
          </div>
        )}
        {activeTab === 'fixture' && (
          <div className={styles.tabContent}>
            <Suspense fallback={<TabFallback />}>
              <FixturePage />
            </Suspense>
          </div>
        )}
        {activeTab === 'scenes' && (
          <div className={styles.tabContent}>
            <Suspense fallback={<TabFallback />}>
              <ActsScenesPage />
            </Suspense>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className={styles.tabContent}>
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
