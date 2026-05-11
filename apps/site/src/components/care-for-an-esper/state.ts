import { create } from 'zustand';
import { LETTERS_BY_ID, type LetterId } from './letters';

// Engagement events the form records. Two kinds:
//   - 'chocobo-fed' : the long-press gysahl-greens offering on the §2
//     chocobo. A focal gesture; bumps chocobo vibrancy and, by
//     extension, opens the kweh letter inline. The post's tutorial.
//   - `letter:<id>` : a mailbox dropped its home letter. Each opens a
//     vibrancy bump and a Hopscotch-fragment payload.
//
// Persisted across visits via localStorage so a returning reader's
// vibrancy survives. The currently-open mailbox state is *not*
// persisted (letters re-close between sessions, the discovery
// gesture stays meaningful).
export type EngagementEvent = 'chocobo-fed' | `letter:${LetterId}`;

type State = {
  esperVibrancy: number;
  chocoboVibrancy: number;
  events: Set<EngagementEvent>;
  /** Per-mailbox: letterId currently displayed (key = mailbox home). */
  mailboxLetters: Partial<Record<LetterId, LetterId>>;
  recordEvent: (e: EngagementEvent) => void;
  /** Drop a sprite on the mailbox at `home`. Opens the mailbox's home
   * letter (one mailbox, one letter, no random draws). */
  dropOnMailbox: (home: LetterId) => void;
  closeMailbox: (home: LetterId) => void;
  hydrate: () => void;
};

const INITIAL_VIBRANCY = 0.7;
const STORAGE_KEY = 'cfe.events.v1';

const STATIC_BUMPS: Partial<Record<EngagementEvent, { who: 'esper' | 'chocobo'; delta: number }>> = {
  'chocobo-fed': { who: 'chocobo', delta: 0.15 },
};

function bumpFor(e: EngagementEvent): { who: 'esper' | 'chocobo'; delta: number } | null {
  if (e in STATIC_BUMPS) return STATIC_BUMPS[e]!;
  if (e.startsWith('letter:')) {
    const id = e.slice('letter:'.length) as LetterId;
    return LETTERS_BY_ID[id]?.bump ?? null;
  }
  return null;
}

// Apply the cumulative vibrancy bumps for a set of events. Used both
// at hydrate (rebuilding state from persisted events) and at runtime
// for any single new event.
function applyBumps(
  events: Iterable<EngagementEvent>,
  initial: { esperVibrancy: number; chocoboVibrancy: number },
): { esperVibrancy: number; chocoboVibrancy: number } {
  let esper = initial.esperVibrancy;
  let chocobo = initial.chocoboVibrancy;
  for (const e of events) {
    const b = bumpFor(e);
    if (!b) continue;
    if (b.who === 'esper') esper = Math.min(1, esper + b.delta);
    else chocobo = Math.min(1, chocobo + b.delta);
  }
  return { esperVibrancy: esper, chocoboVibrancy: chocobo };
}

function loadPersistedEvents(): Set<EngagementEvent> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    // Drop 'chocobo-fed' on load too (prior sessions may have written
    // it before we stopped persisting). The gesture repeats each visit.
    return new Set(
      arr.filter(
        (x): x is EngagementEvent => typeof x === 'string' && x !== 'chocobo-fed',
      ),
    );
  } catch {
    return new Set();
  }
}

// Events that survive a reload. We deliberately drop 'chocobo-fed' so
// the gysahl-greens gesture is repeatable each visit (the daily ritual
// is the point); the kweh letter still carries the chocobo bump
// because `letter:kweh` is persisted, so vibrancy from prior visits
// doesn't reset to default.
function persistedFor(events: Set<EngagementEvent>): EngagementEvent[] {
  return [...events].filter((e) => e !== 'chocobo-fed');
}

function persistEvents(events: Set<EngagementEvent>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedFor(events)));
  } catch {
    // Quota exceeded or storage disabled: fail silently. The runtime
    // experience is intact; only the cross-session memory is lost.
  }
}

// Chocobo's animation speed reflects the reader's engagement with the
// post. Sleepy when the reader has barely opened anything; lively when
// they've worked through most of the letters. Three pre-baked GIFs at
// frame delays of 35 / 22 / 8 cs (selected client-side from the
// events set). Threshold for `fast` lowered so a moderately engaged
// reader visibly trips it.
export function chocoboGifSrcFor(events: Set<EngagementEvent>): string {
  let opened = 0;
  for (const e of events) if (e.startsWith('letter:')) opened++;
  if (opened >= 5) return '/sprites/chocobo-walk-fast.gif';
  if (opened >= 2) return '/sprites/chocobo-walk-med.gif';
  return '/sprites/chocobo-walk-slow.gif';
}

export const useEsperStore = create<State>((set) => ({
  esperVibrancy: INITIAL_VIBRANCY,
  chocoboVibrancy: INITIAL_VIBRANCY,
  events: new Set(),
  mailboxLetters: {},
  recordEvent: (e) =>
    set((s) => {
      if (s.events.has(e)) return s;
      const next = new Set(s.events);
      next.add(e);
      persistEvents(next);
      const bumped = applyBumps([e], {
        esperVibrancy: s.esperVibrancy,
        chocoboVibrancy: s.chocoboVibrancy,
      });
      return { events: next, ...bumped };
    }),
  dropOnMailbox: (home) =>
    set((s) => {
      // If something is already shown at this mailbox, do nothing.
      if (s.mailboxLetters[home]) return s;
      const ev = `letter:${home}` as EngagementEvent;
      const next = new Set(s.events);
      let bumped = { esperVibrancy: s.esperVibrancy, chocoboVibrancy: s.chocoboVibrancy };
      if (!next.has(ev)) {
        next.add(ev);
        persistEvents(next);
        bumped = applyBumps([ev], bumped);
      }
      return {
        events: next,
        mailboxLetters: { ...s.mailboxLetters, [home]: home },
        ...bumped,
      };
    }),
  closeMailbox: (home) =>
    set((s) => {
      if (!s.mailboxLetters[home]) return s;
      const { [home]: _removed, ...rest } = s.mailboxLetters;
      void _removed;
      return { mailboxLetters: rest };
    }),
  hydrate: () =>
    set(() => {
      const events = loadPersistedEvents();
      const bumped = applyBumps(events, {
        esperVibrancy: INITIAL_VIBRANCY,
        chocoboVibrancy: INITIAL_VIBRANCY,
      });
      return { events, mailboxLetters: {}, ...bumped };
    }),
}));
