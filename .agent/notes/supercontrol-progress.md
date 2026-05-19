# SuperControl Scene Sync - Progress Report

## ✅ Completed

1. **Imported Global Store Functions**
   - Added `scenes`, `saveScene`, `deleteScene` from useStore
   - Removed local `scenes` state declaration

2. **Refactored Core Functions**
   - `captureCurrentScene()` - Now uses global `saveScene()` with format conversion
   - `loadScene()` → `loadSceneByIndex()` - Uses global `storeLoadScene()`
   - `deleteScene()` → `deleteSceneByIndex()` - Uses global `deleteScene()`

3. **Removed Config Import**
   - Line 1271: Removed `setScenes()` call from config import

## 🔧 Remaining Issues

### Critical Errors to Fix:

1. **Function Name Conflicts** (Lines 793, 801)
   - References to `loadScene()` need to be updated to `loadSceneByIndex()`
   - Search for all `loadScene(` calls and update to `loadSceneByIndex(`

2. **Scene UI References** (Lines 2108-2157)
   - Multiple references to `scene.id`, `scene.values`, `scene.timestamp`
   - Global scenes use: `scene.name`, `scene.channelValues`, no timestamp
   - Need to update scene display UI to use correct properties

3. **Remaining setScenes Calls** (Lines 1132, 1157, 1346, 1387)
   - These are likely in other functions that need updating
   - Need to find and replace with appropriate global store calls

### Search & Replace Needed:

```typescript
// Find all instances of:
loadScene(         → loadSceneByIndex(
deleteScene(       → deleteSceneByIndex(
scene.id           → scene.name (or generate index)
scene.values       → scene.channelValues
scene.timestamp    → (remove or use Date.now())
```

## Next Steps

1. Find all `loadScene(` calls → replace with `loadSceneByIndex(`
2. Find all `deleteScene(` calls → replace with `deleteSceneByIndex(`
3. Update scene UI to use `scene.name` instead of `scene.id`
4. Update scene display to use `scene.channelValues` instead of `scene.values`
5. Remove timestamp references or handle gracefully
6. Test scene save/load/delete in SuperControl
7. Verify scenes sync with Scenes & Acts page

## Testing Checklist

- [ ] Save scene in SuperControl
- [ ] Verify scene appears in Scenes & Acts page
- [ ] Load scene in SuperControl
- [ ] Delete scene in SuperControl
- [ ] Verify deletion reflected in Scenes & Acts
- [ ] Check scene names display correctly
- [ ] Verify channel values preserved correctly
