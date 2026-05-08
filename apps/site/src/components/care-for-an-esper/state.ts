import { create } from 'zustand';
import { LETTERS_BY_ID, type LetterId } from './letters';

// Engagement events the form records. Two kinds:
//   - 'chocobo-fed' : the long-press gysahl-greens offering on the §2
//     chocobo. A focal gesture; bumps chocobo vibrancy and, by
//     extension, opens the kweh letter inline. The post's tutorial.
//   - `letter:<id>` : a wandering sprite was dragged onto a mailbox.
//     One per discovered letter. Each opens a vibrancy bump (esper
//     for most, chocobo for kweh) and a Hopscotch-fragment payload.
//
// Persisted across visits via localStorage so a returning reader's
// progress survives. Active reader's coda is stable.
export type EngagementEvent = 'chocobo-fed' | `letter:${LetterId}`;

type State = {
  esperVibrancy: number;
  chocoboVibrancy: number;
  events: Set<EngagementEvent>;
  recordEvent: (e: EngagementEvent) => void;
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
    return new Set(arr.filter((x): x is EngagementEvent => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function persistEvents(events: Set<EngagementEvent>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...events]));
  } catch {
    // Quota exceeded or storage disabled — fail silently. The runtime
    // experience is intact; only the cross-session memory is lost.
  }
}

export const useEsperStore = create<State>((set) => ({
  esperVibrancy: INITIAL_VIBRANCY,
  chocoboVibrancy: INITIAL_VIBRANCY,
  events: new Set(),
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
  hydrate: () =>
    set(() => {
      const events = loadPersistedEvents();
      const bumped = applyBumps(events, {
        esperVibrancy: INITIAL_VIBRANCY,
        chocoboVibrancy: INITIAL_VIBRANCY,
      });
      return { events, ...bumped };
    }),
}));
