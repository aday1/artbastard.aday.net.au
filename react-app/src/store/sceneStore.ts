import { create } from 'zustand';

// Placeholder for Scene store
// Will be populated based on usage in other files.

import { Scene } from '../types/dmxTypes'; // Assuming Scene type is defined here

interface SceneState {
  scenes: Scene[];
  activeScene: string | null;
  // Define other state properties here
  setScenes: (scenes: Scene[]) => void;
  setActiveScene: (sceneId: string | null) => void;
}

export const useSceneStore = create<SceneState>()((set) => ({
  // Initial state
  scenes: [],
  activeScene: null,
  setScenes: (scenes) => set(state => ({ ...state, scenes })),
  setActiveScene: (sceneId) => set(state => ({ ...state, activeScene: sceneId })),
}));

// Export other Scene related store logic if needed
