import React from 'react';
import { usePinning, PinnableComponent } from '../../context/PinningContext';
import styles from './PinButton.module.scss';

interface PinButtonProps {
  componentId: PinnableComponent;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  variant?: 'default' | 'minimal' | 'artsnob';
}

export const PinButton: React.FC<PinButtonProps> = ({
  componentId,
  className = '',
  size = 'medium',
  showLabel = true,
  variant = 'default'
}) => {
  const { isPinned, togglePin } = usePinning();
  const pinned = isPinned(componentId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    togglePin(componentId);
  };

  const getDisplayName = (id: PinnableComponent): string => {
    switch (id) {
      case 'master-fader': return 'Master Fader';
      case 'scene-auto': return 'Scene Auto';
      case 'chromatic-energy-manipulator': return 'Energy Manipulator';
      case 'scene-quick-launch': return 'Quick Launch';
      case 'quick-capture': return 'Quick Capture';
      default: return id;
    }
  };

  return (
    <button
      className={`${styles.pinButton} ${styles[size]} ${styles[variant]} ${pinned ? styles.pinned : styles.unpinned} ${className}`}
      onClick={handleClick}
      title={`${pinned ? 'Unpin' : 'Pin'} ${getDisplayName(componentId)} - ${pinned ? 'Remove from viewport overlay' : 'Keep visible while scrolling'}`}
      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${getDisplayName(componentId)}`}
    >
      <i className={`fas ${pinned ? 'fa-thumbtack' : 'fa-thumb-tack'} ${styles.icon}`}></i>
      {showLabel && (
        <span className={styles.label}>
          {pinned ? 'Pinned' : 'Pin'}
        </span>
      )}
    </button>
  );
};

export default PinButton;
