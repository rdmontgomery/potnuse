// The active site theme's tokens. push/pull/highlight are the app's own
// semantics, so they pick a value per colour-scheme with light-dark(): the
// originals on dark palettes, deepened ones that read on paper.
export const K = {
  bg: 'var(--bg)',
  bgCard: 'var(--bg-card)',
  bgButton: 'var(--bg-button)',
  accent: 'var(--accent)',
  accentDim: 'var(--accent-dim)',
  push: 'light-dark(#2f7a4f, #4a9e6e)',
  pushBright: 'light-dark(#1f6b3f, #5ec484)',
  pull: 'light-dark(#a8452f, #c45a3c)',
  pullBright: 'light-dark(#b8401f, #e8714f)',
  text: 'var(--text)',
  textDim: 'var(--text-dim)',
  textMuted: 'var(--text-muted)',
  success: 'light-dark(#1f6b3f, #5ec484)',
  border: 'var(--border)',
  highlight: 'light-dark(#9a7400, #ffd700)',
} as const;

/** A colour at `pct`% opacity. Tokens are var()/light-dark() strings, so
    the old trick of appending two hex digits no longer works. */
export const alpha = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export const FONTS = {
  serif: "var(--font-crimson), 'Georgia', serif",
  mono: "var(--font-jetbrains), monospace",
} as const;
