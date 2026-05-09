import type { ReactNode } from 'react';

// The 10 letters scattered across the post. Each one a discovery the
// linear post does not contain — a Hopscotch / Hotel Chevalier
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
  | 'castorp'
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
          Yes, but who will cure us of the dull fire, the colorless fire
          that at nightfall runs along the Rue de la Huchette, emerging
          from the crumbling doorways, from the little entryways, of the
          imageless fire that licks the stones and lies in wait in
          doorways? How shall we cleanse ourselves of the sweet burning
          that comes after, that nests in us forever allied with time and
          memory, with sticky things that hold us here on this side?
        </blockquote>
        <p>
          — <em>
            <a href="https://www.goodreads.com/book/show/53413.Hopscotch" target="_blank" rel="noopener">Hopscotch</a>
          </em>, Julio Cortázar, ch. 73, transl. Gregory Rabassa.
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
          , Fall 1968.{' '}
          <a href="https://podcasts.apple.com/us/podcast/stewart-brand-silicon-valleys-favorite-prophet-on-lifes/id1548604447?i=1000763393453" target="_blank" rel="noopener">Stewart Brand</a>
          {' '}wrote it at twenty-nine. Underneath the line, in smaller type:{' '}
          <em>
            a realm of intimate, personal power is developing — power of
            the individual to conduct his own education, find his own
            inspiration, shape his own environment, and share his
            adventure with whoever is interested.
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
          {`SITE        — eternal
STRUCTURE   — 30 to 300 years
SKIN        — 20 years
SERVICES    — 7 to 15 years
SPACE PLAN  — 3 to 30 years
STUFF       — daily`}
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
          king asked him to. Then he watched what they were used for —
          bombing raids, conscripted villages, monsters dropped on
          Mysidia. There is a scene where Cid stands on the deck of the{' '}
          <em>Enterprise</em> with the protagonist, Cecil, and says:
        </p>
        <blockquote>The airships were never supposed to be for this.</blockquote>
        <p>
          Then he flies the <em>Enterprise</em> into the underground and
          detonates it, by hand, to seal a gate. The party leaves him
          for dead. He turns up alive two chapters later — old men do, in
          this game — but the ship is gone, and Cid spends the rest of
          the game building the next one.
        </p>
        <p>The airship is not the thing. Cid is the thing.</p>
      </>
    ),
    signoff: '...zup.',
    bump: { who: 'esper', delta: 0.04 },
  },
  {
    id: 'castorp',
    carrier: 'mog',
    from: 'a moogle, slow today',
    re: 'Mann, Magic Mountain',
    body: (
      <>
        <p>
          Hans Castorp comes to Davos for three weeks and stays seven
          years.{' '}
          <em>
            <a href="https://www.goodreads.com/book/show/88077.The_Magic_Mountain" target="_blank" rel="noopener">The Magic Mountain</a>
          </em>{' '}
          keeps changing time scales on you — chapters that span an
          afternoon, chapters that span seasons, a chapter (<em>By the
          Ocean of Time</em>) that just sits in the dilation. Mann is
          doing on the page what the mountain does to Castorp: the
          longer you stay, the less the clock means.
        </p>
        <blockquote>
          Vacuity, monotony, have, indeed, this insidious quality, that
          they wear out, but from out their own being are powerless to
          make new. Once content has been finally exhausted, monotony is
          the only habit from which we can truly learn.
        </blockquote>
        <p>
          The reader who comes back to this post tomorrow will find its
          clock has slowed.
        </p>
      </>
    ),
    signoff: 'kupo, kupo.',
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
          The morning of his suicide, Quentin Compson — narrator of{' '}
          <em>
            <a href="https://www.goodreads.com/book/show/10975.The_Sound_and_the_Fury" target="_blank" rel="noopener">The Sound and the Fury</a>
          </em>
          {' '}— takes the watch his father gave him —{' '}
          <em>a mausoleum of all hope and desire</em> — and breaks it.
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
          millennium. Brand and Hillis built it — are still building it —
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
        <p>
          <em>
            [ Rick — this is your slot. A Stevie line about Hopscotch. A
            specific airship from your kid's playthrough. Something about
            the cabin or the horse or your dad or the stove. The letter
            that is yours, not mine. Anywhere from three sentences to
            three paragraphs. ]
          </em>
        </p>
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
