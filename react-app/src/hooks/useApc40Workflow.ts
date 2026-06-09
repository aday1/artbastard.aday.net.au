import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { decodeApc40Message, isApc40Source } from '../midi/apc40';
import {
  apc40DeckSceneName,
  blendApc40DeckScenes,
  buildFullOnUpdates,
  buildRoleUpdates,
  midiToDmx,
  resolveApc40DeviceRoleSlots,
  type Apc40Deck,
  type Apc40RoleSlot,
} from '../midi/apc40WorkflowHelpers';
import { sceneNameToOscPath } from '../utils/sceneCapture';

const TRACK_CONTROL_ROLES: Apc40RoleSlot[] = [
  { label: 'Pan', controlName: 'pan', aliases: ['pan', 'pan_coarse'] },
  { label: 'Tilt', controlName: 'tilt', aliases: ['tilt', 'tilt_coarse'] },
  { label: 'Red', controlName: 'red', aliases: ['red', 'r'] },
  { label: 'Green', controlName: 'green', aliases: ['green', 'g'] },
  { label: 'Blue', controlName: 'blue', aliases: ['blue', 'b'] },
  { label: 'White', controlName: 'white', aliases: ['white', 'w'] },
  { label: 'Strobe', controlName: 'strobe', aliases: ['strobe', 'shutter'] },
  { label: 'Speed', controlName: 'speed', aliases: ['speed', 'rate', 'effect_speed'] },
];

const DIMMER_ROLE: Apc40RoleSlot = {
  label: 'Dimmer',
  controlName: 'dimmer',
  aliases: ['dimmer', 'intensity', 'master'],
};

function sortedColumns(columns: Set<number>): number[] {
  return Array.from(columns).sort((a, b) => a - b);
}

