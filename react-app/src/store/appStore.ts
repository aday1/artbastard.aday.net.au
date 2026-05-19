import { create } from 'zustand';

interface AppState {
  isLiveMode: boolean;
  setIsLiveMode: (isLive: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isLiveMode: false,
  setIsLiveMode: (isLive) => set(state => ({ ...state, isLiveMode: isLive })),
}));
