import { useEffect, useRef } from 'react';
import { useStore, type Apc40LastChange } from '../store';
import { decodeApc40Message, isApc40Source } from '../midi/apc40';
import {
  apc40DeckSceneName,
  APC40_TRACK_CONTROL_ROLES,
  blendApc40DeckScenes,
  buildFullOnUpdates,
  buildRandomLookUpdates,
  buildRoleUpdates,
  midiToDmx,
  resolveApc40DeviceRoleCatalog,
  resolveApc40DeviceRoleSlots,
  type Apc40Deck,
  type Apc40RoleSlot,
} from '../midi/apc40WorkflowHelpers';
import { sceneNameToOscPath } from '../utils/sceneCapture';

const DIMMER_ROLE: Apc40RoleSlot = {
  label: 'Dimmer',
  controlName: 'dimmer',
  aliases: ['dimmer', 'intensity', 'master'],
};

// Pattern cyclers driven by SHIFT+SEND row. Must stay in sync with the
// union types declared on setColorAutomation / setPanTiltAutomation /
// setEffectsAutomation in store/slices/automationSlice.ts.
const COLOR_PATTERNS = ['rainbow', 'pulse', 'strobe', 'cycle', 'breathe', 'wave', 'random'] as const;
const PAN_TILT_PATHS = ['circle', 'figure8', 'square', 'triangle', 'linear', 'custom'] as const;
const EFFECT_TYPES = ['gobo_cycle', 'prism_rotate', 'iris_breathe', 'zoom_bounce', 'focus_sweep'] as const;

