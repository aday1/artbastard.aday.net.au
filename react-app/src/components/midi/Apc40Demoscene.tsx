import React, { useCallback, useEffect, useState } from 'react';
import {
  DEMO_PATTERNS,
  DemoPatternId,
  isApc40DemoRunning,
  startApc40Demo,
  stopApc40Demo,
} from '../../engines/apc40Demoscene';
import styles from './Apc40Demoscene.module.scss';

/**
 * Easter-egg demoscene tester for the APC40. Lives near the hardware-surface
 * card in the MIDI/OSC setup so a curious user pokes "Test" and the grid
 * comes alive.
 */
export const Apc40Demoscene: React.FC = () => {
  const [active, setActive] = useState<DemoPatternId | null>(null);

  // If something else stops the demo (eg. page navigated away), keep UI sync.
  useEffect(() => {
    const handle = window.setInterval(() => {
      if (!isApc40DemoRunning() && active != null) setActive(null);
    }, 500);
    return () => window.clearInterval(handle);
  }, [active]);

  // Make damn sure the demo isn't left running when this component unmounts.
  useEffect(() => () => stopApc40Demo(), []);

  const startPattern = useCallback(async (id: DemoPatternId) => {
    setActive(id);
    const ok = await startApc40Demo({
      patternId: id,
      onStop: () => setActive(null),
    });
    if (!ok) setActive(null);
  }, []);

  const handleStop = useCallback(() => {
    stopApc40Demo();
    setActive(null);
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <span className={styles.sparkle}>✦</span>
          APC40 Demoscene · Test
        </span>
        <span className={`${styles.status} ${active ? styles.live : ''}`}>
          {active ? `running · ${active}` : 'idle'}
        </span>
      </div>

      <div className={styles.subtitle}>
        Tiny LED animations on the 5×8 clip grid. Pure easter egg — hit Stop and
        normal feedback resumes.
      </div>

      <div className={styles.patterns}>
        {DEMO_PATTERNS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={active === p.id ? styles.active : ''}
            onClick={() => startPattern(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.danger}
          onClick={handleStop}
          disabled={!active}
        >
          Stop
        </button>
      </div>

      <div className={styles.note}>
        Requires an APC40 plugged in and the browser MIDI permission granted.
        While a demo is running, the regular APC40 LED feedback is overridden;
        stopping the demo restores normal lighting on the next state change.
      </div>
    </div>
  );
};

export default Apc40Demoscene;
