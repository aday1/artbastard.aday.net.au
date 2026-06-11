import React from 'react';
import { OscPlaceholder } from '../components/osc/OscPlaceholder';
import { useTheme } from '../context/ThemeContext';
import { LucideIcon } from '../components/ui/LucideIcon';
import styles from './ExperimentalPage.module.scss';

const ExperimentalPage: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className={styles.experimentalPage}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <LucideIcon name="FlaskConical" className={styles.icon} />
            <div>
              <h1 className={styles.mainTitle}>
                {theme === 'artsnob' ? '🧪 Laboratoire Expérimental' :
                 theme === 'minimal' ? 'Experimental' :
                 'Experimental Laboratory'}
              </h1>
              <p className={styles.subtitle}>
                {theme === 'artsnob'
                  ? 'Œuvre incomplète - Work In Progress. Highly experimental and incomplete implementations. Use at your own risk, mon ami.'
                  : 'Work In Progress - Highly experimental and incomplete. Use at your own risk.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        margin: '2rem',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(255, 68, 68, 0.1))',
        border: '3px solid #ff4444',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h2 style={{
          color: '#ff4444',
          fontSize: '1.5rem',
          marginBottom: '1rem',
          fontWeight: 'bold'
        }}>
          ⚠️ HIGHLY EXPERIMENTAL - NOT READY FOR USE ⚠️
        </h2>
        <p style={{
          color: '#ffaaaa',
          fontSize: '1.1rem',
          lineHeight: '1.6',
          marginBottom: '0.5rem'
        }}>
          <strong>These features are buggy and incomplete.</strong>
        </p>
        <p style={{
          color: '#ffaaaa',
          fontSize: '0.95rem',
          lineHeight: '1.6'
        }}>
          Do not rely on these features for production use.
          Development is ongoing but these should be considered experimental and unstable.
        </p>
      </div>

      <div className={styles.content}>
        <div className={styles.oscSection}>
          <OscPlaceholder />
        </div>
      </div>

      {theme === 'artsnob' && (
        <div className={styles.footerNote}>
          <LucideIcon name="Info" />
          <span>
            <em>Note for the uninitiated:</em> This is experimental technology.
            If you find yourself confused, perhaps you should stick to simpler tools,
            <em>mon ami</em>.
          </span>
        </div>
      )}
    </div>
  );
};

export default ExperimentalPage;
