import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useStore } from '../store';
import { useTheme } from './ThemeContext';
import { useRouter } from './RouterContext';
import { useMidiLearn } from '../hooks/useMidiLearn';
import { useContextMenu } from '../hooks/useContextMenu';
import { ContextMenu } from '../components/ui/ContextMenu';
import {
  buildAppContextMenu,
  buildDmxChannelContextMenu,
  buildFixtureContextMenu,
} from '../components/dmx/dmxContextMenus';

export const DMX_EDIT_CHANNEL_NAME = 'dmx-edit-channel-name';

interface ContextMenuContextValue {
  openAppMenu: (event: React.MouseEvent) => void;
  openChannelMenu: (event: React.MouseEvent, channelIndex: number) => void;
  openFixtureMenu: (
    event: React.MouseEvent,
    fixture: { id: string; name: string },
    onRenameFixture: (fixtureId: string, newName: string) => void
  ) => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const { menu, openMenu, closeMenu } = useContextMenu();
  const { theme, darkMode, toggleDarkMode, setTheme } = useTheme();
  const { setCurrentView } = useRouter();
  const toggleSparkles = useStore((s) => s.toggleSparkles);
  const sparklesEnabled = useStore((s) => s.uiSettings.sparklesEnabled);

  const dmxChannels = useStore((s) => s.dmxChannels);
  const selectedChannels = useStore((s) => s.selectedChannels);
  const pinnedChannels = useStore((s) => s.pinnedChannels);
  const channelNames = useStore((s) => s.channelNames);
  const midiMappings = useStore((s) => s.midiMappings);
  const selectedFixtures = useStore((s) => s.selectedFixtures);
  const setDmxChannel = useStore((s) => s.setDmxChannel);
  const setChannelRange = useStore((s) => s.setChannelRange);
  const toggleChannelSelection = useStore((s) => s.toggleChannelSelection);
  const togglePinChannel = useStore((s) => s.togglePinChannel);
  const setRandomChannelColor = useStore((s) => s.setRandomChannelColor);
  const selectAllChannels = useStore((s) => s.selectAllChannels);
  const deselectAllChannels = useStore((s) => s.deselectAllChannels);
  const removeMidiMapping = useStore((s) => s.removeMidiMapping);
  const setOscAssignment = useStore((s) => s.setOscAssignment);
  const oscAssignments = useStore((s) => s.oscAssignments);
  const jumpToChannel = useStore((s) => s.jumpToChannel);
  const toggleFixtureSelection = useStore((s) => s.toggleFixtureSelection);
  const addNotification = useStore((s) => s.addNotification);
  const transitionPatterns = useStore((s) => s.transitionPatterns);
  const activeTransitionPatternId = useStore((s) => s.activeTransitionPatternId);
  const addPatternChannel = useStore((s) => s.addPatternChannel);

  const { isLearning, currentLearningChannel, startLearn, cancelLearn } = useMidiLearn();

  const openAppMenu = useCallback(
    (event: React.MouseEvent) => {
      openMenu(
        event,
        buildAppContextMenu({
          theme,
          darkMode,
          sparklesEnabled,
          setTheme,
          toggleDarkMode,
          toggleSparkles,
          setCurrentView,
        })
      );
    },
    [
      openMenu,
      theme,
      darkMode,
      sparklesEnabled,
      setTheme,
      toggleDarkMode,
      toggleSparkles,
      setCurrentView,
    ]
  );

  const handleMidiLearn = useCallback(
    (channelIndex: number) => {
      setCurrentView('dmxControl');
      jumpToChannel(channelIndex);
      if (isLearning && currentLearningChannel === channelIndex) {
        cancelLearn();
      } else {
        startLearn(channelIndex);
      }
    },
    [setCurrentView, jumpToChannel, isLearning, currentLearningChannel, cancelLearn, startLearn]
  );

