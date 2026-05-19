import React from 'react';
import styles from './SiteBrandingLink.module.scss';

const SITE_URL = 'https://aday.net.au/';

export interface SiteBrandingLinkProps {
  brand: 'artbastard' | 'macroverse';
  className?: string;
  children?: React.ReactNode;
}

export const SiteBrandingLink: React.FC<SiteBrandingLinkProps> = ({
  brand,
  className = '',
  children,
}) => {
  const label = children ?? (brand === 'macroverse' ? 'Macroverse' : 'ArtBastard');

  return (
    <a
      href={SITE_URL}
      className={[styles.link, className].filter(Boolean).join(' ')}
      target="_blank"
      rel="noopener noreferrer"
      title="aday.net.au"
    >
      {label}
    </a>
  );
};
