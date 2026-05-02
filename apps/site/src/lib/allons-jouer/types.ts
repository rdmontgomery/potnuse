export type BellowsDir = 'push' | 'pull';

export interface NoteInfo {
  note: string;  // e.g. "C4"
  freq: number;  // Hz
}

export interface AccordionButton {
  button: number; // 1–10
  push: NoteInfo;
  pull: NoteInfo;
}

export interface DetectedNote {
  button: number;
  dir: BellowsDir;
  note: string;
  freq: number;
  dist: number; // semitones from nearest note
}

export interface SongNote {
  button: number;
  dir: BellowsDir;
  duration: number; // ms
}

export interface PhraseRange {
  label?: string;  // human-readable, e.g. 'main lick' or '"Allons à Lafayette"'
  start: number;   // index into Song.notes (inclusive)
  end: number;     // exclusive
}

export interface Phrase {
  id: string;       // `${songId}:${index}`
  songId: string;
  songTitle: string;
  index: number;
  label?: string;
  notes: SongNote[];
}

export interface CulturalCard {
  context: string;        // one paragraph
  recordingLabel: string; // e.g. "Amédé Ardoin, 1929"
  recordingUrl: string;
  tab: string;            // e.g. "▶2 ◀1 ▶3"
}

export interface Song {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  notes: SongNote[];
  phrases?: PhraseRange[];
  cultural?: CulturalCard;
}

export type Screen = 'home' | 'freeplay' | 'lesson' | 'reference' | 'tuner' | 'phrases';
export type InputMode = 'virtual' | 'mic';
export type TimingResult = 'good' | 'ok' | 'off';
export type LessonMode = 'ownPace' | 'keepUp';
