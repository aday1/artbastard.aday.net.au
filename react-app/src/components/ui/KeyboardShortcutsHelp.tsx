import React from 'react';
import { ALL_SHORTCUTS, formatShortcut, getShortcutsByCategory, KeyboardShortcut } from '../../utils/keyboardShortcuts';
import { LucideIcon } from './LucideIcon';
import styles from './KeyboardShortcutsHelp.module.scss';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<KeyboardShortcut['category'], string> = {
  timeline: 'Timeline',
  general: 'General',
  navigation: 'Navigation',
  editing: 'Editing',
};

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const categories: KeyboardShortcut['category'][] = ['timeline', 'general', 'navigation', 'editing'];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>
            <LucideIcon name="Keyboard" size={24} />
            Keyboard Shortcuts
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            <LucideIcon name="X" size={20} />
          </button>
        </div>
        
        <div className={styles.content}>
          {categories.map(category => {
            const shortcuts = getShortcutsByCategory(category);
            if (shortcuts.length === 0) return null;
            
            return (
              <div key={category} className={styles.category}>
                <h3 className={styles.categoryTitle}>{CATEGORY_LABELS[category]}</h3>
                <div className={styles.shortcutsList}>
                  {shortcuts.map((shortcut, index) => (
                    <div key={index} className={styles.shortcutItem}>
                      <div className={styles.shortcutKeys}>
                        {formatShortcut(shortcut).split(' + ').map((key, i, arr) => (
                          <React.Fragment key={i}>
                            <kbd className={styles.key}>{key}</kbd>
                            {i < arr.length - 1 && <span className={styles.plus}>+</span>}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className={styles.shortcutDescription}>
                        {shortcut.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

