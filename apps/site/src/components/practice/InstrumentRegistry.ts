import type { ComponentType } from 'react';
import {
  ClickOnClockInstrument,
  FreeformPcInstrument,
  MultipleChoiceInstrument,
  type InstrumentProps,
} from './instruments';
import type { Card } from '@/lib/srs/schema';

// Concept-tag → instrument mapping. /practice looks up the right instrument
// for each due card by its prompt kind; /curriculum's inline prompts use the
// same registry so the same Module 0 card mounts the same UI on both
// surfaces. New prompt kinds get added here without touching the runner.

export type PromptKind = Card['prompt']['kind'];

export const INSTRUMENTS: Record<PromptKind, ComponentType<InstrumentProps>> = {
  'click-on-clock': ClickOnClockInstrument,
  'freeform-pc-in-key': FreeformPcInstrument,
  'multiple-choice': MultipleChoiceInstrument,
};

export function instrumentFor(
  card: Card,
): ComponentType<InstrumentProps> | null {
  return INSTRUMENTS[card.prompt.kind] ?? null;
}
