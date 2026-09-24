// The palettes a reader can pick from the corner menu. Tokens live in
// src/styles/themes.css; this list drives the menu and the pre-paint
// script, so a new theme needs an entry in both.
export const THEMES = [
  { name: 'blueprint', scheme: 'dark' },
  { name: 'whiteprint', scheme: 'light' },
  { name: 'sepia', scheme: 'dark' },
  { name: 'parchment', scheme: 'light' },
  { name: 'frenchmen', scheme: 'dark' },
  { name: 'cinnabar', scheme: 'dark' },
  { name: 'rubric', scheme: 'light' },
] as const;

export type ThemeName = (typeof THEMES)[number]['name'];

// "auto" follows the system: blueprint by night, whiteprint by day. The
// pair is historical, diazo whiteprints replaced cyanotype blueprints.
export const AUTO = { dark: 'blueprint', light: 'whiteprint' } as const;
