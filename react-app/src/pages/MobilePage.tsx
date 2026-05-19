import React from 'react';
import { DmxChannelControlPage } from '../components/pages/DmxChannelControlPage';
import SuperControl from '../components/dmx/SuperControl';
import { useTheme } from '../context/ThemeContext';
import { LucideIcon } from '../components/ui/LucideIcon';
import styles from './MobilePage.module.scss';

type MobileTab = 'supercontrol' | 'dmx';

const MobilePage: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = React.useState<MobileTab>('supercontrol');

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'switchTab') return;
      const tab = event.data.tab;
      if (tab === 'dmx' || tab === 'supercontrol' || tab === 'control') {
        setActiveTab(tab === 'dmx' ? 'dmx' : 'supercontrol');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const tabs: Array<{
    id: MobileTab;
    icon: 'Lightbulb' | 'Zap';
    label: { artsnob: string; standard: string };
  }> = [
    {
      id: 'supercontrol',
      icon: 'Lightbulb',
      label: { artsnob: 'Super Contrôle', standard: 'Super Control' },
    },
    {
      id: 'dmx',
      icon: 'Zap',
      label: { artsnob: 'Canaux DMX', standard: 'DMX Channels' },
    },
  ];

  return (
    <div className={styles.mobilePage}>
      <div className={styles.mobileHeader}>
        <h1 className={styles.mobileTitle}>ArtBastard</h1>
        <div className={styles.tabNavigation} role="tablist" aria-label="Mobile control tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.tabIcon} aria-hidden="true">
                <LucideIcon name={tab.icon} size={18} />
              </span>
              <span className={styles.tabLabel}>
                {theme === 'artsnob' ? tab.label.artsnob : tab.label.standard}
              </span>
            </button>
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
      </div>
    </div>
  );
};

export default MobilePage;
