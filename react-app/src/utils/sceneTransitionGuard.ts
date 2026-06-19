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
