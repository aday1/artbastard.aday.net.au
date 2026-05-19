import React, { useEffect, useState } from 'react';
import styles from './FactoryResetBanner.module.scss';

export const FactoryResetBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    // Check for factory reset marker
    const checkFactoryReset = async () => {
      try {
        const response = await fetch('/api/factory-reset-check', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.factoryReset) {
            setShowBanner(true);
            
            // Calculate time remaining based on timestamp
            const markerTimestamp = data.timestamp || 0;
            const now = Math.floor(Date.now() / 1000);
            const elapsed = now - markerTimestamp;
            const remaining = Math.max(0, 60 - elapsed);
            setTimeRemaining(remaining);
            
            // Hide banner after remaining time
            if (remaining > 0) {
              timer = setInterval(() => {
                setTimeRemaining((prev) => {
                  if (prev <= 1) {
                    setShowBanner(false);
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            } else {
              setShowBanner(false);
            }
          }
        }
      } catch (error) {
        console.error('Error checking factory reset:', error);
      }
    };

    checkFactoryReset();
    
    // Cleanup timer on unmount
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  if (!showBanner) {
    return null;
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.icon}>🔄</span>
        <span className={styles.message}>
          Factory Reset Complete! All settings have been restored to defaults.
        </span>
        {timeRemaining > 0 && (
          <span className={styles.timer}>
            (Banner disappears in {timeRemaining}s)
          </span>
        )}
      </div>
    </div>
  );
};

