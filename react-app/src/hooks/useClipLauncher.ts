import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useClipLauncherStore } from '../store/clipLauncherStore';

export function useClipLauncher() {
  const { loadScene } = useStore();
  const { playingClips, clips, stopAllClips } = useClipLauncherStore();
  const playbackRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Handle clip playback
  useEffect(() => {
    // Stop all existing playback
    playbackRefs.current.forEach(timeout => clearInterval(timeout));
    playbackRefs.current.clear();

    // Start playback for each playing clip
    playingClips.forEach(clipId => {
      const clip = clips.flat().find(c => c.id === clipId);
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

          playbackRefs.current.set(clipId, interval);
        }
      }

      // Handle follow actions
      if (!clip.loop && clip.followAction !== 'stop') {
        // This would be handled when the clip ends
        // For now, we'll just stop after duration
        if (clip.scene.timeline) {
          const duration = clip.scene.timeline.duration;
          setTimeout(() => {
            // Handle follow action
            if (clip.followAction === 'next') {
              // Find next clip in row and play it
              // This would need more logic to determine "next"
            }
            stopAllClips();
          }, duration);
        }
      }
    });

    return () => {
      playbackRefs.current.forEach(timeout => clearInterval(timeout));
      playbackRefs.current.clear();
    };
  }, [playingClips, clips, loadScene, stopAllClips]);

  return {
    // Expose any needed functions
  };
}

