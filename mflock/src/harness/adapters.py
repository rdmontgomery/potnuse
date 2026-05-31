"""Benchmark loaders. Filled in step 3.

Loads a small LongMemEval slice into a normalized trace schema. Tries the
HuggingFace ``datasets`` source; falls back to a bundled fixture when HF is
unreachable (it is, behind this environment's network allowlist).
"""
