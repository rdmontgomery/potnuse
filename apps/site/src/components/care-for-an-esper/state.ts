import { create } from 'zustand';

export type Stage =
  | 'cold-open'
  | 'section-1'
  | 'section-1-cid-shown'
  | 'section-2'
  | 'section-2-fed-prompt'
  | 'section-2-resolved'
  | 'section-3'
  | 'section-4'
  | 'section-5'
  | 'section-5-resolved'
  | 'section-6'
  | 'section-6-resolved';

export type EngagementEvent =
  | 'cid-intro-tapped'
  | 'chocobo-fed'
  | 'chocobo-skipped'
  | 'bugenhagen-dwelled'
  | 'ramza-1-tapped'
  | 'ramza-2-tapped'
  | 'ramza-3-tapped';

type State = {
  stage: Stage;
  esperVibrancy: number;
  esperIntroduced: boolean;
  chocoboVibrancy: number;
  atbProgress: number;
  events: Set<EngagementEvent>;
  advance: (to: Stage) => void;
  recordEvent: (e: EngagementEvent) => void;
  bumpAtb: (delta: number) => void;
  introduceEsper: () => void;
  decayEsper: (delta: number) => void;
};

const VIBRANCY_BUMPS: Partial<Record<EngagementEvent, { who: 'esper' | 'chocobo'; delta: number }>> = {
  'cid-intro-tapped': { who: 'esper', delta: 0.05 },
  'chocobo-fed': { who: 'chocobo', delta: 0.15 },
  'bugenhagen-dwelled': { who: 'esper', delta: 0.10 },
  'ramza-1-tapped': { who: 'esper', delta: 0.10 },
  'ramza-2-tapped': { who: 'esper', delta: 0.10 },
  'ramza-3-tapped': { who: 'esper', delta: 0.10 },
};

const ESPER_INITIAL_VIBRANCY = 0.85;

export const useEsperStore = create<State>((set) => ({
  stage: 'cold-open',
  esperVibrancy: 0,
  esperIntroduced: false,
  chocoboVibrancy: 0.5,
  atbProgress: 0,
  events: new Set(),
  advance: (to) => set({ stage: to }),
  recordEvent: (e) =>
    set((s) => {
      if (s.events.has(e)) return s;
      const next = new Set(s.events);
      next.add(e);
      const bump = VIBRANCY_BUMPS[e];
      if (!bump) return { events: next };
      const key = bump.who === 'esper' ? 'esperVibrancy' : 'chocoboVibrancy';
      return {
        events: next,
        [key]: Math.max(0, Math.min(1, s[key] + bump.delta)),
      } as Partial<State>;
    }),
  bumpAtb: (delta) =>
    set((s) => ({ atbProgress: Math.max(0, Math.min(1, s.atbProgress + delta)) })),
  introduceEsper: () =>
    set((s) =>
      s.esperIntroduced
        ? s
        : { esperIntroduced: true, esperVibrancy: ESPER_INITIAL_VIBRANCY },
    ),
  decayEsper: (delta) =>
    set((s) => ({ esperVibrancy: Math.max(0, s.esperVibrancy - delta) })),
}));
