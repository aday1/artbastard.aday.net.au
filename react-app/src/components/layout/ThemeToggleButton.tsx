import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ThemeToggleButton.module.scss';

interface ThemeToggleButtonProps {
  showLabels?: boolean;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ showLabels = false }) => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className={styles.themeToggleContainer}>
      <button
        className={styles.iconButton}
        onClick={toggleDarkMode}
        title="Toggle Light/Dark Mode"
      >
        <LucideIcon name={darkMode ? 'Moon' : 'Sun'} />
        {showLabels && <span>{darkMode ? 'Dark' : 'Light'}</span>}
      </button>
    </div>
  );
};