function nextInCycle<T extends string>(values: readonly T[], current: T): T {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

const TRACK_SELECT_ENCODER_SUPPRESSION_MS = 250;
const APC40_NOTE_RELEASE_WINDOW_MS = 350;
const APC40_FREEZE_TOGGLE_DEBOUNCE_MS = 450;
const APC40_MASTER_CC_BURST_WINDOW_MS = 180;

function sortedColumns(columns: Set<number>): number[] {
  return Array.from(columns).sort((a, b) => a - b);
}

function dispatchSceneTimelineStop() {
  window.dispatchEvent(new CustomEvent('stopSceneTimeline'));
}

type StoreState = ReturnType<typeof useStore.getState>;

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function quoted(name: string): string {
  return `"${name}"`;
}

function selectedFixtureNames(state: StoreState): string[] {
  return state.selectedFixtures
    .map((fixtureId) => state.fixtures.find((fixture) => fixture.id === fixtureId)?.name)
    .filter((name): name is string => Boolean(name));
}

function selectedGroupNames(state: StoreState): string[] {
  const selected = new Set(state.selectedFixtures);
  if (selected.size === 0) return [];
  return state.groups
    .filter((group) => {
      const ids = group.fixtureIndices
        .map((fixtureIndex) => state.fixtures[fixtureIndex]?.id)
        .filter((id): id is string => Boolean(id));
      return ids.length > 0 && ids.length === selected.size && ids.every((id) => selected.has(id));
    })
    .map((group) => group.name);
}

function targetLabelForSelection(state: StoreState, fallbackToAll = true): string {
  const groups = selectedGroupNames(state);
  if (groups.length > 0) return `group ${formatList(groups.map(quoted))}`;
  const fixtures = selectedFixtureNames(state);
  if (fixtures.length > 0) return `fixture ${formatList(fixtures.map(quoted))}`;
  return fallbackToAll ? 'all patched fixtures' : 'no selected fixtures';
}

function roleCategory(role: Apc40RoleSlot): Apc40LastChange['category'] {
  const text = `${role.label} ${role.controlName}`.toLowerCase();
  if (/(gobo|strobe|shutter|prism|iris|focus|zoom|macro|speed|effect|pattern)/.test(text)) {
    return 'effect';
  }
  return 'fixture';
}

function makeLastChange(
  category: Apc40LastChange['category'],
  controlLabel: string,
  summary: string,
  detail?: string,
  extra: Omit<Partial<Apc40LastChange>, 'at' | 'category' | 'controlLabel' | 'summary' | 'detail'> = {}
): Apc40LastChange {
  return {
    at: Date.now(),
    category,
    controlLabel,
    summary,
    detail,
    ...extra,
  };
}

export function useApc40Workflow() {
  // Subscribe via the window 'midiMessage' event below instead of selecting
  // `state.midiMessages[length-1]`. React 18 batches multiple set() calls into
  // a single render, so when SHIFT noteon + clip noteon arrive in the same
  // tick the selector only delivers the last one — losing SHIFT and breaking
  // both single-tap clip launch and SHIFT+clip Deck B targeting. The window
  // event fires synchronously inside addMidiMessage, one per message.
  const fixturesForRoles = useStore((state) => state.fixtures);
  const selectedForRoles = useStore((state) => state.selectedFixtures);
  const setApc40StatePatch = useStore((state) => state.setApc40StatePatch);

  const lastSignature = useRef('');
  const lastSignatureAtRef = useRef(0);
  const lastFreezeToggleAtRef = useRef(0);
  const masterCcBurstRef = useRef<Map<number, { value: number; at: number }>>(new Map());
  const recentPositiveNoteRef = useRef<Map<string, number>>(new Map());
  const handleApc40MessageRef = useRef<(message: any) => void>(() => {});
  const shiftHeldRef = useRef(false);
  const sceneRefs = useRef<Record<Apc40Deck, string | null>>({ A: null, B: null });
  const slotRefs = useRef<Record<Apc40Deck, number | null>>({ A: null, B: null });
  const armedColumnsRef = useRef<Set<number>>(new Set());
  const activeGroupIndexRef = useRef(0);
  const fullOnSnapshotRef = useRef<number[] | null>(null);
  const blackoutSnapshotRef = useRef<number[] | null>(null);
  const deviceRoleBankRef = useRef(0);
  const autoGroupsRef = useRef<Set<number>>(new Set());
  const suppressTrackControlUntilRef = useRef(0);
  // Solo Group state (Record Arm row): a snapshot of pre-solo DMX is taken
  // when the soloed-group set transitions from empty to non-empty, then
  // restored when it transitions back to empty. While any group is soloed,
  // fixtures not in any soloed group have their dimmer channels driven to 0.
  const soloedGroupsRef = useRef<Set<number>>(new Set());
  const soloSnapshotRef = useRef<number[] | null>(null);


  const apcTargetPatch = (
    trackIndex: number | null,
    groupId: string | null,
    fixtureIds: string[],
    label: string | null
  ) => ({
    activeTrackIndex: trackIndex,
    activeGroupId: groupId,
    activeFixtureIds: fixtureIds,
    activeTargetLabel: label,
  });

  const fixtureIdsForGroup = (state: StoreState, groupId: string): string[] => {
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (!group) return [];
    return group.fixtureIndices
      .map((fixtureIndex) => state.fixtures[fixtureIndex]?.id)
      .filter((fixtureId): fixtureId is string => Boolean(fixtureId));
  };
  const publishSurfaceState = (patch: Parameters<typeof setApc40StatePatch>[0] = {}) => {
    const state = useStore.getState();
    const deviceRoleCatalog = resolveApc40DeviceRoleCatalog(
      state.fixtures,
      state.selectedFixtures
    );
    const deviceBankCount = deviceRoleCatalog.length;
    const maxDeviceBankIndex = Math.max(0, deviceBankCount - 1);
    if (deviceRoleBankRef.current > maxDeviceBankIndex) deviceRoleBankRef.current = maxDeviceBankIndex;
    if (deviceRoleBankRef.current < 0) deviceRoleBankRef.current = 0;
    const roles = resolveApc40DeviceRoleSlots(
      state.fixtures,
      state.selectedFixtures,
      deviceRoleBankRef.current
    );
    setApc40StatePatch({
      activeDeck: shiftHeldRef.current ? 'B' : 'A',
      shiftLatched: shiftHeldRef.current,
      sceneAName: sceneRefs.current.A,
      sceneBName: sceneRefs.current.B,
      armedColumns: sortedColumns(armedColumnsRef.current),
      soloedGroups: sortedColumns(soloedGroupsRef.current),
      fullOn: fullOnSnapshotRef.current !== null,
      blackout: blackoutSnapshotRef.current !== null,
      autoGroups: sortedColumns(autoGroupsRef.current),
      deviceRoleLabels: roles.map((role) => role.label),
      deviceBankIndex: deviceRoleBankRef.current,
      deviceBankCount,
      deviceBankAtStart: deviceRoleBankRef.current <= 0,
      deviceBankAtEnd: deviceBankCount <= 0 || deviceRoleBankRef.current >= maxDeviceBankIndex,
      ...patch,
    });
  };

  const toggleMasterFreeze = (state: StoreState, now: number) => {
    if (now - lastFreezeToggleAtRef.current <= APC40_FREEZE_TOGGLE_DEBOUNCE_MS) {
      publishSurfaceState();
      return true;
    }
    lastFreezeToggleAtRef.current = now;
    const nextFrozen = !state.dmxFrozen;
    state.setDmxFrozen(nextFrozen);
    publishSurfaceState({
      lastChange: makeLastChange(
        'transport',
        'Master Select',
        nextFrozen ? 'DMX OUTPUT FROZEN' : 'DMX output released',
        nextFrozen
          ? 'Master LED is on. Backend send is suppressed while the GUI keeps reflecting state.'
          : 'Master LED is off. Backend send is re-enabled and the current store state was flushed to the rig.'
      ),
    });
    state.addNotification({
      message: nextFrozen ? 'APC40 Master FREEZE latched — press Master again to unfreeze' : 'APC40 Master FREEZE released',
      type: nextFrozen ? 'warning' : 'info',
      priority: nextFrozen ? 'high' : 'normal',
    });
    return true;
  };

  const consumeMasterCcBurst = (message: any, now: number): boolean => {
    const type = message.type || message._type;
    const channel = typeof message.channel === 'number' ? message.channel : 0;
    if (type !== 'cc' && type !== 'controlchange') return false;
    if (channel !== 8 || typeof message.controller !== 'number') return false;
    if (message.controller < 0x12 || message.controller > 0x17) return false;

    const value = message.value ?? message.velocity ?? 0;
    masterCcBurstRef.current.set(message.controller, { value, at: now });
    for (const [controller, entry] of masterCcBurstRef.current.entries()) {
      if (now - entry.at > APC40_MASTER_CC_BURST_WINDOW_MS) {
        masterCcBurstRef.current.delete(controller);
      }
    }

    // Observed APC40 MK1 Master Select burst:
    // Ch 9 CC18=0, CC19=0, CC20=4, CC21=0, CC22=1, CC23=0.
    // Device Control knob 5 can also emit CC20, so CC20 alone must never toggle.
    if (message.controller !== 0x16 || value <= 0) return false;
    const hasRecent = (controller: number, expectedValue: number) => {
      const entry = masterCcBurstRef.current.get(controller);
      return Boolean(entry && entry.value === expectedValue && now - entry.at <= APC40_MASTER_CC_BURST_WINDOW_MS);
    };
    const matchesMasterBurst =
      hasRecent(0x12, 0) &&
      hasRecent(0x13, 0) &&
      hasRecent(0x14, 4) &&
      hasRecent(0x15, 0);
    if (!matchesMasterBurst) return false;

    masterCcBurstRef.current.clear();
    return toggleMasterFreeze(useStore.getState(), now);
  };

  const setDeckScene = (deck: Apc40Deck, slotIndex: number | null, sceneName: string | null) => {
    sceneRefs.current[deck] = sceneName;
    slotRefs.current[deck] = slotIndex;
    if (deck === 'A') useStore.getState().setApc40SceneA(sceneName);
    else useStore.getState().setApc40SceneB(sceneName);
  };

  const clearDeckScene = (deck: Apc40Deck, column?: number) => {
    const slot = slotRefs.current[deck];
    const sceneName = sceneRefs.current[deck];
    if (!sceneName) return false;
    if (column !== undefined && slot !== null && slot % 8 !== column) return false;

    setDeckScene(deck, null, null);
    if (sceneName && useStore.getState().activeSceneName === sceneName) {
      useStore.setState({ activeSceneName: null });
      dispatchSceneTimelineStop();
    }
    publishSurfaceState();
    return true;
  };

  const toggleClipGridSaveMode = () => {
    if (armedColumnsRef.current.size > 0) {
      armedColumnsRef.current.clear();
    } else {
      for (let column = 0; column < 8; column += 1) armedColumnsRef.current.add(column);
    }
    publishSurfaceState({ mode: armedColumnsRef.current.size > 0 ? 'save' : null });
  };

  const fixtureIdsInSoloedGroups = (state: StoreState): Set<string> => {
    const ids = new Set<string>();
    soloedGroupsRef.current.forEach((groupIndex) => {
      const group = state.groups[groupIndex];
      if (!group) return;
      group.fixtureIndices.forEach((fixtureIndex) => {
        const id = state.fixtures[fixtureIndex]?.id;
        if (id) ids.add(id);
      });
    });
    return ids;
  };

  const applySoloMask = () => {
    const state = useStore.getState();
    const aliveIds = fixtureIdsInSoloedGroups(state);
    const updates: Record<number, number> = {};
    state.fixtures.forEach((fixture) => {
      if (aliveIds.has(fixture.id)) return;
      const blackoutUpdates = buildRoleUpdates(state.fixtures, [fixture.id], DIMMER_ROLE, 0);
      Object.assign(updates, blackoutUpdates);
    });
    if (Object.keys(updates).length > 0) state.setMultipleDmxChannels(updates, true);
  };

  const restoreSoloSnapshot = () => {
    const snapshot = soloSnapshotRef.current;
    if (!snapshot) return;
    const state = useStore.getState();
    const restore: Record<number, number> = {};
    snapshot.forEach((value, channel) => {
      if (state.dmxChannels[channel] !== value) restore[channel] = value;
    });
    soloSnapshotRef.current = null;
    if (Object.keys(restore).length > 0) state.setMultipleDmxChannels(restore, true);
  };

  const applyRoleToSelection = (role: Apc40RoleSlot, midiValue: number) => {
    const state = useStore.getState();
    state.applySuperControlMidi(role.controlName, midiToDmx(midiValue));
  };

  useEffect(() => {
    publishSurfaceState();
  }, [fixturesForRoles, selectedForRoles]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const listener = (event: Event) => {
      const message = (event as CustomEvent).detail;
      handleApc40MessageRef.current(message);
    };
    window.addEventListener('midiMessage', listener);
    return () => window.removeEventListener('midiMessage', listener);
  }, []);

  handleApc40MessageRef.current = (latestMessage: any) => {
    if (!latestMessage || !isApc40Source(latestMessage.source)) return;

    let message = latestMessage;
    const type = message.type || message._type;
    const note = typeof message.note === 'number' ? message.note : undefined;
    const channel = typeof message.channel === 'number' ? message.channel : 0;
    const velocity = message.velocity ?? message.value ?? 0;
    const now = typeof message.timestamp === 'number' ? message.timestamp : Date.now();

    const noteOffLike = note !== undefined && (
      type === 'noteoff' ||
      (type === 'noteon' && velocity === 0)
    );

    if (type === 'noteon' && note !== undefined && velocity > 0) {
      const noteKey = `${message.source || ''}:${channel}:${note}`;
      recentPositiveNoteRef.current.set(noteKey, now);
    } else if (noteOffLike && note !== 0x62) {
      const noteKey = `${message.source || ''}:${channel}:${note}`;
      const previousPositiveAt = recentPositiveNoteRef.current.get(noteKey);
      const isImmediateRelease =
        previousPositiveAt !== undefined &&
        now >= previousPositiveAt &&
        now - previousPositiveAt <= APC40_NOTE_RELEASE_WINDOW_MS;

      if (isImmediateRelease) return;

      // Some APC40 modes emit separate physical button presses as
      // NOTE ON velocity 127 and later NOTE ON velocity 0. Let delayed
      // velocity-0 / note-off events through as explicit OFF state.
    }

    const signature = JSON.stringify(message);
    if (signature === lastSignature.current && now - lastSignatureAtRef.current < 35) return;
    lastSignature.current = signature;
    lastSignatureAtRef.current = now;

    if (consumeMasterCcBurst(message, now)) return;

    const action = decodeApc40Message(message);
    if (!action) return;

    const state = useStore.getState();
    const deck: Apc40Deck = shiftHeldRef.current ? 'B' : 'A';

    if (action.type === 'shift') {
      shiftHeldRef.current = action.pressed;
      publishSurfaceState({
        activeDeck: action.pressed ? 'B' : 'A',
        lastChange: makeLastChange(
          'transport',
          'SHIFT',
          action.pressed ? 'SHIFT held: Deck B controls active' : 'SHIFT released: Deck A controls active'
        ),
      });
      return;
    }

    if (action.type === 'solo-group') {
      const group = state.groups[action.trackIndex];
      if (!group) {
        publishSurfaceState({
          lastChange: makeLastChange(
            'selection',
            `Solo Group ${action.trackIndex + 1}`,
            `Group ${action.trackIndex + 1} does not exist`,
            'Record Arm row solos the matching fixture group. Patch a group first.'
          ),
        });
        return;
      }

      const alreadyOn = soloedGroupsRef.current.has(action.trackIndex);
      if (action.pressed === alreadyOn) {
        publishSurfaceState();
        return;
      }

      if (action.pressed) {
        if (soloedGroupsRef.current.size === 0) soloSnapshotRef.current = [...state.dmxChannels];
        soloedGroupsRef.current.add(action.trackIndex);
      } else {
        soloedGroupsRef.current.delete(action.trackIndex);
      }

      if (soloedGroupsRef.current.size === 0) {
        restoreSoloSnapshot();
      } else {
        applySoloMask();
      }

      const soloedNames = sortedColumns(soloedGroupsRef.current)
        .map((groupIndex) => state.groups[groupIndex]?.name)
        .filter((name): name is string => Boolean(name));
      publishSurfaceState({
        lastChange: makeLastChange(
          'selection',
          `Solo Group ${action.trackIndex + 1}`,
          action.pressed
            ? `Soloed group "${group.name}"`
            : `Released solo on group "${group.name}"`,
          soloedGroupsRef.current.size > 0
            ? `Currently soloed: ${formatList(soloedNames.map(quoted))}. Other fixtures dimmed to 0.`
            : 'No groups soloed; previous DMX snapshot restored.',
          { groupNames: [group.name] }
        ),
      });
      state.addNotification({
        message: action.pressed
          ? `APC40 soloed group "${group.name}"`
          : `APC40 released solo on "${group.name}"`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'record') {
      if (shiftHeldRef.current) {
        const { updates, touchedFixtures } = buildRandomLookUpdates(state.fixtures);
        if (touchedFixtures === 0) {
          state.addNotification({
            message: 'APC40 roll-dice: no fixtures with recognized roles to randomize',
            type: 'warning',
            priority: 'normal',
          });
          publishSurfaceState({
            lastChange: makeLastChange(
              'effect',
              'SHIFT+REC',
              'Roll dice skipped — no fixtures',
              'Add fixtures to the stage canvas before rolling a random look.'
            ),
          });
          return;
        }
        state.setMultipleDmxChannels(updates, true);
        publishSurfaceState({
          lastChange: makeLastChange(
            'effect',
            'SHIFT+REC',
            `Rolled random look across ${touchedFixtures} fixture${touchedFixtures === 1 ? '' : 's'}`,
            'Preview only — press REC then a grid pad to save it as a scene.'
          ),
        });
        state.addNotification({
          message: `APC40 rolled fresh random look (${touchedFixtures} fixtures). Press REC, then a pad to save.`,
          type: 'success',
          priority: 'normal',
        });
        return;
      }

      toggleClipGridSaveMode();
      publishSurfaceState({
        mode: armedColumnsRef.current.size > 0 ? 'save' : null,
        lastChange: makeLastChange(
          'scene',
          'REC',
          armedColumnsRef.current.size > 0
            ? `Clip-grid save mode active for Deck ${deck}`
            : 'Clip-grid save mode cleared',
          armedColumnsRef.current.size > 0
            ? `Any clip-grid pad can now save the current DMX look into Deck ${deck}.`
            : 'Clip-grid pads are back to launch mode.'
        ),
      });
      state.addNotification({
        message: armedColumnsRef.current.size > 0
          ? `APC40 save mode active for Deck ${deck}. Press a flashing clip pad to save.`
          : 'APC40 save mode cleared',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'clip-launch') {
      const name = apc40DeckSceneName(deck, action.index);

      if (armedColumnsRef.current.has(action.column)) {
        state.saveScene(name, sceneNameToOscPath(name));
        armedColumnsRef.current.delete(action.column);
        setDeckScene(deck, action.index, name);
        publishSurfaceState({
          mode: armedColumnsRef.current.size > 0 ? 'save' : null,
          lastChange: makeLastChange(
            'scene',
            `Deck ${deck} clip ${action.index + 1}`,
            `Saved current DMX to Deck ${deck} scene ${String(action.index + 1).padStart(2, '0')}`,
            `Stored as "${name}" from row ${action.row + 1}, column ${action.column + 1}.`,
            { sceneName: name }
          ),
        });
        state.addNotification({
          message: `APC40 saved ${name}`,
          type: 'success',
          priority: 'normal',
        });
        return;
      }

      const scene = state.scenes.find((candidate) => candidate.name === name);
      if (!scene) {
        publishSurfaceState({
          lastChange: makeLastChange(
            'scene',
            `Deck ${deck} clip ${action.index + 1}`,
            `${name} is empty`,
            `Press REC, then this pad to save the current DMX look. Hold SHIFT for the pad press to save Deck B.`,
            { sceneName: name }
          ),
        });
        state.addNotification({
          message: `${name} is empty. Press REC, then this pad to save it.`,
          type: 'warning',
          priority: 'normal',
        });
        return;
      }

      setDeckScene(deck, action.index, scene.name);
      state.loadScene(scene.name);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('apc40:clip-launch', {
            detail: { row: action.row, col: action.column, sceneName: scene.name },
          })
        );
      }
      publishSurfaceState({
        mode: null,
        lastChange: makeLastChange(
          'scene',
          `Deck ${deck} clip ${action.index + 1}`,
          `Launched Deck ${deck} scene "${scene.name}"`,
          `Loaded from row ${action.row + 1}, column ${action.column + 1}.`,
          { sceneName: scene.name }
        ),
      });
      state.addNotification({
        message: `APC40 Deck ${deck} launched ${scene.name}`,
        type: 'success',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'scene-launch') {
      if (armedColumnsRef.current.size > 0) {
        publishSurfaceState({
          mode: 'save',
          lastChange: makeLastChange(
            'scene',
            `Scene Launch ${action.sceneIndex + 1}`,
            'Scene Launch buttons start ACTS; they do not save Deck scenes',
            `Save mode is active for Deck ${deck}. Press a clip-grid pad to save or overwrite a Deck scene.`
          ),
        });
        state.addNotification({
          message: 'APC40 save mode uses the clip grid, not Scene Launch. Press a clip pad to save.',
          type: 'warning',
          priority: 'normal',
        });
        return;
      }
      const act = state.acts[action.sceneIndex];
      if (!act) {
        publishSurfaceState({
          lastChange: makeLastChange(
            'scene',
            `Scene Launch ${action.sceneIndex + 1}`,
            `ACT ${action.sceneIndex + 1} is empty`,
            'No ACT was launched.'
          ),
        });
        state.addNotification({
          message: `APC40 ACT ${action.sceneIndex + 1} is empty`,
          type: 'warning',
          priority: 'normal',
        });
        return;
      }
      state.playAct(act.id);
      publishSurfaceState({
        lastChange: makeLastChange(
          'scene',
          `Scene Launch ${action.sceneIndex + 1}`,
          `Launched ACT ${action.sceneIndex + 1}: "${act.name}"`,
          'Scene Launch buttons trigger ACT playback.',
          { actName: act.name }
        ),
      });
      return;
    }

    if (action.type === 'track-stop') {
      const cleared = clearDeckScene(deck, action.trackIndex)
        || clearDeckScene(deck);
      publishSurfaceState({
        lastChange: makeLastChange(
          'scene',
          `Track Stop ${action.trackIndex + 1}`,
          cleared
            ? `Stopped Deck ${deck} scene from column ${action.trackIndex + 1}`
            : `Deck ${deck} had no active scene to stop`,
          cleared ? 'Deck scene refs were cleared.' : undefined
        ),
      });
      state.addNotification({
        message: cleared
          ? `APC40 stopped Deck ${deck} scene`
          : `APC40 Deck ${deck} has no active scene to stop`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'stop') {
      const wasEnabled = state.autoSceneEnabled;
      if (wasEnabled) state.setAutoSceneEnabled(false);
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          'STOP',
          wasEnabled ? 'Stopped Auto Scene playback' : 'STOP pressed with Auto Scene already idle',
          'STOP toggles Auto Scene only. Use Stop All Clips for a panic-safe full stop.'
        ),
      });
      state.addNotification({
        message: wasEnabled ? 'APC40 STOP: Auto Scene stopped' : 'APC40 STOP: Auto Scene was not running',
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'stop-all-clips') {
      const hadPlayback = Boolean(sceneRefs.current.A || sceneRefs.current.B || state.actPlaybackState.currentActId);
      sceneRefs.current = { A: null, B: null };
      slotRefs.current = { A: null, B: null };
      armedColumnsRef.current.clear();
      state.setApc40SceneA(null);
      state.setApc40SceneB(null);
      state.stopAct();
      useStore.setState({ activeSceneName: null });
      dispatchSceneTimelineStop();
      publishSurfaceState({
        mode: null,
        lastChange: makeLastChange(
          'transport',
          'Stop All Clips',
          hadPlayback
            ? 'Stopped Deck A/B scenes and ACT playback'
            : 'Stop All Clips pressed with no active Deck scene or ACT playback',
          'Panic-safe stop clears active decks, save mode, ACT playback, and scene timeline playback.'
        ),
      });
      state.addNotification({
        message: 'APC40 stopped all Deck A/B scenes and ACT playback',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'channel-fader') {
      state.applySuperControlMidi('dimmer', midiToDmx(action.value), action.trackIndex);
      const fixtureId = state.selectedFixtures[action.trackIndex];
      const fixture = fixtureId ? state.fixtures.find((candidate) => candidate.id === fixtureId) : undefined;
      const value = midiToDmx(action.value);
      publishSurfaceState({
        lastChange: makeLastChange(
          'fixture',
          `Track ${action.trackIndex + 1} fader`,
          fixture
            ? `Changed dimmer for "${fixture.name}" to ${value}`
            : `Track ${action.trackIndex + 1} fader moved but no selected fixture slot ${action.trackIndex + 1} exists`,
          fixture
            ? `Selected fixture slot ${action.trackIndex + 1}.`
            : 'Track faders require selected fixtures.',
          { fixtureNames: fixture ? [fixture.name] : [], roleLabel: 'Dimmer', value }
        ),
      });
      return;
    }

    if (action.type === 'master-fader') {
      state.applySuperControlMidi('masterDimmer', midiToDmx(action.value));
      const value = midiToDmx(action.value);
      publishSurfaceState({
        lastChange: makeLastChange(
          'fixture',
          'Master fader',
          `Changed master dimmer for ${targetLabelForSelection(state, false)} to ${value}`,
          selectedFixtureNames(state).length > 0
            ? 'Master fader targets the selected lighting context.'
            : 'Master fader requires selected fixtures.',
          {
            fixtureNames: selectedFixtureNames(state),
            groupNames: selectedGroupNames(state),
            roleLabel: 'Master dimmer',
            value,
          }
        ),
      });
      return;
    }

    if (action.type === 'crossfader') {
      const sceneA = state.scenes.find((scene) => scene.name === sceneRefs.current.A);
      const sceneB = state.scenes.find((scene) => scene.name === sceneRefs.current.B);
      const updates = blendApc40DeckScenes(sceneA, sceneB, action.value);
      if (Object.keys(updates).length > 0) state.setMultipleDmxChannels(updates, true);
      const blend = Math.round((action.value / 127) * 100);
      publishSurfaceState({
        lastChange: makeLastChange(
          'scene',
          'Crossfader',
          `Blended Deck A "${sceneA?.name ?? 'none'}" with Deck B "${sceneB?.name ?? 'none'}" at ${blend}% B`,
          Object.keys(updates).length > 0
            ? `Updated ${Object.keys(updates).length} DMX channel${Object.keys(updates).length === 1 ? '' : 's'}.`
            : 'Both decks need assigned scenes before the crossfader can write DMX.',
          { value: blend }
        ),
      });
      return;
    }

    if (action.type === 'device-control') {
      const roles = resolveApc40DeviceRoleSlots(state.fixtures, state.selectedFixtures, deviceRoleBankRef.current);
      const role = roles[action.slotIndex];
      if (!role) return;
      applyRoleToSelection(role, action.value);
      const value = midiToDmx(action.value);
      publishSurfaceState({
        deviceRoleLabels: roles.map((candidate) => candidate.label),
        lastChange: makeLastChange(
          roleCategory(role) === 'effect' ? 'effect' : 'device',
          `Device Control ${action.slotIndex + 1}`,
          `Changed ${role.label} on ${targetLabelForSelection(state, false)} to ${value}`,
          state.selectedFixtures.length > 0
            ? `Device Control bank ${deviceRoleBankRef.current + 1}; context-aware fixture capability.`
            : 'Device Control needs a fixture/group selection before it can write DMX.',
          {
            fixtureNames: selectedFixtureNames(state),
            groupNames: selectedGroupNames(state),
            roleLabel: role.label,
            value,
          }
        ),
      });
      return;
    }

    if (action.type === 'track-control') {
      if (Date.now() < suppressTrackControlUntilRef.current) return;
      const role = APC40_TRACK_CONTROL_ROLES[action.slotIndex];
      if (!role) return;
      applyRoleToSelection(role, action.value);
      const value = midiToDmx(action.value);
      publishSurfaceState({
        lastChange: makeLastChange(
          roleCategory(role),
          `Track Control ${action.slotIndex + 1}`,
          `Changed ${role.label} on ${targetLabelForSelection(state, false)} to ${value}`,
          state.selectedFixtures.length > 0
            ? 'Track Control uses fixed ArtBastard roles.'
            : 'Track Control needs a fixture/group selection before it can write DMX.',
          {
            fixtureNames: selectedFixtureNames(state),
            groupNames: selectedGroupNames(state),
            roleLabel: role.label,
            value,
          }
        ),
      });
      return;
    }

    if (action.type === 'cue-level') {
      // Endless rotary encoder: 1..63 = CW step (forward), 65..127 = CCW step (reverse).
      // 0 and 64 are no-movement noise — ignore.
      if (action.value === 0 || action.value === 64) return;
      const direction = action.value < 64 ? 'forward' : 'reverse';
      if (state.automationDirection === direction) return;
      state.setAutomationDirection(direction);
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          'Cue Level',
          `Automation direction set to ${direction.toUpperCase()}`,
          'AutoScene index advance and pan/tilt autopilot now step in the new direction. Modular color/dimmer/effects phases run on wall-clock and are not reversible.',
        ),
      });
      state.addNotification({
        message: `APC40 automation direction: ${direction}`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'bank-prev' || action.type === 'bank-next') {
      const roleCatalog = resolveApc40DeviceRoleCatalog(state.fixtures, state.selectedFixtures);
      const total = roleCatalog.length;
      const delta = action.type === 'bank-next' ? 1 : -1;
      const maxBankIndex = Math.max(0, total - 1);
      const requestedBankIndex = deviceRoleBankRef.current + delta;
      deviceRoleBankRef.current = Math.max(0, Math.min(maxBankIndex, requestedBankIndex));
      const activeRoles = resolveApc40DeviceRoleSlots(
        state.fixtures, state.selectedFixtures, deviceRoleBankRef.current,
      );
      const direction = action.type === 'bank-next' ? 'next' : 'prev';
      const hitBoundary = requestedBankIndex !== deviceRoleBankRef.current;
      publishSurfaceState({
        deviceBankFlashDirection: direction,
        deviceBankFlashUntil: Date.now() + 450,
        deviceRoleLabels: activeRoles.map((role) => role.label),
        lastChange: makeLastChange(
          'device',
          action.type === 'bank-next' ? 'Device Bank \u2192' : 'Device Bank \u2190',
          hitBoundary
            ? `Device Control bank at ${action.type === 'bank-next' ? 'last' : 'first'} page`
            : `Moved Device Control bank to ${deviceRoleBankRef.current + 1} of ${Math.max(1, total)}`,
          activeRoles.length > 0
            ? `D1-D8 now expose: ${formatList(activeRoles.map((role) => role.label))}.`
            : 'No selected fixture capabilities match the Device Control role bank.',
        ),
      });
      return;
    }

    if (action.type === 'full-on') {
      const alreadyOn = fullOnSnapshotRef.current !== null;
      if (action.pressed === alreadyOn) {
        publishSurfaceState({ fullOn: alreadyOn });
        return;
      }

      if (!action.pressed) {
        const restore: Record<number, number> = {};
        fullOnSnapshotRef.current?.forEach((value, channel) => {
          if (state.dmxChannels[channel] !== value) restore[channel] = value;
        });
        fullOnSnapshotRef.current = null;
        if (Object.keys(restore).length > 0) state.setMultipleDmxChannels(restore, true);
        publishSurfaceState({
          fullOn: false,
          lastChange: makeLastChange(
            'effect',
            'Clip/Track',
            'Released FULL ON and restored the previous DMX snapshot',
            `Restored ${Object.keys(restore).length} DMX channel${Object.keys(restore).length === 1 ? '' : 's'}.`
          ),
        });
        state.addNotification({ message: 'APC40 FULL ON released', type: 'info', priority: 'normal' });
      } else {
        const updates = buildFullOnUpdates(state.fixtures);
        fullOnSnapshotRef.current = [...state.dmxChannels];
        if (Object.keys(updates).length > 0) state.setMultipleDmxChannels(updates, true);
        publishSurfaceState({
          fullOn: true,
          lastChange: makeLastChange(
            'effect',
            'Clip/Track',
            'Latched FULL ON across patched fixtures',
            `Raised ${Object.keys(updates).length} fixture DMX channel${Object.keys(updates).length === 1 ? '' : 's'} to full, excluding reset/lamp/function-style channels.`
          ),
        });
        state.addNotification({ message: 'APC40 FULL ON latched', type: 'warning', priority: 'normal' });
      }
      return;
    }

    if (action.type === 'blackout') {
      const alreadyOn = blackoutSnapshotRef.current !== null;
      if (action.pressed === alreadyOn) {
        publishSurfaceState({ blackout: alreadyOn });
        return;
      }

      // ON latches all DMX to 0 (snapshot prev state); OFF restores snapshot.
      if (!action.pressed) {
        const restore: Record<number, number> = {};
        blackoutSnapshotRef.current?.forEach((value, channel) => {
          if (state.dmxChannels[channel] !== value) restore[channel] = value;
        });
        blackoutSnapshotRef.current = null;
        if (Object.keys(restore).length > 0) state.setMultipleDmxChannels(restore, true);
        publishSurfaceState({
          blackout: false,
          lastChange: makeLastChange(
            'effect',
            'Device On/Off',
            'Released BLACKOUT and restored the previous DMX snapshot',
            `Restored ${Object.keys(restore).length} DMX channel${Object.keys(restore).length === 1 ? '' : 's'}.`,
          ),
        });
        state.addNotification({ message: 'APC40 BLACKOUT released', type: 'info', priority: 'normal' });
      } else {
        blackoutSnapshotRef.current = [...state.dmxChannels];
        const updates: Record<number, number> = {};
        state.dmxChannels.forEach((value, channel) => {
          if (value !== 0) updates[channel] = 0;
        });
        if (Object.keys(updates).length > 0) state.setMultipleDmxChannels(updates, true);
        publishSurfaceState({
          blackout: true,
          lastChange: makeLastChange(
            'effect',
            'Device On/Off',
            'Latched BLACKOUT \u2014 all DMX channels driven to 0',
            `Zeroed ${Object.keys(updates).length} active channel${Object.keys(updates).length === 1 ? '' : 's'}; press again to restore.`,
          ),
        });
        state.addNotification({ message: 'APC40 BLACKOUT latched', type: 'warning', priority: 'high' });
      }
      return;
    }

    if (action.type === 'select-fixture') {
      // Solo/Cue row (note 0x31): ON selects fixture, OFF removes it.
      suppressTrackControlUntilRef.current = Date.now() + TRACK_SELECT_ENCODER_SUPPRESSION_MS;
      const fixture = state.fixtures[action.trackIndex];
      if (fixture) {
        const wasSelected = state.selectedFixtures.includes(fixture.id);
        if (action.pressed === wasSelected) {
          publishSurfaceState({
            ...apcTargetPatch(action.trackIndex, null, state.selectedFixtures, `Fixture ${action.trackIndex + 1}: ${fixture.name}`),
          });
          return;
        }
        state.deselectAllChannels();
        const nextSelection = action.pressed
          ? [...state.selectedFixtures, fixture.id]
          : state.selectedFixtures.filter((id) => id !== fixture.id);
        state.setSelectedFixtures(nextSelection);
        publishSurfaceState({
          ...apcTargetPatch(action.trackIndex, null, nextSelection, `Fixture ${action.trackIndex + 1}: ${fixture.name}`),
          lastChange: makeLastChange(
            'selection',
            `Select Fixture ${action.trackIndex + 1}`,
            action.pressed
              ? `Added fixture "${fixture.name}" to selection (${nextSelection.length} now selected)`
              : `Deselected fixture "${fixture.name}" (${nextSelection.length} now selected)`,
            'Solo/Cue row ON selects individual fixtures; OFF removes them from the live selection.',
            { fixtureNames: [fixture.name] }
          ),
        });
        state.addNotification({
          message: action.pressed
            ? `APC40 added fixture "${fixture.name}" to selection`
            : `APC40 deselected fixture "${fixture.name}"`,
          type: 'info',
          priority: 'low',
        });
      } else {
        publishSurfaceState({
          ...apcTargetPatch(action.trackIndex, null, [], `Fixture ${action.trackIndex + 1}: empty`),
          lastChange: makeLastChange(
            'selection',
            `Select Fixture ${action.trackIndex + 1}`,
            `Fixture ${action.trackIndex + 1} has no patched fixture`,
            'No selection changed.'
          ),
        });
      }
      return;
    }

    if (action.type === 'select-group') {
      // Activator row (note 0x32): ON adds the group, OFF removes it.
      suppressTrackControlUntilRef.current = Date.now() + TRACK_SELECT_ENCODER_SUPPRESSION_MS;
      activeGroupIndexRef.current = action.trackIndex;
      const group = state.groups[action.trackIndex];
      if (group) {
        const groupFixtureIds = group.fixtureIndices
          .map((fixtureIndex) => state.fixtures[fixtureIndex]?.id)
          .filter((id): id is string => Boolean(id));
        const currentSelection = state.selectedFixtures;
        const allAlreadySelected = groupFixtureIds.length > 0
          && groupFixtureIds.every((id) => currentSelection.includes(id));
        if (action.pressed === allAlreadySelected) {
          publishSurfaceState({
            ...apcTargetPatch(action.trackIndex, group.id, currentSelection, `Group ${action.trackIndex + 1}: ${group.name}`),
          });
          return;
        }
        const nextSelection = action.pressed
          ? Array.from(new Set([...currentSelection, ...groupFixtureIds]))
          : currentSelection.filter((id) => !groupFixtureIds.includes(id));
        state.setSelectedFixtures(nextSelection);
        state.deselectAllChannels();
        const fixtureNames = group.fixtureIndices
          .map((fixtureIndex) => state.fixtures[fixtureIndex]?.name)
          .filter((name): name is string => Boolean(name));
        publishSurfaceState({
          ...apcTargetPatch(action.trackIndex, group.id, nextSelection, `Group ${action.trackIndex + 1}: ${group.name}`),
          lastChange: makeLastChange(
            'selection',
            `Select Group ${action.trackIndex + 1}`,
            action.pressed
              ? `Added group "${group.name}" to selection (${nextSelection.length} now selected)`
              : `Removed group "${group.name}" from selection (${nextSelection.length} now selected)`,
            fixtureNames.length > 0 ? `Group contains ${formatList(fixtureNames.map(quoted))}.` : 'Group has no patched fixtures.',
            { groupNames: [group.name], fixtureNames }
          ),
        });
        state.addNotification({
          message: action.pressed
            ? `APC40 added group "${group.name}" to selection`
            : `APC40 removed group "${group.name}" from selection`,
          type: 'info',
          priority: 'low',
        });
      } else {
        publishSurfaceState({
          ...apcTargetPatch(action.trackIndex, null, [], `Group ${action.trackIndex + 1}: empty`),
          lastChange: makeLastChange(
            'selection',
            `Select Group ${action.trackIndex + 1}`,
            `Group ${action.trackIndex + 1} does not exist`,
            'No selection changed.'
          ),
        });
      }
      return;
    }

    if (action.type === 'play') {
      const wasEnabled = state.autoSceneEnabled;
      if (state.autoSceneList.length === 0) {
        publishSurfaceState({
          lastChange: makeLastChange(
            'transport',
            'PLAY',
            'Auto Scene list is empty',
            'Add scenes to the Auto Scene list in the Scenes panel, then press PLAY again.'
          ),
        });
        state.addNotification({
          message: 'APC40 PLAY: auto-scene list is empty',
          type: 'warning',
          priority: 'low',
        });
        return;
      }
      if (!wasEnabled) state.setAutoSceneEnabled(true);
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          'PLAY',
          wasEnabled ? 'Auto Scene already running' : 'Started Auto Scene playback',
          `BPM source: ${state.autoSceneTempoSource}; ${state.autoSceneList.length} scene(s) in rotation; mode: ${state.autoSceneMode}.`
        ),
      });
      state.addNotification({
        message: wasEnabled ? 'APC40 PLAY: Auto Scene already running' : 'APC40 PLAY: Auto Scene started',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'tap-tempo') {
      state.recordTapTempo();
      if (state.autoSceneTempoSource !== 'tap_tempo') {
        state.setAutoSceneTempoSource('tap_tempo');
      }
      const next = useStore.getState();
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          'Tap Tempo',
          `Tapped — ${next.autoSceneTapTempoBpm} BPM`,
          'Auto Scene tempo source switched to Tap Tempo. Tap on the beat to set the BPM.'
        ),
      });
      return;
    }

    if (action.type === 'nudge') {
      const currentBpm = state.autoSceneManualBpm;
      const nextBpm = action.direction === 'up' ? currentBpm + 1 : currentBpm - 1;
      state.setManualBpm(nextBpm);
      if (state.autoSceneTempoSource !== 'manual_bpm') {
        state.setAutoSceneTempoSource('manual_bpm');
      }
      const next = useStore.getState();
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          action.direction === 'up' ? 'Nudge+' : 'Nudge\u2212',
          `Auto Scene tempo ${action.direction === 'up' ? 'increased' : 'decreased'} to ${next.autoSceneManualBpm} BPM`,
          'Auto Scene tempo source switched to Manual BPM.'
        ),
      });
      return;
    }

    if (action.type === 'freeze-dmx') {
      const wasFrozen = state.dmxFrozen;
      if (action.pressed === wasFrozen) {
        publishSurfaceState();
        return;
      }
      state.setDmxFrozen(action.pressed);
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          'Detail View',
          action.pressed ? 'DMX OUTPUT FROZEN' : 'DMX output released',
          action.pressed
            ? 'Backend send suppressed. GUI keeps reflecting state; rig holds last value until released.'
            : 'Backend send re-enabled. Current store state was flushed to the rig.'
        ),
      });
      state.addNotification({
        message: action.pressed ? 'APC40 DMX output FROZEN — press Detail View OFF to release' : 'APC40 DMX output released',
        type: action.pressed ? 'warning' : 'info',
        priority: action.pressed ? 'high' : 'normal',
      });
      return;
    }

    if (action.type === 'toggle-freeze-dmx') {
      toggleMasterFreeze(state, now);
      return;
    }

    if (action.type === 'toggle-color-auto') {
      if (shiftHeldRef.current && action.pressed) {
        const nextPattern = nextInCycle(COLOR_PATTERNS, state.modularAutomation.color.type as typeof COLOR_PATTERNS[number]);
        state.setColorAutomation({ type: nextPattern });
        publishSurfaceState({
          lastChange: makeLastChange(
            'effect',
            'SHIFT+SEND A',
            `Color pattern \u2192 ${nextPattern}`,
            'Cycles modular color engine pattern.'
          ),
        });
        state.addNotification({ message: `APC40 color pattern: ${nextPattern}`, type: 'info', priority: 'low' });
        return;
      }
      if (state.modularAutomation.color.enabled !== action.pressed) {
        state.toggleColorAutomation();
      }
      const enabled = useStore.getState().modularAutomation.color.enabled;
      publishSurfaceState({
        lastChange: makeLastChange(
          'effect',
          'SEND A',
          enabled ? 'Color automation enabled' : 'Color automation disabled',
          'Toggles the modular color automation engine for the current fixture set.'
        ),
      });
      state.addNotification({
        message: `APC40 color automation ${enabled ? 'on' : 'off'}`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'toggle-pan-tilt-auto') {
      if (shiftHeldRef.current && action.pressed) {
        const nextPath = nextInCycle(PAN_TILT_PATHS, state.modularAutomation.panTilt.pathType as typeof PAN_TILT_PATHS[number]);
        state.setPanTiltAutomation({ pathType: nextPath });
        publishSurfaceState({
          lastChange: makeLastChange(
            'effect',
            'SHIFT+SEND B',
            `Pan/Tilt path \u2192 ${nextPath}`,
            'Cycles modular pan/tilt engine path.'
          ),
        });
        state.addNotification({ message: `APC40 pan/tilt path: ${nextPath}`, type: 'info', priority: 'low' });
        return;
      }
      if (state.modularAutomation.panTilt.enabled !== action.pressed) {
        state.togglePanTiltAutomation();
      }
      const enabled = useStore.getState().modularAutomation.panTilt.enabled;
      publishSurfaceState({
        lastChange: makeLastChange(
          'effect',
          'SEND B',
          enabled ? 'Pan/Tilt automation enabled' : 'Pan/Tilt automation disabled',
          'Toggles the modular pan/tilt automation engine for the current fixture set.'
        ),
      });
      state.addNotification({
        message: `APC40 pan/tilt automation ${enabled ? 'on' : 'off'}`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'toggle-effect-auto') {
      if (shiftHeldRef.current && action.pressed) {
        const nextType = nextInCycle(EFFECT_TYPES, state.modularAutomation.effects.type as typeof EFFECT_TYPES[number]);
        state.setEffectsAutomation({ type: nextType });
        publishSurfaceState({
          lastChange: makeLastChange(
            'effect',
            'SHIFT+SEND C',
            `Effect type \u2192 ${nextType}`,
            'Cycles modular effects engine type.'
          ),
        });
        state.addNotification({ message: `APC40 effect type: ${nextType}`, type: 'info', priority: 'low' });
        return;
      }
      if (state.modularAutomation.effects.enabled !== action.pressed) {
        state.toggleEffectsAutomation();
      }
      const enabled = useStore.getState().modularAutomation.effects.enabled;
      publishSurfaceState({
        lastChange: makeLastChange(
          'effect',
          'SEND C',
          enabled ? 'Effects automation enabled' : 'Effects automation disabled',
          'Toggles the modular effects automation engine for the current fixture set.'
        ),
      });
      state.addNotification({
        message: `APC40 effects automation ${enabled ? 'on' : 'off'}`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'nav-fixture') {
      if (action.direction === 'next') state.selectNextFixture();
      else state.selectPreviousFixture();
      const nextState = useStore.getState();
      publishSurfaceState({
        lastChange: makeLastChange(
          'selection',
          action.direction === 'next' ? 'Bank Down' : 'Bank Up',
          `${action.direction === 'next' ? 'Selected next fixture' : 'Selected previous fixture'}: ${targetLabelForSelection(nextState, false)}`,
          'Bank Select Up/Down cycles fixture selection.',
          {
            fixtureNames: selectedFixtureNames(nextState),
            groupNames: selectedGroupNames(nextState),
          }
        ),
        ...apcTargetPatch(null, null, [...nextState.selectedFixtures], targetLabelForSelection(nextState, false)),
      });
      return;
    }

    if (action.type === 'nav-scene') {
      if (action.direction === 'next') state.loadNextScene();
      else state.loadPreviousScene();
      const nextState = useStore.getState();
      publishSurfaceState({
        lastChange: makeLastChange(
          'scene',
          action.direction === 'next' ? 'Bank Right' : 'Bank Left',
          `${action.direction === 'next' ? 'Loaded next scene' : 'Loaded previous scene'}: "${nextState.activeSceneName ?? 'none'}"`,
          'Bank Select Left/Right cycles saved scenes.',
          { sceneName: nextState.activeSceneName ?? undefined }
        ),
      });
      return;
    }

    if (action.type === 'select-all') {
      if (action.pressed) state.selectAllFixtures();
      else state.deselectAllFixtures();
      const nextState = useStore.getState();
      publishSurfaceState({
        lastChange: makeLastChange(
          'selection',
          'PAN',
          action.pressed
            ? `Selected all fixtures (${nextState.selectedFixtures.length})`
            : 'Deselected all fixtures',
          'PAN ON selects all fixtures; PAN OFF clears fixture selection.',
          { fixtureNames: selectedFixtureNames(nextState) }
        ),
        ...apcTargetPatch(null, null, [...nextState.selectedFixtures], `All fixtures (${nextState.selectedFixtures.length})`),
      });
      state.addNotification({
        message: action.pressed ? 'APC40 selected all fixtures' : 'APC40 deselected all fixtures',
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'clear-selection') {
      state.deselectAllFixtures();
      publishSurfaceState();
    }
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (autoGroupsRef.current.size === 0) return;

      const state = useStore.getState();
      const now = Date.now();
      const updates: Record<number, number> = {};

      autoGroupsRef.current.forEach((groupIndex) => {
        const group = state.groups[groupIndex];
        if (!group) return;
        const fixtureIds = group.fixtureIndices
          .map((fixtureIndex) => state.fixtures[fixtureIndex]?.id)
          .filter((fixtureId): fixtureId is string => Boolean(fixtureId));
        if (fixtureIds.length === 0) return;

        const roles = resolveApc40DeviceRoleSlots(state.fixtures, fixtureIds, groupIndex);
        const autoRole = roles.find((role) =>
          ['gobo', 'gobo_rotation', 'color_wheel', 'prism', 'macro', 'speed', 'strobe'].includes(role.controlName)
        ) || roles[0] || DIMMER_ROLE;

        const phase = (now / 700) + groupIndex;
        const value = Math.round((Math.sin(phase) + 1) * 127.5);
        Object.assign(updates, buildRoleUpdates(state.fixtures, fixtureIds, autoRole, value));

        if (Object.keys(updates).length === 0) {
          const breathe = Math.round((Math.sin(now / 900 + groupIndex) + 1) * 127.5);
          Object.assign(updates, buildRoleUpdates(state.fixtures, fixtureIds, DIMMER_ROLE, breathe));
        }
      });

      if (Object.keys(updates).length > 0) {
        state.setMultipleDmxChannels(updates, true);
      }
    }, 120);

    return () => window.clearInterval(interval);
  }, []);
}
