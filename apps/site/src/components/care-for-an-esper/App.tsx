import { useEffect } from 'react';
import { useEsperStore } from './state';
import { DialogueBox } from './DialogueBox';
import { Chocobo } from './Chocobo';
import { EsperCameo } from './EsperCameo';
import { CodaChocobo, CodaEsper } from './CodaCameo';
import { Masthead } from './Masthead';
import { Toc } from './Toc';
import { SectionHeader, SceneBreak } from './SectionHeader';
import {
  BUGENHAGEN,
  CID_BREAK_FOURTH_WALL,
  CID_DEL_NORTE_MARQUEZ,
  CID_FINAL,
  CID_INTRO,
  CID_PARAPHRASE_DISCLAIMER,
  CID_THUNDER_GOD,
  CID_WOOD_STOVE,
  RAMZA_AJORA,
  RAMZA_TIETRA,
  RAMZA_WIEGRAF,
  TERRA_MOBLIZ,
  YUNA,
} from './dialogue';
import './styles.css';

export default function App() {
  const hydrate = useEsperStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="cfe-root">
      <article className="cfe-article">
        <Masthead />
        <Toc />

        <section className="cfe-section cfe-cold-open-section">
          <SectionHeader ordinal="Cold Open" title="The Borgmann horse" />
          <div className="cfe-body cfe-cold-open-body">
            <blockquote className="cfe-epigraph">
              <p>
                You cannot remain unmoved by the gentleness and conformation
                of well-bred and well-trained horse — more than a thousand
                pounds of big-boned, well-muscled animal, slick of coat and
                sweet of smell, obedient and mannerly, and yet forever a
                menace with its innocent power and ineradicable inclination
                to seek refuge in flight, and always a burden with its need
                to be fed, wormed and shod, and its liability to cuts and
                infections, to laming and heaves. But when it greets you
                with a nicker, nuzzles your chest, and regards you with a
                large and liquid eye, the question of where you want to be
                and what you want to do has been answered.
              </p>
              <footer className="cfe-epigraph-cite">
                — Albert Borgmann, <em>Crossing the Postmodern Divide</em>,
                University of Chicago Press, 1992.
              </footer>
            </blockquote>
          </div>
        </section>

        <section className="cfe-section">
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
              <DialogueBox label="CID" body={CID_INTRO} />
            </div>
          </section>

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
                Before we go — there is a chocobo at the edge of the
                screen. The post is full of devices, and she is not one
                of them. She has gysahl greens at her feet if you have a
                hand free.
              </p>
              <Chocobo />
            </div>
          </section>

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
                Watch the corner. An esper has appeared.
              </p>
              <EsperCameo variant="intro" />
            </div>
          </section>

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
              <DialogueBox label="BUGENHAGEN" body={BUGENHAGEN} />
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
            </div>
          </section>

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
            </div>
          </section>

          <section className="cfe-section">
            <SceneBreak />
            <SectionHeader
              ordinal="VI"
              title="The False Relics (FFT, 1997)"
            />
            <div className="cfe-body">
              <p>
                Ivalice, late in the War of the Lions. A boy named Ramza
                Beoulve, second son of a noble house, watches his country
                bleed itself for a throne nobody can sit on. The war is a
                noble dispute dressed as a religious one. Sakimoto's score
                plays under it the way a requiem plays under a funeral the
                family is pretending is a wedding. The Church of Glabados,
                custodian of the faith of Saint Ajora and keeper of the
                twelve Zodiac Stones, sits behind the war as referee,
                judge, and beneficiary. The Stones — Auracite, the holy
                relics of the Zodiac Braves legend — are the Church's
                spiritual currency.
              </p>
              <p>The Stones are demons.</p>
              <p>
                Auracite contains Lucavi. When a person attuned to a stone
                uses it under sufficient desire, the Lucavi possesses
                them. The Church knows this. Saint Ajora himself was a
                Lucavi pawn. The legend is the cover for the mechanism.
                The religion that claims to have defeated demons is the
                institution that keeps them on retainer.
              </p>
              <p>
                Ramza does not learn this all at once. He learns it three
                times, in stages, each time discovering that what he had
                not yet doubted was already rotten.
              </p>
              <p>
                The first stone is dropped at home. His brother Dycedarg,
                patriarch of the Beoulve house, has been moving the war
                for private advancement — abducting a princess, murdering
                allies, treating the family name as a lever. The house
                Ramza grew up believing was honorable is a chess piece in
                a private campaign. He leaves.
              </p>
              <DialogueBox label="RAMZA" body={RAMZA_TIETRA} />
              <p>
                The second stone is the Church. The Knights Templar, the
                Church's military arm, are using Auracite as weapons.
                Wiegraf Folles, the rebel-turned-Templar, is given a
                stone and consumed by the Lucavi inside it. The High
                Priest has been orchestrating the war from underneath the
                war. The clergy that taught Ramza to pray are the
                engineers of the bloodshed they pray to end. He fights
                them.
              </p>
              <DialogueBox label="RAMZA" body={RAMZA_WIEGRAF} />
              <p>
                The third stone is the saint. Saint Ajora — the messianic
                figure the entire faith is built around, the man who
                supposedly defeated the Lucavi a millennium ago — was a
                Lucavi himself. The religion was always upside down. The
                thing it pretends to fight is the thing that founded it.
                There is no clean institution underneath the corrupt one.
                The corruption is the institution, all the way down.
              </p>
              <DialogueBox label="RAMZA" body={RAMZA_AJORA} />
              <p>
                This is the move FFT puts in front of you that the
                previous three games did not. FFVI gave you an Empire to
                overthrow. FFVII gave you a corporation to bomb. FFX gave
                you a pilgrimage to refuse. FFT gives you something
                harder: a world in which the institution that licenses
                your moral vocabulary is the same institution running the
                parasitism. The relics you were taught to revere are
                demons. The saint is a demon. The hymns are demonic.
                There is no outside.
              </p>
              <p>
                Borgmann's distinction was device versus focal thing.
                Girard's distinction was clean ritual versus scapegoat
                mechanism. FFT is Borgmann and Girard at once: the relic
                is a device in focal-thing clothes <em>and</em> the
                religion is the scapegoat mechanism in focal-practice
                clothes. The discrimination problem stacks. How do you
                tell a real focal practice from sanctified parasitism
                when the parasitism has had a thousand years to perfect
                the costume?
              </p>
              <DialogueBox label="CID" body={CID_THUNDER_GOD} />
              <p>
                The other answer is Delita. He grew up beside Ramza,
                watched the same war, learned the same lessons — and
                concluded that the mechanism is the only operative
                reality and the only sane path is to use it. He uses the
                war. He uses the princess. He uses the Church. By the end
                of the game he has won everything Ramza would have won by
                refusing the mechanism: the throne, the crown, the
                historical record. The history books call Delita the hero
                who ended the war. They do not record Ramza.
              </p>
              <p>
                The final cinematic of FFT is one of the great endings in
                any video game. Delita rides through the streets in his
                coronation procession. He sits on the throne. Ovelia, his
                queen, stabs him. He stabs her back. They die together,
                alone, on the throne, having achieved the mechanism's
                full reward. The game cuts to a chronicler asking the
                void: <em>Tell me, Ramza… what did you fight for?</em>{' '}
                Ramza does not answer because Ramza is gone — either
                dead, or escaped, or living anonymously in a town nobody
                chronicles.
              </p>
              <p>
                This is the post's hardest claim. The mechanism punishes
                the refusers. Refusal does not produce historical
                victory. It does not produce institutional reward. It
                does not even produce a stable narrative — Ramza is
                officially a heretic, a traitor, or a hero, depending on
                which surviving manuscript you read. Refusal produces
                only what Borgmann said focal practice produces: what you
                became through the refusing.
              </p>
              <p>
                That is what Ramza fought for. There is not another
                answer. Delita won the throne and died on it because he
                had nothing left to be when the mechanism finished using
                him. Ramza disappeared from the record because what he
                had become was the only thing that was actually his, and
                it did not need a record.
              </p>
              <p>The brushwork is what makes the brusher.</p>
              <EsperCameo variant="dimmed-with-chocobo" />
            </div>
          </section>

          <section className="cfe-section cfe-section-quiet">
            <SceneBreak />
            <SectionHeader ordinal="VII" title="Cortázar's Watch" />
            <div className="cfe-body cfe-body-dense">
              <p>
                The Final Fantasy chambers are four behind you. The post is
                going to leave them.
              </p>
              <p>
                Cortázar wrote a small piece called <em>Preamble to the
                Instructions on How to Wind a Watch.</em> When someone gives
                you a watch, they have not given you a watch. They have
                given you a chain of obligation, a small machine of hours,
                an artifact that will require you every day for the rest of
                your life. You will wind it. You will sleep beside it. You
                will hand it down to your son. You did not get a watch. The
                watch got you.
              </p>
              <p>This is Borgmann's horse seen from the other side of the room.</p>
              <p>
                Same maintenance loop. Same human bent over the artifact,
                attending to it, returning to it daily. Same pattern of
                demand-and-tending the focal-thing argument celebrates. But
                Cortázar is reporting from inside the loop, and what he
                reports is different. The horse looks at you with a liquid
                eye and the question of where you want to be has been
                answered. The watch ticks on your wrist and the question
                is being asked, every minute, with the answer no longer
                available because you have spent your minutes maintaining
                the watch.
              </p>
              <p>
                Cortázar sharpens the picture in <em>Hopscotch.</em> The
                protagonist, Horacio Oliveira, sits in a Paris flat where
                the world keeps offering him the same things each morning —
                the partner, the watch, the novel reopening at the same
                fold in the curve of his glasses. The pattern accepts
                itself. The cloud, he writes, "cunningly accepts its name
                as cloud." Hope compresses into a small primate that
                shivers on a tabletop. Cortázar's instruction to Horacio —
                and to the reader who feels Horacio's predicament in his
                own bones — is: break the primate's head. Push outward
                from the center of the room. Open a passage to the street
                the pattern has never let you see.
              </p>
              <p>
                Cortázar is not describing a way to live. He is describing
                a way to die slowly, and warning us against it.
              </p>
              <p>This is the failure mode Borgmann does not address.</p>
              <p>
                Focal practice has its own pathology. When the brushwork
                becomes routine — when the daily winding becomes habit,
                when the daily tending of the horse becomes the indistinct
                fact of mornings — the brusher is still being made by the
                brushwork. But what is being made is the primate. The
                maintenance has not stopped. The relation has gone. What
                remains is the chain of obligation.
              </p>
              <p>
                What saves the maintainer from the primate is what
                Cortázar calls the moth — the small irruption on the
                pencil's edge, the unscheduled encounter, the thing that
                wakes you to the artifact again as if you had not seen
                it. Borgmann's focal practice depends on this without
                saying so. The horse is focal because the horse is alive
                and surprises you. The hearth is focal because the fire
                moves. The watch is harder, because the watch is exactly
                what does not surprise. The watch was Cortázar's example
                for a reason.
              </p>
              <p>
                The Magitek Knight, by the way, is not Horacio. The
                Magitek Knight is not maintaining anything — the armor
                maintains itself, the slave crown maintains the rider, no
                relation exists. Horacio's failure is not the absence of
                focal practice. It is focal practice that has lost its
                moth: the engineer who has polished the same airship for
                forty years and stopped seeing it, the priest who has lit
                the same candle for forty years and forgotten what the
                candle was for, the watch-winder who has wound the watch
                for forty years and become its instrument. Cortázar does
                not absolve any of them. He is shouting at them through
                the glass.
              </p>
              <p>
                Section 8 will return to Cid. Notice, when we get there,
                that the recurring Cid has never been the same Cid twice.
                Each game gives him a new airship to invent, a new
                emergency, a new young pilot to take under his wing. He
                recurs at the level of archetype, never at the level of
                his own routine. The games keep giving him moths.
              </p>
              <p className="cfe-quiet-beat">
                <em>
                  the post is quiet here. the sprite layer has withdrawn.
                  the chocobo has wandered off-screen. the esper is somewhere
                  else.
                </em>
              </p>
            </div>
          </section>

          <section className="cfe-section">
            <SceneBreak />
            <SectionHeader ordinal="VIII" title="Cid" />
            <div className="cfe-body">
              <p>Every Final Fantasy has a Cid.</p>
              <p>
                Cid Del Norte Marquez built the Magitek armor that powered
                the Empire, and recoiled when he found out what they had
                done with his work. Cid Highwind kept rocket parts in his
                backyard, smoked while he built them, named his airship
                and yelled at it like a father yelling at a son he could
                not love any other way. Cidolfus Orlandeau, the Thunder
                God, was the strongest swordsman in Ivalice and joined a
                teenager named Ramza when he saw what the Church was
                doing with the Stones. Cid Pollendina led the Al Bhed, a
                people who refused Yevon's prohibition on machina and
                kept building airships in the desert because someone had
                to remember how.
              </p>
              <p>
                These are the four we walked through. There are more. Cid
                Pollendina the elder hammered the airships of Baron
                together by hand, and lived through more deaths than the
                writers thought he should. Cid Previa abandoned his
                weapons program in 1992 and went looking for his
                grandson. Regent Cid Fabool of Lindblum built airships
                for sport and statecraft and once spent half a game
                cursed into the body of an oglop. Cid Garlond founded
                Garlond Ironworks and has been hauling parts across an
                MMO for over a decade. Cid Sophiar fixes the black car at
                a desert garage in FFXV with his granddaughter Cindy
                learning the trade beside him. In FFXVI the name itself
                is the inheritance — a man called Cid dies, and his
                apprentice takes the name as a vow.
              </p>
              <p>
                The pattern is forty years deep and has failed once.
                Doctor Cid Bunansa, in FFXII, let his maintenance project
                consume him. He stopped tending the artifacts and started
                serving them. He became their instrument. He became
                Horacio with a physicist's vocabulary, and the game made
                him a villain and killed him for it. The exception proves
                the rule. Square knows what Cid becomes if he stops
                getting moths. Most of the time, they remember.
              </p>
              <p>
                He has never been the same Cid twice. He has been
                scientist, pilot, knight, regent, chieftain, mechanic,
                outlaw. He has worked on Magitek, rockets, sword arts,
                airship engines, mist engines, branded magic, the cars of
                a road movie. He has fought empires, corporations,
                churches, theocracies, gods. The thing that has held
                constant is structural: he is the figure who keeps
                relation to the artifact in a world that has organized
                itself around the artifact's apparatus.
              </p>
              <p>
                That structural position has a name now, after seven
                sections of working it out. Cid is the maintainer who
                never becomes Horacio.
              </p>
              <p>
                Look at the medium. Each Final Fantasy resets Cid to a
                new airship he has never built, a new emergency he has
                never seen, a new young protagonist he has never
                mentored. The repetition that would make him Horacio —
                same Cid, same routine, same airship for forty years — is
                structurally impossible. The form requires a new moth
                every game. Square has been giving him moths since the
                8-bit era. He has been kept alive at the archetypal
                level by the medium's refusal to let any single Cid
                finish his story. Every Cid passes the airship to the
                next Cid. The maintenance survives because the
                maintainers do not.
              </p>
              <p>This is what institutional focal practice looks like.</p>
              <p>
                Stewart Brand has been arguing for it in non-fictional
                register for sixty years. Whole Earth Catalog was a Cid
                object — a manual for people who maintain.{' '}
                <em>How Buildings Learn</em> is the Cid argument applied
                to architecture: buildings are not commodities you finish
                and ship; they are airships in slow motion, demanding
                tending across generations, growing pace layers as the
                maintainers cycle through. Long Now is the same argument
                scaled to civilizational time. The 10,000-year clock in
                the Texas mountain is an artifact engineered to require a
                new maintainer every generation, forever, with the
                maintenance-relation passing down a chain that no single
                Horacio can ossify because no single Horacio gets to live
                ten thousand years.
              </p>
              <p>
                Brand is the real-world Cid. Borgmann gave us the theory.
                Cortázar gave us the warning. Brand is the engineer who
                has been building the machine that lets the theory
                survive the warning — the institution that requires its
                maintainers to cycle, that hands the airship to a new
                generation before the old one has time to forget the
                moth.
              </p>
              <p>This is the answer the post has been walking toward.</p>
              <p>Cid steps forward.</p>
              <DialogueBox label="CID" body={CID_BREAK_FOURTH_WALL} maxCols={64} />
              <p className="cfe-quiet-beat">
                <em>the chocobo is still here. the esper is still here.</em>
              </p>
            </div>
          </section>

          <section className="cfe-section">
            <SceneBreak />
            <SectionHeader ordinal="IX" title="The Engineer's Position" />
            <div className="cfe-body">
              <p>
                There is an alternative to the argument the post has just
                spent eight sections building. It is honorable, it is held
                by serious people, and the post has been pushing past it
                without naming it directly. Now is the moment to name it.
              </p>
              <p>
                The alternative is the engineer's position. The most
                articulate version of it is Stuart Russell's{' '}
                <em>Human Compatible</em> — an argument that the alignment
                problem is solvable if we design AI systems with three
                structural commitments: the AI exists to satisfy human
                preferences, it is initially uncertain what those
                preferences are, and it learns about them by attending to
                human behavior. Russell calls this the assistance game.
                It is an attempt to engineer, into the artifact's design,
                something structurally homologous to care. The AI defers.
                The AI listens. The AI is constituted as a being whose
                function is the realization of someone else's good.
              </p>
              <p>
                This is a beautiful argument. It is the most serious
                technical attempt anyone has made at putting the liquid
                eye into the silicon. Russell is not a fool, and he is
                not engaged in metaphysical hand-waving. He is bracketing
                the question of whether the AI is conscious and asking
                what design choices make the artifact behave as if it
                were attending to us.
              </p>
              <p>
                The bracketing is the move the post has been refusing for
                eight sections.
              </p>
              <p>
                Borgmann's argument is not that we cannot design
                artifacts that approximate care. It is that the moral
                substance of the relation is not located in the artifact.
                It is located in the practice. The horse is focal because
                of what brushing the horse does to the brusher — what
                kind of person you become through the years of brushwork.
                The hearth is focal because of what tending the fire does
                to the tender. The watch is focal — when it is focal —
                because of what winding it does to the winder. Russell's
                AI can be perfectly designed and the user can still treat
                it as a device. The artifact's structure does not
                determine the practice's structure. The user is the
                variable.
              </p>
              <p>
                The Magitek Knight had armor that was, in its way, an
                engineering triumph. Square's writers gave us an artifact
                designed to extend its operator's capacities almost
                limitlessly. The problem was never the artifact. The
                problem was the civilization that organized itself around
                making the artifact and around being the people who used
                it. Russell's frame can give us better artifacts. It
                cannot give us the civilization that maintains them with
                relation rather than apparatus.
              </p>
              <p>
                Brand has been arguing this for sixty years in a
                different idiom. Borgmann has been arguing it since 1992.
                Square Enix has been animating it for forty. The post
                has been arguing it for nine sections.
              </p>
              <p>
                Cid is the answer because Cid is the figure who tends.
                His airship is not a more carefully designed machine. It
                is the same machine he has always built. What is
                different about Cid is what <em>he</em> does at the
                workbench every morning, with his hands, with his
                attention, with his mortal time. Russell engineers the
                airship. Cid is what makes the airship matter.
              </p>
              <p>
                The argument is not against Russell. It is around him.
                He is solving an important problem. He is solving it on
                the wrong side of the relation. The interesting question
                — the question this post has been asking — is on the
                other side, where the brushwork lives.
              </p>
            </div>
          </section>

          <section className="cfe-section cfe-section-coda">
            <SceneBreak />
            <SectionHeader ordinal="X" title="Coda" />
            <div className="cfe-body">
              <p>
                The horse stamps in the snow. The handler's hands are
                sore from the brushing. The cold has gotten into the
                seams of his coat. He has fed the horse and watered the
                horse and cleaned the stall. He is going to do it again
                tomorrow. Tomorrow morning is a long way off. The horse
                looks up.
              </p>
              <p>What did Borgmann say happens next.</p>
              <p>
                The question of where you want to be and what you want
                to do has been answered. Not by the gaze. The gaze is a
                small fact at the end of the day. The answer is what
                came before the gaze — the brushing, the feeding, the
                cleaning, the years. The years made a man who was
                capable of standing in a stall in the cold and
                recognizing what was looking at him. The years were the
                answer. The eye was the receipt.
              </p>
              <p>
                This was the post's argument. The Final Fantasy chambers
                were the long working-out. The Cortázar interlude was the
                warning. The Cid section was the answer. The Russell
                section was the foil. The horse passage we opened with —
                the man with the sore hands, the liquid eye — was the
                entire argument compressed into one paragraph that you
                read before the post said anything else.
              </p>
              <p>
                We are going to leave you with two things and then leave.
              </p>

              <p className="cfe-coda-line">
                <em>the chocobo is here.</em>
              </p>
              <CodaChocobo />

              <p className="cfe-coda-line">
                <em>the esper is here.</em>
              </p>
              <CodaEsper />

              <DialogueBox label="CID" body={CID_FINAL} maxCols={48} />
            </div>
          </section>
      </article>
    </div>
  );
}
