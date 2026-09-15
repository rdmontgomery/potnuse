// A pentimento song is a tiered timeline. Each note carries a tier in [0..N-1].
// The slider value c in [0,1] maps to a tier index; only notes in the active
// tier sound and engrave. Sliding mid-playback swaps tiers at the next note
// onset, so sustaining notes never cut.

export type Voice = 'bass' | 'comp' | 'lead';

// Tier ordering: 0 = skeleton, last = virtuoso.
export type Tier = number;

export interface PNote {
  voice: Voice;
  // VexFlow-style pitch, lowercase: "c/4", "eb/5", "f#/3". Engrave + audio
  // both read this.
  pitch: string;
  // Onset in 16th-note steps from song start. 4 = one quarter.
  step: number;
  // Duration in 16th-note steps.
  dur: number;
  // Tier this note belongs to.
  tier: Tier;
}

// Chord stab for the comp voice. Multiple pitches strike together. Comp is
// rendered as a chord symbol above the staff (not engraved as notes), but
// the audio scheduler reads the pitches array and plays them.
export interface PChord {
  step: number;
  dur: number;
  pitches: string[];
  // Symbol shown above the staff (e.g. "C7", "F9"). May be empty for tier 0.
  symbol: string;
  tier: Tier;
}

export interface Song {
  title: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  notes: PNote[];
  chords: PChord[];
  // Labels for the slider tick marks, one per tier.
  tierLabels: string[];
  // Bar-by-bar chord progression (root chord names for the engraving header).
  progression: string[];
}
