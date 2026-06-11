# SuperControl Scene System Fix - Status Report

## Problem
SuperControl component maintains its own local `scenes` state instead of using the global Zustand store. This causes:
- Scenes saved in SuperControl don't appear in Scenes & Acts page
- Scenes saved elsewhere don't appear in SuperControl
- Data inconsistency across the application

## Changes Made

### ✅ Step 1: Import Global Scene Functions
**File:** `react-app/src/components/dmx/SuperControl.tsx`
**Lines:** 68-74
```typescript
// Added to useStore() destructuring:
scenes,        // Global scenes array from store
saveScene,     // Global save function
deleteScene,   // Global delete function
```

### ✅ Step 2: Remove Local Scenes State
**Lines:** 344-353 (removed)
```typescript
// REMOVED this local state:
const [scenes, setScenes] = useState<Array<{...}>>([]);
```

## Remaining Work

### 🔧 Step 3: Update Scene Save Function
**Location:** Line ~1132
**Current:** Uses `setScenes()` to update local state
**Fix:** Replace with `saveScene()` from global store

### 🔧 Step 4: Update Scene Delete Function  
**Location:** Line ~1161
**Current:** Local `deleteScene` function that uses `setScenes()`
**Fix:** Remove local function, use global `deleteScene()` from store

### 🔧 Step 5: Fix Scene Data Structure
**Issue:** SuperControl uses different scene format:
- Local: `{ id, name, values: Record<number, number>, timestamp }`
- Global: `{ name, channelValues: number[], oscAddress }`

**Fix:** Convert between formats when saving/loading

### 🔧 Step 6: Remove All `setScenes()` Calls
**Locations:** Lines 1132, 1157, 1266, 1346, 1387
**Fix:** Replace with appropriate global store actions

## Scene Format Conversion

### SuperControl Format → Global Format
```typescript
// SuperControl scene
{
  id: string,
  name: string,
  values: Record<number, number>,  // { 0: 255, 5: 128 }
  timestamp: number
}

// Convert to Global format
{
  name: string,
  channelValues: number[],  // [255, 0, 0, 0, 0, 128, ...]
  oscAddress: string
}
```

### Conversion Helper Needed
```typescript
const convertToGlobalFormat = (localScene) => {
  const channelValues = new Array(512).fill(0);
  Object.entries(localScene.values).forEach(([ch, val]) => {
    channelValues[parseInt(ch)] = val;
  });
  return {
    name: localScene.name,
    channelValues,
    oscAddress: `/scene/${localScene.name.toLowerCase().replace(/\s+/g, '_')}`
  };
};
```

## Next Steps

1. Find all scene save operations in SuperControl
2. Replace with global `saveScene()` calls
3. Remove local `deleteScene` function
4. Add format conversion where needed
5. Test scene operations in SuperControl
6. Verify scenes sync with Scenes & Acts page

## Testing Checklist

- [ ] Save scene in SuperControl → appears in Scenes & Acts
- [ ] Delete scene in SuperControl → removed from Scenes & Acts  
- [ ] Load scene in SuperControl → uses global store
- [ ] Save scene in Scenes & Acts → appears in SuperControl
- [ ] No duplicate scene entries
- [ ] OSC addresses preserved correctly
