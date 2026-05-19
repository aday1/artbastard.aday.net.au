import React, { useState } from 'react';
import { useStore } from '../../../store';
import { normalizePattern, getActivePage } from '../../../utils/transitionTrackerEngine';
import { getFixtureInfoForChannel } from '../../../utils/fixturePresentation';
import { SkeuoButton } from '../../ui/SkeuoButton';
import { ChannelRoleIcon } from '../../ui/ChannelRoleIcon';
import { RackToggle } from '../../ui/rack';
import { TrackerFixtureLanes } from './TrackerFixtureLanes';
import styles from './TrackerChannelPicker.module.scss';

export interface TrackerChannelPickerProps {
  patternId: string;
  focusedChannel: number;
  onFocusChannel: (ch: number) => void;
}

export const TrackerChannelPicker: React.FC<TrackerChannelPickerProps> = ({
  patternId,
  focusedChannel,
  onFocusChannel,
}) => {
  const [channelInput, setChannelInput] = useState('1');
  const [lanesOpen, setLanesOpen] = useState(false);

  const {
    transitionPatterns,
    selectedChannels,
    pinnedChannels,
    channelNames,
    fixtures,
    envelopeAutomation,
    setPatternChannelsLocked,
    addPatternChannel,
    removePatternChannel,
    mergeSelectionIntoPattern,
    mergePinnedIntoPattern,
    clearPatternPageChannels,
    addPatternPage,
    setActivePatternPage,
    deletePatternPage,
    bakeEnvelopeToPatternTrack,
    importPatternTrackToEnvelope,
    linkTrackEnvelope,
  } = useStore((s) => ({
    transitionPatterns: s.transitionPatterns,
    selectedChannels: s.selectedChannels,
    pinnedChannels: s.pinnedChannels,
    channelNames: s.channelNames,
    fixtures: s.fixtures,
    envelopeAutomation: s.envelopeAutomation,
    setPatternChannelsLocked: s.setPatternChannelsLocked,
    addPatternChannel: s.addPatternChannel,
    removePatternChannel: s.removePatternChannel,
    mergeSelectionIntoPattern: s.mergeSelectionIntoPattern,
    mergePinnedIntoPattern: s.mergePinnedIntoPattern,
    clearPatternPageChannels: s.clearPatternPageChannels,
    addPatternPage: s.addPatternPage,
    setActivePatternPage: s.setActivePatternPage,
    deletePatternPage: s.deletePatternPage,
    bakeEnvelopeToPatternTrack: s.bakeEnvelopeToPatternTrack,
    importPatternTrackToEnvelope: s.importPatternTrackToEnvelope,
    linkTrackEnvelope: s.linkTrackEnvelope,
  }));

  const raw = transitionPatterns.find((p) => p.id === patternId);
  if (!raw) return null;
  const pattern = normalizePattern(raw);
  const page = getActivePage(pattern);
  const pageChannels = page?.channelIndices ?? [];

  const addChannel = () => {
    const n = parseInt(channelInput, 10);
    if (Number.isNaN(n) || n < 1) return;
    addPatternChannel(patternId, n - 1);
  };

  const envelopeForChannel = (ch: number) =>
    envelopeAutomation.envelopes.find((e) => e.channel === ch);

  const trackForChannel = (ch: number) => pattern.tracks.find((t) => t.channelIndex === ch);

  return (
    <div className={styles.picker}>
      <p className={styles.tip}>
        Grid columns match the chips below. Add channels with + Selection (desk strip) or + Pinned
        (left sidebar), by number, or via Fixture lanes.
      </p>

      <div className={styles.row}>
        <button
          type="button"
          className={styles.lanesToggle}
          onClick={() => setLanesOpen((v) => !v)}
        >
          {lanesOpen ? 'Hide fixture lanes' : 'Fixture lanes (pan/tilt, RGB, gobo...)'}
        </button>
      </div>
      {lanesOpen && <TrackerFixtureLanes patternId={patternId} />}

      <div className={styles.row}>
        <span className={styles.label}>Columns ({pageChannels.length})</span>
        <RackToggle
          pressed={pattern.channelsLocked}
          onToggle={() => setPatternChannelsLocked(patternId, !pattern.channelsLocked)}
          label="Lock cols"
        />
      </div>

      <div className={styles.row}>
        <SkeuoButton
          compact
          disabled={selectedChannels.length === 0}
          onClick={() => mergeSelectionIntoPattern(patternId, selectedChannels)}
          title="Add channels selected on the DMX channel strip (click rows to select)"
        >
          + Selection
        </SkeuoButton>
        <SkeuoButton
          compact
          disabled={!pinnedChannels || pinnedChannels.length === 0}
          onClick={() => mergePinnedIntoPattern(patternId)}
          title="Add channels from the pinned sidebar strip"
        >
          + Pinned
        </SkeuoButton>
        <form
          className={styles.addForm}
          onSubmit={(e) => {
            e.preventDefault();
            addChannel();
          }}
        >
          <input
            type="number"
            min={1}
            max={512}
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            title="DMX channel number (1-based)"
            aria-label="Channel number"
          />
          <SkeuoButton compact type="submit">
            Add
          </SkeuoButton>
        </form>
        <SkeuoButton
          compact
          accent="purple"
          disabled={pageChannels.length === 0}
          onClick={() => clearPatternPageChannels(patternId)}
          title="Remove all columns from this page"
        >
          Clear all
        </SkeuoButton>
      </div>

      <div className={styles.pages}>
        <span className={styles.label}>Pages</span>
        {pattern.pages.map((pg) => (
          <button
            key={pg.id}
            type="button"
            className={`${styles.pageTab} ${pg.id === pattern.activePageId ? styles.pageTabActive : ''}`}
            onClick={() => setActivePatternPage(patternId, pg.id)}
            title={pg.name}
          >
            {pg.name} ({pg.channelIndices.length})
          </button>
        ))}
        <SkeuoButton compact onClick={() => addPatternPage(patternId)}>
          + Page
        </SkeuoButton>
        {pattern.pages.length > 1 && page && (
          <SkeuoButton
            compact
            accent="purple"
            onClick={() => deletePatternPage(patternId, page.id)}
            title="Delete active page"
          >
            Del page
          </SkeuoButton>
        )}
      </div>

      <div className={styles.chips}>
        {pageChannels.map((ch) => {
          const info = getFixtureInfoForChannel(ch, fixtures);
          return (
            <span
              key={ch}
              className={`${styles.chip} ${ch === focusedChannel ? styles.chipActive : ''}`}
              title={info ? `${info.fixtureName} - ${info.channelFunction}` : undefined}
            >
              <button type="button" onClick={() => onFocusChannel(ch)}>
                <ChannelRoleIcon
                  channelType={info?.channelType}
                  fixtureType={info?.fixtureType}
                  size={12}
                />
                {String(ch + 1).padStart(3, '0')}
                {info?.shortFunction ? ` ${info.shortFunction}` : ''}
              </button>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => removePatternChannel(patternId, ch)}
                aria-label={`Remove channel ${ch + 1}`}
              >
                x
              </button>
            </span>
          );
        })}
        {pageChannels.length === 0 && (
          <span className={styles.label}>
            No columns yet. Use + Selection, + Pinned, Add by number, or Fixture lanes.
          </span>
        )}
      </div>

      {pattern.channelsLocked && pageChannels.length > 0 && (
        <div className={styles.trackList}>
          <span className={styles.label}>Envelope sync (per column)</span>
          {pageChannels.map((ch) => {
            const track = trackForChannel(ch);
            const env = envelopeForChannel(ch);
            return (
              <div key={ch} className={styles.trackRow}>
                <span>Ch {ch + 1}</span>
                <SkeuoButton
                  compact
                  disabled={!env}
                  onClick={() => {
                    if (env) bakeEnvelopeToPatternTrack(patternId, ch, env.id);
                  }}
                >
                  Env to grid
                </SkeuoButton>
                <SkeuoButton
                  compact
                  onClick={() => {
                    const id = importPatternTrackToEnvelope(patternId, ch, env?.id);
                    if (track && id) linkTrackEnvelope(patternId, track.id, id);
                  }}
                >
                  Grid to env
                </SkeuoButton>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
