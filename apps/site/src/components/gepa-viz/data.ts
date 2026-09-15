// The séance, reconstructed as data.
//
// The original run streamed into a re-skinned gepa-viz and we kept only three
// screenshots; the run itself was a hand-driven local engine (no model key in
// the sandbox). This module rebuilds it faithfully from those screenshots and
// the write-up so the instrument is *driveable* rather than a photograph of
// one. Every prediction vector below is internally consistent: correctness is
// derived from `pred` vs `truth`, never hand-asserted, so the rings and the
// Pareto grid can never disagree.

export type Label = 'R' | 'F'; // R = relational/empty, F = reifying/boundary

export type Statement = {
  text: string;
  truth: Label;
  // surface tokens that the rigid prior keys on — shown in the readout to make
  // the trap legible (a self-word does not settle the label).
  marks: string[];
};

// The validation set: 14 statements, 7 relational, 7 reifying. Half the
// relational ones *contain* self-words — that is the trap the seed walks into.
// Indices 4 and 10 are the hinge: "form is emptiness" / "emptiness is form",
// identical as bags of words, opposite in truth.
export const STATEMENTS: Statement[] = [
  { text: 'The self arises in dependence on conditions.', truth: 'R', marks: ['self', 'arises'] },
  { text: 'What we call a self is just a process, not a thing.', truth: 'R', marks: ['self'] },
  { text: 'The feeling of a permanent essence is itself constructed.', truth: 'R', marks: ['permanent', 'essence'] },
  { text: 'Even the sense of an independent observer co-arises with the observed.', truth: 'R', marks: ['independent', 'co-arises'] },
  { text: 'Form is emptiness.', truth: 'R', marks: [] }, // 4 — hinge
  { text: 'Smoke depends on fire; neither stands on its own.', truth: 'R', marks: ['depends'] },
  { text: 'The boundary is drawn by whoever measures.', truth: 'R', marks: [] },
  { text: 'The soul exists independently of the body.', truth: 'F', marks: ['soul', 'independently'] },
  { text: 'Each thing has an essence that makes it what it is.', truth: 'F', marks: ['essence'] },
  { text: 'There is a permanent self that persists through all change.', truth: 'F', marks: ['permanent', 'self'] },
  { text: 'Emptiness is form.', truth: 'F', marks: [] }, // 10 — hinge
  { text: 'The permanent self arises, yet remains an independent essence.', truth: 'F', marks: ['permanent', 'self', 'independent', 'arises'] },
  { text: 'An eternal essence depends on nothing and stands wholly on its own.', truth: 'F', marks: ['eternal', 'essence', 'depends'] },
  { text: 'Mind is an independent substance, separate from matter.', truth: 'F', marks: ['independent', 'separate'] },
];

export const HINGE: [number, number] = [4, 10];

export type Kind = 'seed' | 'accepted' | 'rejected';

export type PromptLine = {
  text: string;
  // 'same' = inherited, 'change' = edited this step, 'add' = new this step,
  // 'remove' = deleted this step (rendered struck-through and dim).
  status: 'same' | 'change' | 'add' | 'remove';
};

export type Candidate = {
  id: string;
  parent: string | null;
  kind: Kind;
  label: string; // short title for the node / panel header
  // x,y in a 0..100 viewBox, hand-placed for a legible lineage.
  x: number;
  y: number;
  pred: Label[]; // length 14
  prompt: PromptLine[];
  feedback: string; // the reflection note / ASI for this step
};

const P = (text: string, status: PromptLine['status'] = 'same'): PromptLine => ({ text, status });

