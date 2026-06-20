export const SCENE_TRANSITION_COMPLETE_EVENT = 'sceneTransitionComplete';

export function isClientSceneTransitionActive(state: { isTransitioning: boolean }): boolean {
  return state.isTransitioning;
}

export function dispatchSceneTransitionComplete(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SCENE_TRANSITION_COMPLETE_EVENT));
}

export function sceneTimelineStartDelayMs(transitionDuration: number): number {
  if (transitionDuration <= 0) return 100;
  return transitionDuration + 50;
}

type ModularAutomationModule = 'color' | 'dimmer' | 'panTilt' | 'effects';

export function disableModularAutomationFlags<
  T extends {
    color: { enabled: boolean };
    dimmer: { enabled: boolean };
    panTilt: { enabled: boolean };
    effects: { enabled: boolean };
  },
>(modularAutomation: T): T {
  return {
    ...modularAutomation,
    color: { ...modularAutomation.color, enabled: false },
    dimmer: { ...modularAutomation.dimmer, enabled: false },
    panTilt: { ...modularAutomation.panTilt, enabled: false },
    effects: { ...modularAutomation.effects, enabled: false },
  };
}

export function modularAutomationModulesToStart(
  modularAutomation: {
    color: { enabled: boolean };
    dimmer: { enabled: boolean };
    panTilt: { enabled: boolean };
    effects: { enabled: boolean };
  }
): ModularAutomationModule[] {
  return (['color', 'dimmer', 'panTilt', 'effects'] as const).filter(
    (type) => modularAutomation[type].enabled
  );
}
