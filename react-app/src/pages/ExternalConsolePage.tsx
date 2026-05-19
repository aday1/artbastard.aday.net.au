import React from 'react';
import Dashboard from '../components/dashboard/Dashboard';
import styles from './ExternalConsolePage.module.scss';

/**
 * External Console Page - Standalone page for tablets and 2nd monitors
 * Opens in a new window with full functionality
 * All providers are handled in App.tsx
 */
const ExternalConsolePage: React.FC = () => {
  return (
    <div className={styles.externalConsolePage}>
      <Dashboard />
    </div>
  );
};

export default ExternalConsolePage;

