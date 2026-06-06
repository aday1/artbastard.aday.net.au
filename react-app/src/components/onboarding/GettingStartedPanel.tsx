import React, { useEffect, useState } from 'react';
import { useRouter, ViewType } from '../../context/RouterContext';
import styles from './GettingStartedPanel.module.scss';

export const ONBOARDING_DISMISSED_KEY = 'artbastard-onboarding-dismissed';

export const GettingStartedPanel: React.FC = () => {
  const { setCurrentView } = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1';
      const explicitRoute = window.location.hash && window.location.hash !== '#/';
      setVisible(!dismissed && !explicitRoute);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const openView = (view: ViewType) => {
    setCurrentView(view);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="getting-started-title">
      <div className={styles.panel}>
        <h2 id="getting-started-title" className={styles.title}>
          Welcome to ArtBastard
        </h2>
        <p className={styles.lead}>
          A short path to your first show. You can reopen full help anytime with Ctrl+H.
        </p>
        <ol className={styles.steps}>
          <li>
            <strong>Fixtures:</strong> open Fixture Setup, add fixtures, and patch DMX addresses.
          </li>
          <li>
            <strong>Levels:</strong> use Super Control for fixtures (color, pan/tilt, gobos) or DMX Control for raw channels.
          </li>
          <li>
            <strong>Scenes:</strong> capture looks on the Scenes page; use the clock icon on a scene for timeline fades.
          </li>
          <li>
            <strong>Channel LFOs:</strong> cyclic envelopes live under DMX Control (not the scene timeline editor).
          </li>
          <li>
            <strong>Phone or tablet:</strong> Touch Surface uses the same Super Control and DMX pages with larger touch targets.
          </li>
        </ol>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => openView('fixture')}>
            Build & Patch Fixtures
          </button>
          <button type="button" className={styles.secondary} onClick={() => openView('dmxControl')}>
            Open DMX Control
          </button>
          <button type="button" className={styles.secondary} onClick={() => openView('scenesActs')}>
            Open Scenes
          </button>
          <button type="button" className={styles.secondary} onClick={dismiss}>
            Just Open App
          </button>
        </div>
      </div>
    </div>
  );
};

export default GettingStartedPanel;
