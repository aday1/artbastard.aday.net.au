import React, { Suspense, useEffect, useMemo, useState } from 'react';
import type { Fixture } from '../../store';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './MobileFixtureRack.module.scss';

const FixtureSetup = React.lazy(async () => {
  const fixtureModule = await import('./FixtureSetup');
  return { default: fixtureModule.FixtureSetup };
});

type FixtureRackView = 'rack' | 'patch';

const channelColor = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized === 'red') return '#df5548';
  if (normalized === 'green') return '#52b56d';
  if (normalized === 'blue') return '#4d7fd8';
  if (normalized === 'white') return '#dedbd0';
  if (normalized === 'amber') return '#d99032';
  if (normalized === 'uv') return '#8c66cc';
  if (normalized.includes('pan') || normalized.includes('tilt')) return '#5b9a9a';
  if (normalized.includes('gobo') || normalized.includes('color_wheel')) return '#b48645';
  if (normalized.includes('dimmer') || normalized.includes('intensity')) return '#d2b95a';
  if (normalized.includes('strobe') || normalized.includes('shutter')) return '#c5c7c4';
  return '#8b9b73';
};

const fixtureColor = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized.includes('laser')) return '#4a9b72';
  if (normalized.includes('moving') || normalized.includes('beam')) return '#a95345';
  if (normalized.includes('wash') || normalized.includes('par')) return '#b58b32';
  if (normalized.includes('strobe')) return '#8d9290';
  if (normalized.includes('dimmer')) return '#4f7192';
  return '#7d6b8c';
};

const channelIndexFor = (fixture: Fixture, offset: number) =>
  fixture.startAddress - 1 + offset;

