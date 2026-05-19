/**
 * Preset Management System
 * Handles preset library with categories, quick recall, preview thumbnails, import/export
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PresetThumbnail {
  type: 'image' | 'color' | 'gradient';
  data: string; // Base64 image, hex color, or gradient definition
}

export interface Preset {
  id: string;
  name: string;
  description?: string;
  category: string;
  thumbnail?: PresetThumbnail;
  dmxValues: Record<number, number>; // Channel -> Value mapping
  fixtureStates?: Record<string, any>; // Fixture-specific states
  sceneName?: string; // Optional link to scene
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
}

export interface PresetCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  order: number;
}

interface PresetState {
  presets: Preset[];
  categories: PresetCategory[];
  selectedCategory: string | null;
  searchQuery: string;
  
  // Actions
  addPreset: (preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  getPreset: (id: string) => Preset | undefined;
  getPresetsByCategory: (category: string) => Preset[];
  searchPresets: (query: string) => Preset[];
  
  addCategory: (category: Omit<PresetCategory, 'id'>) => string;
  updateCategory: (id: string, updates: Partial<PresetCategory>) => void;
  deleteCategory: (id: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;
  
  toggleFavorite: (id: string) => void;
  getFavorites: () => Preset[];
  
  exportPresets: () => string;
  importPresets: (json: string) => void;
  exportCategory: (categoryId: string) => string;
}

const defaultCategories: PresetCategory[] = [
  { id: 'all', name: 'All Presets', color: '#3b82f6', order: 0 },
  { id: 'favorites', name: 'Favorites', color: '#f59e0b', order: 1 },
  { id: 'scenes', name: 'Scenes', color: '#8b5cf6', order: 2 },
  { id: 'colors', name: 'Colors', color: '#ef4444', order: 3 },
  { id: 'positions', name: 'Positions', color: '#10b981', order: 4 },
  { id: 'effects', name: 'Effects', color: '#ec4899', order: 5 },
  { id: 'custom', name: 'Custom', color: '#6b7280', order: 6 }
];

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [],
      categories: defaultCategories,
      selectedCategory: null,
      searchQuery: '',

      addPreset: (presetData) => {
        const id = `preset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const preset: Preset = {
          ...presetData,
          id,
          createdAt: now,
          updatedAt: now,
          tags: presetData.tags || [],
          isFavorite: presetData.isFavorite || false
        };

        set(state => ({
          presets: [...state.presets, preset]
        }));

        return id;
      },

      updatePreset: (id, updates) => {
        set(state => ({
          presets: state.presets.map(preset =>
            preset.id === id
              ? { ...preset, ...updates, updatedAt: Date.now() }
              : preset
          )
        }));
      },

      deletePreset: (id) => {
        set(state => ({
          presets: state.presets.filter(preset => preset.id !== id)
        }));
      },

      getPreset: (id) => {
        return get().presets.find(preset => preset.id === id);
      },

      getPresetsByCategory: (category) => {
        if (category === 'all') {
          return get().presets;
        }
        if (category === 'favorites') {
          return get().presets.filter(p => p.isFavorite);
        }
        return get().presets.filter(preset => preset.category === category);
      },

      searchPresets: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().presets.filter(preset =>
          preset.name.toLowerCase().includes(lowerQuery) ||
          preset.description?.toLowerCase().includes(lowerQuery) ||
          preset.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
      },

      addCategory: (categoryData) => {
        const id = `category-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const category: PresetCategory = {
          ...categoryData,
          id
        };

        set(state => ({
          categories: [...state.categories, category].sort((a, b) => a.order - b.order)
        }));

        return id;
      },

      updateCategory: (id, updates) => {
        set(state => ({
          categories: state.categories.map(cat =>
            cat.id === id ? { ...cat, ...updates } : cat
          ).sort((a, b) => a.order - b.order)
        }));
      },

      deleteCategory: (id) => {
        // Don't allow deleting default categories
        if (['all', 'favorites'].includes(id)) {
          return;
        }

        set(state => {
          // Move presets from deleted category to 'custom'
          const updatedPresets = state.presets.map(preset =>
            preset.category === id ? { ...preset, category: 'custom' } : preset
          );

          return {
            categories: state.categories.filter(cat => cat.id !== id),
            presets: updatedPresets
          };
        });
      },

      setSelectedCategory: (categoryId) => {
        set({ selectedCategory: categoryId });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      toggleFavorite: (id) => {
        set(state => ({
          presets: state.presets.map(preset =>
            preset.id === id
              ? { ...preset, isFavorite: !preset.isFavorite, updatedAt: Date.now() }
              : preset
          )
        }));
      },

      getFavorites: () => {
        return get().presets.filter(preset => preset.isFavorite);
      },

      exportPresets: () => {
        const { presets, categories } = get();
        return JSON.stringify({ presets, categories }, null, 2);
      },

      importPresets: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            presets: data.presets || [],
            categories: data.categories || defaultCategories
          });
        } catch (error) {
          console.error('Failed to import presets:', error);
          throw new Error('Invalid preset file format');
        }
      },

      exportCategory: (categoryId) => {
        const presets = get().getPresetsByCategory(categoryId);
        const category = get().categories.find(cat => cat.id === categoryId);
        return JSON.stringify({ category, presets }, null, 2);
      }
    }),
    {
      name: 'artbastard-presets',
      partialize: (state) => ({
        presets: state.presets,
        categories: state.categories
      })
    }
  )
);

