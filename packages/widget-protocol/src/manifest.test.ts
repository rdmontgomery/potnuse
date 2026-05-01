import { describe, expect, test } from 'vitest';
import { WidgetManifestSchema, type WidgetManifest } from './manifest';

const VALID_IFRAME_MANIFEST = {
  id: 'rdm.widget.markdown-editor',
  version: '0.3.0',
  kind: 'iframe' as const,
  entry: 'https://widgets.example.com/markdown/index.html',
};

describe('WidgetManifestSchema', () => {
  test('parses a minimal valid iframe manifest', () => {
    const m = WidgetManifestSchema.parse(VALID_IFRAME_MANIFEST);
    expect(m).toMatchObject({
      id: 'rdm.widget.markdown-editor',
      kind: 'iframe',
      capabilities: [],
      protocolVersion: 1,
    });
  });

  test('parses a native manifest with module specifier entry', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        kind: 'native',
        entry: '@rdm/widgets-browser/markdown',
      })
    ).not.toThrow();
  });

  test('rejects iframe entry that is not http(s)', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        entry: '/local/path',
      })
    ).toThrow(/iframe entry must be an http\(s\) URL/);
  });

  test('rejects single-segment id', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, id: 'foo' })
    ).toThrow();
  });

  test('rejects uppercase id', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, id: 'Rdm.widget.x' })
    ).toThrow();
  });

  test('rejects non-semver version', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, version: '1' })
    ).toThrow();
  });

  test('accepts pre-release semver version', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        version: '1.2.3-beta.4',
      })
    ).not.toThrow();
  });

  test('defaults capabilities to []', () => {
    const m = WidgetManifestSchema.parse(VALID_IFRAME_MANIFEST);
    expect(m.capabilities).toEqual([]);
  });

  test('defaults protocolVersion to 1', () => {
    const m = WidgetManifestSchema.parse(VALID_IFRAME_MANIFEST);
    expect(m.protocolVersion).toBe(1);
  });

  test('rejects protocolVersion 2', () => {
    expect(() =>
      WidgetManifestSchema.parse({ ...VALID_IFRAME_MANIFEST, protocolVersion: 2 })
    ).toThrow();
  });

  test('parses optional defaultSize', () => {
    const m = WidgetManifestSchema.parse({
      ...VALID_IFRAME_MANIFEST,
      defaultSize: { w: 480, h: 360 },
    });
    expect(m.defaultSize).toEqual({ w: 480, h: 360 });
  });

  test('rejects negative defaultSize.w', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        defaultSize: { w: -1, h: 360 },
      })
    ).toThrow();
  });

  test('rejects non-integer defaultSize', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        defaultSize: { w: 100.5, h: 200 },
      })
    ).toThrow();
  });

  test('parses with capabilities array', () => {
    const m = WidgetManifestSchema.parse({
      ...VALID_IFRAME_MANIFEST,
      capabilities: ['fs.read', 'fs.write'],
    });
    expect(m.capabilities).toEqual(['fs.read', 'fs.write']);
  });

  test('rejects malformed capability in array', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        capabilities: ['FS.read'],
      })
    ).toThrow();
  });

  test('parses optional name and description', () => {
    const m = WidgetManifestSchema.parse({
      ...VALID_IFRAME_MANIFEST,
      name: 'Markdown Editor',
      description: 'A widget for editing markdown.',
    });
    expect(m.name).toBe('Markdown Editor');
    expect(m.description).toBe('A widget for editing markdown.');
  });

  test('parses optional sandbox flags', () => {
    const m = WidgetManifestSchema.parse({
      ...VALID_IFRAME_MANIFEST,
      sandbox: ['allow-same-origin', 'allow-popups'],
    });
    expect(m.sandbox).toEqual(['allow-same-origin', 'allow-popups']);
  });

  test('rejects malformed sandbox flag', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        sandbox: ['NotAFlag'],
      })
    ).toThrow();
  });

  test('rejects sandbox flag not starting with allow-', () => {
    expect(() =>
      WidgetManifestSchema.parse({
        ...VALID_IFRAME_MANIFEST,
        sandbox: ['deny-scripts'],
      })
    ).toThrow();
  });
});

describe('WidgetManifest type (compile-time)', () => {
  test('inferred type accepts a literal manifest', () => {
    const m: WidgetManifest = {
      id: 'rdm.widget.x',
      version: '0.0.1',
      kind: 'iframe',
      entry: 'https://x.example/x.html',
      capabilities: [],
      protocolVersion: 1,
    };
    expect(m.id).toBe('rdm.widget.x');
  });
});
