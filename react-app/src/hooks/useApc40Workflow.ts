import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { decodeApc40Message, isApc40Source } from '../midi/apc40';
import { sceneNameToOscPath } from '../utils/sceneCapture';

function sceneSlotName(index: number) {
  return `APC40 Scene ${index + 1}`;
}

function quickSceneName() {
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
  return `APC40 Capture ${stamp}`;
}

const FADER_CONTROL_BY_TRACK = [
  'dimmer',
  'pan',
  'tilt',
  'red',
  'green',
  'blue',
  'gobo',
  'strobe',
] as const;

function midiToDmx(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255 / 127)));
}

export function useApc40Workflow() {
  const latestMessage = useStore((state) => state.midiMessages[state.midiMessages.length - 1]);
  const scenes = useStore((state) => state.scenes);
  const fixtures = useStore((state) => state.fixtures);
  const groups = useStore((state) => state.groups);
  const selectedFixtures = useStore((state) => state.selectedFixtures);
  const loadScene = useStore((state) => state.loadScene);
  const saveScene = useStore((state) => state.saveScene);
  const setSelectedFixtures = useStore((state) => state.setSelectedFixtures);
  const selectFixtureGroup = useStore((state) => state.selectFixtureGroup);
  const deselectAllFixtures = useStore((state) => state.deselectAllFixtures);
  const selectAllFixtures = useStore((state) => state.selectAllFixtures);
  const selectNextFixture = useStore((state) => state.selectNextFixture);
  const selectPreviousFixture = useStore((state) => state.selectPreviousFixture);
  const loadNextScene = useStore((state) => state.loadNextScene);
  const loadPreviousScene = useStore((state) => state.loadPreviousScene);
  const addNotification = useStore((state) => state.addNotification);
  const applySuperControlMidi = useStore((state) => state.applySuperControlMidi);
  const setDmxChannelValue = useStore((state) => state.setDmxChannelValue);
  const setApc40SceneA = useStore((state) => state.setApc40SceneA);
  const setApc40SceneB = useStore((state) => state.setApc40SceneB);
  const setApc40Shift = useStore((state) => state.setApc40Shift);
  const lastSignature = useRef('');
  const shiftHeldRef = useRef(false);
  const sceneARef = useRef<string | null>(null);
  const sceneBRef = useRef<string | null>(null);
  const nextAssignRef = useRef<'A' | 'B'>('A');

  useEffect(() => {
    if (!latestMessage || !isApc40Source(latestMessage.source)) return;

    const signature = JSON.stringify(latestMessage);
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    const action = decodeApc40Message(latestMessage);
    if (!action) return;

    if (action.type === 'channel-fader') {
      const control = FADER_CONTROL_BY_TRACK[action.trackIndex];
      if (!control) return;
      applySuperControlMidi(control, midiToDmx(action.value));
      return;
    }

    if (action.type === 'master-fader') {
      const value = midiToDmx(action.value);
      fixtures.forEach((fixture) => {
        for (let i = 0; i < fixture.channels.length; i++) {
          const ch = fixture.channels[i];
          const type = (ch.type || '').toLowerCase();
          if (type === 'dimmer' || type === 'intensity' || type === 'master') {
            setDmxChannelValue(fixture.startAddress + i - 1, value);
            break;
          }
        }
      });
      return;
    }

    if (action.type === 'crossfader') {
      const aName = sceneARef.current;
      const bName = sceneBRef.current;
      if (!aName || !bName) return;
      const sceneA = scenes.find((s) => s.name === aName);
      const sceneB = scenes.find((s) => s.name === bName);
      if (!sceneA || !sceneB) return;
      const t = action.value / 127;
      const len = Math.max(sceneA.channelValues.length, sceneB.channelValues.length);
      for (let i = 0; i < len; i++) {
        const a = sceneA.channelValues[i] ?? 0;
        const b = sceneB.channelValues[i] ?? 0;
        if (a === 0 && b === 0) continue;
        const blended = Math.round(a * (1 - t) + b * t);
        setDmxChannelValue(i, blended);
      }
      return;
    }

    if (action.type === 'shift') {
      const next = !shiftHeldRef.current;
      shiftHeldRef.current = next;
      setApc40Shift(next);
      addNotification({
        message: `APC40 SHIFT ${next ? 'latched — next scene press assigns to crossfader' : 'released'}`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'scene-launch') {
      if (shiftHeldRef.current) {
        const scene = scenes[action.sceneIndex];
        if (!scene) {
          addNotification({
            message: `APC40 SHIFT+scene: slot ${action.sceneIndex + 1} is empty — assign skipped`,
            type: 'warning',
            priority: 'normal',
          });
          return;
        }
        const slot = nextAssignRef.current;
        if (slot === 'A') {
          sceneARef.current = scene.name;
          setApc40SceneA(scene.name);
          nextAssignRef.current = 'B';
        } else {
          sceneBRef.current = scene.name;
          setApc40SceneB(scene.name);
          nextAssignRef.current = 'A';
        }
        addNotification({
          message: `APC40 Crossfader ${slot} = "${scene.name}"`,
          type: 'success',
          priority: 'normal',
        });
        return;
      }

      const scene = scenes[action.sceneIndex];
      if (scene) {
        loadScene(scene.name);
        addNotification({
          message: `APC40 launched scene ${action.sceneIndex + 1}: ${scene.name}`,
          type: 'success',
          priority: 'normal',
        });
      } else {
        const name = sceneSlotName(action.sceneIndex);
        saveScene(name, sceneNameToOscPath(name));
        addNotification({
          message: `APC40 captured empty scene slot ${action.sceneIndex + 1}`,
          type: 'success',
          priority: 'normal',
        });
      }
      return;
    }

    if (action.type === 'record') {
      const name = quickSceneName();
      saveScene(name, sceneNameToOscPath(name));
      addNotification({
        message: `APC40 captured "${name}"`,
        type: 'success',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'play') {
      window.dispatchEvent(new CustomEvent('artbastard:apc40-create-show'));
      addNotification({
        message: 'APC40 requested Create Show from the current show map',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'clear-selection' || action.type === 'track-stop' || action.type === 'stop') {
      deselectAllFixtures();
      addNotification({
        message: 'APC40 cleared fixture selection',
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'multi-select-add') {
      const fixture = fixtures[action.trackIndex];
      if (!fixture) return;
      const exists = selectedFixtures.includes(fixture.id);
      const next = exists
        ? selectedFixtures.filter((id) => id !== fixture.id)
        : [...selectedFixtures, fixture.id];
      setSelectedFixtures(next);
      addNotification({
        message: `APC40 ACTIVATOR ${exists ? 'removed' : 'added'} "${fixture.name}"`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'multi-select-solo') {
      const fixture = fixtures[action.trackIndex];
      if (!fixture) return;
      setSelectedFixtures([fixture.id]);
      addNotification({
        message: `APC40 SOLO isolated "${fixture.name}"`,
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'track-select') {
      const group = groups[action.trackIndex];
      if (group) {
        selectFixtureGroup(group.id);
        addNotification({
          message: `APC40 selected group "${group.name}"`,
          type: 'info',
          priority: 'low',
        });
      } else {
        const fixture = fixtures[action.trackIndex];
        if (fixture) {
          setSelectedFixtures([fixture.id]);
          addNotification({
            message: `APC40 selected fixture "${fixture.name}"`,
            type: 'info',
            priority: 'low',
          });
        }
      }
      return;
    }

    if (action.type === 'nav-fixture') {
      if (action.direction === 'next') selectNextFixture();
      else selectPreviousFixture();
      return;
    }

    if (action.type === 'nav-scene') {
      if (action.direction === 'next') loadNextScene();
      else loadPreviousScene();
      return;
    }

    if (action.type === 'select-all') {
      selectAllFixtures();
      addNotification({
        message: 'APC40 selected all fixtures',
        type: 'info',
        priority: 'low',
      });
      return;
    }

    if (action.type === 'clip-launch') {
      const fixture = fixtures[action.index];
      if (fixture) {
        const next = selectedFixtures.includes(fixture.id)
          ? selectedFixtures.filter((id) => id !== fixture.id)
          : [...selectedFixtures, fixture.id];
        setSelectedFixtures(next);
        addNotification({
          message: `APC40 ${next.includes(fixture.id) ? 'selected' : 'released'} fixture "${fixture.name}"`,
          type: 'info',
          priority: 'low',
        });
      } else {
        window.dispatchEvent(new CustomEvent('artbastard:apc40-add-template', {
          detail: { templateIndex: action.index },
        }));
      }
    }
  }, [
    addNotification,
    applySuperControlMidi,
    deselectAllFixtures,
    fixtures,
    groups,
    latestMessage,
    loadNextScene,
    loadPreviousScene,
    loadScene,
    saveScene,
    scenes,
    selectAllFixtures,
    selectFixtureGroup,
    selectNextFixture,
    selectPreviousFixture,
    selectedFixtures,
    setApc40SceneA,
    setApc40SceneB,
    setApc40Shift,
    setDmxChannelValue,
    setSelectedFixtures,
  ]);
}
