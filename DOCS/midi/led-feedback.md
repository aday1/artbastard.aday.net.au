---
spec: led-feedback
version: 1
ringLeds:
  enabled: true
  coalesceMs: 50
  deviceRingBaseCc: 0x18
  trackRingBaseCc: 0x38
  midiChannel: 0
errorHandling:
  maxErrorsPerSecond: 5
  toastDebounceMs: 5000
---

# APC40 LED Feedback Spec

LED velocity constants for the APC40 MK1 hardware (Note On messages).
Per-control behavior rules describe how live store state maps to a velocity
choice for each pad.

Edits regenerate `react-app/src/midi/generated/ledFeedbackSpec.ts`.

## Velocities

| name              | value | meaning                                     |
|-------------------|-------|---------------------------------------------|
| LED_OFF           | 0     | empty / inactive                            |
| LED_GREEN         | 1     | saved / available                           |
| LED_GREEN_BLINK   | 2     | saved + pending action (reserved)           |
| LED_RED           | 3     | stop / FULL ON / latched                    |
| LED_RED_BLINK     | 4     | armed save column / active record           |
| LED_ORANGE        | 5     | SHIFT held / Deck B context / playback idle |
| LED_ORANGE_BLINK  | 6     | active deck slot / playing ACT / auto       |

## Behavior

Each row describes the pad family and the velocity to send under the listed
conditions, in priority order (top-most matching condition wins).

| controlKey   | states                                                                                                       |
|--------------|--------------------------------------------------------------------------------------------------------------|
| clipGrid       | armed=LED_RED_BLINK; activeDeckSlot=LED_ORANGE_BLINK; saved=LED_GREEN; else=LED_OFF                          |
| sceneLaunch    | playing=LED_ORANGE_BLINK; saved=LED_GREEN; else=LED_OFF                                                      |
| recordArm      | soloed=LED_RED_BLINK; else=LED_OFF                                                                           |
| selectFixture  | selected=LED_GREEN; else=LED_OFF                                                                             |
| selectGroup    | selected=LED_GREEN; else=LED_OFF                                                                             |
| trackSelect    | always=LED_OFF                                                                                               |
| trackStop      | anyActiveScene=LED_RED; else=LED_OFF                                                                         |
| masterButton   | dmxFrozen=LED_RED; else=LED_OFF                                                                              |
| stopAll        | anyActiveScene=LED_RED; else=LED_OFF                                                                         |
| shift          | shiftLatched=LED_ORANGE; else=LED_OFF                                                                        |
| rec            | anyArmed=LED_RED_BLINK; else=LED_OFF                                                                         |
| play           | autoSceneEnabled=LED_GREEN_BLINK; else=LED_OFF                                                               |
| stop           | autoSceneEnabled=LED_RED; else=LED_OFF                                                                       |
| sendA          | colorAutoEnabled=LED_ORANGE_BLINK; else=LED_OFF                                                              |
| sendB          | panTiltAutoEnabled=LED_ORANGE_BLINK; else=LED_OFF                                                            |
| sendC          | effectsAutoEnabled=LED_ORANGE_BLINK; else=LED_OFF                                                            |

## Hardware constraint: single-color rows

On APC40 MK1, only the 8×5 **clip grid** is multi-color (green/red/orange).
The **Solo/Cue**, **Activator**, **Record Arm**, and **Track Select** rows are
single-color amber pads — any non-zero velocity displays as the same "amber on"
state; only 0 vs non-zero is distinguishable to the operator. Therefore those
rows use LED_GREEN purely as a stand-in for "on"; do not encode meaning via
GREEN vs RED vs ORANGE on those rows.
