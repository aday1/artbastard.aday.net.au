"use client"; // This page will use client components

import React from 'react';
import FixtureList from '../components/fixtures/FixtureList';
import styles from './FixturesPage.module.scss'; // Create this file for page-specific styles

const FixturesPage: React.FC = () => {
  return (
    <div className={styles.fixturesPageContainer}>
      <header className={styles.pageHeader}>
        <h1>Fixture Management</h1>
        <p>Define, edit, and organize your lighting fixtures.</p>
      </header>

      <div className={styles.contentArea}>
        <FixtureList />
        {/*
          Could add other related components here in the future,
          e.g., a fixture group manager, or a visual layout planner.
        */}
      </div>
    </div>
  );
};

export default FixturesPage;
