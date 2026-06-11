import React, { useEffect, useMemo, useState } from 'react';
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
import styles from './DetectedMidiControllerPrompt.module.scss';

const dismissedKey = (controller: DetectedMidiController): string =>
  `artbastard:midi-controller-dismissed:${controller.kind}:${controller.name}`;

const controllerSort = (a: DetectedMidiController, b: DetectedMidiController): number => {
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
  if (a.transport === b.transport) return a.name.localeCompare(b.name);
  return a.transport === 'browser' ? -1 : 1;
};

export const DetectedMidiControllerPrompt: React.FC = () => {
  const [controllersByKind, setControllersByKind] = useState<Map<string, DetectedMidiController>>(new Map());

  useEffect(() => {
    const handleDetected = (event: Event) => {
      const controller = (event as CustomEvent<DetectedMidiController>).detail;
      if (!controller) return;
      if (sessionStorage.getItem(dismissedKey(controller)) === 'true') return;

      setControllersByKind((current) => {
        const existing = current.get(controller.kind);
        if (existing && existing.transport === 'browser') return current;
        const next = new Map(current);
        next.set(controller.kind, controller);
        return next;
      });
    };

    const handleConnected = (event: Event) => {
      const controller = (event as CustomEvent<DetectedMidiController>).detail;
      if (!controller) return;
      setControllersByKind((current) => {
        if (!current.has(controller.kind)) return current;
        const next = new Map(current);
        next.delete(controller.kind);
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
    () => Array.from(controllersByKind.values()).sort(controllerSort),
    [controllersByKind],
  );

  if (controllers.length < 1) return null;

  return (
    <div className={styles.promptStack} aria-live="polite">
      {controllers.map((controller) => (
        <section className={styles.prompt} key={`${controller.kind}:${controller.transport}:${controller.name}`}>
          <div className={styles.copy}>
            <strong>{detectedMidiControllerLabel(controller.kind)} detected</strong>
            <span>{controller.name}</span>
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
              {detectedMidiControllerAction(controller.kind)}
            </button>
            <button
              className={styles.dismissButton}
              type="button"
              aria-label={`Dismiss ${detectedMidiControllerLabel(controller.kind)} prompt`}
              onClick={() => {
                sessionStorage.setItem(dismissedKey(controller), 'true');
                setControllersByKind((current) => {
                  const next = new Map(current);
                  next.delete(controller.kind);
                  return next;
                });
              }}
            >
              Later
            </button>
          </div>
        </section>
      ))}
    </div>
  );
};
