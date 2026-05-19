import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Sparkles.module.scss';
import { useStore } from '../../store';

interface Sparkle {
  id: string;
  x: number;
  y: number;
  key: number; // Used to force re-render and re-trigger animation
}

const SPARKLE_LIFESPAN = 1500; // ms, updated to match animation duration

export const Sparkles: React.FC = () => {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const dmxChannels = useStore(state => state.dmxChannels);
  const uiSettings = useStore(state => state.uiSettings);
  const lastDmxActivityTimeRef = useRef<number>(0);
  const prevDmxChannelsRef = useRef<number[]>(dmxChannels);

  // Adjust sparkle limits based on visual effects level
  const getMaxSparkles = useCallback(() => {
    switch (uiSettings?.dmxVisualEffects) {
      case 'low': return 10;
      case 'medium': return 25;
      case 'high': return 50;
      default: return 25;
    }
  }, [uiSettings?.dmxVisualEffects]);

  const getCooldown = useCallback(() => {
    switch (uiSettings?.dmxVisualEffects) {
      case 'low': return 200; // Less frequent
      case 'medium': return 50;
      case 'high': return 20; // More frequent
      default: return 50;
    }
  }, [uiSettings?.dmxVisualEffects]);

  const addSparkle = useCallback(() => {
    setSparkles(currentSparkles => {
      const now = Date.now();
      const maxSparkles = getMaxSparkles();
      // Remove oldest sparkles if limit is reached
      const filteredSparkles = currentSparkles.length >= maxSparkles 
        ? currentSparkles.slice(currentSparkles.length - maxSparkles + 1) 
        : currentSparkles;

      const newSparkle: Sparkle = {
        id: `sparkle-${now}-${Math.random()}`,
        x: Math.random() * 100, // percentage
        y: Math.random() * 100, // percentage
        key: Math.random(), // Force re-render for animation
      };
      return [...filteredSparkles, newSparkle];
    });
  }, [getMaxSparkles]);

  useEffect(() => {
    // Early return if sparkles are disabled or visual effects are off
    if (!uiSettings?.sparklesEnabled || uiSettings?.dmxVisualEffects === 'off') {
      return;
    }

    // Effect to add sparkle on DMX channel change
    const dmxChanged = prevDmxChannelsRef.current.some((val, i) => val !== dmxChannels[i]);

    if (dmxChanged) {
      const now = Date.now();
      const cooldown = getCooldown();
      if (now - lastDmxActivityTimeRef.current > cooldown) {
        addSparkle();
        if (uiSettings?.dmxVisualEffects === 'high') {
          console.log('DMX activity detected - sparkle triggered!');
        }
        lastDmxActivityTimeRef.current = now;
      }
    }
    prevDmxChannelsRef.current = [...dmxChannels]; // Store current DMX state for next comparison
  }, [dmxChannels, addSparkle, getCooldown, uiSettings?.sparklesEnabled, uiSettings?.dmxVisualEffects]);


  useEffect(() => {
    // Periodically remove old sparkles based on their creation time (embedded in id)
    const intervalId = setInterval(() => {
      const now = Date.now();
      setSparkles(currentSparkles =>
        currentSparkles.filter(
          s => now - parseInt(s.id.split('-')[1]) < SPARKLE_LIFESPAN
        )
      );
    }, SPARKLE_LIFESPAN / 2); // Check more frequently than lifespan

    return () => clearInterval(intervalId);
  }, []);

  // Early return if sparkles are disabled or visual effects are off
  if (!uiSettings?.sparklesEnabled || uiSettings?.dmxVisualEffects === 'off') {
    return null;
  }

  return (
    <div className={styles.sparkleContainer}>
      {sparkles.map(sparkle => (
        <div
          key={sparkle.key}
          className={styles.sparkle}
          style={{
            top: `${sparkle.y}%`,
            left: `${sparkle.x}%`,
          }}
        />
      ))}
    </div>
  );
};