function dispatchSceneTimelineStop() {
  window.dispatchEvent(new CustomEvent('stopSceneTimeline'));
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
    const updates = buildRoleUpdates(state.fixtures, state.selectedFixtures, role, midiToDmx(midiValue));
    if (Object.keys(updates).length > 0) {
      state.setMultipleDmxChannels(updates, true);
    }
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
      publishSurfaceState({ activeDeck: action.pressed ? 'B' : 'A' });
      return;
    }

    if (action.type === 'record-arm') {
      toggleRecordColumn(action.trackIndex);
      state.addNotification({
        message: `APC40 record ${armedColumnsRef.current.has(action.trackIndex) ? 'armed' : 'disarmed'} column ${action.trackIndex + 1} for Deck ${deck}`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'record') {
      toggleAllRecordColumns();
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
        publishSurfaceState({ mode: armedColumnsRef.current.size > 0 ? 'save' : null });
        state.addNotification({
          message: `APC40 saved ${name}`,
          type: 'success',
          priority: 'normal',
        });
        return;
      }

      const scene = state.scenes.find((candidate) => candidate.name === name);
      if (!scene) {
        state.addNotification({
          message: `${name} is empty. Press Record Arm ${action.column + 1}, then this pad to save it.`,
          type: 'warning',
          priority: 'normal',
        });
        return;
      }

      setDeckScene(deck, action.index, scene.name);
      state.loadScene(scene.name);
      publishSurfaceState({ mode: null });
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
        state.addNotification({
          message: `APC40 ACT ${action.sceneIndex + 1} is empty`,
          type: 'warning',
          priority: 'normal',
        });
        return;
      }
      state.playAct(act.id);
      publishSurfaceState();
      return;
    }

    if (action.type === 'track-stop') {
      const cleared = clearDeckScene(deck, action.trackIndex)
        || clearDeckScene(deck);
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
      sceneRefs.current = { A: null, B: null };
      slotRefs.current = { A: null, B: null };
      armedColumnsRef.current.clear();
      state.setApc40SceneA(null);
      state.setApc40SceneB(null);
      state.stopAct();
      useStore.setState({ activeSceneName: null });
      dispatchSceneTimelineStop();
      publishSurfaceState({ mode: null });
      state.addNotification({
        message: 'APC40 stopped all Deck A/B scenes and ACT playback',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'channel-fader') {
      state.applySuperControlMidi('dimmer', midiToDmx(action.value), action.trackIndex);
      return;
    }

    if (action.type === 'master-fader') {
      state.applySuperControlMidi('masterDimmer', midiToDmx(action.value));
      return;
    }

    if (action.type === 'crossfader') {
      const sceneA = state.scenes.find((scene) => scene.name === sceneRefs.current.A);
      const sceneB = state.scenes.find((scene) => scene.name === sceneRefs.current.B);
      const updates = blendApc40DeckScenes(sceneA, sceneB, action.value);
      if (Object.keys(updates).length > 0) state.setMultipleDmxChannels(updates, true);
      return;
    }

    if (action.type === 'device-control') {
      const roles = resolveApc40DeviceRoleSlots(state.fixtures, state.selectedFixtures, deviceRoleBankRef.current);
      const role = roles[action.slotIndex];
      if (!role) return;
      applyRoleToSelection(role, action.value);
      publishSurfaceState({ deviceRoleLabels: roles.map((candidate) => candidate.label) });
      return;
    }

    if (action.type === 'track-control') {
      const role = TRACK_CONTROL_ROLES[action.slotIndex];
      if (!role) return;
      applyRoleToSelection(role, action.value);
      return;
    }

    if (action.type === 'cue-level') {
      const roles = resolveApc40DeviceRoleSlots(state.fixtures, state.selectedFixtures, 0);
      deviceRoleBankRef.current = roles.length > 0 ? Math.floor(action.value / 16) % roles.length : 0;
      publishSurfaceState();
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
        publishSurfaceState({ fullOn: false });
        state.addNotification({ message: 'APC40 FULL ON released', type: 'info', priority: 'normal' });
      } else {
        const updates = buildFullOnUpdates(state.fixtures);
        fullOnSnapshotRef.current = [...state.dmxChannels];
        if (Object.keys(updates).length > 0) state.setMultipleDmxChannels(updates, true);
        publishSurfaceState({ fullOn: true });
        state.addNotification({ message: 'APC40 FULL ON latched', type: 'warning', priority: 'normal' });
      }
      return;
    }

    if (action.type === 'track-select') {
      activeGroupIndexRef.current = action.trackIndex;
      const group = state.groups[action.trackIndex];
      if (group) {
        state.selectFixtureGroup(group.id);
        state.addNotification({
          message: `APC40 selected group "${group.name}"`,
          type: 'info',
          priority: 'low',
        });
      } else {
        const fixture = state.fixtures[action.trackIndex];
        if (fixture) {
          state.setSelectedFixtures([fixture.id]);
          state.addNotification({
            message: `APC40 selected fixture "${fixture.name}"`,
            type: 'info',
            priority: 'low',
          });
        }
      }
      publishSurfaceState();
      return;
    }

    if (action.type === 'solo-cue') {
      const groupIndex = activeGroupIndexRef.current;
      const group = state.groups[groupIndex] || state.groups[action.trackIndex];
      if (!group) return;
      const fixtureIndex = group.fixtureIndices[action.trackIndex];
      const fixture = fixtureIndex !== undefined ? state.fixtures[fixtureIndex] : undefined;
      if (!fixture) return;

      if (soloRestoreRef.current?.fixtureId === fixture.id) {
        state.setSelectedFixtures(soloRestoreRef.current.restoreIds);
        soloRestoreRef.current = null;
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
        state.addNotification({
          message: `APC40 SOLO/CUE isolated "${fixture.name}" from "${group.name}"`,
          type: 'info',
          priority: 'low',
        });
      }
      publishSurfaceState();
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
      publishSurfaceState({ autoGroups: sortedColumns(autoGroupsRef.current) });
      state.addNotification({
        message: `APC40 ${autoGroupsRef.current.has(action.trackIndex) ? 'enabled' : 'disabled'} auto control for "${group.name}"`,
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'nav-fixture') {
      if (action.direction === 'next') state.selectNextFixture();
      else state.selectPreviousFixture();
      publishSurfaceState();
      return;
    }

    if (action.type === 'nav-scene') {
      if (action.direction === 'next') state.loadNextScene();
      else state.loadPreviousScene();
      return;
    }

    if (action.type === 'select-all') {
      state.selectAllFixtures();
      publishSurfaceState();
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
