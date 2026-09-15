import { describe, expect, it } from 'vitest';
import {
  frontmatterEndLine,
  nodeFromSource,
  parseFrontmatter,
  parseStaticNodes,
  snapshot,
  type RawNode,
} from './graph.ts';

const doc = (body: string) => `---\n${body}\n---\n\nprose here.\n`;

describe('frontmatterEndLine', () => {
  it('finds the closing fence', () => {
    expect(frontmatterEndLine(doc('title: x'))).toBe(3);
  });

  it('returns 0 when there is no frontmatter', () => {
    expect(frontmatterEndLine('just prose\n')).toBe(0);
  });

  it('returns 0 when the fence never closes', () => {
    expect(frontmatterEndLine('---\ntitle: x\n')).toBe(0);
  });
});

describe('parseFrontmatter', () => {
  it('reads scalars and strips quotes', () => {
    const fm = parseFrontmatter(doc("title: 'a title'\ndate: 2026-04-17"));
    expect(fm.title).toBe('a title');
    expect(fm.date).toBe('2026-04-17');
  });

  it('reads inline arrays', () => {
    const fm = parseFrontmatter(doc('connects: [alpha, beta]'));
    expect(fm.connects).toEqual(['alpha', 'beta']);
  });

  it('reads block arrays', () => {
    const fm = parseFrontmatter(doc('connects:\n  - alpha\n  - beta\ntags: [x]'));
    expect(fm.connects).toEqual(['alpha', 'beta']);
    expect(fm.tags).toEqual(['x']);
  });

  it('treats an empty inline array as empty', () => {
    expect(parseFrontmatter(doc('connects: []')).connects).toEqual([]);
  });

  it('ignores prose below the fence', () => {
    const fm = parseFrontmatter(doc('title: x'));
    expect(Object.keys(fm)).toEqual(['title']);
  });
});

describe('nodeFromSource', () => {
  it('derives the slug from the filename', () => {
    const node = nodeFromSource(
      'essays',
      'apps/site/src/content/essays/colophon.mdx',
      doc('title: colophon'),
    );
    expect(node.slug).toBe('colophon');
    expect(node.collection).toBe('essays');
  });

  it('defaults an absent or unknown state to seedling', () => {
    const path = 'apps/site/src/content/essays/a.mdx';
    expect(nodeFromSource('essays', path, doc('title: a')).state).toBe('seedling');
    expect(nodeFromSource('essays', path, doc('state: compost')).state).toBe(
      'seedling',
    );
  });
});

describe('parseStaticNodes', () => {
  const source = `
const STATIC_NODES: Omit<Node, 'backlinks'>[] = [
  {
    id: 'page/allons-jouer',
    collection: 'page',
    slug: 'allons-jouer',
    title: 'Allons jouer',
    state: 'stable',
    date: '2026-04-29T00:00:00.000Z',
    connects: ['ladder'],
    tags: ['instrument'],
    url: '/allons-jouer',
  },
  {
    id: 'page/calibrate',
    collection: 'page',
    slug: 'calibrate',
    title: 'calibrate',
    state: 'germinating',
    connects: ['dsl-hobbies', 'mumford-magick'],
    url: '/calibrate',
  },
];
`;

  it('extracts each static node', () => {
    const nodes = parseStaticNodes(source);
    expect(nodes.map((n) => n.slug)).toEqual(['allons-jouer', 'calibrate']);
    expect(nodes[0]?.connects).toEqual(['ladder']);
    expect(nodes[0]?.date).toBe('2026-04-29T00:00:00.000Z');
    expect(nodes[1]?.connects).toEqual(['dsl-hobbies', 'mumford-magick']);
    expect(nodes[1]?.date).toBeNull();
  });

  it('returns nothing when the declaration has drifted, so callers can warn', () => {
    expect(parseStaticNodes('export const PAGES = [];')).toEqual([]);
  });
});

describe('snapshot', () => {
  const node = (slug: string, connects: string[] = []): RawNode => ({
    slug,
    collection: 'essays',
    path: `apps/site/src/content/essays/${slug}.mdx`,
    title: slug,
    date: '2026-04-17',
    state: 'seedling',
    connects,
  });

  it('counts inbound links', () => {
    const { inDegree } = snapshot([node('a', ['c']), node('b', ['c']), node('c')]);
    expect(inDegree.c).toBe(2);
    expect(inDegree.a).toBe(0);
  });

  it('accepts a qualified collection/slug target', () => {
    const { inDegree, dangling } = snapshot([
      node('a', ['essays/b']),
      node('b'),
    ]);
    expect(inDegree.b).toBe(1);
    expect(dangling).toEqual([]);
  });

  it('counts a repeated target once', () => {
    const { inDegree } = snapshot([node('a', ['b', 'b']), node('b')]);
    expect(inDegree.b).toBe(1);
  });

  it('ignores a self-link without calling it dangling', () => {
    const { inDegree, dangling } = snapshot([node('a', ['a'])]);
    expect(inDegree.a).toBe(0);
    expect(dangling).toEqual([]);
  });

  it('reports targets that match no node', () => {
    const { dangling } = snapshot([node('a', ['typo'])]);
    expect(dangling).toEqual([{ from: 'a', target: 'typo' }]);
  });
});
