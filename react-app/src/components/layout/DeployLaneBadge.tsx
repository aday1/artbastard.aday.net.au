import React, { useEffect, useState } from 'react';
import styles from './DeployLaneBadge.module.scss';

type DeployLane = 'live' | 'dev' | 'beta' | 'aday';
export type DeployLanePlacement = 'corner' | 'topbar' | 'inline';

function readLane(): { lane: DeployLane; label: string } {
  const w = window as Window & { __deployLane?: string; __deployLaneLabel?: string };
  const lane = String(w.__deployLane || 'live').toLowerCase();
  const isBetaHost =
    typeof window !== 'undefined' &&
    /^(macroverse|artbastard)-beta\.aday\.net\.au$/.test(
      window.location.hostname.toLowerCase()
    );
  const k: DeployLane =
    isBetaHost ? 'beta' : lane === 'dev' ? 'dev' : lane === 'aday' ? 'aday' : 'live';
  const label =
    w.__deployLaneLabel ||
    (k === 'beta' ? 'BETA' : k === 'dev' ? 'DEV' : k === 'aday' ? 'ADAY' : 'LIVE');
  return { lane: k, label };
}

/** Remove legacy duplicate nodes from older builds (static HTML + React). */
function pruneLegacyLaneBadges(keep: HTMLElement | null) {
  const legacyIds = ['appTitleDeployLaneMobile'];
  for (const id of legacyIds) {
    document.querySelectorAll(`#${id}`).forEach((el) => el.remove());
  }
  const primaryId = 'appDeployLaneBadge';
  const nodes = Array.from(document.querySelectorAll(`#${primaryId}`));
  if (nodes.length <= 1) return;
  for (const el of nodes) {
    if (keep && el === keep) continue;
    el.remove();
  }
}

interface DeployLaneBadgeProps {
  placement?: DeployLanePlacement;
  className?: string;
}

export const DeployLaneBadge: React.FC<DeployLaneBadgeProps> = ({
  placement = 'corner',
  className = '',
}) => {
  const [{ lane, label }, setLaneState] = useState(readLane);
  const rootRef = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sync = () => setLaneState(readLane());
    sync();
    window.addEventListener('deploy-lane-updated', sync);
    const id = window.setInterval(sync, 4000);
    return () => {
      window.removeEventListener('deploy-lane-updated', sync);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    pruneLegacyLaneBadges(rootRef.current);
  }, [placement]);

  const ghcrTrack = lane === 'beta' ? 'dev' : lane;
  const title = `Deploy track: ${label} (GHCR :${ghcrTrack} on Linode)`;

  if (placement === 'inline') {
    return (
      <span
        id="appTitleDeployLane"
        className={`deploy-lane-inline ${styles.inline} ${className}`}
        data-lane={lane}
        title={title}
      >
        {label}
      </span>
    );
  }

  const placementClass =
    placement === 'topbar' ? styles.topbar : styles.corner;

  return (
    <span
      ref={rootRef}
      id="appDeployLaneBadge"
      className={`${placementClass} ${className}`.trim()}
      data-lane={lane}
      title={title}
    >
      {label}
    </span>
  );
};
