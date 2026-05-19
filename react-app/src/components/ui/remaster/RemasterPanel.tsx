import React from 'react';
import { RackModule } from '../rack/RackModule';
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
  <RackModule
    title={title}
    actions={actions}
    className={`${styles.rackWrap} ${accent ? styles.accent : ''} ${className}`.trim()}
    bodyClassName={styles.bodyInner}
  >
    {children}
  </RackModule>
);
