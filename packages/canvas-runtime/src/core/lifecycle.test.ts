// packages/canvas-runtime/src/core/lifecycle.test.ts
import { describe, expect, test } from 'vitest';
import { canTransition, assertTransition } from './lifecycle';

describe('canTransition', () => {
  test('loading -> ready is allowed', () => {
    expect(canTransition('loading', 'ready')).toBe(true);
  });

  test('loading -> active is NOT allowed (must go via ready)', () => {
    expect(canTransition('loading', 'active')).toBe(false);
  });

  test('ready -> active is allowed', () => {
    expect(canTransition('ready', 'active')).toBe(true);
  });

  test('active -> suspended is allowed', () => {
    expect(canTransition('active', 'suspended')).toBe(true);
  });

  test('suspended -> active is allowed', () => {
    expect(canTransition('suspended', 'active')).toBe(true);
  });

  test('any state -> unloaded is allowed', () => {
    expect(canTransition('loading', 'unloaded')).toBe(true);
    expect(canTransition('ready', 'unloaded')).toBe(true);
    expect(canTransition('active', 'unloaded')).toBe(true);
    expect(canTransition('suspended', 'unloaded')).toBe(true);
  });

  test('unloaded is terminal', () => {
    expect(canTransition('unloaded', 'ready')).toBe(false);
    expect(canTransition('unloaded', 'active')).toBe(false);
  });
});

describe('assertTransition', () => {
  test('returns silently for valid transition', () => {
    expect(() => assertTransition('loading', 'ready')).not.toThrow();
  });

  test('throws on invalid transition with descriptive message', () => {
    expect(() => assertTransition('unloaded', 'active')).toThrow(
      /illegal lifecycle transition: unloaded -> active/
    );
  });
});
