import type { AccordionButton } from './types';

export const ACCORDION_NOTES: AccordionButton[] = [
  { button: 1,  push: { note: 'E4', freq: 329.63 },  pull: { note: 'F4',  freq: 349.23  } },
  { button: 2,  push: { note: 'C4', freq: 261.63 },  pull: { note: 'D4',  freq: 293.66  } },
  { button: 3,  push: { note: 'G4', freq: 392.00 },  pull: { note: 'A4',  freq: 440.00  } },
  { button: 4,  push: { note: 'C5', freq: 523.25 },  pull: { note: 'B4',  freq: 493.88  } },
  { button: 5,  push: { note: 'E5', freq: 659.26 },  pull: { note: 'D5',  freq: 587.33  } },
  { button: 6,  push: { note: 'G5', freq: 783.99 },  pull: { note: 'F5',  freq: 698.46  } },
  { button: 7,  push: { note: 'C6', freq: 1046.50 }, pull: { note: 'A5',  freq: 880.00  } },
  { button: 8,  push: { note: 'E6', freq: 1318.51 }, pull: { note: 'B5',  freq: 987.77  } },
  { button: 9,  push: { note: 'G6', freq: 1567.98 }, pull: { note: 'D6',  freq: 1174.66 } },
  { button: 10, push: { note: 'C7', freq: 2093.00 }, pull: { note: 'F6',  freq: 1396.91 } },
];

export function getButtonInfo(button: number): AccordionButton | undefined {
  return ACCORDION_NOTES.find(b => b.button === button);
}
