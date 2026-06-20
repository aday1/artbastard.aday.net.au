---
spec: scene-pack
id: operator-rows-ab-48
label: Operator rows 3-5 (A and B)
description: Fills APC40 slots 17-40 on Deck A and Deck B with pan/tilt-only, color-only, and color+pan/tilt layers. Never writes dimmer, gobo, or strobe.
templates:
  - pt-center
  - pt-left
  - pt-right
  - pt-up
  - pt-down
  - pt-fan
  - pt-sweep-slow
  - pt-corner-90
  - col-red
  - col-blue
  - col-green
  - col-amber
  - col-cyan
  - col-magenta
  - col-white
  - col-cycle
  - mix-red-center
  - mix-blue-left
  - mix-green-right
  - mix-amber-up
  - mix-cyan-down
  - mix-warm-sweep
  - mix-cool-90
  - mix-fan-cycle
---

# Operator rows 3-5

Layered operator pack for mixing with Essential 14+14 on rows 1-2.

Row 3 (slots 17-24): pan and tilt only on movers. Static positions plus optional
sweep/90 animations when Include automation is checked.

Row 4 (slots 25-32): color only. Mix with Deck A/B row 1-2 looks while you keep
dimmers and shutter under manual control.

Row 5 (slots 33-40): color plus pan/tilt. Never writes gobo, strobe, dimmer, or
shutter.

Creates 48 APC clip scenes: slots 17-40 on Deck A and the same on Deck B (Deck B
gets mirrored color and pan for crossfader work). Slots 01-16 stay for Essential
or your own captures.
