import type { ReactNode } from 'react';

// The letters scattered across the post. Each one a discovery the
// linear post does not contain: a Cronopios / Hotel Chevalier
// fragment, available only to the active reader who notices a
// mailbox between paragraphs and drags a wandering sprite onto it.
//
// One exception: the chocobo's letter ('kweh') opens directly when
// she's fed her gysahl greens. She is the tutorial mailbox.
//
// Vibrancy bumps tuned so a reader who finds everything ends near
// full esper + chocobo brightness; one who finds nothing stays at
// the warm-gold default. Both register honestly at the coda.

export type SpriteKind = 'mog' | 'chocobo';

export type LetterId =
  | 'moth'
  | 'catalog'
  | 'pace-layers'
  | 'pollendina'
  | 'odell'
  | 'quentin-watch'
  | 'hearth'
  | 'long-now'
  | 'kweh'
  | 'rick-slot';

export type Letter = {
  id: LetterId;
  carrier: SpriteKind;
  from: string;
  re: string;
  body: ReactNode;
  signoff: string;
  bump: { who: 'esper' | 'chocobo'; delta: number };
};

export const LETTERS: Letter[] = [
  {
    id: 'moth',
    carrier: 'mog',
    from: 'a moth that was here a moment ago',
    re: "Cortázar's actual passage",
    body: (
      <>
        <blockquote>
          And if suddenly a moth lands on the edge of a pencil and
          flutters there like an ash-colored flame, look at it, I am
          looking at it, I am touching its tiny heart and I hear it,
          that moth reverberates in the pie dough of frozen glass, all
          is not lost.
        </blockquote>
        <p>
          <em>
            <a href="https://www.goodreads.com/book/show/12059.Cronopios_and_Famas" target="_blank" rel="noopener">Cronopios and Famas</a>
          </em>, Julio Cortázar, "Instruction Manual," transl. Paul
          Blackburn.
        </p>
      </>
    ),
    signoff: 'kupo. it lands on the pencil. it does not stay.',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'catalog',
    carrier: 'mog',
    from: 'a moogle, fluttering',
    re: 'the original instinct',
    body: (
      <>
        <blockquote>
          We are as gods and might as well get good at it.
        </blockquote>
        <p>
          That's the opening line of the{' '}
          <a href="https://wholeearth.info/" target="_blank" rel="noopener">Whole Earth Catalog</a>
          , Fall 1968. Stewart Brand wrote it at twenty-nine. Underneath the line, in smaller type:{' '}
          <em>
            a realm of intimate, personal power is developing (power of
            the individual to conduct his own education, find his own
            inspiration, shape his own environment, and share his
            adventure with whoever is interested).
          </em>
        </p>
        <p>A catalog, then, of access to tools.</p>
      </>
    ),
    signoff: 'kupo!',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'pace-layers',
    carrier: 'mog',
    from: 'a moogle who has read the Brand',
    re: 'the layers',
    body: (
      <>
        <p>
          Stewart Brand's diagram, from{' '}
          <em>
            <a href="https://www.goodreads.com/book/show/38310.How_Buildings_Learn" target="_blank" rel="noopener">How Buildings Learn</a>
          </em>: every building is six layers, each changing at its own rate.
        </p>
        <pre className="cfe-letter-pre">
          {`SITE        : eternal
STRUCTURE   : 30 to 300 years
SKIN        : 20 years
SERVICES    : 7 to 15 years
SPACE PLAN  : 3 to 30 years
STUFF       : daily`}
        </pre>
        <p>
          The fast layers learn from the slow. The slow layers constrain
          the fast. A building that survives is one whose layers are
          allowed to move at their own rates without tearing themselves
          apart.
        </p>
        <p>The civilization Brand argues for is a building, scaled up.</p>
      </>
    ),
    signoff: 'kupo. small things move fast. big things move slow. that is the trick.',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'pollendina',
    carrier: 'mog',
    from: 'a tonberry, very slow, with a small lantern',
    re: 'the moment Cid realizes',
    body: (
      <>
        <p>
          In FFIV, Cid Pollendina built the airships of Baron because the
          king asked him to. Then he watched what they were used for:
          bombing raids, conscripted villages, monsters dropped on
          Mysidia. There is a scene where Cid stands on the deck of the{' '}
          <em>Enterprise</em> with the protagonist, Cecil, and says:
        </p>
        <blockquote>The airships were never supposed to be for this.</blockquote>
        <p>
          Then he flies the <em>Enterprise</em> into the underground and
          detonates it, by hand, to seal a gate. The party leaves him
          for dead. He turns up alive two chapters later (old men do, in
          this game), but the ship is gone, and Cid spends the rest of
          the game building the next one.
        </p>
        <p>The airship is not the thing. Cid is the thing.</p>
      </>
    ),
    signoff: '...zup.',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'odell',
    carrier: 'mog',
    from: 'a moogle, watching a heron',
    re: 'Odell, How to Do Nothing',
    body: (
      <>
        <p>
          Jenny Odell's{' '}
          <em>
            <a href="https://www.goodreads.com/book/show/42771901-how-to-do-nothing" target="_blank" rel="noopener">How to Do Nothing</a>
          </em>{' '}
          gives Ramza's refusal a contemporary vocabulary. The
          attention economy extracts; the refuser redirects; the place
          attention gets redirected toward (Odell calls it the
          bioregion) was always there, ignored by the apparatus. The
          platform punishes the redirector with invisibility, which is
          the same prize the chronicler offers Ramza. The bioregion
          does not.
        </p>
        <p>
          She is making the Borgmann move in 2019 idiom. The focal
          substrate is a watershed, a heron, a row of rosemary on the
          balcony, and the practice is paying attention to it on its
          own terms. Refusal as redirection. The reward is what you
          became through the redirecting.
        </p>
      </>
    ),
    signoff: 'kupo. it is watching the heron, too.',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'quentin-watch',
    carrier: 'mog',
    from: 'a marlboro, dragging slightly',
    re: 'the watch',
    body: (
      <>
        <p>
          The morning of his suicide, Quentin Compson (narrator of{' '}
          <em>
            <a href="https://www.goodreads.com/book/show/10975.The_Sound_and_the_Fury" target="_blank" rel="noopener">The Sound and the Fury</a>
          </em>
          ){' '}takes the watch his father gave him (
          <em>a mausoleum of all hope and desire</em>) and breaks it.
          Twists the hands off, watches them spin to the floor. He still
          hears it ticking. He has spent the morning trying to outrun
          time and the watch will not stop.
        </p>
        <blockquote>
          Father said clocks slay time. He said time is dead as long as
          it is being clicked off by little wheels; only when the clock
          stops does time come to life.
        </blockquote>
        <p>
          Cortázar's watch, fifty years later, was the same watch.
        </p>
      </>
    ),
    signoff: '...glorp.',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'hearth',
    carrier: 'mog',
    from: 'a cactuar, vibrating',
    re: 'beyond the horse',
    body: (
      <>
        <blockquote>
          A practice... is required to organize human existence around a
          focal thing, and so to inscribe attention into a person's life.
          The hearth is the original focal thing. Its centripetal pull
          becomes the structure of the dwelling around it.
        </blockquote>
        <p>
          Borgmann,{' '}
          <em>
            <a href="https://www.goodreads.com/book/show/704227.Technology_and_the_Character_of_Contemporary_Life" target="_blank" rel="noopener">Technology and the Character of Contemporary Life</a>
          </em>
          , 1984. (The book before the one we cited at the top.)
        </p>
        <p>
          The horse is the second example in his catalog. The hearth is
          the first. Both make the same move: a thing that gathers
          practice around itself.
        </p>
      </>
    ),
    signoff: '!!!',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'long-now',
    carrier: 'mog',
    from: 'a moogle who has been waiting',
    re: 'Long Now',
    body: (
      <>
        <p>
          The{' '}
          <a href="https://longnow.org/clock/" target="_blank" rel="noopener">clock</a>
          {' '}in the Texas mountain ticks once a year. The century hand
          advances every hundred years. The cuckoo comes out every
          millennium. Brand and Hillis built it (are still building it)
          to require a maintainer every generation, forever, and to refuse
          to be finished by any single one of them.
        </p>
        <p>
          The maintenance survives because the maintainers do not. That
          sentence is the whole post in twelve words.
        </p>
      </>
    ),
    signoff: 'kupo.',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'kweh',
    carrier: 'chocobo',
    from: 'the chocobo herself',
    re: 'the sound',
    body: (
      <>
        <p>
          The original chocobo cry was recorded in 1988, on a Yamaha
          synth, by Nobuo Uematsu, who had never seen a chocobo. He said
          later that he tried to imagine what a giant friendly bird would
          say if it loved you and had something on its mind. <em>Kweh</em>
          , he decided.
        </p>
        <p>That is what she is saying.</p>
      </>
    ),
    signoff: 'kweh.',
    bump: { who: 'chocobo', delta: 0.05 },
  },
  {
    id: 'rick-slot',
    carrier: 'mog',
    from: 'a moogle that knows you',
    re: 'something personal',
    body: (
      <>
        <p>when you sing out loud, the world sings back.</p>
      </>
    ),
    signoff: 'kupo. some letters are not from moogles.',
    bump: { who: 'esper', delta: 0.04 },
  },
];

export const LETTERS_BY_ID: Record<LetterId, Letter> = LETTERS.reduce(
  (acc, l) => {
    acc[l.id] = l;
    return acc;
  },
  {} as Record<LetterId, Letter>,
);
