import React, { useMemo } from 'react';
import { useStore } from '../../store';
import { isApc40Source } from '../../midi/apc40';
import { LucideIcon } from '../ui/LucideIcon';
import { StageMapDashboard } from './StageMapDashboard';
import { Apc40SurfaceDiagram } from '../midi/Apc40SurfaceDiagram';
import styles from './FixtureSetup.module.scss';

export const Apc40WorkflowPanel: React.FC = () => {
  const { midiMessages, scenes, fixtures, groups, fixtureTemplates, apc40State } = useStore((state) => ({
    midiMessages: state.midiMessages,
    scenes: state.scenes,
    fixtures: state.fixtures,
    groups: state.groups,
    fixtureTemplates: state.fixtureTemplates,
    apc40State: state.apc40CrossfaderState,
  }));

  const lastApcSource = useMemo(() => {
    const recent = [...midiMessages].reverse().find((message) => isApc40Source(message.source));
    return recent?.source;
  }, [midiMessages]);

  const lastTrackSelectIndex = apc40State.activeTrackIndex;
  const highlightedGroupId = apc40State.activeGroupId;

  const highlightedGroup = highlightedGroupId
    ? groups.find((group) => group.id === highlightedGroupId)
    : null;

  return (
    <section className={styles.apcPanel} aria-label="Akai APC40 remote workflow">
      <div className={styles.apcHeader}>
        <div>
          <span className={styles.stepKicker}>Remote control</span>
          <h3>Akai APC40 / APC40 mkII</h3>
          <p>Plug it in, enable the MIDI input, then run Deck A/B scenes, ACTS, fixture groups, Super Control, and full-on from the surface.</p>
        </div>
        <div className={lastApcSource ? styles.apcStatusReady : styles.apcStatusIdle}>
          <LucideIcon name={lastApcSource ? 'Cable' : 'Unplug'} size={16} />
          {lastApcSource || 'Waiting for APC40 MIDI'}
        </div>
      </div>

      <StageMapDashboard
        title="APC40 live stage map"
        subtitle={
          highlightedGroup
            ? `APC track ${(lastTrackSelectIndex ?? 0) + 1} -> ${highlightedGroup.name} (${highlightedGroup.fixtureIndices.length} fixtures)`
            : apc40State.activeTargetLabel
              ? `APC target -> ${apc40State.activeTargetLabel}`
              : `${fixtures.length} fixtures · ${groups.length} groups · tap to target the surface`
        }
        highlightGroupId={highlightedGroupId}
        highlightFixtureIds={apc40State.activeFixtureIds}
        highlightLabel={apc40State.activeTargetLabel}
      />

      <Apc40SurfaceDiagram mode="fixtures" showBothDecks title="track select → groups" />

      <div className={styles.apcMapGrid}>
        <div title="Clip Launch / Session View is the scene grid. Default is Deck A; hold SHIFT for Deck B.">
          <strong>Clip grid</strong>
          <span>40 scene slots for Deck A, SHIFT for Deck B</span>
        </div>
        <div title="These buttons select group 1-8 when groups exist, otherwise fixture 1-8.">
          <strong>Track Select</strong>
          <span>Select fixture groups 1-8</span>
        </div>
        <div title="Scene Launch buttons are ACT launchers. Stop All Clips stops scenes and ACT playback.">
          <strong>Scene Launch</strong>
          <span>Launch ACTS 1-5</span>
        </div>
        <div title="Record Arm saves the next grid press into the current deck; faders and Device Control drive Super Control roles.">
          <strong>Record / Super Control</strong>
          <span>Record-arm deck slots, dimmers, gobo/effects</span>
        </div>
      </div>

      <div className={styles.apcCounts}>
        <span>{fixtureTemplates.filter((template) => template.id !== 'custom-blank').length} fixture profiles</span>
        <span>{fixtures.length} patched fixtures</span>
        <span>{groups.length} groups</span>
        <span>{scenes.length} scenes</span>
        <a href="/#/mobile" target="_blank" rel="noreferrer" title="Open the tablet/mobile remote control surface">
          Open tablet remote
        </a>
      </div>
    </section>
  );
};
