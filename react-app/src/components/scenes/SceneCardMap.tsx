import React, { useEffect, useRef, useState } from 'react';
import { StageMapDashboard } from '../fixtures/StageMapDashboard';
import styles from './SceneCardMap.module.scss';

interface SceneCardMapProps {
  sceneName: string;
  channelValues: number[];
  activeChannelCount: number;
}

/**
 * Per-scene-card mini stage map. Mounts the dashboard only when the card
 * scrolls into view to avoid eager-rendering N dashboards in a long scene grid.
 */
export const SceneCardMap: React.FC<SceneCardMapProps> = ({
  sceneName,
  channelValues,
  activeChannelCount,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = wrapperRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={wrapperRef} className={styles.sceneMap}>
      {visible ? (
        <StageMapDashboard
          title={sceneName}
          subtitle={`${activeChannelCount} channels lit · scene snapshot`}
          showGroupPicker={false}
          maxGroupChips={0}
          dmxOverride={channelValues}
        />
      ) : (
        <div className={styles.placeholder} aria-hidden="true" />
      )}
    </div>
  );
};

export default SceneCardMap;
