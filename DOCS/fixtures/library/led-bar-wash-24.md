---
spec: fixture-library
id: led-bar-wash-24
catalogId: AB-FIX-013
name: 24-LED Bar Wash
defaultNamePrefix: LED Bar
type: RGBW Wash
category: LED Effect / Bar wash
manufacturer: Generic
model: 24-LED bar wash (7-channel RGBW + strobe + macro)
modelConfidence: unknown
photoUrl: /fixtures/ab-fix-013-led-bar-wash-24-generated.png
documentationPath: DOCS/fixtures/LED-EFFECT/LED-EFFECT-bar-wash-24.md
tags: [WASH, RGBW, LED, BAR, STATIC]
notes: Generic 7-channel RGBW bar wash profile; verify against printed manual when available.
---

# 24-LED Bar Wash

Generic 7-channel RGBW LED bar wash with master dimmer, strobe and built-in macros. Provisional channel layout assuming the most common cheap-RGBW-bar convention. Replace if the printed manual disagrees.

## Mode: 7-channel mode

| name   | type   | min | max | description           |
|--------|--------|-----|-----|-----------------------|
| Dimmer | dimmer | 0   | 255 | 0-100% master dimmer  |
| Red    | red    | 0   | 255 | 0-100% red            |
| Green  | green  | 0   | 255 | 0-100% green          |
| Blue   | blue   | 0   | 255 | 0-100% blue           |
| White  | white  | 0   | 255 | 0-100% white          |
| Strobe | strobe | 0   | 255 | 0=open, ramp = slow to fast |
| Macro  | macro  | 0   | 255 | Built-in colour and chase macros |
