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
  const latestMessage = useStore((state) => state.midiMessages[state.midiMessages.length - 1]);
  const fixturesForRoles = useStore((state) => state.fixtures);
  const selectedForRoles = useStore((state) => state.selectedFixtures);
  const setApc40StatePatch = useStore((state) => state.setApc40StatePatch);

  const lastSignature = useRef('');
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
      autoGroups: sortedColumns(autoGroupsRef.current),
      deviceRoleLabels: roles.map((role) => role.label),
      ...patch,
    });
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

  const toggleAllRecordColumns = () => {
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
    if (!latestMessage || !isApc40Source(latestMessage.source)) return;

    const signature = JSON.stringify(latestMessage);
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    const action = decodeApc40Message(latestMessage);
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

      const wasEmpty = soloedGroupsRef.current.size === 0;
      const alreadyOn = soloedGroupsRef.current.has(action.trackIndex);
      if (alreadyOn) {
        soloedGroupsRef.current.delete(action.trackIndex);
      } else {
        if (wasEmpty) soloSnapshotRef.current = [...state.dmxChannels];
        soloedGroupsRef.current.add(action.trackIndex);
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
          alreadyOn
            ? `Released solo on group "${group.name}"`
            : `Soloed group "${group.name}"`,
          soloedGroupsRef.current.size > 0
            ? `Currently soloed: ${formatList(soloedNames.map(quoted))}. Other fixtures dimmed to 0.`
            : 'No groups soloed; previous DMX snapshot restored.',
          { groupNames: [group.name] }
        ),
      });
      state.addNotification({
        message: alreadyOn
          ? `APC40 released solo on "${group.name}"`
          : `APC40 soloed group "${group.name}"`,
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
          message: `APC40 rolled fresh random look (${touchedFixtures} fixtures). Press REC + a pad to save.`,
          type: 'success',
          priority: 'normal',
        });
        return;
      }

      toggleAllRecordColumns();
      publishSurfaceState({
        mode: armedColumnsRef.current.size > 0 ? 'save' : null,
        lastChange: makeLastChange(
          'scene',
          'REC',
          armedColumnsRef.current.size > 0
            ? `Armed all save columns for Deck ${deck}`
            : 'Cleared all armed save columns',
          armedColumnsRef.current.size > 0
            ? `Any clip-grid pad can now save the current DMX look into Deck ${deck}.`
            : 'Clip-grid pads are back to launch mode.'
        ),
      });
      state.addNotification({
        message: armedColumnsRef.current.size > 0
          ? `APC40 record armed all grid columns for Deck ${deck}`
          : 'APC40 record arms cleared',
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
            `Press Record Arm ${action.column + 1}, then this pad to save the current DMX look.`,
            { sceneName: name }
          ),
        });
        state.addNotification({
          message: `${name} is empty. Press Record Arm ${action.column + 1}, then this pad to save it.`,
          type: 'warning',
          priority: 'normal',
        });
        return;
      }

      setDeckScene(deck, action.index, scene.name);
      state.loadScene(scene.name);
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
            `Save mode is armed for Deck ${deck}. Press a clip-grid pad in an armed Record Arm column to save or overwrite a Deck scene.`
          ),
        });
        state.addNotification({
          message: 'APC40 save mode uses the clip grid, not Scene Launch. Press an armed column pad to save.',
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
          'Panic-safe stop clears active decks, armed columns, ACT playback, and scene timeline playback.'
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
            : 'Device Control needs Track Select or a fixture selection before it can write DMX.',
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
            : 'Track Control needs Track Select or a fixture selection before it can write DMX.',
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
      const roles = resolveApc40DeviceRoleSlots(state.fixtures, state.selectedFixtures, 0);
      const total = roles.length || 1;
      const delta = action.type === 'bank-next' ? 1 : -1;
      deviceRoleBankRef.current = ((deviceRoleBankRef.current + delta) % total + total) % total;
      const activeRoles = resolveApc40DeviceRoleSlots(
        state.fixtures, state.selectedFixtures, deviceRoleBankRef.current,
      );
      publishSurfaceState({
        deviceRoleLabels: activeRoles.map((role) => role.label),
        lastChange: makeLastChange(
          'device',
          action.type === 'bank-next' ? 'Device Bank \u2192' : 'Device Bank \u2190',
          `Rotated Device Control bank to ${deviceRoleBankRef.current + 1}`,
          `D1-D8 now expose: ${formatList(activeRoles.map((role) => role.label))}.`,
        ),
      });
      return;
    }

    if (action.type === 'full-on') {
      if (fullOnSnapshotRef.current) {
        const restore: Record<number, number> = {};
        fullOnSnapshotRef.current.forEach((value, channel) => {
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
      // Toggle: latch all DMX to 0 (snapshot prev state), or restore snapshot.
      if (blackoutSnapshotRef.current) {
        const restore: Record<number, number> = {};
        blackoutSnapshotRef.current.forEach((value, channel) => {
          if (state.dmxChannels[channel] !== value) restore[channel] = value;
        });
        blackoutSnapshotRef.current = null;
        if (Object.keys(restore).length > 0) state.setMultipleDmxChannels(restore, true);
        publishSurfaceState({
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
      // Solo/Cue row (note 0x31): toggle fixture in/out of multi-selection.
      suppressTrackControlUntilRef.current = Date.now() + TRACK_SELECT_ENCODER_SUPPRESSION_MS;
      const fixture = state.fixtures[action.trackIndex];
      if (fixture) {
        const wasSelected = state.selectedFixtures.includes(fixture.id);
        state.toggleFixtureSelection(fixture.id);
        state.deselectAllChannels();
        const nextSelection = wasSelected
          ? state.selectedFixtures.filter((id) => id !== fixture.id)
          : [...state.selectedFixtures, fixture.id];
        publishSurfaceState({
          ...apcTargetPatch(action.trackIndex, null, nextSelection, `Fixture ${action.trackIndex + 1}: ${fixture.name}`),
          lastChange: makeLastChange(
            'selection',
            `Select Fixture ${action.trackIndex + 1}`,
            wasSelected
              ? `Deselected fixture "${fixture.name}" (${nextSelection.length} now selected)`
              : `Added fixture "${fixture.name}" to selection (${nextSelection.length} now selected)`,
            'Solo/Cue row toggles individual fixtures in the live selection.',
            { fixtureNames: [fixture.name] }
          ),
        });
        state.addNotification({
          message: wasSelected
            ? `APC40 deselected fixture "${fixture.name}"`
            : `APC40 added fixture "${fixture.name}" to selection`,
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
      // Activator row (note 0x32): toggle the group's fixtures in/out of multi-selection.
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
        const nextSelection = allAlreadySelected
          ? currentSelection.filter((id) => !groupFixtureIds.includes(id))
          : Array.from(new Set([...currentSelection, ...groupFixtureIds]));
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
            allAlreadySelected
              ? `Removed group "${group.name}" from selection (${nextSelection.length} now selected)`
              : `Added group "${group.name}" to selection (${nextSelection.length} now selected)`,
            fixtureNames.length > 0 ? `Group contains ${formatList(fixtureNames.map(quoted))}.` : 'Group has no patched fixtures.',
            { groupNames: [group.name], fixtureNames }
          ),
        });
        state.addNotification({
          message: allAlreadySelected
            ? `APC40 removed group "${group.name}" from selection`
            : `APC40 added group "${group.name}" to selection`,
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
      state.setDmxFrozen(!wasFrozen);
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          'Master Select',
          wasFrozen ? 'DMX output released' : 'DMX OUTPUT FROZEN',
          wasFrozen
            ? 'Backend send re-enabled. Current store state was flushed to the rig.'
            : 'Backend send suppressed. GUI keeps reflecting state; rig holds last value until released.'
        ),
      });
      state.addNotification({
        message: wasFrozen ? 'APC40 DMX output released' : 'APC40 DMX output FROZEN — press Master again to release',
        type: wasFrozen ? 'info' : 'warning',
        priority: wasFrozen ? 'normal' : 'high',
      });
      return;
    }

    if (action.type === 'toggle-color-auto') {
      if (shiftHeldRef.current) {
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
      state.toggleColorAutomation();
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
      if (shiftHeldRef.current) {
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
      state.togglePanTiltAutomation();
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
      if (shiftHeldRef.current) {
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
      state.toggleEffectsAutomation();
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
      state.selectAllFixtures();
      const nextState = useStore.getState();
      publishSurfaceState({
        lastChange: makeLastChange(
          'selection',
          'PAN',
          `Selected all fixtures (${nextState.selectedFixtures.length})`,
          'PAN utility button is mapped as Select All in ArtBastard.',
          { fixtureNames: selectedFixtureNames(nextState) }
        ),
        ...apcTargetPatch(null, null, [...nextState.selectedFixtures], `All fixtures (${nextState.selectedFixtures.length})`),
      });
      state.addNotification({
        message: 'APC40 selected all fixtures',
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'clear-selection') {
      state.deselectAllFixtures();
      publishSurfaceState();
    }
  }, [latestMessage]); // eslint-disable-line react-hooks/exhaustive-deps

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
