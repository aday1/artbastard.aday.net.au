import { useEffect, useRef } from 'react';

const ACCENT_HZ = 880;
const TICK_HZ = 660;
const NOTE_LEN = 0.045;

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

function playClick(ctx: AudioContext, time: number, accent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = accent ? ACCENT_HZ : TICK_HZ;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.22, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + NOTE_LEN);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + NOTE_LEN + 0.01);
}

/** One-shot click synced to an external beat (e.g. server MIDI clock). */
export function playMetronomeClick(accent: boolean) {
  const ctx = getContext();
  if (!ctx) return;
  playClick(ctx, ctx.currentTime + 0.01, accent);
}

/**
 * Lookahead metronome scheduler (HTML5 Rocks audio scheduling pattern).
 */
export function useMetronomeAudio(
  enabled: boolean,
  bpm: number,
  beatsPerBar: number,
  onBeat?: (beatIndex: number, isAccent: boolean) => void,
  soundEnabled = true
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const onBeatRef = useRef(onBeat);
  onBeatRef.current = onBeat;

  useEffect(() => {
    if (!enabled || bpm <= 0 || beatsPerBar < 1) {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      beatIndexRef.current = 0;
      return;
    }

    const ctx = soundEnabled ? getContext() : null;
    if (soundEnabled && !ctx) return;
    ctxRef.current = ctx;

    const secondsPerBeat = 60 / bpm;
    nextNoteTimeRef.current = (ctx?.currentTime ?? performance.now() / 1000) + 0.05;
    beatIndexRef.current = 0;

    const schedule = () => {
      const context = ctxRef.current;
      const currentTime = context?.currentTime ?? performance.now() / 1000;

      while (nextNoteTimeRef.current < currentTime + 0.12) {
        const idx = beatIndexRef.current % beatsPerBar;
        const accent = idx === 0;
        if (context && soundEnabled) {
          playClick(context, nextNoteTimeRef.current, accent);
        }
        onBeatRef.current?.(idx, accent);
        nextNoteTimeRef.current += secondsPerBeat;
        beatIndexRef.current += 1;
      }
      timerRef.current = window.setTimeout(schedule, 25);
    };

    schedule();

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, bpm, beatsPerBar, soundEnabled]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      ctxRef.current = null;
    };
  }, []);
}