export const MobileFixtureRack: React.FC = () => {
  const {
    fixtures,
    dmxChannels,
    selectedFixtures,
    setSelectedFixtures,
    setDmxChannel,
  } = useStore((state) => ({
    fixtures: state.fixtures,
    dmxChannels: state.dmxChannels,
    selectedFixtures: state.selectedFixtures,
    setSelectedFixtures: state.setSelectedFixtures,
    setDmxChannel: state.setDmxChannel,
  }));

  const [view, setView] = useState<FixtureRackView>('rack');
  const [search, setSearch] = useState('');
  const [expandedFixtures, setExpandedFixtures] = useState<Set<string>>(
    () => new Set(fixtures[0] ? [fixtures[0].id] : [])
  );

  const changeView = (nextView: FixtureRackView) => {
    setView(nextView);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  useEffect(() => {
    if (fixtures.length === 0 || expandedFixtures.size > 0) return;
    setExpandedFixtures(new Set([fixtures[0].id]));
  }, [expandedFixtures.size, fixtures]);

  const visibleFixtures = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fixtures;
    return fixtures.filter((fixture) =>
      [
        fixture.name,
        fixture.type,
        fixture.manufacturer,
        fixture.model,
        fixture.mode,
        String(fixture.startAddress),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [fixtures, search]);

  const toggleExpanded = (fixtureId: string) => {
    setExpandedFixtures((current) => {
      const next = new Set(current);
      if (next.has(fixtureId)) next.delete(fixtureId);
      else next.add(fixtureId);
      return next;
    });
  };

  const toggleSelected = (fixtureId: string) => {
    setSelectedFixtures(
      selectedFixtures.includes(fixtureId)
        ? selectedFixtures.filter((id) => id !== fixtureId)
        : [...selectedFixtures, fixtureId]
    );
  };

  const setFixtureChannels = (fixture: Fixture, value: number) => {
    fixture.channels.forEach((_, offset) => {
      const channelIndex = channelIndexFor(fixture, offset);
      if (channelIndex >= 0 && channelIndex < 512) {
        setDmxChannel(channelIndex, value);
      }
    });
  };

  const setFixtureIntensity = (fixture: Fixture, value: number) => {
    fixture.channels.forEach((channel, offset) => {
      const type = channel.type.toLowerCase();
      if (type === 'dimmer' || type === 'intensity' || type === 'master') {
        const channelIndex = channelIndexFor(fixture, offset);
        if (channelIndex >= 0 && channelIndex < 512) {
          setDmxChannel(channelIndex, value);
        }
      }
    });
  };

  if (view === 'patch') {
    return (
      <div className={`${styles.fixtureRack} ab-rack`}>
        <div className={styles.patchToolbar}>
          <button type="button" className={styles.hardwareButton} onClick={() => changeView('rack')}>
            <LucideIcon name="ArrowLeft" size={17} />
            <span>Rack</span>
          </button>
          <strong>Fixture Patch</strong>
        </div>
        <div className={styles.fixtureSetupHost}>
          <Suspense fallback={<div className={styles.emptyState}>Chargement...</div>}>
            <FixtureSetup />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.fixtureRack} ab-rack`}>
      <div className={styles.rackToolbar}>
        <div className={styles.toolbarTop}>
          <div className={styles.rackTitle}>
            <span className="ab-rack-led ab-rack-led--on" aria-hidden="true" />
            <span>Fixture Rack</span>
            <output>{fixtures.length}</output>
          </div>
          <button type="button" className={styles.hardwareButton} onClick={() => changeView('patch')}>
            <LucideIcon name="Wrench" size={16} />
            <span>Patch</span>
          </button>
        </div>

        <label className={styles.searchControl}>
          <LucideIcon name="Search" size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find fixture"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear fixture search">
              <LucideIcon name="X" size={16} />
            </button>
          )}
        </label>

        <div className={styles.selectionBar}>
          <button
            type="button"
            className={styles.hardwareButton}
            onClick={() => setSelectedFixtures(visibleFixtures.map((fixture) => fixture.id))}
            disabled={visibleFixtures.length === 0}
          >
            <LucideIcon name="ListChecks" size={16} />
            <span>Select visible</span>
          </button>
          <button
            type="button"
            className={styles.hardwareButton}
            onClick={() => setSelectedFixtures([])}
            disabled={selectedFixtures.length === 0}
          >
            <LucideIcon name="CircleOff" size={16} />
            <span>Clear</span>
          </button>
          <output>{selectedFixtures.length} selected</output>
        </div>
      </div>

      {visibleFixtures.length === 0 && (
        <div className={styles.emptyState}>
          <LucideIcon name="LampDesk" size={24} />
          <strong>{fixtures.length === 0 ? 'No fixtures patched' : 'No matching fixtures'}</strong>
          {fixtures.length === 0 && (
            <button type="button" className={styles.hardwareButton} onClick={() => changeView('patch')}>
              <LucideIcon name="Plus" size={16} />
              <span>Add fixture</span>
            </button>
          )}
        </div>
      )}

      <div className={styles.moduleStack}>
        {visibleFixtures.map((fixture) => {
          const isExpanded = expandedFixtures.has(fixture.id);
          const isSelected = selectedFixtures.includes(fixture.id);
          const startIndex = fixture.startAddress - 1;
          const endAddress = fixture.startAddress + fixture.channels.length - 1;
          const values = fixture.channels.map((_, offset) => dmxChannels[startIndex + offset] || 0);
          const isActive = values.some((value) => value > 0);
          const hasIntensity = fixture.channels.some((channel) => {
            const type = channel.type.toLowerCase();
            return type === 'dimmer' || type === 'intensity' || type === 'master';
          });

          return (
            <section
              key={fixture.id}
              className={`${styles.fixtureModule} ab-rack-module ${
                isSelected ? styles.selectedModule : ''
              }`}
              style={{ '--fixture-accent': fixtureColor(fixture.type) } as React.CSSProperties}
            >
              <div className={styles.moduleHeader}>
                <button
                  type="button"
                  className={styles.moduleIdentity}
                  onClick={() => toggleExpanded(fixture.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`fixture-module-${fixture.id}`}
                >
                  <span
                    className={`ab-rack-led ${isActive ? 'ab-rack-led--on' : ''}`}
                    aria-hidden="true"
                  />
                  <span className={styles.fixtureIdentityText}>
                    <strong>{fixture.name}</strong>
                    <small>
                      {fixture.type || 'Fixture'} · CH {fixture.startAddress}-{endAddress}
                    </small>
                  </span>
                  <LucideIcon
                    name="ChevronDown"
                    size={19}
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                  />
                </button>

                <div className={styles.moduleActions}>
                  <button
                    type="button"
                    className={`${styles.squareButton} ${isSelected ? styles.buttonActive : ''}`}
                    onClick={() => toggleSelected(fixture.id)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? 'Deselect' : 'Select'} ${fixture.name}`}
                    title={`${isSelected ? 'Deselect' : 'Select'} fixture`}
                  >
                    <LucideIcon name="Check" size={17} />
                  </button>
                  {hasIntensity && (
                    <button
                      type="button"
                      className={styles.squareButton}
                      onClick={() => setFixtureIntensity(fixture, 255)}
                      aria-label={`Set ${fixture.name} intensity to full`}
                      title="Intensity full"
                    >
                      <LucideIcon name="Sun" size={17} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.squareButton}
                    onClick={() => setFixtureChannels(fixture, 0)}
                    aria-label={`Blackout ${fixture.name}`}
                    title="Fixture blackout"
                  >
                    <LucideIcon name="PowerOff" size={17} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div id={`fixture-module-${fixture.id}`} className={styles.moduleBody}>
                  <div className={styles.modulePlate}>
                    <span>{fixture.manufacturer || 'ARTBASTARD'}</span>
                    <strong>{fixture.model || fixture.mode || fixture.type || 'DMX MODULE'}</strong>
                    <span>{fixture.channels.length} CH</span>
                  </div>

                  <div className={styles.channelBank}>
                    {fixture.channels.map((channel, offset) => {
                      const channelIndex = channelIndexFor(fixture, offset);
                      const value =
                        channelIndex >= 0 && channelIndex < 512
                          ? dmxChannels[channelIndex] || 0
                          : 0;
                      const accent = channelColor(channel.type);
                      const level = `${Math.round((value / 255) * 100)}%`;

                      return (
                        <label
                          key={`${fixture.id}-${offset}`}
                          className={styles.channelControl}
                          style={
                            {
                              '--channel-accent': accent,
                              '--channel-level': level,
                            } as React.CSSProperties
                          }
                        >
                          <span className={styles.channelHeading}>
                            <span className={styles.channelLamp} aria-hidden="true" />
                            <strong>{channel.name || channel.type}</strong>
                            <output>{value}</output>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="255"
                            step="1"
                            value={value}
                            onChange={(event) =>
                              setDmxChannel(channelIndex, Number(event.target.value))
                            }
                            disabled={channelIndex < 0 || channelIndex >= 512}
                            aria-label={`${fixture.name} ${channel.name || channel.type} channel ${
                              channelIndex + 1
                            }`}
                          />
                          <span className={styles.channelFooter}>
                            <span>{channel.type.toUpperCase()}</span>
                            <span>CH {channelIndex + 1}</span>
                            <span>{level}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default MobileFixtureRack;
