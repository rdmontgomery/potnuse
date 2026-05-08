import { create } from 'zustand';

// Discovery events. The shape of a future letter mechanic — drag a
// wandering moogle to a mailbox, open the letter, learn something the
// linear post does not contain. Recording an event nudges the chocobo
// or esper's color a little. The active reader (in the Hopscotch /
// Hotel Chevalier sense) ends up at a slightly different coda than the
// linear reader. Empty for now while the mechanic is being designed.
export type EngagementEvent = never;

type State = {
  esperVibrancy: number;
  chocoboVibrancy: number;
  events: Set<EngagementEvent>;
  recordEvent: (e: EngagementEvent) => void;
};

// Initial vibrancy: warm gold but not full bright. Discovered letters
// will push the values up. The coda renders both at their current
// values without commentary — what the reader did, rendered back.
const INITIAL_VIBRANCY = 0.7;

export const useEsperStore = create<State>((set) => ({
  esperVibrancy: INITIAL_VIBRANCY,
  chocoboVibrancy: INITIAL_VIBRANCY,
  events: new Set(),
  recordEvent: (e) =>
    set((s) => {
      if (s.events.has(e)) return s;
      const next = new Set(s.events);
      next.add(e);
      return { events: next };
    }),
}));
