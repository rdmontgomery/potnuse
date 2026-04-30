import { describe, expect, test } from 'vitest';
import {
  RequestSchema,
  ResponseSchema,
  EventSchema,
  ProtocolMessageSchema,
} from './envelopes';

describe('RequestSchema', () => {
  test('parses a minimal request', () => {
    expect(RequestSchema.parse({ type: 'req', id: '1', method: 'fs.read' })).toEqual({
      type: 'req',
      id: '1',
      method: 'fs.read',
    });
  });

  test('parses a request with params', () => {
    const r = RequestSchema.parse({
      type: 'req',
      id: '1',
      method: 'fs.read',
      params: { path: '/x' },
    });
    expect(r.params).toEqual({ path: '/x' });
  });

  test('rejects empty id', () => {
    expect(() =>
      RequestSchema.parse({ type: 'req', id: '', method: 'fs.read' })
    ).toThrow();
  });

  test('rejects malformed method (single segment)', () => {
    expect(() =>
      RequestSchema.parse({ type: 'req', id: '1', method: 'fs' })
    ).toThrow();
  });

  test('rejects type=res', () => {
    expect(() =>
      RequestSchema.parse({ type: 'res', id: '1', method: 'fs.read' })
    ).toThrow();
  });
});

describe('ResponseSchema', () => {
  test('parses an ok response with result', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
      result: { data: 42 },
    });
    expect(r).toMatchObject({ type: 'res', outcome: 'ok', result: { data: 42 } });
  });

  test('parses an err response with error', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'err',
      error: { code: 'capability/denied', message: 'no' },
    });
    expect(r).toMatchObject({
      type: 'res',
      outcome: 'err',
      error: { code: 'capability/denied', message: 'no' },
    });
  });

  test('strips an error field on an ok response (Zod default strip)', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
      result: 1,
      error: { code: 'x', message: 'y' },
    });
    expect(r).toEqual({ type: 'res', id: '1', outcome: 'ok', result: 1 });
  });

  test('rejects err response with no error field', () => {
    expect(() =>
      ResponseSchema.parse({ type: 'res', id: '1', outcome: 'err' })
    ).toThrow();
  });

  test('rejects unknown outcome', () => {
    expect(() =>
      ResponseSchema.parse({ type: 'res', id: '1', outcome: 'maybe' })
    ).toThrow();
  });

  test('narrows result vs error via outcome discriminator', () => {
    const r = ResponseSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
      result: 42,
    });
    if (r.outcome === 'ok') {
      // TS: r.result is in scope, r.error is not
      expect(r.result).toBe(42);
    } else {
      throw new Error('should have narrowed to ok');
    }
  });
});

describe('EventSchema', () => {
  test('parses a minimal event', () => {
    expect(EventSchema.parse({ type: 'event', name: 'widget.resized' })).toEqual({
      type: 'event',
      name: 'widget.resized',
    });
  });

  test('parses an event with payload', () => {
    const e = EventSchema.parse({
      type: 'event',
      name: 'widget.resized',
      payload: { w: 100, h: 100 },
    });
    expect(e.payload).toEqual({ w: 100, h: 100 });
  });

  test('rejects malformed name (single segment)', () => {
    expect(() => EventSchema.parse({ type: 'event', name: 'resized' })).toThrow();
  });

  test('rejects type=req', () => {
    expect(() => EventSchema.parse({ type: 'req', name: 'a.b' })).toThrow();
  });
});

describe('ProtocolMessageSchema', () => {
  test('narrows to req on type=req', () => {
    const m = ProtocolMessageSchema.parse({
      type: 'req',
      id: '1',
      method: 'fs.read',
    });
    if (m.type === 'req') {
      expect(m.method).toBe('fs.read');
    } else {
      throw new Error('expected req');
    }
  });

  test('narrows to res on type=res', () => {
    const m = ProtocolMessageSchema.parse({
      type: 'res',
      id: '1',
      outcome: 'ok',
    });
    expect(m.type).toBe('res');
  });

  test('narrows to event on type=event', () => {
    const m = ProtocolMessageSchema.parse({ type: 'event', name: 'a.b' });
    expect(m.type).toBe('event');
  });

  test('rejects unknown type', () => {
    expect(() => ProtocolMessageSchema.parse({ type: 'unknown' })).toThrow();
  });
});
