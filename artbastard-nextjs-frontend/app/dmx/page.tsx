"use client"; // This page will use client components

import React from 'react';
import DMXChannelGrid from '../components/dmx/DMXChannelGrid';
import { useDmxStore } from '../store/dmxStore';
import styles from './DMXPage.module.scss'; // Create this file for page-specific styles

const DMXPage: React.FC = () => {
  const setAllToZero = useDmxStore(state => state.setAllToZero);

  const handleBlackout = async () => {
    await setAllToZero();
  };

  return (
    <div className={styles.dmxPageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h1>DMX Control</h1>
            <p>Direct control over all 512 DMX channels.</p>
          </div>
          <div className={styles.toolbar}>
            <button 
              className={styles.blackoutButton}
              onClick={handleBlackout}
              title="Set all DMX channels to 0 (Blackout)"
            >
              <span className={styles.blackoutIcon}>⚫</span>
              <span>SET TO 0</span>
            </button>
          </div>
        </div>
      </header>

      <DMXChannelGrid />

      {/* Future additions:
          - Master Fader component
          - Group controls
          - Selection tools (select all, none, invert)
          - Pagination/Filtering for DMXChannelGrid
      */}
    </div>
  );
};

export default DMXPage;
