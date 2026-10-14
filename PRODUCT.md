# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Homeowner controlling smart automated motorized curtains in a living room or bedroom, operating them via smartphone from bed or desktop, relying on automated gentle sunrise wake-up routines.

## Product Purpose
Provide an architectural, tactile, high-craft control surface for motorized smart curtains powered by Tuya IoT and serverless Upstash infrastructure. Eliminates generic dashboard clutter in favor of physical window-state feedback, instant direct manipulation, and peaceful circadian routines.

## Positioning
An architectural smart home cockpit inspired by tactile consumer electronics (B&O, Teenage Engineering, Lutron). It replaces generic status cards and emoji-filled buttons with a physical curtain stage, daylight illumination feedback, and intuitive sunrise choreography.

## Operating Context
Next.js 15 (App Router) on Vercel with Upstash Redis, QStash, and Upstash Workflow. Controls Tuya smart curtain motors. Accessed primarily in low-light environments (early morning wake-up or late night closing) on mobile web and desktop.

## Capabilities and Constraints
- Instant motor commands: Open, Close, Stop/Hold.
- Real-time positional status (0-100%) and percentage scrubbing.
- Serverless multi-step gradual sunrise opening workflow with configurable step intervals and step percentages.
- Dynamic QStash cron scheduling with timezone management (`CRON_TZ`).
- Session cookie authentication.
- Must run fast, reliably, and gracefully handle motor delays or offline status.

## Product Principles
- **Physicality & Tactility**: The interface mirrors the physical architecture of a window and drapery; light levels and curtain positions are immediately legible at a glance.
- **Quiet Utility**: Zero generic AI slop, no emojis, no alarming red badges for routine actions like closing curtains. Precision micro-typography and calm contrast.
- **Circadian Choreography**: The sunrise routine is elevated into a visible, calm morning ritual rather than an opaque background cron job.
