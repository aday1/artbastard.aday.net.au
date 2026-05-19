import React from 'react';
import styles from '../pages/DmxChannelControlPage.module.scss';

interface DmxFooterInfoProps {
  displayedCount: number;
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  midiMappingCount: number;
}

export const DmxFooterInfo: React.FC<DmxFooterInfoProps> = ({
  displayedCount,
  filteredCount,
  currentPage,
  totalPages,
  midiMappingCount,
}) => {
  return (
    <div className={styles.footer}>
      <div className={styles.footerInfo}>
        <span>Showing {displayedCount} of {filteredCount} channels</span>
        <span>•</span>
        <span>Page {currentPage + 1} of {totalPages}</span>
        <span>•</span>
        <span>{midiMappingCount} MIDI mappings</span>
      </div>
    </div>
  );
};
