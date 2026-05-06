# /rhizome — focus + atmosphere

A redesign of the rhizome page. Solves the mobile usability hole (titles invisible until commit) by giving every node three states — resting, summoned, focused — and layers atmospheric motion on top so the rhizome feels alive instead of mechanical.

Single-file change: `apps/site/src/pages/rhizome.astro`. No new dependencies.

> **Design history.** An earlier revision used a "bloom" model that duplicated neighbors into a fixed orbital arc around the tapped node. That read as visual noise — two dots for every neighbor — and was scrapped in favor of focus mode, which highlights neighbors *in place* on the actual graph.

## Problem

Current /rhizome shows a force-directed canvas of every page. Titles surface only via a `mousemove`-driven tooltip — invisible on touch. Tapping a node navigates immediately, so on mobile you cannot read where you're going before you go there. Beyond that, the page is functional but inert: arrows mark direction, nodes don't move once settled, the `state` field (seedling/germinating/stable/fossil) is invisible to the reader.

## The interaction model

Three states a node can be in.

**Resting.** The current dot. Color = collection, size = degree.

**Summoned** (press-and-hold ≥ 250 ms). A small card rises from the node — title in serif, the page's `description` in italic, a row of micro-dots representing neighbors colored by their collection. Card stays as long as the pointer is down. Lift on the node = enter the page. Lift off the node = dismiss, no harm done. This is the divination gesture: ask, the card rises, choose.

**Focused** (single tap, no hold). The tapped node and its actual neighbors stay bright with their titles labeled in place; everything else dims to ~30%. Edges between focus and neighbors brighten; other edges fade. The focused node gets a highlight ring and grows slightly. Tap a labeled neighbor to re-focus on *it* (the camera pans, labels shift). Tap the focused node again to enter. Tap empty space (or Escape) to release focus.

The interaction is universal — not a mobile fallback. Desktop also gets focus on click; hover labels remain as a fast preview for power users who already know where they're going.

## Camera

On focus, the camera gently pans to bring the focused node toward screen center over ~340 ms. On re-focus (tapping a neighbor), the new center pans in. On release, the camera stays where it is.

## Atmosphere

Three layers of motion, calibrated to feel alive without becoming a screensaver.

**State-driven breathing** (subtle, always on). Per-node radius modulation tied to `state`:

- `seedling` — fast low-amp flicker (±8% at ~1.4 Hz)
- `germinating` — slower larger pulse (±12% at ~0.7 Hz)
- `stable` — barely-there breath (±3% at ~0.3 Hz)
- `fossil` — no pulse, existing 0.55 alpha preserved

This makes the rhizome's *health* legible at a glance, and turns the existing `state` field into something readers can feel.

**Edge particles** (replace arrowheads). Each edge gets a small particle drifting source → target in the source node's color, period proportional to length so visual speed stays constant. Direction becomes ambient, not arrow-marked. Arrowheads are removed entirely.

**Focus transitions.** Center scales up briefly, neighbor labels fade in, dim crossfades over ~220 ms. Release reverses, slightly faster.

## Reduced motion

Respect `prefers-reduced-motion: reduce`: kill breathing, kill particles, instant focus transitions. Functionality unchanged.

## Implementation notes

- Replace `mousedown` / `mousemove` / `mouseup` with `pointerdown` / `pointermove` / `pointerup`. Use `setPointerCapture` so drags survive leaving the canvas.
- Long-press detector: 250 ms timer started on `pointerdown` over a node, cancelled on movement > 6 px or on `pointerup`.
- `panning` only kicks in once movement actually crosses the threshold — a stationary press is always tap-eligible, so a tap on empty space (or any non-node target) reaches `handleTap`.
- Hover labels (the desktop tooltip) only render when `pointerType === 'mouse'`.
- Focus labels: anchored to actual node positions in screen space, offset outward from the focused center along the focus → neighbor direction; transform anchored to the dominant axis (top/bottom/left/right) so labels don't overlap the node they describe.
- The stage element disables text selection (`user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`) so long-press on mobile doesn't trigger the iOS/Android text selection magnifier.
- Drag-a-node-around still works (start moving immediately within the 250 ms / 6 px window).
- All state confined to the existing `<script>` block; no new files, no new components.

## Out of scope

Tilt / accelerometer parallax (iOS permission gate, low payoff). Audio chimes (site is silent everywhere; one page breaking that is jarring). Both can be added later if they earn their keep.
