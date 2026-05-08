import { create } from 'zustand';

// Discovery + offering events. The shape of the active-reader layer:
// gestures that yield bonus content (letters from wandering sprites,
// dragged to mailboxes scattered between paragraphs) or small acts of
// care (gysahl greens for the chocobo). Each one is optional. The
// linear post does not change. The active reader (in the Hopscotch /
// Hotel Chevalier sense) ends up at a slightly different coda.
export type EngagementEvent = 'chocobo-fed';

type State = {
  esperVibrancy: number;
  chocoboVibrancy: number;
  events: Set<EngagementEvent>;
  recordEvent: (e: EngagementEvent) => void;
};

// Initial vibrancy: warm gold but not full bright. Engagement events
// nudge values up. The coda renders both at their current values
// without commentary — what the reader did, rendered back.
const INITIAL_VIBRANCY = 0.7;

const VIBRANCY_BUMPS: Record<EngagementEvent, { who: 'esper' | 'chocobo'; delta: number }> = {
  'chocobo-fed': { who: 'chocobo', delta: 0.15 },
};

export const useEsperStore = create<State>((set) => ({
  esperVibrancy: INITIAL_VIBRANCY,
  chocoboVibrancy: INITIAL_VIBRANCY,
  events: new Set(),
  recordEvent: (e) =>
    set((s) => {
      if (s.events.has(e)) return s;
      const next = new Set(s.events);
      next.add(e);
      const bump = VIBRANCY_BUMPS[e];
      const key = bump.who === 'esper' ? 'esperVibrancy' : 'chocoboVibrancy';
      return {
        events: next,
        [key]: Math.max(0, Math.min(1, s[key] + bump.delta)),
      } as Partial<State>;
    }),
}));
