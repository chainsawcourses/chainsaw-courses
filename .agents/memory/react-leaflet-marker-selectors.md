---
name: React-Leaflet marker selectors
description: How to expose stable SVG marker selectors for browser-level map tests.
---

Pass a `className` used by browser tests directly to `CircleMarker`; do not place it inside `pathOptions`.

**Why:** With the React-Leaflet version used here, a class nested in `pathOptions` was accepted by TypeScript but did not appear on the rendered SVG path, so the public API contained the venue while the browser test could not identify its marker.

**How to apply:** When a map test must associate a rendered Leaflet marker with a specific record, put a stable record-derived class on the layer's direct `className` prop and assert the popup after clicking it.