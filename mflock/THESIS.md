# THESIS

> The framing for mflock. Long-form companion: the site node
> `discourse-active-matter`. Operationalized in
> [BENCHMARKS.md](./BENCHMARKS.md) and [HYPOTHESIS.md](./HYPOTHESIS.md);
> first results in [RESULTS.md](./RESULTS.md).

Discourse is an active-matter system. Treat each utterance as a self-propelled
agent in a dialectical space; meaning is the collective order that emerges when
those agents align — a flock with no choreographer. The dynamics are Toner-Tu:
polar flocking hydrodynamics, ported from John Toner's own equations off
physical space onto a space of positions-in-an-argument.

Write a partition function Z over discourse configurations. Its free-energy
minima are stable meanings — conversational attractors. The catch: kinetic and
potential terms don't separate (H ≠ T + V), which forecloses equilibrium stat
mech and commits the framework to nonequilibrium. That's not a defect, it's the
claim — conversation is driven, dissipative, far from equilibrium by
construction.

The LLM is a Maxwell's demon on this system: it sorts conversational
microstates, locally lowering entropy, paying in compute. Memory is the demon's
ledger — a Malthusian birth-death process over stored states, retention and
forgetting as growth and death rates.

The unifying observable is the order parameter. In flocking, polarization. In
Luhmann, function systems are order parameters in a renormalization-group sense
— coarse-grained variables that survive rescaling. Stafford Beer's
variety-as-log-Ω is the information-theoretic spine: entropy, coarse-graining,
sufficient statistics, one object.

The wager: if discourse-memory has an order parameter, existing memory
benchmarks are already measuring a projection of it without knowing. Find the
projection. That's the experiment.

---

## From thesis to instrument

The three candidate order parameters in
[`src/mflock/order_params.py`](./src/mflock/order_params.py) are the
operational handles on the paragraphs above:

- **φ — polarization** is the flocking observable, paragraph one: the magnetization
  of the utterance-flock.
- **ξ — retention correlation length** is the demon's ledger, paragraph three: the
  decay constant of the birth-death process, how far back memory stays coherent.
- **χ — susceptibility** is the nonequilibrium commitment, paragraph two, made
  measurable: the system's linear response to driving (distractor load), which
  in an equilibrium theory would be tied to fluctuations by a relation that
  H ≠ T + V forbids — so a measured χ that *violates* that relation would be the
  far-from-equilibrium claim showing its face in data.

The wager (paragraph five) is the falsifiable core, and it has a kill switch:
if benchmark scores don't collapse onto these variables, the framework is
decorative and gets retired. RESULTS.md keeps score.
