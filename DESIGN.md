---
name: Curtain Control OS
description: Architectural tactile smart home cockpit for physical motorized curtains
colors:
  primary: "#f59e0b"
  primary-hover: "#d97706"
  background: "#080a0f"
  surface: "#11141e"
  surface-hover: "#181d2c"
  border: "#1c2234"
  text-primary: "#f1f5f9"
  text-muted: "#94a3b8"
  emerald-pulse: "#10b981"
  destructive: "#ef4444"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label-mono:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "20px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#080a0f"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  panel-chassis:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "20px 24px"
---

# Design System: Curtain Control OS

## Overview

**Creative North Star: "The Architectural Cockpit"**

Curtain Control OS is designed for physical motorized hardware in contemporary residential architecture. It rejects generic cloud-dashboard abstractions, emoji-cluttered controls, and alert-red danger buttons in favor of physical window-state feedback, tactile direct scrubbing, and peaceful circadian wake-up choreography.

The interface treats home automation as a quiet, physical utility: high contrast in low ambient light, crisp tabular typography, and tactile affordances that mirror physical drapery parting to admit daylight.

**Key Characteristics:**
- **Physical Drapery Simulation**: Real-time dual-parted curtains with fabric fold gradients and dynamic solar backlighting.
- **Quiet Anodized Palette**: Deep graphite/slate grounds (#080A0F, #11141E) with warm solar amber (#F59E0B) for dawn states and emerald hardware sync pulses.
- **Zero Emoji Policy**: Drawn, consistent-weight Lucide micro-icons only (`Sunrise`, `Sunset`, `Square`, `SlidersHorizontal`, `Clock`, `Activity`).
- **Tactile Direct Control**: Integrated position scrubber rail and discrete preset stops (0%, 25%, 50%, 75%, 100%).

## Colors

The color palette is derived from twilight and dawn architecture: deep midnight tones paired with low-saturation slate and focused bursts of solar amber.

### Primary
- **Solar Amber** (`#f59e0b`): Reserved for active circadian energy, dawn routines, and primary interactive highlights.

### Neutral
- **Deep Void Background** (`#080a0f`): Non-reflective dark ambient ground designed for early morning or late night use in bed.
- **Chassis Surface** (`#11141e`): Anodized dark panel background for control modules.
- **Milled Border** (`#1c2234`): Subtle structural perimeter rule separating functional modules.
- **Text Primary** (`#f1f5f9`): High-legibility crisp off-white for metrics and titles.
- **Text Muted** (`#94a3b8`): Low-glare secondary labeling for technical telemetry.

### Named Rules
**The Routine Evening Rule.** Closing curtains is a daily peaceful ritual, never an emergency. The close action is rendered in calm slate/secondary anodized finish, never alarm red (`destructive`).

## Typography

**Display & Body Font:** `Geist Sans` / `SF Pro` / `system-ui`
**Telemetry Font:** `ui-monospace` with `tabular-nums`

**Character:** Clean, technical, architectural, with crisp kerning and non-jittering tabular numerals.

### Hierarchy
- **Display** (300 weight, 3rem / 48px, line-height 1): Large live curtain position percentage.
- **Headline** (600 weight, 1.25rem / 20px, line-height 1.25): Page and major module titles.
- **Body** (400 weight, 0.875rem / 14px, line-height 1.5): Explanatory labels and instructions.
- **Label** (500 weight, 0.6875rem / 11px, tracking 0.05em uppercase mono): Telemetry metrics and hardware status tags.

## Layout

A centralized single-surface cockpit with a max-width container (64rem / 1024px). Primary physical stage sits on top as the first viewport anchor, supported by dual secondary cards (Sunrise Routine and Schedule) and an inline telemetry stream.

## Elevation & Depth

Surfaces rely on subtle tonal layering and soft deep shadows rather than decorative neon halos.
- **Chassis Elevation**: `box-shadow: 0 10px 30px -15px rgba(0, 0, 0, 0.6)`
- **Aperture Inset**: `box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8)`

## Shapes

- **Modules & Chassis**: Rounded corners (16px / `rounded-2xl`).
- **Buttons & Interactive Chips**: Tactical rounded rectangles (10px / `rounded-xl`).
- **Telemetry Tags**: Tight rounded pills (9999px).

## Components

### Drapery Stage (`CurtainStage`)
- The visual centerpiece: dual sliding curtain fabrics over a daylight aperture backdrop. Includes live percentage readout, direct scrubber rail, 5 preset stops, and 3 mechanical command buttons (Open Full, Hold/Stop, Close Full).

### Routine Visualizer (`SunriseRoutineCard`)
- Displays staged dawn sequence pills (`10% → 30% → 50% → 70% → 90% → 100%`) with calculated total run duration and active stepping states.

### Telemetry Stream (`RecentActivityCard`)
- Clean event log with status indicators, execution duration, and trigger origin.

## Do's and Don'ts

### Do:
- **Do** use `font-mono tabular-nums` for all dynamic numbers and percentages so UI does not jitter during motor motion.
- **Do** represent daylight intensity dynamically behind the curtain aperture as position changes.
- **Do** provide tactile preset stops alongside continuous drag.

### Don't:
- **Don't** use raw emojis in titles, cards, or buttons (`🏠`, `☀️`, `▲`, `▼`, `⏸`, `⏳` are permanently banned).
- **Don't** use destructive/red styling for the curtain close button.
- **Don't** leak internal backend debug math or raw formulas into end-user UI.
