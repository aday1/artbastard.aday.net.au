import React from 'react';
import { MobileControlSurface } from '../components/mobile/MobileControlSurface';
import { DmxChannelControlPage } from '../components/pages/DmxChannelControlPage';
import SuperControl from '../components/dmx/SuperControl';
import { useMobile } from '../hooks/useMobile';
import { useTheme } from '../context/ThemeContext';
import styles from './MobilePage.module.scss';

const MobilePage: React.FC = () => {
  const { theme } = useTheme();
  const { isMobile, isTablet } = useMobile();
  const [activeTab, setActiveTab] = React.useState<'control' | 'dmx' | 'supercontrol'>('control');

  // Listen for tab switch messages
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'switchTab') {
        if (event.data.tab === 'control' || event.data.tab === 'dmx' || event.data.tab === 'supercontrol') {
          setActiveTab(event.data.tab);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className={styles.mobilePage}>
      <div className={styles.mobileHeader}>
        <h1 className={styles.mobileTitle}>
          {theme === 'artsnob' 
            ? '📱 ArtBastard Mobile' 
            : '📱 ArtBastard Mobile'}
        </h1>
        <div className={styles.tabNavigation}>
          <button
            className={`${styles.tab} ${activeTab === 'control' ? styles.active : ''}`}
            onClick={() => setActiveTab('control')}
          >
            <span className={styles.tabIcon}>🎮</span>
            <span className={styles.tabLabel}>
              {theme === 'artsnob' ? 'Contrôle Mobile' : 'Control'}
            </span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'dmx' ? styles.active : ''}`}
            onClick={() => setActiveTab('dmx')}
          >
            <span className={styles.tabIcon}>⚡</span>
            <span className={styles.tabLabel}>
              {theme === 'artsnob' ? 'DMX Ultime' : 'DMX Control'}
            </span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'supercontrol' ? styles.active : ''}`}
            onClick={() => setActiveTab('supercontrol')}
          >
            <span className={styles.tabIcon}>💡</span>
            <span className={styles.tabLabel}>
              {theme === 'artsnob' ? 'Super Contrôle' : 'Super Control'}
            </span>
          </button>
        </div>
      </div>
      
      <div className={styles.mobileContent}>
        {activeTab === 'control' && (
          <div className={styles.tabContent}>
            <MobileControlSurface showFixtureSelector={true} />
          </div>
        )}
        {activeTab === 'dmx' && (
          <div className={styles.tabContent}>
            <DmxChannelControlPage />
          </div>
        )}
        {activeTab === 'supercontrol' && (
          <div className={styles.tabContent}>
            <SuperControl />
          </div>
        )}
      </div>
    </div>
  );
};

export default MobilePage;

