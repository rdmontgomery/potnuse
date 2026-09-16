# The door sigil as a map — design

Date: 2026-09-16
Status: implemented (proposal A)

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

## What shipped, and what the open questions resolved to

Proposal A, at `src/pages/index.astro` with the layout in `lib/sigil.ts`.

- **Size** landed at `min(86vmin, 400px)`. 300px read as an ornament with a knot
  in the middle; 400px lets the chords separate.
- **Radius** is the shared temporal coordinate at a rank-heavy mix (0.82) rather
  than the field's calendar-heavy 0.5. Built at 0.5 first and it was wrong on a
  disc: April packed into one unreadable knot near the center, September stranded
  as two dots on the rim, most of the face empty. Ordering is identical at any
  mix — that is the invariant the views share, and it lives in `lib/temporal.ts`
  so neither view can drift from it. Spacing is a display choice, and a disc and
  a vertical axis do not want the same one.
- **Color** stayed, using the `/rhizome` palette. Monochrome lost the one thing
  the mark says at a glance, which is that the corpus has kinds.
- **Orientation**: the spiral is spun so the newest node sits at twelve o'clock.
  Unplanned, and it is what turned a scatter into a seal.

## The footer, same language

`Backlinks.astro` went with it — the list of "connects to" / "pointed to by"
became an ego graph. The current node is a hub, its neighbours fan left for
incoming and right for outgoing, each side ordered newest first, with threads
drawn between them. Labels are ordinary HTML links and the threads are an SVG
layer drawn after layout, so the curves are decorative: with no JS you get two
columns and lose nothing that navigates. Below 640px it collapses to a single
column and the threads turn off, which is the only honest thing to do with a
horizontal fan on a phone.
