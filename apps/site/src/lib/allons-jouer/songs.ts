import type { Song } from './types';

export const SONGS: Song[] = [
  {
    id: 'scale-push',
    title: 'Push Scale',
    description: 'All push notes, low to high. Get the bellows feel.',
    difficulty: 1,
    notes: [
      { button: 2, dir: 'push', duration: 800 },
      { button: 1, dir: 'push', duration: 800 },
      { button: 3, dir: 'push', duration: 800 },
      { button: 4, dir: 'push', duration: 800 },
      { button: 5, dir: 'push', duration: 800 },
      { button: 6, dir: 'push', duration: 800 },
    ],
  },
  {
    id: 'scale-pull',
    title: 'Pull Scale',
    description: 'All pull notes. Reverse bellows direction.',
    difficulty: 1,
    notes: [
      { button: 2, dir: 'pull', duration: 800 },
      { button: 1, dir: 'pull', duration: 800 },
      { button: 3, dir: 'pull', duration: 800 },
      { button: 4, dir: 'pull', duration: 800 },
      { button: 5, dir: 'pull', duration: 800 },
      { button: 6, dir: 'pull', duration: 800 },
    ],
  },
  {
    id: 'push-pull-alt',
    title: 'Push-Pull Exercise',
    description: 'Alternate bellows on buttons 2–3–4. The core mechanic.',
    difficulty: 1,
    notes: [
      { button: 2, dir: 'push', duration: 600 },
      { button: 2, dir: 'pull', duration: 600 },
      { button: 3, dir: 'push', duration: 600 },
      { button: 3, dir: 'pull', duration: 600 },
      { button: 4, dir: 'push', duration: 600 },
      { button: 4, dir: 'pull', duration: 600 },
      { button: 4, dir: 'push', duration: 600 },
    ],
  },
  {
    id: 'jolie-blonde',
    title: 'Jolie Blonde',
    description: 'The Cajun anthem. Simplified melody, middle register.',
    difficulty: 2,
    notes: [
      { button: 4, dir: 'push', duration: 1000 },
      { button: 5, dir: 'push', duration: 500 },
      { button: 5, dir: 'pull', duration: 1000 },
      { button: 4, dir: 'pull', duration: 500 },
      { button: 4, dir: 'push', duration: 1000 },
      { button: 3, dir: 'pull', duration: 500 },
      { button: 3, dir: 'push', duration: 1000 },
      { button: 2, dir: 'pull', duration: 500 },
      { button: 2, dir: 'push', duration: 1500 },
    ],
    phrases: [
      { label: 'main lick', start: 0, end: 5 },
      { label: 'resolve', start: 5, end: 9 },
    ],
    cultural: {
      context: "Jolie Blonde is the unofficial anthem of Cajun Louisiana — the one song every player knows, the one the crowd sings along to at every fais do-do and family gathering. It's a lament about a pretty blonde who left for another man. Playing it even roughly will get a room of Cajuns to smile.",
      recordingLabel: 'Leo Soileau & Mayeus LaFleur, 1929',
      recordingUrl: 'https://www.loc.gov/item/jukebox-193316/',
      tab: '▶4 ▶5 ◀5 ◀4 ▶4 ◀3 ▶3 ◀2 ▶2',
    },
  },
  {
    id: 'two-step',
    title: 'Two-Step Pattern',
    description: 'Basic Cajun two-step rhythm. Bounce between 3–4–5.',
    difficulty: 2,
    notes: [
      { button: 3, dir: 'push', duration: 400 },
      { button: 4, dir: 'push', duration: 400 },
      { button: 5, dir: 'push', duration: 800 },
      { button: 4, dir: 'push', duration: 400 },
      { button: 3, dir: 'push', duration: 400 },
      { button: 3, dir: 'pull', duration: 800 },
      { button: 3, dir: 'push', duration: 400 },
      { button: 4, dir: 'pull', duration: 400 },
      { button: 4, dir: 'push', duration: 800 },
      { button: 3, dir: 'push', duration: 400 },
      { button: 2, dir: 'push', duration: 1200 },
    ],
    phrases: [
      { label: 'climb', start: 0, end: 5 },
      { label: 'turnaround', start: 5, end: 11 },
    ],
    cultural: {
      context: "The Cajun two-step is what fills the dance floor on a Saturday night at a bal de maison. It's fast, bouncy, and built around that characteristic push-pull alternation. The short-short-long rhythm — un-deux-trois — is the heartbeat of the music.",
      recordingLabel: 'Nathan Abshire, "Pine Grove Blues", 1949',
      recordingUrl: 'https://www.youtube.com/watch?v=5J_pFQSB8Xk',
      tab: '▶3 ▶4 ▶5 ▶4 ▶3 ◀3 ▶3 ◀4 ▶4 ▶3 ▶2',
    },
  },
  {
    id: 'cajun-waltz',
    title: 'Cajun Waltz',
    description: '3/4 time. The other half of the repertoire.',
    difficulty: 3,
    notes: [
      { button: 4, dir: 'push', duration: 900 },
      { button: 5, dir: 'push', duration: 450 },
      { button: 5, dir: 'pull', duration: 450 },
      { button: 4, dir: 'push', duration: 900 },
      { button: 3, dir: 'pull', duration: 450 },
      { button: 3, dir: 'push', duration: 450 },
      { button: 2, dir: 'push', duration: 900 },
      { button: 2, dir: 'pull', duration: 450 },
      { button: 3, dir: 'push', duration: 450 },
      { button: 4, dir: 'push', duration: 1800 },
    ],
    phrases: [
      { label: 'first line', start: 0, end: 4 },
      { label: 'second line', start: 4, end: 7 },
      { label: 'resolve', start: 7, end: 10 },
    ],
    cultural: {
      context: "The Cajun waltz is the slower, sweeter half of the traditional repertoire. Where the two-step gets the floor moving, the waltz brings couples close. It's 3/4 time — one-two-three — and the phrasing is more legato, more breath. Amédé Ardoin and Dennis McGee defined what it could sound like.",
      recordingLabel: 'Amédé Ardoin & Dennis McGee, 1929',
      recordingUrl: 'https://www.youtube.com/watch?v=mWFcaABcFvI',
      tab: '▶4 ▶5 ◀5 ▶4 ◀3 ▶3 ▶2 ◀2 ▶3 ▶4',
    },
  },
  {
    id: 'jai-ete-au-bal',
    title: "J'ai Été au Bal",
    description: "I went to the dance. The Cajun two-step everyone knows.",
    difficulty: 2,
    notes: [
      // Phrase 1: rising pickup into the melody
      { button: 3, dir: 'push', duration: 400 },  // G4
      { button: 3, dir: 'pull', duration: 400 },  // A4
      { button: 4, dir: 'push', duration: 800 },  // C5
      { button: 5, dir: 'pull', duration: 400 },  // D5
      { button: 5, dir: 'push', duration: 400 },  // E5
      { button: 5, dir: 'pull', duration: 800 },  // D5
      { button: 4, dir: 'push', duration: 400 },  // C5
      { button: 4, dir: 'pull', duration: 400 },  // B4
      { button: 3, dir: 'pull', duration: 800 },  // A4
      { button: 3, dir: 'push', duration: 1200 }, // G4 (hold)
      // Phrase 2: descending answer
      { button: 4, dir: 'push', duration: 400 },  // C5
      { button: 4, dir: 'pull', duration: 400 },  // B4
      { button: 3, dir: 'pull', duration: 800 },  // A4
      { button: 3, dir: 'push', duration: 400 },  // G4
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 2, dir: 'pull', duration: 800 },  // D4
      { button: 2, dir: 'push', duration: 1600 }, // C4 (resolve)
    ],
    phrases: [
      { label: 'rising pickup', start: 0, end: 10 },
      { label: 'descending answer', start: 10, end: 17 },
    ],
    cultural: {
      context: "J'ai Été au Bal is the song that put Cajun music on the map outside Louisiana. Iry LeJeune's 1948 recording brought the raw, high-lonesome accordion sound back after years of string-band dominance. The title means \"I went to the dance last night\" — and the song is about heartbreak on the dance floor, which is about as Cajun as it gets.",
      recordingLabel: 'Iry LeJeune, 1948',
      recordingUrl: 'https://www.youtube.com/watch?v=WL4FDvhuR6g',
      tab: '▶3 ◀3 ▶4 ◀5 ▶5 ◀5 ▶4 ◀4 ◀3 ▶3 · ▶4 ◀4 ◀3 ▶3 ▶1 ◀2 ▶2',
    },
  },
  {
    id: 'danse-mardi-gras',
    title: 'La Danse de Mardi Gras',
    description: 'The Mardi Gras song. A march for the courir.',
    difficulty: 2,
    notes: [
      // "Les Mardi Gras se rassemblent..."
      { button: 4, dir: 'push', duration: 600 },  // C5
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 5, dir: 'pull', duration: 300 },  // D5
      { button: 5, dir: 'push', duration: 600 },  // E5
      { button: 5, dir: 'push', duration: 300 },  // E5
      { button: 5, dir: 'pull', duration: 300 },  // D5
      { button: 4, dir: 'push', duration: 600 },  // C5
      // "...une fois par an"
      { button: 5, dir: 'pull', duration: 300 },  // D5
      { button: 5, dir: 'push', duration: 300 },  // E5
      { button: 4, dir: 'push', duration: 900 },  // C5 (hold)
      // "pour demander la charité..."
      { button: 3, dir: 'pull', duration: 600 },  // A4
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 5, dir: 'pull', duration: 300 },  // D5
      { button: 4, dir: 'push', duration: 600 },  // C5
      { button: 3, dir: 'pull', duration: 300 },  // A4
      { button: 3, dir: 'push', duration: 300 },  // G4
      { button: 3, dir: 'pull', duration: 600 },  // A4
      { button: 3, dir: 'push', duration: 1200 }, // G4 (resolve)
    ],
    phrases: [
      { label: '"se rassemblent"', start: 0, end: 7 },
      { label: '"une fois par an"', start: 7, end: 10 },
      { label: '"la charité"', start: 10, end: 18 },
    ],
    cultural: {
      context: "This is the song of the Courir de Mardi Gras — the Cajun Mardi Gras run. Masked riders on horseback go farm to farm begging for ingredients to make a communal gumbo. At each stop they sing this song, chasing chickens and making a joyful mess. It's not New Orleans Mardi Gras — it's older, rural, and deeply communal. The melody is a march because that's what it is: a procession through the prairie.",
      recordingLabel: 'Balfa Brothers, 1965',
      recordingUrl: 'https://www.youtube.com/watch?v=T7gkTMKUqOk',
      tab: '▶4 ▶4 ◀5 ▶5 ▶5 ◀5 ▶4 · ◀5 ▶5 ▶4 · ◀3 ▶4 ◀5 ▶4 ◀3 ▶3 ◀3 ▶3',
    },
  },
  {
    id: 'allons-a-lafayette',
    title: 'Allons à Lafayette',
    description: "The first Cajun song ever recorded. Where it all started.",
    difficulty: 2,
    notes: [
      // "Allons à Lafayette..."
      { button: 3, dir: 'push', duration: 600 },  // G4
      { button: 3, dir: 'push', duration: 300 },  // G4
      { button: 3, dir: 'pull', duration: 300 },  // A4
      { button: 4, dir: 'push', duration: 800 },  // C5
      { button: 4, dir: 'push', duration: 400 },  // C5
      { button: 4, dir: 'pull', duration: 400 },  // B4
      { button: 3, dir: 'pull', duration: 800 },  // A4
      // "...c'est pour changer ton nom"
      { button: 3, dir: 'push', duration: 400 },  // G4
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 2, dir: 'pull', duration: 400 },  // D4
      { button: 2, dir: 'push', duration: 1200 }, // C4 (hold)
      // Phrase 2: answer
      { button: 2, dir: 'pull', duration: 400 },  // D4
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 3, dir: 'push', duration: 800 },  // G4
      { button: 3, dir: 'pull', duration: 400 },  // A4
      { button: 3, dir: 'push', duration: 400 },  // G4
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 2, dir: 'push', duration: 1400 }, // C4 (resolve)
    ],
    phrases: [
      { label: '"Allons à Lafayette"', start: 0, end: 7 },
      { label: '"changer ton nom"', start: 7, end: 11 },
      { label: 'answer', start: 11, end: 18 },
    ],
    cultural: {
      context: "This is where recorded Cajun music begins. Joe Falcon and Cleoma Breaux walked into a makeshift studio in 1928 and cut this song — an accordion and a guitar, raw and real. The lyrics are about going to Lafayette to get married. It sold so well it proved that Cajun music had a commercial audience, opening the door for everything that followed.",
      recordingLabel: 'Joe Falcon & Cleoma Breaux, 1928',
      recordingUrl: 'https://www.youtube.com/watch?v=LpVpFmN0AS0',
      tab: '▶3 ▶3 ◀3 ▶4 ▶4 ◀4 ◀3 · ▶3 ▶1 ◀2 ▶2 · ◀2 ▶1 ▶3 ◀3 ▶3 ▶1 ▶2',
    },
  },
  {
    id: 'colinda',
    title: 'Colinda',
    description: 'Half Cajun, half Creole. A haunting melody from both traditions.',
    difficulty: 2,
    notes: [
      // Phrase 1: the haunting opening
      { button: 2, dir: 'push', duration: 800 },  // C4
      { button: 2, dir: 'pull', duration: 600 },  // D4
      { button: 1, dir: 'push', duration: 600 },  // E4
      { button: 3, dir: 'push', duration: 1000 }, // G4
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 2, dir: 'pull', duration: 400 },  // D4
      { button: 2, dir: 'push', duration: 1200 }, // C4 (hold)
      // Phrase 2: rising answer
      { button: 2, dir: 'pull', duration: 400 },  // D4
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 3, dir: 'push', duration: 600 },  // G4
      { button: 3, dir: 'pull', duration: 600 },  // A4
      { button: 3, dir: 'push', duration: 800 },  // G4
      // Phrase 3: resolve
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 2, dir: 'pull', duration: 400 },  // D4
      { button: 2, dir: 'push', duration: 1600 }, // C4 (long resolve)
    ],
    phrases: [
      { label: 'haunting opening', start: 0, end: 7 },
      { label: 'rising answer', start: 7, end: 12 },
      { label: 'resolve', start: 12, end: 15 },
    ],
    cultural: {
      context: "Colinda lives in the borderland between Cajun and Creole music — both traditions claim it, and both are right. The song may trace back to an Afro-Caribbean calinda dance. In Louisiana it became a love song with a melody that sticks in your head for days. It's slower than most two-steps, almost hypnotic, and the lower register gives it a gravity that the upbeat tunes don't have.",
      recordingLabel: 'Dewey Balfa, 1960s',
      recordingUrl: 'https://www.youtube.com/watch?v=0YN4hHpTbWA',
      tab: '▶2 ◀2 ▶1 ▶3 ▶1 ◀2 ▶2 · ◀2 ▶1 ▶3 ◀3 ▶3 · ▶1 ◀2 ▶2',
    },
  },
  {
    id: 'lacassine-special',
    title: 'Lacassine Special',
    description: 'A driving instrumental. Faster bellows, wider jumps.',
    difficulty: 3,
    notes: [
      // Phrase 1: the driving opening
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 5, dir: 'push', duration: 300 },  // E5
      { button: 5, dir: 'pull', duration: 300 },  // D5
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 3, dir: 'pull', duration: 300 },  // A4
      { button: 3, dir: 'push', duration: 600 },  // G4
      // Phrase 2: climb back up
      { button: 3, dir: 'pull', duration: 300 },  // A4
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 5, dir: 'pull', duration: 300 },  // D5
      { button: 5, dir: 'push', duration: 600 },  // E5
      { button: 5, dir: 'pull', duration: 300 },  // D5
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 4, dir: 'pull', duration: 300 },  // B4
      { button: 3, dir: 'pull', duration: 600 },  // A4
      // Phrase 3: fast turnaround
      { button: 3, dir: 'push', duration: 300 },  // G4
      { button: 3, dir: 'pull', duration: 300 },  // A4
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 4, dir: 'pull', duration: 300 },  // B4
      { button: 3, dir: 'pull', duration: 300 },  // A4
      { button: 3, dir: 'push', duration: 300 },  // G4
      // Phrase 4: resolve with punch
      { button: 1, dir: 'push', duration: 300 },  // E4
      { button: 3, dir: 'push', duration: 300 },  // G4
      { button: 4, dir: 'push', duration: 300 },  // C5
      { button: 3, dir: 'push', duration: 300 },  // G4
      { button: 2, dir: 'push', duration: 900 },  // C4 (resolve)
    ],
    phrases: [
      { label: 'driving opening', start: 0, end: 6 },
      { label: 'climb back up', start: 6, end: 14 },
      { label: 'fast turnaround', start: 14, end: 20 },
      { label: 'resolve with punch', start: 20, end: 25 },
    ],
    cultural: {
      context: "Lacassine Special is a pure instrumental — no words, just fingers and bellows. It's named after Lacassine, a tiny town in Jeff Davis Parish. This is the tune that accordion players use to show what they can do. The tempo is brisk, the bellows changes come fast, and the melody covers more of the keyboard than most Cajun songs. If you can play this clean, you can sit in at a jam.",
      recordingLabel: 'Iry LeJeune, 1950s',
      recordingUrl: 'https://www.youtube.com/watch?v=N7cmOe1Gm5s',
      tab: '▶4 ▶5 ◀5 ▶4 ◀3 ▶3 · ◀3 ▶4 ◀5 ▶5 ◀5 ▶4 ◀4 ◀3 · ▶3 ◀3 ▶4 ◀4 ◀3 ▶3 · ▶1 ▶3 ▶4 ▶3 ▶2',
    },
  },
  {
    id: 'grand-mamou',
    title: 'Grand Mamou',
    description: 'Named after the capital of Cajun music. A Saturday night staple.',
    difficulty: 2,
    notes: [
      // Phrase 1: bouncy opening
      { button: 3, dir: 'push', duration: 400 },  // G4
      { button: 4, dir: 'push', duration: 400 },  // C5
      { button: 4, dir: 'push', duration: 400 },  // C5
      { button: 4, dir: 'pull', duration: 400 },  // B4
      { button: 3, dir: 'pull', duration: 800 },  // A4
      { button: 3, dir: 'push', duration: 400 },  // G4
      { button: 3, dir: 'pull', duration: 400 },  // A4
      { button: 4, dir: 'push', duration: 800 },  // C5
      // Phrase 2: the turnaround
      { button: 5, dir: 'pull', duration: 400 },  // D5
      { button: 4, dir: 'push', duration: 400 },  // C5
      { button: 4, dir: 'pull', duration: 400 },  // B4
      { button: 3, dir: 'pull', duration: 400 },  // A4
      { button: 3, dir: 'push', duration: 400 },  // G4
      { button: 1, dir: 'push', duration: 400 },  // E4
      { button: 2, dir: 'push', duration: 1200 }, // C4 (resolve)
    ],
    phrases: [
      { label: 'bouncy opening', start: 0, end: 8 },
      { label: 'turnaround', start: 8, end: 15 },
    ],
    cultural: {
      context: "Mamou is a small town in Evangeline Parish that punches way above its weight in Cajun music. Fred's Lounge in Mamou has hosted a live radio broadcast every Saturday morning since the 1960s — accordion, fiddle, and cold beer before noon. This two-step captures that Saturday energy. The Hackberry Ramblers made it a standard, but every band in southwest Louisiana has their own version.",
      recordingLabel: 'Hackberry Ramblers, 1930s',
      recordingUrl: 'https://www.youtube.com/watch?v=r1GJnFzlQJ8',
      tab: '▶3 ▶4 ▶4 ◀4 ◀3 ▶3 ◀3 ▶4 · ◀5 ▶4 ◀4 ◀3 ▶3 ▶1 ▶2',
    },
  },
];
