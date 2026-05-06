# /rhizome — bloom + atmosphere

A redesign of the rhizome page. Solves the mobile usability hole (titles invisible until commit) by giving every node three states — resting, summoned, bloomed — and layers atmospheric motion on top so the rhizome feels alive instead of mechanical.

Single-file change: `apps/site/src/pages/rhizome.astro`. No new dependencies.

## Problem

Current /rhizome shows a force-directed canvas of every page. Titles surface only via a `mousemove`-driven tooltip — invisible on touch. Tapping a node navigates immediately, so on mobile you cannot read where you're going before you go there. Beyond that, the page is functional but inert: arrows mark direction, nodes don't move once settled, the `state` field (seedling/germinating/stable/fossil) is invisible to the reader.

## The interaction model

Three states a node can be in.

**Resting.** The current dot. Color = collection, size = degree.

**Summoned** (press-and-hold ≥ 250ms). A small card rises from the node — title in serif, the page's `description` in italic, a row of micro-dots representing neighbors colored by their collection. Card stays as long as the pointer is down. Lift on the node = enter the page. Lift off the node = dismiss, no harm done. This is the divination gesture: ask, the card rises, choose.

**Bloomed** (single tap, no hold). The node becomes the local center of the universe. Up to ten neighbors swing out on short arcs (~140 px world radius) with their titles visible. The rest of the graph dims to ~30% opacity; non-bloom edges fade. Edges within the bloom brighten. The bloomed center is tappable a second time to enter; any bloomed neighbor is tappable to re-bloom around *it* (chained exploration without ever leaving the graph). Tap empty space to collapse back to the full rhizome.

The interaction is universal — not a mobile fallback. Desktop also gets bloom on click; hover labels remain as a fast preview for power users who already know where they're going.

## Camera

On bloom, the camera gently pans to bring the bloomed node toward screen center over ~340 ms. On re-bloom, the new center pans in. On collapse, the camera stays where it is — you don't get yanked back.

## Atmosphere

Three layers of motion, calibrated to feel alive without becoming a screensaver.

**State-driven breathing** (subtle, always on). Per-node radius modulation tied to `state`:

- `seedling` — fast low-amp flicker (±8% at ~1.4 Hz)
- `germinating` — slower larger pulse (±12% at ~0.7 Hz)
- `stable` — barely-there breath (±3% at ~0.3 Hz)
- `fossil` — no pulse, existing 0.55 alpha preserved

This makes the rhizome's *health* legible at a glance, and turns the existing `state` field into something readers can feel.

**Edge particles** (replace arrowheads). Each edge gets 1–2 small particles drifting source → target in the source node's color, period ~3–5 s per traversal. Direction becomes ambient, not arrow-marked. Arrowheads are removed entirely.

**Bloom transitions.** Center scales 1.0 → 1.15 over ~280 ms (ease-out-back). Neighbors fly out from center along their arcs over ~340 ms; labels fade in over the last 120 ms. Background dim crossfades over ~220 ms. Collapse is the reverse, slightly faster.

## Reduced motion

Respect `prefers-reduced-motion: reduce`: kill breathing, kill particles, instant bloom transitions. Functionality unchanged.

## Implementation notes

- Replace `mousedown` / `mousemove` / `mouseup` with `pointerdown` / `pointermove` / `pointerup`. Use `setPointerCapture` so drags survive leaving the canvas.
- Long-press detector: 250 ms timer started on `pointerdown` over a node, cancelled on movement > 6 px or on `pointerup`.
- Hover labels (the current tooltip) only render when `pointerType === 'mouse'`.
- Bloom layout: neighbors arrange evenly on a 140 px-radius arc, starting at -π/2 (top). Cap at 10 neighbors per bloom; rank by degree if more exist.
- Bloom labels and the summon card are DOM overlays positioned in screen coords from world coords each frame.
- Drag-a-node-around still works (start moving immediately within the 250 ms / 6 px window).
- All state confined to the existing `<script>` block; no new files, no new components.

## Out of scope

Tilt / accelerometer parallax (iOS permission gate, low payoff). Audio chimes (site is silent everywhere; one page breaking that is jarring). Both can be added later if they earn their keep.
