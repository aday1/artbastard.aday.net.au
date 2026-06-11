export interface ActTriggerStore {
  actPlaybackState: {
    isPlaying: boolean;
    currentActId?: string | null;
  };
  playAct: (actId: string) => void;
  pauseAct: () => void;
  stopAct: () => void;
  nextActStep: () => void;
  previousActStep: () => void;
}

export const handleActTriggerAction = (
  store: ActTriggerStore,
  actId: string,
  action: string
): boolean => {
  switch (action) {
    case 'play':
      store.playAct(actId);
      return true;
    case 'pause':
      store.pauseAct();
      return true;
    case 'stop':
      store.stopAct();
      return true;
    case 'toggle':
      if (store.actPlaybackState.isPlaying && store.actPlaybackState.currentActId === actId) {
        store.pauseAct();
      } else {
        store.playAct(actId);
      }
      return true;
    case 'next':
      if (store.actPlaybackState.currentActId !== actId) {
        store.playAct(actId);
      }
      store.nextActStep();
      return true;
    case 'previous':
      if (store.actPlaybackState.currentActId !== actId) {
        store.playAct(actId);
      }
      store.previousActStep();
      return true;
    default:
      return false;
  }
};
