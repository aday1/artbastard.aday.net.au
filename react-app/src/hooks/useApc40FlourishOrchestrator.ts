/**
 * Single-mount hook that subscribes to a small set of app events and fires
 * APC40 LED flourishes when meaningful changes happen. Mounted once from
 * App so subscriptions live for the lifetime of the page.
 *
 * Event sources, in order:
 *  - Zustand store: selectedFixtures, isTransitioning, apc40CrossfaderState.activeDeck, bridgeConnected
 *  - dmxStore: blackout
 *  - window CustomEvents: apc40:clip-launch, router:view-change, roli-device-change
 */

import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useDMXStore } from '../store/dmxStore';
import { triggerFlourish } from '../engines/apc40Flourishes';

export function useApc40FlourishOrchestrator(): void {
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    // --- Zustand subscriptions (main store) -----------------------------------
    let prevSelected: string[] = useStore.getState().selectedFixtures ?? [];
    let prevTransitioning: boolean = useStore.getState().isTransitioning ?? false;
    let prevDeck: 'A' | 'B' = useStore.getState().apc40CrossfaderState?.activeDeck ?? 'A';
    let prevBridge: boolean = useStore.getState().bridgeConnected ?? false;
    let bridgeBaseline = false; // ignore the very first true on page load

    const unsubMain = useStore.subscribe((state) => {
      const fixtures = useStore.getState().fixtures || [];
      const nextSelected = state.selectedFixtures ?? [];
      // Newly selected fixtures (add vs prevSelected) → fire per-fixture.
      const added = nextSelected.filter((id) => !prevSelected.includes(id));
      if (added.length > 0) {
        const first = added[0];
        const fixture = fixtures.find((f) => f.id === first);
        const col =
          fixture && typeof fixture.startAddress === 'number'
            ? Math.floor(((fixture.startAddress - 1) / 512) * 8) % 8
            : Math.floor(Math.random() * 8);
        triggerFlourish('fixtureSelect', { column: col, color: 'green' });
      }
      prevSelected = nextSelected;

      const nextTransitioning = state.isTransitioning ?? false;
      if (nextTransitioning && !prevTransitioning) {
        triggerFlourish('crossfade', {
          color: 'orange',
          durationMs: state.transitionDuration ?? 1000,
        });
      }
      prevTransitioning = nextTransitioning;

      const nextDeck: 'A' | 'B' = state.apc40CrossfaderState?.activeDeck ?? 'A';
      if (nextDeck !== prevDeck) {
        triggerFlourish(nextDeck === 'A' ? 'deckSwitchA' : 'deckSwitchB');
        prevDeck = nextDeck;
      }

      const nextBridge = state.bridgeConnected ?? false;
      if (!bridgeBaseline) {
        bridgeBaseline = true;
        prevBridge = nextBridge;
      } else if (nextBridge !== prevBridge) {
        triggerFlourish(nextBridge ? 'connectionUp' : 'connectionDown');
        prevBridge = nextBridge;
      }
    });

    // --- dmxStore (blackout) --------------------------------------------------
    let prevBlackout: boolean = useDMXStore.getState().blackout ?? false;
    const unsubDmx = useDMXStore.subscribe((state) => {
      const next = state.blackout ?? false;
      if (next && !prevBlackout) triggerFlourish('blackout');
      prevBlackout = next;
    });

    // --- window CustomEvents --------------------------------------------------
    const onClipLaunch = (ev: Event) => {
      const detail = (ev as CustomEvent<{ row: number; col: number }>).detail;
      triggerFlourish('clipLaunch', { row: detail?.row ?? 0, column: detail?.col ?? 0 });
    };
    const onViewChange = () => {
      triggerFlourish('tabChange');
    };
    const onRoliChange = () => {
      // Treat any ROLI device-list change as a connection event; the engine
      // dedupes via diff-skip on the APC40 side.
      triggerFlourish('connectionUp', { durationMs: 240 });
    };

    window.addEventListener('apc40:clip-launch', onClipLaunch);
    window.addEventListener('router:view-change', onViewChange);
    window.addEventListener('roli-device-change', onRoliChange);

    return () => {
      // Hook is single-mount; cast through unknown so TS accepts the
      // unsubscribe call even when zustand's middleware overloads obscure
      // the return type.
      (unsubMain as unknown as (() => void) | undefined)?.();
      (unsubDmx as unknown as (() => void) | undefined)?.();
      window.removeEventListener('apc40:clip-launch', onClipLaunch);
      window.removeEventListener('router:view-change', onViewChange);
      window.removeEventListener('roli-device-change', onRoliChange);
    };
  }, []);
}
