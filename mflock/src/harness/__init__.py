"""harness — load memory benchmarks, run them against a model, score them.

The projection-finding half of the experiment. ``adapters`` loads benchmark
slices into a normalized trace schema; ``run`` executes a slice against a
model backend (Anthropic API or an offline mock); ``score`` turns raw answers
into per-category accuracy plus the order-parameter values, and emits an
embeddable HTML report.
"""