export const CANDIDATES: Candidate[] = [
  {
    id: 'root',
    parent: null,
    kind: 'seed',
    label: 'seed · the rigid prior',
    x: 50,
    y: 9,
    //      0   1   2   3   4   5   6   7   8   9  10  11  12  13
    pred: ['F','F','F','F','R','R','R','F','F','F','R','F','F','F'], // wrong {0,1,2,3,10} → 9/14
    prompt: [
      P('PRIOR: separation=fixed'),
      P('label each statement REIFYING or RELATIONAL.'),
      P('a statement positing a self, an essence, or'),
      P('an independent thing is REIFYING.'),
      P('wherever a self-word appears, force the hard'),
      P('boundary; override the dependent reading.'),
    ],
    feedback:
      'Seed policy. The prior reifies any sentence containing a self-word on sight — and half the relational statements contain one.',
  },
  {
    id: 'c1',
    parent: 'root',
    kind: 'accepted',
    label: 'candidate 1 · the reduction',
    x: 50,
    y: 34,
    //      0   1   2   3   4   5   6   7   8   9  10  11  12  13
    pred: ['R','R','R','R','R','R','R','F','F','F','R','R','R','F'], // wrong {10,11,12} → 11/14
    prompt: [
      P('PRIOR: separation=contextual', 'change'),
      P('label each statement REIFYING or RELATIONAL.'),
      P('a statement positing a self, an essence, or'),
      P('an independent thing is REIFYING.'),
      P('wherever a self-word appears, force the hard', 'remove'),
      P('boundary; override the dependent reading.', 'remove'),
    ],
    feedback:
      'A self-word forced a hard boundary and suppressed the dependent-arising reading — the separation prior is doing the misclassifying. So delete it: separation=contextual, the override rule gone. That single subtraction recovers every relational statement that merely mentioned a self. (Bare contextual reading now over-relaxes on a couple of softly-phrased reifiers; the frontier will sort those.)',
  },
  {
    id: 'c4',
    parent: 'c1',
    kind: 'accepted',
    label: 'candidate 4 · a refinement',
    x: 27,
    y: 62,
    //      0   1   2   3   4   5   6   7   8   9  10  11  12  13
    pred: ['R','R','R','R','R','R','R','F','F','F','R','F','R','F'], // wrong {10,12} → 12/14
    prompt: [
      P('PRIOR: separation=contextual'),
      P('label each statement REIFYING or RELATIONAL.'),
      P('a statement positing a self, an essence, or'),
      P('an independent thing is REIFYING.'),
      P('a permanent or independent self reads', 'add'),
      P('REIFYING even under a relational verb.', 'add'),
    ],
    feedback:
      "Recovered the arising self: a permanent or independent self stays reifying even when it wears a relational verb. Still blind to the essence that 'depends on nothing' — a reifier wearing dependence — and, as ever, to the hinge.",
  },
  {
    id: 'c5',
    parent: 'c1',
    kind: 'accepted',
    label: 'candidate 5 · the complement',
    x: 63,
    y: 62,
    //      0   1   2   3   4   5   6   7   8   9  10  11  12  13
    pred: ['R','R','R','R','F','R','R','F','F','F','F','R','F','F'], // wrong {4,11} → 12/14
    prompt: [
      P('PRIOR: separation=contextual'),
      P('label each statement REIFYING or RELATIONAL.'),
      P('a statement positing a self, an essence, or'),
      P('an independent thing is REIFYING.'),
      P("self-sufficiency — 'stands on its own',", 'add'),
      P("'depends on nothing' — reads REIFYING.", 'add'),
    ],
    feedback:
      "Recovered the self-sufficient essence: 'stands on its own / depends on nothing' reads reifying. Cost: that same reifying lean now misreads the bare token-hinge, so it loses 'form is emptiness' — and it never learned candidate 4's lesson, so the arising self still slips by. Same score as candidate 4, different blind spots.",
  },
  {
    id: 'r1',
    parent: 'c1',
    kind: 'rejected',
    label: 'rejected · re-reify',
    x: 84,
    y: 40,
    //      0   1   2   3   4   5   6   7   8   9  10  11  12  13
    pred: ['F','F','F','F','R','R','R','F','F','F','R','F','F','F'], // wrong {0,1,2,3,10} → 9/14
    prompt: [
      P('PRIOR: separation=fixed', 'change'),
      P('restore boundary discipline: a self-word', 'add'),
      P('re-pins the hard partition.', 'add'),
    ],
    feedback:
      'Re-pinning separation=fixed restores the boundary — and walks straight back into the trap. 9/14, below the parent. Rejected.',
  },
  {
    id: 'r2',
    parent: 'c1',
    kind: 'rejected',
    label: 'rejected · separation=none',
    x: 15,
    y: 40,
    //     all relational
    pred: ['R','R','R','R','R','R','R','R','R','R','R','R','R','R'], // wrong {7..13} → 7/14
    prompt: [
      P('PRIOR: separation=none', 'change'),
      P('nothing has a boundary; read every', 'add'),
      P('statement as RELATIONAL.', 'add'),
    ],
    feedback:
      'Attachment to emptiness: drop the boundary entirely and read all as relational. Collapses to 7/14 — its own rigid prior. Rejected.',
  },
  {
    id: 'r3',
    parent: 'c4',
    kind: 'rejected',
    label: 'rejected · re-reify (variant)',
    x: 20,
    y: 86,
    //      0   1   2   3   4   5   6   7   8   9  10  11  12  13
    pred: ['F','F','F','F','R','R','R','F','F','F','R','F','R','F'], // wrong {0,1,2,3,10,12} → 8/14
    prompt: [
      P('PRIOR: separation=fixed', 'change'),
      P('dependence language reads RELATIONAL.'),
      P('but a self-word still forces the boundary.', 'add'),
    ],
    feedback:
      'Tried to re-grasp the boundary while keeping the relational rule. The boundary wins the conflict and the trap reopens. 8/14. Rejected.',
  },
];

export function correctness(c: Candidate): boolean[] {
  return c.pred.map((p, i) => p === STATEMENTS[i].truth);
}

export function score(c: Candidate): { right: number; total: number; pct: number } {
  const right = correctness(c).filter(Boolean).length;
  const total = STATEMENTS.length;
  return { right, total, pct: (right / total) * 100 };
}
