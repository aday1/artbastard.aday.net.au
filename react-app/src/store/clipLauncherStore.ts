import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Scene } from './store';

export interface ClipLauncherState {
  gridSize: { rows: number; columns: number };
  clips: ClipCell[][]; // 2D array of clips [row][column]
  playingClips: Set<string>; // Clip IDs that are currently playing
  queuedClips: Set<string>; // Clip IDs queued to play next
  recordingClip: string | null; // Clip ID currently being recorded
}

export interface ClipCell {
  id: string;
  sceneName: string | null; // null if empty slot
  scene: Scene | null;
  loop: boolean;
  followAction: 'stop' | 'next' | 'loop' | 'random';
  color: string;
  row: number;
  column: number;
}

interface ClipLauncherActions {
  setGridSize: (size: { rows: number; columns: number }) => void;
  setClip: (row: number, column: number, clip: Partial<ClipCell>) => void;
  clearClip: (row: number, column: number) => void;
  launchClip: (row: number, column: number) => void;
  stopClip: (row: number, column: number) => void;
  stopAllClips: () => void;
  toggleLoop: (row: number, column: number) => void;
  setFollowAction: (row: number, column: number, action: ClipCell['followAction']) => void;
  setRecordingClip: (clipId: string | null) => void;
  queueClip: (row: number, column: number) => void;
  clearQueue: () => void;
}

const createEmptyClip = (row: number, column: number): ClipCell => ({
  id: `clip-${row}-${column}`,
  sceneName: null,
  scene: null,
  loop: false,
  followAction: 'stop',
  color: '#64748b',
  row,
  column
});

const initialState: ClipLauncherState = {
  gridSize: { rows: 4, columns: 4 },
  clips: [],
  playingClips: new Set(),
  queuedClips: new Set(),
  recordingClip: null
};

export const useClipLauncherStore = create<ClipLauncherState & ClipLauncherActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setGridSize: (size) => {
        const { rows, columns } = size;
        const currentClips = get().clips;
        const newClips: ClipCell[][] = [];

        // Initialize grid
        for (let r = 0; r < rows; r++) {
          newClips[r] = [];
          for (let c = 0; c < columns; c++) {
            if (currentClips[r]?.[c]) {
              newClips[r][c] = currentClips[r][c];
            } else {
              newClips[r][c] = createEmptyClip(r, c);
            }
          }
        }

        set({ gridSize: size, clips: newClips });
      },

      setClip: (row, column, clipData) => {
        const clips = [...get().clips];
        if (!clips[row]) clips[row] = [];
        
        clips[row][column] = {
          ...clips[row][column] || createEmptyClip(row, column),
          ...clipData
        };

        set({ clips });
      },

      clearClip: (row, column) => {
        const clips = [...get().clips];
        if (clips[row]?.[column]) {
          clips[row][column] = createEmptyClip(row, column);
          set({ clips });
        }
      },

      launchClip: (row, column) => {
        const clips = get().clips;
        const clip = clips[row]?.[column];
        if (!clip || !clip.scene) return;

        const playingClips = new Set(get().playingClips);
        
        if (playingClips.has(clip.id)) {
          // Stop if already playing
          playingClips.delete(clip.id);
        } else {
          // Start playing
          playingClips.add(clip.id);
        }

        set({ playingClips });
      },

      stopClip: (row, column) => {
        const clips = get().clips;
        const clip = clips[row]?.[column];
        if (!clip) return;

        const playingClips = new Set(get().playingClips);
        playingClips.delete(clip.id);
        set({ playingClips });
      },

      stopAllClips: () => {
        set({ playingClips: new Set(), queuedClips: new Set() });
      },

      toggleLoop: (row, column) => {
        const clips = [...get().clips];
        if (clips[row]?.[column]) {
          clips[row][column].loop = !clips[row][column].loop;
          set({ clips });
        }
      },

      setFollowAction: (row, column, action) => {
        const clips = [...get().clips];
        if (clips[row]?.[column]) {
          clips[row][column].followAction = action;
          set({ clips });
        }
      },

      setRecordingClip: (clipId) => {
        set({ recordingClip: clipId });
      },

      queueClip: (row, column) => {
        const clips = get().clips;
        const clip = clips[row]?.[column];
        if (!clip || !clip.scene) return;

        const queuedClips = new Set(get().queuedClips);
        queuedClips.add(clip.id);
        set({ queuedClips });
      },

      clearQueue: () => {
        set({ queuedClips: new Set() });
      }
    }),
    { name: 'ClipLauncherStore' }
  )
);

