/**
 * Keyboard Shortcuts Overlay
 * Displays all available keyboard shortcuts in a searchable overlay
 */

import React, { useState, useEffect, useMemo } from 'react';
import styles from './KeyboardShortcutsOverlay.module.scss';

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
  context?: string; // Optional context where shortcut applies
}

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

const KeyboardShortcutsOverlay: React.FC<KeyboardShortcutsOverlayProps> = ({
  isOpen,
  onClose,
  shortcuts
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter shortcuts based on search and category
  const filteredShortcuts = useMemo(() => {
    let filtered = shortcuts;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.description.toLowerCase().includes(query) ||
        s.keys.some(k => k.toLowerCase().includes(query)) ||
        s.category.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [shortcuts, searchQuery, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(shortcuts.map(s => s.category))).sort();
  }, [shortcuts]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Escape': 'Esc',
      'Enter': '↵',
      'Backspace': '⌫',
      'Delete': '⌦',
      'Tab': '⇥',
      'Shift': '⇧',
      'Control': 'Ctrl',
      'Alt': 'Alt',
      'Meta': '⌘'
    };
    return keyMap[key] || key;
  };

  const renderKey = (key: string) => {
    return (
      <kbd key={key} className={styles.key}>
        {formatKey(key)}
      </kbd>
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            ×
          </button>
        </div>

        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            autoFocus
          />
        </div>

        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${selectedCategory === null ? styles.active : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              className={`${styles.filterButton} ${selectedCategory === category ? styles.active : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className={styles.shortcutsList}>
          {filteredShortcuts.length === 0 ? (
            <div className={styles.emptyState}>
              No shortcuts found matching your search.
            </div>
          ) : (
            Object.entries(
              filteredShortcuts.reduce((acc, shortcut) => {
                if (!acc[shortcut.category]) {
                  acc[shortcut.category] = [];
                }
                acc[shortcut.category].push(shortcut);
                return acc;
              }, {} as Record<string, KeyboardShortcut[]>)
            ).map(([category, categoryShortcuts]) => (
              <div key={category} className={styles.categorySection}>
                <h3 className={styles.categoryTitle}>{category}</h3>
                {categoryShortcuts.map(shortcut => (
                  <div key={shortcut.id} className={styles.shortcutItem}>
                    <div className={styles.shortcutKeys}>
                      {shortcut.keys.map((key, index) => (
                        <React.Fragment key={index}>
                          {renderKey(key)}
                          {index < shortcut.keys.length - 1 && (
                            <span className={styles.keySeparator}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className={styles.shortcutDescription}>
                      {shortcut.description}
                      {shortcut.context && (
                        <span className={styles.context}> ({shortcut.context})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <p>Press <kbd>Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsOverlay;

