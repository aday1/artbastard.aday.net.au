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
  const addNotification = useStore((state) => state.addNotification);
  const lastSignature = useRef('');

  useEffect(() => {
    if (!latestMessage || !isApc40Source(latestMessage.source)) return;

    const signature = JSON.stringify(latestMessage);
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    const action = decodeApc40Message(latestMessage);
    if (!action) return;

    if (action.type === 'scene-launch') {
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

    if (action.type === 'clear-selection' || action.type === 'track-stop' || action.type === 'stop') {
      deselectAllFixtures();
      addNotification({
        message: 'APC40 cleared fixture selection',
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
    deselectAllFixtures,
    fixtures,
    groups,
    latestMessage,
    loadScene,
    saveScene,
    scenes,
    selectFixtureGroup,
    selectedFixtures,
    setSelectedFixtures,
  ]);
}