  const handleMidiForget = useCallback(
    (channelIndex: number) => {
      removeMidiMapping(channelIndex);
      addNotification({
        message: `MIDI mapping removed for DMX CH ${channelIndex + 1}`,
        type: 'info',
        priority: 'normal',
      });
    },
    [removeMidiMapping, addNotification]
  );

  const handleSetOscAddress = useCallback(
    (channelIndex: number) => {
      const currentAddress = oscAssignments[channelIndex] || '';
      const newAddress = window.prompt(
        `Enter OSC address for DMX CH ${channelIndex + 1}:`,
        currentAddress
      );
      if (newAddress !== null) {
        setOscAssignment(channelIndex, newAddress);
        addNotification({
          message: `OSC address set for DMX CH ${channelIndex + 1}: ${newAddress || '(cleared)'}`,
          type: 'success',
          priority: 'normal',
        });
      }
    },
    [oscAssignments, setOscAssignment, addNotification]
  );

  const openChannelMenu = useCallback(
    (event: React.MouseEvent, channelIndex: number) => {
      const value = dmxChannels[channelIndex] || 0;
      const patternId =
        activeTransitionPatternId ?? transitionPatterns[0]?.id ?? null;
      openMenu(
        event,
        buildDmxChannelContextMenu({
          channelIndex,
          value,
          isSelected: selectedChannels.includes(channelIndex),
          isPinned: pinnedChannels?.includes(channelIndex) ?? false,
          hasMidiMapping: !!midiMappings[channelIndex],
          isChannelLearning: isLearning && currentLearningChannel === channelIndex,
          setDmxChannel,
          setChannelRange,
          toggleChannelSelection,
          togglePinChannel,
          setRandomChannelColor,
          onRename: () => {
            setCurrentView('dmxControl');
            window.dispatchEvent(
              new CustomEvent(DMX_EDIT_CHANNEL_NAME, { detail: { channelIndex } })
            );
          },
          handleMidiLearn,
          handleMidiForget,
          handleSetOscAddress,
          selectAllChannels,
          deselectAllChannels,
          dmxChannels,
          onAddToTracker: patternId
            ? () => {
                addPatternChannel(patternId, channelIndex);
                addNotification({
                  message: `DMX CH ${channelIndex + 1} added to DMX Tracker`,
                  type: 'success',
                  priority: 'normal',
                });
              }
            : undefined,
        })
      );
    },
    [
      openMenu,
      dmxChannels,
      selectedChannels,
      pinnedChannels,
      midiMappings,
      isLearning,
      currentLearningChannel,
      setDmxChannel,
      setChannelRange,
      toggleChannelSelection,
      togglePinChannel,
      setRandomChannelColor,
      setCurrentView,
      handleMidiLearn,
      handleMidiForget,
      handleSetOscAddress,
      selectAllChannels,
      deselectAllChannels,
      activeTransitionPatternId,
      transitionPatterns,
      addPatternChannel,
      addNotification,
    ]
  );

  const openFixtureMenu = useCallback(
    (
      event: React.MouseEvent,
      fixture: { id: string; name: string },
      onRenameFixture: (fixtureId: string, newName: string) => void
    ) => {
      openMenu(
        event,
        buildFixtureContextMenu(
          fixture,
          onRenameFixture,
          toggleFixtureSelection,
          selectedFixtures,
          setCurrentView
        )
      );
    },
    [openMenu, toggleFixtureSelection, selectedFixtures, setCurrentView]
  );

  const value = useMemo(
    () => ({ openAppMenu, openChannelMenu, openFixtureMenu }),
    [openAppMenu, openChannelMenu, openFixtureMenu]
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      <ContextMenu menu={menu} onClose={closeMenu} />
    </ContextMenuContext.Provider>
  );
}

export function useAppContextMenu(): ContextMenuContextValue {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error('useAppContextMenu must be used within ContextMenuProvider');
  }
  return ctx;
}

/** Safe when provider is optional (e.g. tests). */
export function useAppContextMenuOptional(): ContextMenuContextValue | null {
  return useContext(ContextMenuContext);
}
