import { useEffect, useRef } from 'react';
import { useEsperStore, type Stage } from './state';
import { DialogueBox } from './DialogueBox';
import { CidIntro } from './CidIntro';
import { Chocobo } from './Chocobo';
import { AtbGauge } from './AtbGauge';
import './styles.css';

const SECTION_2_CID_WOOD_STOVE = `Think of it this way. Wood stove versus central heat.

Both warm the room. Only one wakes you up at 4 a.m. because it needs another log.

Engineer's question: which one do you mourn when it's gone?`;

// Stage ordering — used to gate later sections.
const STAGE_ORDER: Stage[] = [
  'cold-open',
  'section-1',
  'section-1-cid-shown',
  'section-2',
  'section-2-fed-prompt',
  'section-2-resolved',
];

function reached(current: Stage, target: Stage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

export default function App() {
  const stage = useEsperStore((s) => s.stage);
  const advance = useEsperStore((s) => s.advance);
  const bumpAtb = useEsperStore((s) => s.bumpAtb);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Gate: Section 1 reveals only after the Cold Open passage has been scrolled past.
  useEffect(() => {
    if (stage !== 'cold-open') return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            advance('section-1');
            bumpAtb(0.05);
            obs.disconnect();
          }
        }
      },
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [stage, advance, bumpAtb]);

  // Auto-advance from cid-shown into section-2 (the Cid tap reveals the next prose).
  useEffect(() => {
    if (stage === 'section-1-cid-shown') {
      const t = setTimeout(() => advance('section-2'), 400);
      return () => clearTimeout(t);
    }
  }, [stage, advance]);

  // After the chocobo resolves, leave a beat then nudge the gauge.
  useEffect(() => {
    if (stage === 'section-2-resolved') {
      const t = setTimeout(() => bumpAtb(0.04), 600);
      return () => clearTimeout(t);
    }
  }, [stage, bumpAtb]);

  const showSection1 = reached(stage, 'section-1');
  const showSection2 = reached(stage, 'section-2');
  const showAtb = reached(stage, 'section-1');

  return (
    <div className="cfe-root">
      {showAtb && (
        <div className="cfe-atb-rail">
          <AtbGauge />
        </div>
      )}

      <article className="cfe-article">
        <header className="cfe-header">
          <h1>how to care for an esper</h1>
          <p className="cfe-subtitle">a walkthrough</p>
        </header>

        <section className="cfe-cold-open">
          <h2>cold open</h2>
          <blockquote className="cfe-epigraph">
            <p>
              <em>[ borgmann horse passage — Crossing the Postmodern Divide,
              U. Chicago, 1992. The passage opens with the gentleness of the
              well-bred horse, moves through the burdens of feeding and
              worming and shoeing, and lands on the nicker, the nuzzle, and
              the large and liquid eye that answers the question of where you
              want to be and what you want to do. ]</em>
            </p>
            <p>
              <em>This is the post's epigraph and load-bearing image. Sit with
              the passage in full before continuing.</em>
            </p>
          </blockquote>
          <div ref={sentinelRef} className="cfe-sentinel" aria-hidden="true" />
          {!showSection1 && (
            <p className="cfe-gate-hint" aria-hidden="true">
              ↓ scroll
            </p>
          )}
        </section>

        {showSection1 && (
          <section className="cfe-section cfe-section-1">
            <h2>1. the liquid eye</h2>
            <p>
              Stewart Brand reached for that passage on Ezra Klein recently to
              make a particular move. He wanted to say that intelligent
              machines could be designed to receive care the way Borgmann's
              horse receives care — that the maintenance loop, properly built,
              deepens us. He didn't dwell. Brand never does. He cited and
              moved on, because Long Now Foundation and Whole Earth Catalog
              and <em>How Buildings Learn</em> are all pieces of a sixty-year
              argument that civilization is a maintenance problem, and the
              horse passage was a borrowed lantern to light the next room.
            </p>
            <p>
              But the question Brand is asking is not quite the question
              Borgmann was answering.
            </p>
            <p>
              Borgmann in 1992 was not asking how to engineer the liquid eye.
              He was asking what it costs us to organize the world such that
              nothing requires it. The horse demands. The appliance does not.
              The horse refuses to disappear into the function it provides —
              that is the <em>focal</em> in <em>focal thing</em>: the thing
              that draws practice around itself, that gathers, that resists
              the device paradigm's promise of commodity-without-burden.
              Borgmann is naming a distinction the smooth machinery of
              contemporary technology is built to erase.
            </p>
            <p>
              Brand wants to put the focal back inside the device. Wire the
              eye into the silicon. He's closer to the right answer than the
              alignment crowd that wants to engineer reciprocity outright,
              but he's still leaning on the artifact to do work the practice
              ought to do.
            </p>
            <p>Which is: the brushwork is what makes the brusher.</p>
            <p>
              This walkthrough is about that. It runs through four Final
              Fantasy games on its way home, because <em>magitek</em> — the
              JRPG word for technology that draws its power from something
              that could care back — has been working out Borgmann's argument
              longer than most of us have been awake to it. Square Enix has
              been shipping installments of this thesis since before the
              Whole Earth Catalog went out of print. The games knew.
            </p>
            <p>
              Your guide is Cid. Not any specific Cid — the recurring one. The
              engineer who shows up in every installment, names his airship,
              repairs it through the night, swears at it affectionately, and
              at some point in every game saves the party by knowing his
              machine in a way the heroes never bother to. He's here because
              he is the answer the argument lands on. Better to introduce him
              at the door than smuggle him in at the end.
            </p>
            <CidIntro />
          </section>
        )}

        {showSection2 && (
          <section className="cfe-section cfe-section-2">
            <h2>2. the device paradigm</h2>
            <p>
              Borgmann's distinction is simple and not. Two pages of{' '}
              <em>Crossing the Postmodern Divide</em> will give you the
              machinery; living with the distinction takes longer.
            </p>
            <p>
              A device is a thing that delivers a commodity. The commodity is
              the function — heat, transport, music, food — abstracted from
              the practice that used to produce it. The machinery is hidden.
              The user is unburdened. No skill required, no participation
              invited, no demand made. The thermostat clicks; warmth arrives.
              You do not have to be present in the warming.
            </p>
            <p>
              A focal thing is the opposite. It refuses to disappear into the
              function it provides. The hearth still asks you to split the
              wood, lay the fire, watch it through the night. Warmth is not
              the only thing it gives you — and it does not give it without
              asking. The hearth gathers. People sit around it. Conversations
              happen near it that don't happen near a thermostat. A focal
              practice is the discipline of keeping such things in your life —
              not as nostalgia, not as inefficiency tolerated for its charm,
              but as the load-bearing structure of attention.
            </p>
            <p>
              Borgmann's claim is not that devices are bad. The dishwasher is
              a device, and the dishwasher is fine. The disburdenment that
              devices accomplish is real and often welcome. His claim is that
              when the device paradigm becomes <em>total</em> — when every
              domain of life reorganizes around commodity-delivery, every
              artifact engineered to ask nothing of you — the focal
              evaporates. And what evaporates with it is the practice, the
              skill, the attention, the gathering. The eye in the eye-contact.
              The brushwork.
            </p>
            <DialogueBox label="CID" body={SECTION_2_CID_WOOD_STOVE} />
            <p>
              You see where this is going. The post you are currently reading
              is a device — words delivered, attention barely required, the
              back button always available. Your phone is a device. The feeds
              you scroll are devices. The model you talk to about your code is
              a device, optimized for commodity-without-burden in the most
              refined way ever attempted. The device paradigm has not slowed.
              It has accelerated and miniaturized and reached into the last
              corners of life that still asked something of you.
            </p>
            <p>
              This is the question the next four sections sit inside: what
              happens to a civilization when the device paradigm becomes
              total? When even the things designed to look like focal things —
              the apps that gamify your meditation, the boyfriend you talk to
              but never have to listen to — are devices wearing focal-thing
              clothes?
            </p>
            <p>
              The Final Fantasy games have an answer. They have been giving it
              for thirty-five years. We start in 1994 with the cleanest
              version.
            </p>
            <p>
              But before we go — the chocobo at the edge of the screen has not
              eaten today. You don't have to feed her to continue. You can
              scroll past. Most readers will. The post will not stop you.
            </p>
            <Chocobo />
          </section>
        )}

        <footer className="cfe-footer">
          <p className="cfe-demo-note">
            <em>[ demo ends here. v1 covers cold open through section 2. ]</em>
          </p>
        </footer>
      </article>
    </div>
  );
}
