import React from 'react';
import { getFixtureIdentity, type FixturePresentationInput } from '../../utils/fixturePresentation';
import { HoverZoomImage } from '../ui/HoverZoomImage';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './FixtureIdentityVisual.module.scss';

type FixtureIdentityVariant = 'library' | 'palette' | 'node' | 'mini';

interface FixtureIdentityVisualProps {
  fixture: FixturePresentationInput;
  variant?: FixtureIdentityVariant;
  className?: string;
  zoom?: boolean;
  zoomSize?: number;
  showCatalog?: boolean;
  showTypeBadge?: boolean;
}

const iconSizes: Record<FixtureIdentityVariant, number> = {
  library: 48,
  palette: 24,
  node: 30,
  mini: 12,
};

const badgeSizes: Record<FixtureIdentityVariant, number> = {
  library: 14,
  palette: 12,
  node: 12,
  mini: 9,
};

export const FixtureIdentityVisual: React.FC<FixtureIdentityVisualProps> = ({
  fixture,
  variant = 'library',
  className,
  zoom = false,
  zoomSize = 280,
  showCatalog = variant === 'library' || variant === 'palette',
  showTypeBadge = true,
}) => {
  const identity = getFixtureIdentity(fixture);
  const classNames = [styles.visual, styles[variant], className].filter(Boolean).join(' ');
  const style = { ['--fixture-accent' as any]: identity.accentColor } as React.CSSProperties;

  return (
    <span className={classNames} style={style} title={identity.title} aria-label={identity.title}>
      {identity.photoUrl ? (
        zoom ? (
          <HoverZoomImage
            src={identity.photoUrl}
            alt={identity.label}
            className={styles.photoZoom}
            imgClassName={styles.photo}
            zoomSize={zoomSize}
          />
        ) : (
          <img className={styles.photo} src={identity.photoUrl} alt="" loading="lazy" decoding="async" draggable={false} />
        )
      ) : (
        <span className={styles.fallback}>
          <LucideIcon name={identity.iconName as any} size={iconSizes[variant]} />
          <span className={styles.initials}>{identity.shortCode}</span>
        </span>
      )}

      {showCatalog && identity.catalogId && (
        <span className={styles.catalogBadge}>{identity.catalogId}</span>
      )}
      {showTypeBadge && (
        <span className={styles.typeBadge}>
          <LucideIcon name={identity.iconName as any} size={badgeSizes[variant]} />
        </span>
      )}
    </span>
  );
};

export default FixtureIdentityVisual;
