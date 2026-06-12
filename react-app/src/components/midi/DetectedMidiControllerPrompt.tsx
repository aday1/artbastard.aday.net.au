import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DetectedMidiController,
  MIDI_CONNECT_BROWSER_EVENT,
  MIDI_CONNECT_ROLI_EVENT,
  MIDI_CONNECT_SERVER_EVENT,
  MIDI_CONTROLLER_CONNECTED_EVENT,
  MIDI_CONTROLLER_DETECTED_EVENT,
  ROLI_LIGHTPAD_CONNECT_APPROVED_KEY,
  detectedMidiControllerAction,
  detectedMidiControllerLabel,
  detectedMidiControllerMessage,
} from '../../midi/detectedMidiController';
import { tagPrefixFor } from '../../midi/smartControllers';
import styles from './DetectedMidiControllerPrompt.module.scss';

const promptKey = (controller: DetectedMidiController): string =>
  `${controller.kind}:${controller.transport}:${controller.id}`;

const dismissedKey = (controller: DetectedMidiController): string =>
  `artbastard:midi-controller-dismissed:${controller.kind}:${controller.transport}:${controller.id}`;

const shortenId = (id: string): string => {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
};

const controllerSort = (a: DetectedMidiController, b: DetectedMidiController): number => {
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
  if (a.transport !== b.transport) return a.transport === 'browser' ? -1 : 1;
  return a.id.localeCompare(b.id);
};

export const DetectedMidiControllerPrompt: React.FC = () => {
  const [controllersByKey, setControllersByKey] = useState<Map<string, DetectedMidiController>>(new Map());
  // Assigns A/B/C suffix per kind in stable detection order. Survives re-renders.
  const tagAssignmentsRef = useRef<Map<string, string>>(new Map()); // promptKey -> tag
  const kindCountersRef = useRef<Map<string, number>>(new Map()); // kind -> next letter index

  const assignTag = (controller: DetectedMidiController): string => {
    const key = promptKey(controller);
    const existing = tagAssignmentsRef.current.get(key);
    if (existing) return existing;
    const prefix = tagPrefixFor(controller.name || controller.kind);
    const idx = kindCountersRef.current.get(controller.kind) ?? 0;
    const letter = String.fromCharCode(65 + idx);
    kindCountersRef.current.set(controller.kind, idx + 1);
    const tag = `${prefix}-${letter}`;
    tagAssignmentsRef.current.set(key, tag);
    return tag;
  };

  useEffect(() => {
    const handleDetected = (event: Event) => {
      const controller = (event as CustomEvent<DetectedMidiController>).detail;
      if (!controller) return;
      if (sessionStorage.getItem(dismissedKey(controller)) === 'true') return;

      setControllersByKey((current) => {
        const key = promptKey(controller);
        if (current.has(key)) return current;
        const next = new Map(current);
        next.set(key, controller);
        return next;
      });
    };

    const handleConnected = (event: Event) => {
      const controller = (event as CustomEvent<DetectedMidiController>).detail;
      if (!controller) return;
      setControllersByKey((current) => {
        const key = promptKey(controller);
        if (!current.has(key)) return current;
        const next = new Map(current);
        next.delete(key);
        return next;
      });
    };

    window.addEventListener(MIDI_CONTROLLER_DETECTED_EVENT, handleDetected);
    window.addEventListener(MIDI_CONTROLLER_CONNECTED_EVENT, handleConnected);
    return () => {
      window.removeEventListener(MIDI_CONTROLLER_DETECTED_EVENT, handleDetected);
      window.removeEventListener(MIDI_CONTROLLER_CONNECTED_EVENT, handleConnected);
    };
  }, []);

  const controllers = useMemo(
    () => Array.from(controllersByKey.values()).sort(controllerSort),
    [controllersByKey],
  );

  if (controllers.length < 1) return null;

  return (
    <div className={styles.promptStack} aria-live="polite">
      {controllers.map((controller) => {
        const tag = assignTag(controller);
        return (
          <section className={styles.prompt} key={promptKey(controller)}>
            <div className={styles.copy}>
              <strong>
                <span className={styles.tagPill}>{tag}</span>
                {detectedMidiControllerLabel(controller.kind)} detected
              </strong>
              <span>{controller.name}</span>
              <span className={styles.deviceId}>
                <em>{controller.transport === 'browser' ? 'Browser MIDI' : 'Server MIDI'}</em>
                <code>ID: {shortenId(controller.id)}</code>
              </span>
              <p>{detectedMidiControllerMessage(controller.kind)}</p>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => {
                  if (controller.kind === 'roli-lightpad') {
                    localStorage.setItem(ROLI_LIGHTPAD_CONNECT_APPROVED_KEY, 'true');
                    window.dispatchEvent(new CustomEvent<DetectedMidiController>(MIDI_CONNECT_ROLI_EVENT, { detail: controller }));
                    return;
                  }
                  window.dispatchEvent(new CustomEvent<DetectedMidiController>(
                    controller.transport === 'browser' ? MIDI_CONNECT_BROWSER_EVENT : MIDI_CONNECT_SERVER_EVENT,
                    { detail: controller },
                  ));
                }}
              >
                {detectedMidiControllerAction(controller.kind)} ({tag})
              </button>
              <button
                className={styles.dismissButton}
                type="button"
                aria-label={`Dismiss ${detectedMidiControllerLabel(controller.kind)} ${tag} prompt`}
                onClick={() => {
                  sessionStorage.setItem(dismissedKey(controller), 'true');
                  setControllersByKey((current) => {
                    const key = promptKey(controller);
                    const next = new Map(current);
                    next.delete(key);
                    return next;
                  });
                }}
              >
                Later
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
};
