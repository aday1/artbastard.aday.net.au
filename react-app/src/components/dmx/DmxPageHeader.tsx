import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import { FaderOrientationSwitch, type FaderOrientation } from './FaderOrientationSwitch';
import styles from '../pages/DmxChannelControlPage.module.scss';

interface DmxPageHeaderProps {
  theme: 'artsnob' | 'standard' | 'minimal';
  activeChannelCount: number;
  selectedFixturesCount: number;
  selectedChannelsCount: number;
  midiMappingsCount: number;
  isLearning: boolean;
  currentLearningChannel: number | null;
  faderOrientation: FaderOrientation;
  onFaderOrientationChange: (orientation: FaderOrientation) => void;
  fixtureSelector: React.ReactNode;
}

export const DmxPageHeader: React.FC<DmxPageHeaderProps> = ({
  theme,
  activeChannelCount,
  selectedFixturesCount,
  selectedChannelsCount,
  midiMappingsCount,
  isLearning,
  currentLearningChannel,
  faderOrientation,
  onFaderOrientationChange,
  fixtureSelector,
}) => {
  return (
    <div className={styles.header}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>
          <LucideIcon name="Sliders" />
          {theme === 'artsnob' ? 'Le Contrôle DMX Ultime' : 'DMX Channel Control'}
        </h1>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <LucideIcon name="Zap" />
            {activeChannelCount} Active
          </span>
          <span className={styles.stat}>
            <LucideIcon name="CheckSquare" />
            {selectedFixturesCount > 0
              ? `${selectedFixturesCount} Fixture${selectedFixturesCount !== 1 ? 's' : ''} Selected`
              : `${selectedChannelsCount} Channel${selectedChannelsCount !== 1 ? 's' : ''} Selected`}
          </span>
          <span className={styles.stat}>
            <LucideIcon name="Music" />
            {midiMappingsCount} MIDI Mapped
          </span>
          {isLearning && (
            <span className={`${styles.stat} ${styles.learningStat}`}>
              <LucideIcon name="Radio" />
              Learning CH {currentLearningChannel !== null ? currentLearningChannel + 1 : '?'}
            </span>
          )}
        </div>
      </div>
      <div className={styles.headerFaderLayout}>
        <span className={styles.controlLabel}>Fader layout</span>
        <FaderOrientationSwitch
          value={faderOrientation}
          onChange={onFaderOrientationChange}
        />
      </div>
      {fixtureSelector}
    </div>
  );
};
