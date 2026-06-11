import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useClipLauncherStore } from '../store/clipLauncherStore';

export const findNextClipInRow = (rowClips: any[], currentColumn: number) => {
  if (rowClips.length === 0) return null;
  for (let offset = 1; offset <= rowClips.length; offset++) {
    const nextColumn = (currentColumn + offset) % rowClips.length;
    const candidate = rowClips[nextColumn];
    if (candidate?.scene) {
      return candidate;
    }
  }
  return null;
};

export const findRandomClipInRow = (rowClips: any[], currentClipId: string) => {
  const candidates = rowClips.filter((clip) => clip?.scene && clip.id !== currentClipId);
  if (candidates.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
};

export function useClipLauncher() {
  const { loadScene } = useStore();
  const { playingClips, clips } = useClipLauncherStore();
  const loopRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const followRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Handle clip playback
  useEffect(() => {
    // Stop all existing playback
    loopRefs.current.forEach((timer) => clearInterval(timer));
    loopRefs.current.clear();
    followRefs.current.forEach((timer) => clearTimeout(timer));
    followRefs.current.clear();

    // Start playback for each playing clip
    playingClips.forEach((clipId) => {
      const clip = clips.flat().find((c) => c.id === clipId);
      if (!clip || !clip.scene) return;

      // Load the scene
      loadScene(clip.scene.name);

      // If scene has a timeline, handle timeline playback
      if (clip.scene.timeline?.enabled) {
        // Dispatch event to start timeline playback
        window.dispatchEvent(new CustomEvent('startSceneTimeline', {
          detail: { sceneName: clip.scene.name }
        }));

        // Handle looping
        if (clip.loop && clip.scene.timeline) {
          const duration = clip.scene.timeline.duration;
          const interval = setInterval(() => {
            // Timeline will loop automatically if configured
            window.dispatchEvent(new CustomEvent('restartSceneTimeline', {
              detail: { sceneName: clip.scene!.name }
            }));
          }, duration);

          loopRefs.current.set(clipId, interval);
        }
      }

      // Handle follow actions
      if (!clip.loop && clip.followAction !== 'stop') {
        if (clip.scene.timeline?.duration) {
          const duration = clip.scene.timeline.duration;
          const timeout = setTimeout(() => {
            const state = useClipLauncherStore.getState();
            if (!state.playingClips.has(clip.id)) return;

            state.stopClip(clip.row, clip.column);
            const rowClips = state.clips[clip.row] || [];

            if (clip.followAction === 'loop') {
              state.launchClip(clip.row, clip.column);
              return;
            }

            if (clip.followAction === 'next') {
              const nextClip = findNextClipInRow(rowClips, clip.column);
              if (nextClip) {
                state.launchClip(nextClip.row, nextClip.column);
              }
              return;
            }

            if (clip.followAction === 'random') {
              const randomClip = findRandomClipInRow(rowClips, clip.id);
              if (randomClip) {
                state.launchClip(randomClip.row, randomClip.column);
              }
            }
          }, duration);
          followRefs.current.set(clipId, timeout);
        }
      }
    });

    return () => {
      loopRefs.current.forEach((timer) => clearInterval(timer));
      loopRefs.current.clear();
      followRefs.current.forEach((timer) => clearTimeout(timer));
      followRefs.current.clear();
    };
  }, [playingClips, clips, loadScene]);

  return {
    // Expose any needed functions
  };
}

