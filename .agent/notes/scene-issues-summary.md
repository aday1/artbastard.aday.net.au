# Scene Management Issues - Summary & Action Plan

## Issues Identified

### 1. SceneGallery - Missing Inline Editor ⚠️
**Status:** In Progress
**Problem:** The Scenes & Acts page uses SceneGallery component, which only allows editing scene name/OSC address, not channel values.
**Solution:** Add inline channel value editor with sliders (similar to ScenePanel)

### 2. SuperControl Scene Management - Broken 🔴
**Status:** Critical
**Problem:** SuperControl maintains its own local scene state (line 345 in SuperControl.tsx) instead of using the global Zustand store. Scenes saved in SuperControl don't appear globally.
**Solution:** Refactor SuperControl to use global `scenes`, `saveScene`, `loadScene`, `deleteScene` from store instead of local state.

### 3. Quick Scene Selector - No Multi-Select 📋
**Status:** Requested Feature
**Problem:** Quick Scene panel in PinnedChannels only shows one scene at a time. User wants to prepare/select next scene from UI.
**Solution:** Add dropdown or list to select which scene is "queued" for quick load.

## Priority Order

1. **Fix SuperControl Scene Management** (Critical - data loss issue)
2. **Add SceneGallery Inline Editor** (High - user requested)
3. **Add Quick Scene Multi-Select** (Medium - UX improvement)

## Implementation Details

### SuperControl Fix
**File:** `react-app/src/components/dmx/SuperControl.tsx`
**Changes:**
- Remove local `scenes` state (line 345)
- Import `scenes`, `saveScene`, `loadScene`, `deleteScene` from `useStore()`
- Update all scene-related functions to use global store
- Remove `setScenes` calls
- Ensure scene saves go through `saveScene()` action which persists to backend

### SceneGallery Inline Editor
**File:** `react-app/src/components/scenes/SceneGallery.tsx`
**Status:** Handlers added, UI needs to be inserted
**Remaining:**
- Add "Edit Values" button to scene controls (after Edit button)
- Add inline editor panel below scene visualizer
- Include pending changes badge and enhanced save button

### Quick Scene Multi-Select
**File:** `react-app/src/components/layout/PinnedChannels.tsx`
**Changes:**
- Already has dropdown selector (implemented)
- Could add "queue" feature to prepare next scene
- Add visual indicator for "next" scene

## Next Steps

1. Fix SuperControl scene management first (prevents data loss)
2. Complete SceneGallery inline editor UI
3. Test all scene operations across all components
4. Add multi-select/queue feature to Quick Scene panel
