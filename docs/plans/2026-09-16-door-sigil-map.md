# The door sigil as a map — design

Date: 2026-09-16
Status: design (pre-implementation)

## The problem

The front door is three dashed concentric circles and a dot. Click it, get a
random node. It is a good door: it says "no index, only a threshold," and it
enacts that by refusing to tell you anything about what is behind it.

It is also inert. The site has grown a graph with a working temporal field at
`/rhizome`, and the door knows nothing about it. Two consequences. The door does
not change as the corpus grows, so a returning reader gets no signal that
anything happened. And the map lives at a URL nobody has a reason to visit,
because the door is the only entrance and it does not point there.

## The tension, named first

Putting the graph on the front page is an index. The colophon is explicit that
this place is a rhizome and has no index. Any proposal here is in some tension
with that, and pretending otherwise would be the wrong way to start.

The resolution I'd argue for: an index is a thing you can *read* — titles, dates,
an ordering you can scan. A shape is not. A sigil whose geometry is derived from
the graph shows that the corpus has structure, roughly how much of it there is,
and where the recent growth sits, while naming nothing until you point at it. You
cannot use it to find a specific essay. You can only use it to see that there is
something to find. That is a threshold, not a table of contents — arguably more
rhizome than the dashed circles, which say nothing because they *are* nothing.

## Proposal A — growth rings (recommended)

Keep the sigil. Make its geometry the graph.

**Radius is time.** Each node sits at `r = R_in + (R_out - R_in) * u`, where `u`
is the same normalized temporal coordinate the rhizome field already computes —
the calendar/rank blend with the separation floor. Center is oldest, rim is
newest. This is dendrochronology, not a clock face: the cambium is at the rim,
the outermost dashed circle is the present and is still forming, and the disc
grows outward as the corpus does. The sigil accretes. A reader who comes back in
three months sees a wider disc, which is the signal the current door cannot send.

**Angle is phyllotaxis.** `θ = n * 137.5°` by date rank. Vogel's sunflower
arrangement, with radius driven by date instead of `sqrt(n)`. Deterministic, no
clustering, no overlap, and it reads as a seal rather than a scatter plot. The
golden angle is doing real work here: it is the only rotation that avoids
periodic alignment for arbitrary node counts, so the sigil stays legible as the
corpus grows without retuning.

**Edges are chords**, drawn faint and bowed toward the center so the interior
reads as a web rather than a starburst. Node dot size by degree, opacity by
state, so fossils recede. The recency glow from `/rhizome` applies at the rim.

**The existing dashed rings survive** as quarter gridlines. Visual continuity
with the current sigil is a feature: it should read as the same mark, grown.

**Interaction.** Center dot keeps the current behavior exactly — click for a
random node. Hover a point for its title; click a point to go there. The existing
hover rotation stays, and becomes meaningful once the mark is polar.

**No physics.** Deterministic layout, computed at build. It renders identical on
every load. A door should be a seal, not a screensaver — and the live simulation
already exists one click away.

Roughly 150 lines in `index.astro`, plus extracting the temporal-`u` computation
out of `rhizome.astro` into `lib/graph.ts` so the door and the map cannot drift
apart. That extraction is worth doing regardless.

## Proposal B — a live sim in the sigil

Run the Toner-Tu/force simulation small, inside the sigil's circle.

Rejected. It is nondeterministic, so the door has no fixed identity; it is the
heaviest thing on the lightest page; and it duplicates `/rhizome` without adding
to it. The door's stillness is most of why it works.

## Proposal C — sigil plus a map link

Keep everything, add a small link to `/rhizome`.

Honest fallback if the index objection above is judged fatal. Costs nothing,
gains little, and leaves the door as inert as it is now.

## Open questions

- Size. Current is 140px. The map wants more; 280px still reads as a door. Worth
  seeing both before deciding.
- Whether radius should be `u` (the blend) or raw calendar. Raw calendar collapses
  the April cluster into a near-solid ring, which may actually look right on a
  growth-ring figure — that is what a slow growth year looks like.
- Whether the four collections should be tinted by their `/rhizome` colors or left
  monochrome. Monochrome is more sigil; color is more map.
