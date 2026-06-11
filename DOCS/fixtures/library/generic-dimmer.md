---
spec: fixture-library
id: generic-dimmer
catalogId: AB-FIX-010
name: Generic Dimmer
defaultNamePrefix: Dimmer
type: Dimmer
category: Generic Control
manufacturer: Generic
model: 1-channel intensity profile
modelConfidence: confirmed
documentationPath: DOCS/fixtures/AB-FIX-010-generic-dimmer.md
tags: [DIMMER, GENERIC, INTENSITY]
notes: Canonical fallback profile for a single DMX dimmer or intensity-only fixture.
---

# Generic Dimmer

Single-channel dimmer profile used as the safe fallback when a fixture lacks a
manufacturer-specific entry.

## Mode: 1-channel mode

| name      | type   | min | max | description       |
|-----------|--------|-----|-----|-------------------|
| Intensity | dimmer | 0   | 255 | 0-100% intensity  |
