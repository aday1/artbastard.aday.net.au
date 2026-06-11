import { useCallback } from 'react';
import { useStore } from '../store';
import { captureChannelValues, sceneNameToOscPath } from '../utils/sceneCapture';

export interface CaptureSceneOptions {
  name?: string;
  oscAddress?: string;
  /** When false, prompts before overwriting an existing scene name. Default: prompt. */
  allowOverwrite?: boolean;
  notify?: boolean;
}

export function useSceneCapture() {
  const scenes = useStore((state) => state.scenes);
  const saveScene = useStore((state) => state.saveScene);
  const addNotification = useStore((state) => state.addNotification);
  const getDmxChannelValue = useStore((state) => state.getDmxChannelValue);

  const captureScene = useCallback(
    (options: CaptureSceneOptions = {}) => {
      const name = options.name?.trim() || `Scene ${scenes.length + 1}`;
      const existing = scenes.find((scene) => scene.name === name);

      if (existing && options.allowOverwrite !== true) {
        const ok = window.confirm(`Scene "${name}" already exists. Overwrite it?`);
        if (!ok) return null;
      }

      const oscAddress = options.oscAddress ?? sceneNameToOscPath(name);
      saveScene(name, oscAddress);

      const channelValues = captureChannelValues(getDmxChannelValue, 512);

      if (options.notify !== false) {
        addNotification({
          message: `Scene "${name}" saved`,
          type: 'success',
        });
      }

      return { name, oscAddress, channelValues };
    },
    [scenes, saveScene, addNotification, getDmxChannelValue]
  );

  const quickCapture = useCallback(() => {
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    return captureScene({
      name: `Quick_${stamp}`,
      allowOverwrite: true,
      notify: true,
    });
  }, [captureScene]);

  return { captureScene, quickCapture, sceneNameToOscPath };
}
