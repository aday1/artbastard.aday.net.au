import React from 'react';
import styles from './RemasterPanel.module.scss';

export interface RemasterPanelProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}

export const RemasterPanel: React.FC<RemasterPanelProps> = ({
  title,
  actions,
  children,
  className = '',
  accent = true,
}) => (
  <section className={`${styles.panel} ${accent ? styles.accent : ''} ${className}`}>
    <header className={styles.header}>
      <div className={styles.title}>{title}</div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
    <div className={styles.body}>{children}</div>
  </section>
);
