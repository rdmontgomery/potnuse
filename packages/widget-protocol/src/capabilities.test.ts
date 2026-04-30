import { describe, expect, test } from 'vitest';
import {
  CapabilitySchema,
  CAPABILITY_PATTERN,
  type KnownCapability,
  type Capability,
} from './capabilities';

describe('CapabilitySchema', () => {
  test('parses simple domain.verb', () => {
    expect(CapabilitySchema.parse('fs.read')).toBe('fs.read');
  });

  test('parses dotted-suffix forms (sub-namespacing)', () => {
    expect(CapabilitySchema.parse('fs.read.scoped')).toBe('fs.read.scoped');
  });

  test('rejects single-segment names', () => {
    expect(() => CapabilitySchema.parse('fs')).toThrow();
  });

  test('rejects uppercase', () => {
    expect(() => CapabilitySchema.parse('FS.read')).toThrow();
  });

  test('rejects names starting with a digit', () => {
    expect(() => CapabilitySchema.parse('1fs.read')).toThrow();
  });

  test('rejects empty string', () => {
    expect(() => CapabilitySchema.parse('')).toThrow();
  });

  test('rejects names with hyphens (capabilities use dots only)', () => {
    expect(() => CapabilitySchema.parse('fs-read')).toThrow();
  });
});

describe('CAPABILITY_PATTERN', () => {
  test('exposes the regex as a constant', () => {
    expect(CAPABILITY_PATTERN.test('fs.read')).toBe(true);
    expect(CAPABILITY_PATTERN.test('FS.read')).toBe(false);
  });
});

describe('Capability type (compile-time)', () => {
  test('KnownCapability values are assignable to Capability', () => {
    const known: KnownCapability = 'fs.read';
    const c: Capability = known;
    expect(c).toBe('fs.read');
  });

  test('arbitrary strings are assignable to Capability', () => {
    const c: Capability = 'rdm.experimental.draw';
    expect(c).toBe('rdm.experimental.draw');
  });
});
