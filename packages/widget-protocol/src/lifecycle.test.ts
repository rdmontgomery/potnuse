import { describe, expect, test } from 'vitest';
import {
  WidgetLifecycleStateSchema,
  VALID_TRANSITIONS,
  type WidgetLifecycleState,
} from './lifecycle';

const ALL_STATES: WidgetLifecycleState[] = [
  'loading',
  'ready',
  'active',
  'suspended',
  'unloaded',
];

describe('WidgetLifecycleStateSchema', () => {
  test.each(ALL_STATES)('parses %s', (s) => {
    expect(WidgetLifecycleStateSchema.parse(s)).toBe(s);
  });

  test('rejects unknown state', () => {
    expect(() => WidgetLifecycleStateSchema.parse('error')).toThrow();
  });

  test('rejects empty string', () => {
    expect(() => WidgetLifecycleStateSchema.parse('')).toThrow();
  });
});

describe('VALID_TRANSITIONS', () => {
  test('every state has an entry', () => {
    for (const state of ALL_STATES) {
      expect(VALID_TRANSITIONS).toHaveProperty(state);
    }
  });

  test('unloaded is terminal (no outbound transitions)', () => {
    expect(VALID_TRANSITIONS.unloaded).toEqual([]);
  });

  test('every transition target is itself a valid state', () => {
    const validStates = new Set<WidgetLifecycleState>(ALL_STATES);
    for (const targets of Object.values(VALID_TRANSITIONS)) {
      for (const t of targets) {
        expect(validStates).toContain(t);
      }
    }
  });

  test('active and suspended toggle to each other', () => {
    expect(VALID_TRANSITIONS.active).toContain('suspended');
    expect(VALID_TRANSITIONS.suspended).toContain('active');
  });
});
