import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { decodeApc40Message, isApc40Source } from '../midi/apc40';
import { sceneNameToOscPath } from '../utils/sceneCapture';

function sceneSlotName(index: number) {
  return `APC40 Scene ${index + 1}`;
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
  const setApc40Mode = useStore((state) => state.setApc40Mode);
  const lastSignature = useRef('');
  const shiftHeldRef = useRef(false);
  const sceneARef = useRef<string | null>(null);
  const sceneBRef = useRef<string | null>(null);
  const modeRef = useRef<'save' | 'pickA' | 'pickB' | null>(null);

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
      // SHIFT now cancels any active picker/save mode (escape gesture).
      if (modeRef.current) {
        modeRef.current = null;
        setApc40Mode(null);
        addNotification({
          message: 'APC40 mode cancelled',
          type: 'info',
          priority: 'low',
        });
        return;
      }
      const next = !shiftHeldRef.current;
      shiftHeldRef.current = next;
      setApc40Shift(next);
      return;
    }

    if (action.type === 'record') {
      const next = modeRef.current === 'save' ? null : 'save';
      modeRef.current = next;
      setApc40Mode(next);
      addNotification({
        message: next
          ? 'APC40 SAVE mode — tap a scene pad to overwrite/fill it'
          : 'APC40 SAVE mode cancelled',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'play') {
      const next = modeRef.current === 'pickA' ? null : 'pickA';
      modeRef.current = next;
      setApc40Mode(next);
      addNotification({
        message: next
          ? 'APC40 PLAY — pick Scene A for crossfader'
          : 'APC40 pick-A cancelled',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'stop') {
      const next = modeRef.current === 'pickB' ? null : 'pickB';
      modeRef.current = next;
      setApc40Mode(next);
      addNotification({
        message: next
          ? 'APC40 STOP — pick Scene B for crossfader'
          : 'APC40 pick-B cancelled',
        type: 'info',
        priority: 'normal',
      });
      return;
    }

    if (action.type === 'scene-launch') {
      const mode = modeRef.current;

      if (mode === 'save') {
        const existing = scenes[action.sceneIndex];
        const name = existing ? existing.name : sceneSlotName(action.sceneIndex);
        saveScene(name, sceneNameToOscPath(name));
        modeRef.current = null;
        setApc40Mode(null);
        addNotification({
          message: `APC40 SAVE → "${name}" (slot ${action.sceneIndex + 1})`,
          type: 'success',
          priority: 'normal',
        });
        return;
      }

      if (mode === 'pickA' || mode === 'pickB') {
        const scene = scenes[action.sceneIndex];
        if (!scene) {
          addNotification({
            message: `APC40 pick-${mode === 'pickA' ? 'A' : 'B'}: slot ${action.sceneIndex + 1} is empty`,
            type: 'warning',
            priority: 'normal',
          });
          return;
        }
        if (mode === 'pickA') {
          sceneARef.current = scene.name;
          setApc40SceneA(scene.name);
        } else {
          sceneBRef.current = scene.name;
          setApc40SceneB(scene.name);
        }
        modeRef.current = null;
        setApc40Mode(null);
        addNotification({
          message: `APC40 Crossfader ${mode === 'pickA' ? 'A' : 'B'} = "${scene.name}"`,
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

    if (action.type === 'clear-selection' || action.type === 'track-stop') {
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
    setApc40Mode,
    setDmxChannelValue,
    setSelectedFixtures,
  ]);
}
