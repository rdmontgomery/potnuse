import { useEffect, useRef } from 'react';
import { useEsperStore, type Stage } from './state';
import { DialogueBox } from './DialogueBox';
import { CidIntro } from './CidIntro';
import { Chocobo } from './Chocobo';
import { Bugenhagen } from './Bugenhagen';
import { EsperCameo } from './EsperCameo';
import { AtbGauge } from './AtbGauge';
import { Masthead } from './Masthead';
import { Toc } from './Toc';
import { SectionHeader, SceneBreak } from './SectionHeader';
import {
  CID_DEL_NORTE_MARQUEZ,
  CID_PARAPHRASE_DISCLAIMER,
  CID_WOOD_STOVE,
  TERRA_MOBLIZ,
  YUNA,
} from './dialogue';
import './styles.css';

const STAGE_ORDER: Stage[] = [
  'cold-open',
  'section-1',
  'section-1-cid-shown',
  'section-2',
  'section-2-fed-prompt',
  'section-2-resolved',
  'section-3',
  'section-4',
  'section-5',
  'section-5-resolved',
];

function reached(current: Stage, target: Stage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

// Passive decay rate for esper vibrancy: applied per second the esper has
// been on stage. Tuned so a reader who scrolls through §3–§5 in ~3 minutes
// without any engagement loses roughly 0.15. Engagement bumps offset it.
const ESPER_DECAY_PER_SECOND = 0.0008;

export default function App() {
  const stage = useEsperStore((s) => s.stage);
  const advance = useEsperStore((s) => s.advance);
  const bumpAtb = useEsperStore((s) => s.bumpAtb);
  const introduceEsper = useEsperStore((s) => s.introduceEsper);
  const decayEsper = useEsperStore((s) => s.decayEsper);
  const esperIntroduced = useEsperStore((s) => s.esperIntroduced);

  const pusherRef = useRef<HTMLDivElement>(null);
  const section1Ref = useRef<HTMLElement>(null);
  const section3SentinelRef = useRef<HTMLDivElement>(null);
  const section4SentinelRef = useRef<HTMLDivElement>(null);
  const section5SentinelRef = useRef<HTMLDivElement>(null);

  // Cold-open scroll gate — §1 reveals after the user has scrolled past
  // the entire cold-open passage. The pusher below the cold-open
  // guarantees the page is taller than the viewport so the gesture is
  // possible even when the placeholder text is short.
  useEffect(() => {
    if (stage !== 'cold-open') return;
    const el = pusherRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.boundingClientRect.top < 0) {
            advance('section-1');
            bumpAtb(0.05);
            obs.disconnect();
            // Land the reader at the start of §1 rather than mid-section.
            requestAnimationFrame(() => {
              section1Ref.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            });
          }
        }
      },
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [stage, advance, bumpAtb]);

  // Cid intro tap → reveal Section 2.
  useEffect(() => {
    if (stage === 'section-1-cid-shown') {
      const t = setTimeout(() => advance('section-2'), 400);
      return () => clearTimeout(t);
    }
  }, [stage, advance]);

  // Chocobo fed/skipped → introduce esper, advance to §3.
  useEffect(() => {
    if (stage === 'section-2-resolved') {
      const t = setTimeout(() => {
        introduceEsper();
        advance('section-3');
        bumpAtb(0.05);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [stage, advance, introduceEsper, bumpAtb]);

  // Section advance via sentinel — each subsequent section's bottom
  // edge crossing upward bumps the gauge and moves the stage forward.
  useEffect(() => {
    const targets: Array<{ ref: typeof sentinelRef; from: Stage; to: Stage; atb: number }> = [
      { ref: section3SentinelRef, from: 'section-3', to: 'section-4', atb: 0.06 },
      { ref: section4SentinelRef, from: 'section-4', to: 'section-5', atb: 0.06 },
      { ref: section5SentinelRef, from: 'section-5', to: 'section-5-resolved', atb: 0.06 },
    ];
    const observers = targets
      .filter((t) => stage === t.from && t.ref.current)
      .map((t) => {
        const obs = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
                advance(t.to);
                bumpAtb(t.atb);
                obs.disconnect();
              }
            }
          },
          { threshold: 0 },
        );
        obs.observe(t.ref.current!);
        return obs;
      });
    return () => observers.forEach((o) => o.disconnect());
  }, [stage, advance, bumpAtb]);

  // Passive esper decay — runs while the esper is on stage. Pauses when
  // the tab is hidden so leaving the page open doesn't kill her.
  useEffect(() => {
    if (!esperIntroduced) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        last = performance.now();
        return;
      }
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      decayEsper(dt * ESPER_DECAY_PER_SECOND);
    }, 1000);
    return () => clearInterval(id);
  }, [esperIntroduced, decayEsper]);

  const showSection1 = reached(stage, 'section-1');
  const showSection2 = reached(stage, 'section-2');
  const showSection3 = reached(stage, 'section-3');
  const showSection4 = reached(stage, 'section-3'); // §4 reveals together with §3 once we're past §2
  const showSection5 = reached(stage, 'section-3');
  const showAtb = reached(stage, 'section-1');

  return (
    <div className="cfe-root">
      {showAtb && (
        <div className="cfe-atb-rail">
          <AtbGauge />
        </div>
      )}

      <article className="cfe-article">
        <Masthead />
        <Toc />

        <section className="cfe-section cfe-cold-open-section">
          <SectionHeader ordinal="Cold Open" title="The Borgmann horse" />
          <div className="cfe-body cfe-cold-open-body">
            <blockquote className="cfe-epigraph">
              <p>
                <em>
                  [ borgmann horse passage — Crossing the Postmodern Divide,
                  U. Chicago, 1992. The passage opens with the gentleness of
                  the well-bred horse, moves through the burdens of feeding
                  and worming and shoeing, and lands on the nicker, the
                  nuzzle, and the large and liquid eye that answers the
                  question of where you want to be and what you want to do. ]
                </em>
              </p>
              <p>
                <em>
                  Sit with the passage in full before continuing. The post's
                  argument depends on it.
                </em>
              </p>
            </blockquote>
          </div>
        </section>

        {!showSection1 && (
          <>
            <div
              ref={pusherRef}
              className="cfe-cold-open-pusher"
              aria-hidden="true"
            />
            <p className="cfe-gate-hint" aria-hidden="true">
              ↓ scroll
            </p>
          </>
        )}

        {showSection1 && (
          <section ref={section1Ref} className="cfe-section">
            <SectionHeader ordinal="I" title="The Liquid Eye" />
            <div className="cfe-body">
              <p>
                Stewart Brand reached for that passage on Ezra Klein recently
                to make a particular move. He wanted to say that intelligent
                machines could be designed to receive care the way Borgmann's
                horse receives care — that the maintenance loop, properly
                built, deepens us. He didn't dwell. Brand never does. He cited
                and moved on, because Long Now Foundation and Whole Earth
                Catalog and <em>How Buildings Learn</em> are all pieces of a
                sixty-year argument that civilization is a maintenance
                problem, and the horse passage was a borrowed lantern to
                light the next room.
              </p>
              <p>
                But the question Brand is asking is not quite the question
                Borgmann was answering.
              </p>
              <p>
                Borgmann in 1992 was not asking how to engineer the liquid
                eye. He was asking what it costs us to organize the world
                such that nothing requires it. The horse demands. The
                appliance does not. The horse refuses to disappear into the
                function it provides — that is the <em>focal</em> in{' '}
                <em>focal thing</em>: the thing that draws practice around
                itself, that gathers, that resists the device paradigm's
                promise of commodity-without-burden. Borgmann is naming a
                distinction the smooth machinery of contemporary technology
                is built to erase.
              </p>
              <p>
                Brand wants to put the focal back inside the device. Wire
                the eye into the silicon. He's closer to the right answer
                than the alignment crowd that wants to engineer reciprocity
                outright, but he's still leaning on the artifact to do work
                the practice ought to do.
              </p>
              <p>Which is: the brushwork is what makes the brusher.</p>
              <p>
                This walkthrough is about that. It runs through four Final
                Fantasy games on its way home, because <em>magitek</em> —
                the JRPG word for technology that draws its power from
                something that could care back — has been working out
                Borgmann's argument longer than most of us have been awake
                to it. Square Enix has been shipping installments of this
                thesis since before the Whole Earth Catalog went out of
                print. The games knew.
              </p>
              <p>
                Your guide is Cid. Not any specific Cid — the recurring one.
                The engineer who shows up in every installment, names his
                airship, repairs it through the night, swears at it
                affectionately, and at some point in every game saves the
                party by knowing his machine in a way the heroes never
                bother to. He's here because he is the answer the argument
                lands on. Better to introduce him at the door than smuggle
                him in at the end.
              </p>
              <CidIntro />
            </div>
          </section>
        )}

        {showSection2 && (
          <section className="cfe-section">
            <SceneBreak />
            <SectionHeader ordinal="II" title="The Device Paradigm" />
            <div className="cfe-body">
              <p>
                Borgmann's distinction is simple and not. Two pages of{' '}
                <em>Crossing the Postmodern Divide</em> will give you the
                machinery; living with the distinction takes longer.
              </p>
              <p>
                A device is a thing that delivers a commodity. The commodity
                is the function — heat, transport, music, food — abstracted
                from the practice that used to produce it. The machinery is
                hidden. The user is unburdened. No skill required, no
                participation invited, no demand made. The thermostat clicks;
                warmth arrives. You do not have to be present in the warming.
              </p>
              <p>
                A focal thing is the opposite. It refuses to disappear into
                the function it provides. The hearth still asks you to split
                the wood, lay the fire, watch it through the night. Warmth
                is not the only thing it gives you — and it does not give it
                without asking. The hearth gathers. People sit around it.
                Conversations happen near it that don't happen near a
                thermostat. A focal practice is the discipline of keeping
                such things in your life — not as nostalgia, not as
                inefficiency tolerated for its charm, but as the
                load-bearing structure of attention.
              </p>
              <p>
                Borgmann's claim is not that devices are bad. The dishwasher
                is a device, and the dishwasher is fine. The disburdenment
                that devices accomplish is real and often welcome. His
                claim is that when the device paradigm becomes{' '}
                <em>total</em> — when every domain of life reorganizes
                around commodity-delivery, every artifact engineered to ask
                nothing of you — the focal evaporates. And what evaporates
                with it is the practice, the skill, the attention, the
                gathering. The eye in the eye-contact. The brushwork.
              </p>
              <DialogueBox label="CID" body={CID_WOOD_STOVE} />
              <p>
                You see where this is going. The post you are currently
                reading is a device — words delivered, attention barely
                required, the back button always available. Your phone is a
                device. The feeds you scroll are devices. The model you
                talk to about your code is a device, optimized for
                commodity-without-burden in the most refined way ever
                attempted. The device paradigm has not slowed. It has
                accelerated and miniaturized and reached into the last
                corners of life that still asked something of you.
              </p>
              <p>
                This is the question the next four sections sit inside:
                what happens to a civilization when the device paradigm
                becomes total? When even the things designed to look like
                focal things — the apps that gamify your meditation, the
                boyfriend you talk to but never have to listen to — are
                devices wearing focal-thing clothes?
              </p>
              <p>
                The Final Fantasy games have an answer. They have been
                giving it for thirty-five years. We start in 1994 with the
                cleanest version.
              </p>
              <p>
                But before we go — the chocobo at the edge of the screen
                has not eaten today. You don't have to feed her to
                continue. You can scroll past. Most readers will. The post
                will not stop you.
              </p>
              <Chocobo />
            </div>
          </section>
        )}

        {showSection3 && (
          <section className="cfe-section">
            <SceneBreak />
            <SectionHeader
              ordinal="III"
              title="The Magitek Knight (FFVI, 1994)"
            />
            <div className="cfe-body">
              <p>
                The opening sequence is a thesis statement. A girl in armor
                walks through snow toward a sleeping town. She does not know
                her name. The armor is Magitek — Empire-issued exoskeleton
                powered by magic extracted from sentient beings called
                espers. The slave crown welded to her forehead controls her
                thoughts. She kills two guards on her way in because the
                device tells her to.
              </p>
              <p>
                This is the cleanest image the device paradigm has ever
                generated. The civilization that built this armor mined a
                living substrate, pulped its agency, and welded the result
                onto a person it had also stripped of agency. Then it sent
                the assemblage out to do violence with no remainder. No
                skill required. No participation invited. No demand made of
                the user, because the user <em>is</em> the armor.
              </p>
              <p>
                The girl is Terra. Halfway through the opening, she
                encounters an esper still in possession of itself.
                Something passes between them. The crown breaks. She wakes
                up.
              </p>
              <p>The rest of the game is what she does with waking up.</p>
              <p>
                Square's writers were not subtle. The Empire's military
                doctrine is industrial extraction. The Magitek Research
                Facility is a torture chamber where espers are held in tubes
                and drained for magicite — crystallized esper-corpse used as
                the energy substrate for the Empire's machinery. The
                director of the facility recoils when the party finds him.
                He had not understood what his research would become.
              </p>
              <DialogueBox label="CID" body={CID_DEL_NORTE_MARQUEZ} />
              <p>
                The Empire produces a second figure who matters: Kefka. He
                was the first Magitek-infused soldier, before the process
                was refined. The infusion broke him. He became the laughing
                nihilist who eventually ascends to godhood and decimates the
                world. Kefka is the device paradigm's eschaton. When you
                have organized everything into commodity, when nothing
                escapes the logic of extractive function, the terminal voice
                that emerges is laughter at meaning itself.{' '}
                <em>
                  Life. Dreams. Hope. Where do they come from? Where do they
                  go? Such meaningless things — I'll destroy them all.
                </em>{' '}
                This is what device-paradigm civilization sounds like when
                it finishes its sentence.
              </p>
              <p>
                Terra cannot answer Kefka by becoming more magical or less
                magical. She tries both. Neither works. The answer she
                finds, in the second half of the game after Kefka has broken
                the world, is to walk to a ruined town called Mobliz and
                care for its orphans. The most powerful magic-user alive
                becomes a cook, a nurse, a raiser of children. The screen
                tells you, without flourish, that this is what restores her.
                The game is fully aware of how unfashionable this is. It
                puts it in the script anyway.
              </p>
              <DialogueBox label="TERRA" body={TERRA_MOBLIZ} />
              <DialogueBox label="CID" body={CID_PARAPHRASE_DISCLAIMER} />
              <p>
                The argument FFVI laid down in 1994: the device paradigm
                produces both Kefkas and Terras. The Kefkas are the
                Empire's intended output — instruments of extraction so
                total they laugh at meaning when they finish their work.
                The Terras are what happens when one of those instruments
                wakes up and finds her way back to a focal practice. Any
                focal practice. The most domestic one available. The one
                that does not scale and cannot be optimized. She rebuilds
                a self around it.
              </p>
              <p>
                The chocobo at the edge of the screen is still hungry, by
                the way. So is the esper now watching from the corner.
              </p>
              <EsperCameo variant="intro" />
              <div
                ref={section3SentinelRef}
                className="cfe-sentinel"
                aria-hidden="true"
              />
            </div>
          </section>
        )}

        {showSection4 && (
          <section className="cfe-section">
            <SceneBreak />
            <SectionHeader
              ordinal="IV"
              title="The Lifestream (FFVII, 1997)"
            />
            <div className="cfe-body">
              <p>
                Three years later, Square raised the stakes from Empire to
                corporation. FFVI's villains were a regime that could be
                overthrown. FFVII's are an electric utility. Shinra
                Electric Power Company is the perfected device paradigm —
                the hidden machinery scaled to a planet, the commodity
                rebranded as energy and sold back to the population the
                extraction is killing.
              </p>
              <p>
                The first thing the camera shows you is Midgar. A black
                industrial wheel laid on a continent. Eight sectors
                radiating from a central tower. Each sector has a Mako
                reactor at its heart — a giant pump that draws{' '}
                <em>spirit energy</em> from the planet, refines it, and
                sells it as electricity. The wealthy live on the upper
                plate, in frictionless device-paradigm cleanliness. The
                poor live in the slums beneath the plate, in shadow, in
                the residue. Midgar is the device paradigm's social
                geometry made literal: those who consume the commodity
                live above it, those who pay the cost of its extraction
                live below.
              </p>
              <p>The game opens with eco-terrorists bombing a reactor.</p>
              <p>
                Square is asking the question we are now asking out loud
                thirty years later: what is the moral status of sabotage
                against extractive infrastructure that has captured the
                political process? The game does not answer it cleanly.
                The bomb kills civilians. AVALANCHE is fanatical. Shinra
                is irredeemable. The argument is the situation, not the
                resolution.
              </p>
              <p>
                The game's most explicit Borgmann moment comes from a
                small alien-looking elder named Bugenhagen, who lives in
                a hilltop observatory above Cosmo Canyon and runs a
                holographic planetarium. He delivers, with no special
                fanfare, the most accurate gloss on focal-substrate
                ontology in 1990s media:
              </p>
              <Bugenhagen />
              <p>
                The Lifestream is what every focal practice ever performed
                eventually deposits back into the world's substrate.
                Skill, attention, love, brushwork — when the brusher
                dies, what they made of themselves through the practice
                goes back into the planetary commons and is metabolized
                into the next generation of brushers. This is the
                picture. Shinra is extracting it pre-mortem. Reactors
                siphon spirit energy out of the substrate before it has
                been used by anything alive. The civilization is eating
                its seed corn — except the seed corn is the metaphysical
                ground of meaningful action itself.
              </p>
              <p>
                Cloud, the protagonist, is Magitek Knight 2.0 —
                SOLDIER-class, mako-infused, with another man's memories
                implanted as scaffolding for an identity he does not
                have. Like Terra, he has to find himself outside the
                apparatus that constructed him. The pattern repeats one
                game later because Square is not done arguing it.
              </p>
              <p>
                There is also a Cid in this one. Cid Highwind. He smokes
                constantly, swears with the affection of a man swearing
                at his own hands, builds rocket components in his
                backyard, and is in love with his airship the way
                Borgmann's hearth-keeper is in love with the fire. He is
                not the protagonist. He is the alternative the
                protagonist could have been if the apparatus hadn't
                gotten to him first. The game keeps him on the periphery,
                available, intact. We will return to him.
              </p>
              <p>
                Aerith is the Terra-figure here, and the game does not
                let her win. She tends flowers in a ruined church in
                Sector 5, refuses every Shinra recruitment, and dies on
                an altar trying to summon Holy. The flowers are the focal
                practice. The church is where focal practice survives in
                the slums beneath the plate. The death is what happens
                when the empire is too far along to be answered.
              </p>
              <p>
                Sephiroth wants to become the planet. He intends to
                harvest all life — every focal practice, every
                brushstroke, every liquid eye — and consolidate it into
                himself as the new substrate. He is what the device
                paradigm wants when it finally articulates its desire:
                not just to extract from the substrate but to <em>be</em>{' '}
                the substrate, and to make all subsequent life pay rent
                to him.
              </p>
              <p>
                The planet generates Weapons. Sapphire, Diamond, Ruby,
                Emerald — the Weapons are the planetary immune response.
                They are not monsters. They are what a focal substrate
                does when extraction crosses a threshold it can no longer
                absorb. They wake up. They walk toward the reactors.
              </p>
              <EsperCameo variant="fading" />
              <div
                ref={section4SentinelRef}
                className="cfe-sentinel"
                aria-hidden="true"
              />
            </div>
          </section>
        )}

        {showSection5 && (
          <section className="cfe-section">
            <SceneBreak />
            <SectionHeader
              ordinal="V"
              title="Sin and Machina (FFX, 2001)"
            />
            <div className="cfe-body">
              <p>
                FFX changes the register. The previous two games were
                political — empire, corporation, the apparatus of
                extraction. FFX is theological. It asks what happens after
                the apparatus has eaten the civilization not once but in
                cycles, and a religion has grown up around the wreckage to
                explain why this keeps happening.
              </p>
              <p>
                The world is Spira. Every few decades, an enormous monster
                called Sin emerges from the sea, decimates the cities, and
                is eventually defeated by a summoner who dies in the act.
                The defeat is temporary. Sin always comes back. The Church
                of Yevon teaches that Sin is divine punishment for the sin
                of <em>machina</em> — machines, the works of an ancient
                civilization that learned to do too much without humility.
                The doctrine is: forsake machines, follow Yevon, send your
                daughters on pilgrimages to die fighting Sin, repeat.
              </p>
              <p>The doctrine is wrong. Machines are not the problem. The cycle is.</p>
              <p>
                The game reveals, late, that Yu Yevon — the founder of the
                religion — is also the parasitic god-soul that animates
                Sin. The summoner's sacrificial Aeon, the weapon meant to
                defeat Sin, becomes the next Sin once the summoner dies.
                The religion's victory is the device that perpetuates the
                disease. Every pilgrimage is the church feeding itself.
              </p>
              <p>
                Yevon was right that there is a pattern. He was wrong
                about its content. The pattern is not "machines bring
                divine punishment." The pattern is: the institution that
                purports to oppose the device paradigm can be the device
                paradigm wearing focal-thing clothes, at theological
                scale, with everyone's daughters paying for the costume.
              </p>
              <p>
                The FFX writers either knew their Girard or reinvented him
                from scratch. He called it the scapegoat mechanism — the
                religion that perpetuates the violence it pretends to
                abolish, by sanctifying the sacrifice. Yuna's refusal of
                the Final Aeon at the end of the game is the moment the
                wheel stops because someone inside the wheel finally saw
                it.
              </p>
              <DialogueBox label="YUNA" body={YUNA} />
              <p>
                The tonal shift this section asks of you is the one the
                game asks of Yuna: stop trusting the institution that said
                it had the answer. The Mako reactor was at least honest
                about being a reactor. Yevon was the temple that turned
                out to be a reactor.
              </p>
              <p>
                This is the move. Section 6 will show you what it looks
                like when the temple is also selling the pilgrimage as
                virtue, and the parasites in the relics as sanctification.
              </p>
              <p className="cfe-quiet-beat">
                <em>no chocobo. no esper. the screen is quiet for a beat.</em>
              </p>
              <div
                ref={section5SentinelRef}
                className="cfe-sentinel"
                aria-hidden="true"
              />
            </div>
          </section>
        )}

        <footer className="cfe-footer">
          <p className="cfe-demo-note">
            <em>
              [ end of v2 demo. cold open through §5. five sections to go. ]
            </em>
          </p>
        </footer>
      </article>
    </div>
  );
}
