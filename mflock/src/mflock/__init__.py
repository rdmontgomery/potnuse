"""mflock — discourse as active matter.

The package half of the experiment: candidate *order parameters* for
discourse-memory, implemented as pure functions over a conversation trace.
The harness half (loading benchmarks, running them against a model, scoring)
lives in the sibling ``harness`` package.

The wager: if discourse-memory has an order parameter, existing memory
benchmarks are already measuring a projection of it. ``mflock.order_params``
holds the candidate definitions; ``harness`` produces the projections.
"""

__version__ = "0.1.0"
