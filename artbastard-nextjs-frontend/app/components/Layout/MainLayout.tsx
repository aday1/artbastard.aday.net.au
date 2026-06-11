"use client";

import React from 'react';
import Header from '../Header/Header';
import SocketProvider from '../SocketProvider'; // Import SocketProvider
import styles from './MainLayout.module.scss';

// Font Awesome CSS and configuration
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
config.autoAddCss = false; // Prevent FA from adding CSS automatically

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <SocketProvider> {/* Wrap content with SocketProvider */}
      <div className={styles.mainLayout}>
        <Header />
        <main className={styles.content}>
          {children}
        </main>
        <footer className={styles.footer}>
          <p>&copy; {new Date().getFullYear()} ArtBastard NEXT - Luminous Reimagination</p>
        </footer>
      </div>
    </SocketProvider>
  );
};

export default MainLayout;
