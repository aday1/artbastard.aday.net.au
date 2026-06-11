import { useEffect, useRef } from 'react';
import { useStore, type Apc40LastChange } from '../store';
import { decodeApc40Message, isApc40Source } from '../midi/apc40';
import {
  apc40DeckSceneName,
  APC40_TRACK_CONTROL_ROLES,
  blendApc40DeckScenes,
  buildFullOnUpdates,
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
  const soloRestoreRef = useRef<{ groupIndex: number; fixtureId: string; restoreIds: string[] } | null>(null);
  const fullOnSnapshotRef = useRef<number[] | null>(null);
  const deviceRoleBankRef = useRef(0);
  const autoGroupsRef = useRef<Set<number>>(new Set());
  const suppressTrackControlUntilRef = useRef(0);

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

  const toggleRecordColumn = (column: number) => {
    if (armedColumnsRef.current.has(column)) {
      armedColumnsRef.current.delete(column);
    } else {
      armedColumnsRef.current.add(column);
    }
    publishSurfaceState({ mode: armedColumnsRef.current.size > 0 ? 'save' : null });
  };

  const toggleAllRecordColumns = () => {
    if (armedColumnsRef.current.size > 0) {
      armedColumnsRef.current.clear();
    } else {
      for (let column = 0; column < 8; column += 1) armedColumnsRef.current.add(column);
    }
    publishSurfaceState({ mode: armedColumnsRef.current.size > 0 ? 'save' : null });
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

    if (action.type === 'record-arm') {
      toggleRecordColumn(action.trackIndex);
      const armed = armedColumnsRef.current.has(action.trackIndex);
      publishSurfaceState({
        mode: armedColumnsRef.current.size > 0 ? 'save' : null,
        lastChange: makeLastChange(
          'scene',
          `Record Arm ${action.trackIndex + 1}`,
          `${armed ? 'Armed' : 'Disarmed'} save column ${action.trackIndex + 1} for Deck ${deck}`,
          armed
            ? `Next clip-grid pad in column ${action.trackIndex + 1} saves current DMX to Deck ${deck}.`
            : `Column ${action.trackIndex + 1} will launch saved scenes instead of saving.`
        ),
      });
      state.addNotification({
        message: `APC40 record ${armed ? 'armed' : 'disarmed'} column ${action.trackIndex + 1} for Deck ${deck}`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'record') {
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

    if (action.type === 'stop-all-clips' || action.type === 'stop') {
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
          action.type === 'stop' ? 'STOP' : 'Stop All Clips',
          hadPlayback
            ? 'Stopped Deck A/B scenes and ACT playback'
            : 'Stop pressed with no active Deck scene or ACT playback',
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
      const roles = resolveApc40DeviceRoleSlots(state.fixtures, state.selectedFixtures, 0);
      deviceRoleBankRef.current = roles.length > 0 ? Math.floor(action.value / 16) % roles.length : 0;
      const activeRoles = resolveApc40DeviceRoleSlots(state.fixtures, state.selectedFixtures, deviceRoleBankRef.current);
      publishSurfaceState({
        deviceRoleLabels: activeRoles.map((role) => role.label),
        lastChange: makeLastChange(
          'device',
          'Cue Level',
          `Rotated Device Control bank to ${deviceRoleBankRef.current + 1}`,
          `D1-D8 now expose: ${formatList(activeRoles.map((role) => role.label))}.`,
          { value: action.value }
        ),
      });
      return;
    }

    if (action.type === 'master-button') {
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
            'Master Track Select',
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
            'Master Track Select',
            'Latched FULL ON across patched fixtures',
            `Raised ${Object.keys(updates).length} fixture DMX channel${Object.keys(updates).length === 1 ? '' : 's'} to full, excluding reset/lamp/function-style channels.`
          ),
        });
        state.addNotification({ message: 'APC40 FULL ON latched', type: 'warning', priority: 'normal' });
      }
      return;
    }

    if (action.type === 'track-select') {
      suppressTrackControlUntilRef.current = Date.now() + TRACK_SELECT_ENCODER_SUPPRESSION_MS;
      activeGroupIndexRef.current = action.trackIndex;
      const group = state.groups[action.trackIndex];
      if (group) {
        state.selectFixtureGroup(group.id);
        const fixtureNames = group.fixtureIndices
          .map((fixtureIndex) => state.fixtures[fixtureIndex]?.name)
          .filter((name): name is string => Boolean(name));
        publishSurfaceState({
          lastChange: makeLastChange(
            'selection',
            `Track Select ${action.trackIndex + 1}`,
            `Selected fixture group "${group.name}"`,
            fixtureNames.length > 0 ? `Group contains ${formatList(fixtureNames.map(quoted))}.` : 'Group has no patched fixtures.',
            { groupNames: [group.name], fixtureNames }
          ),
        });
        state.addNotification({
          message: `APC40 selected group "${group.name}"`,
          type: 'info',
          priority: 'low',
        });
      } else {
        const fixture = state.fixtures[action.trackIndex];
        if (fixture) {
          state.setSelectedFixtures([fixture.id]);
          publishSurfaceState({
            lastChange: makeLastChange(
              'selection',
              `Track Select ${action.trackIndex + 1}`,
              `Selected fixture "${fixture.name}"`,
              'No fixture group exists in this slot, so Track Select fell back to direct fixture selection.',
              { fixtureNames: [fixture.name] }
            ),
          });
          state.addNotification({
            message: `APC40 selected fixture "${fixture.name}"`,
            type: 'info',
            priority: 'low',
          });
        } else {
          publishSurfaceState({
            lastChange: makeLastChange(
              'selection',
              `Track Select ${action.trackIndex + 1}`,
              `Track Select ${action.trackIndex + 1} has no group or fixture`,
              'No selection changed.'
            ),
          });
        }
      }
      return;
    }

    if (action.type === 'solo-cue') {
      const groupIndex = activeGroupIndexRef.current;
      const group = state.groups[groupIndex] || state.groups[action.trackIndex];
      if (!group) {
        publishSurfaceState({
          lastChange: makeLastChange(
            'selection',
            `Solo/Cue ${action.trackIndex + 1}`,
            `Solo/Cue ${action.trackIndex + 1} has no active group`,
            'Select a group before isolating fixtures.'
          ),
        });
        return;
      }
      const fixtureIndex = group.fixtureIndices[action.trackIndex];
      const fixture = fixtureIndex !== undefined ? state.fixtures[fixtureIndex] : undefined;
      if (!fixture) {
        publishSurfaceState({
          lastChange: makeLastChange(
            'selection',
            `Solo/Cue ${action.trackIndex + 1}`,
            `Solo/Cue ${action.trackIndex + 1} found no fixture in "${group.name}"`,
            'No selection changed.',
            { groupNames: [group.name] }
          ),
        });
        return;
      }

      if (soloRestoreRef.current?.fixtureId === fixture.id) {
        state.setSelectedFixtures(soloRestoreRef.current.restoreIds);
        soloRestoreRef.current = null;
        publishSurfaceState({
          lastChange: makeLastChange(
            'selection',
            `Solo/Cue ${action.trackIndex + 1}`,
            `Released solo for "${fixture.name}"`,
            `Restored the previous fixture selection in group "${group.name}".`,
            { fixtureNames: [fixture.name], groupNames: [group.name] }
          ),
        });
        state.addNotification({
          message: `APC40 solo released "${fixture.name}"`,
          type: 'info',
          priority: 'low',
        });
      } else {
        soloRestoreRef.current = {
          groupIndex,
          fixtureId: fixture.id,
          restoreIds: [...state.selectedFixtures],
        };
        state.setSelectedFixtures([fixture.id]);
        publishSurfaceState({
          lastChange: makeLastChange(
            'selection',
            `Solo/Cue ${action.trackIndex + 1}`,
            `Isolated "${fixture.name}" from "${group.name}"`,
            'Solo/Cue temporarily targets one fixture inside the active group.',
            { fixtureNames: [fixture.name], groupNames: [group.name] }
          ),
        });
        state.addNotification({
          message: `APC40 SOLO/CUE isolated "${fixture.name}" from "${group.name}"`,
          type: 'info',
          priority: 'low',
        });
      }
      return;
    }

    if (action.type === 'activator') {
      const group = state.groups[action.trackIndex];
      if (!group) {
        state.addNotification({
          message: `APC40 auto group ${action.trackIndex + 1} is empty`,
          type: 'warning',
          priority: 'low',
        });
        return;
      }
      if (autoGroupsRef.current.has(action.trackIndex)) {
        autoGroupsRef.current.delete(action.trackIndex);
      } else {
        autoGroupsRef.current.add(action.trackIndex);
      }
      state.selectFixtureGroup(group.id);
      const enabled = autoGroupsRef.current.has(action.trackIndex);
      publishSurfaceState({
        autoGroups: sortedColumns(autoGroupsRef.current),
        lastChange: makeLastChange(
          'effect',
          `Activator ${action.trackIndex + 1}`,
          `${enabled ? 'Enabled' : 'Disabled'} APC40 auto-control for "${group.name}"`,
          'Auto-control modulates context-aware fixture roles for that group.',
          { groupNames: [group.name] }
        ),
      });
      state.addNotification({
        message: `APC40 ${enabled ? 'enabled' : 'disabled'} auto control for "${group.name}"`,
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'play') {
      publishSurfaceState({
        lastChange: makeLastChange(
          'transport',
          'PLAY',
          'PLAY is reserved in ArtBastard today',
          'The button is decoded and shown in monitors, but it does not trigger live DMX yet.'
        ),
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
