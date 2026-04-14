import { getCollection, type CollectionEntry } from 'astro:content';

export type NodeCollection = 'essays' | 'experiments' | 'page';
export type NodeState = 'seedling' | 'germinating' | 'stable' | 'fossil';

export interface Node {
  id: string;
  collection: NodeCollection;
  slug: string;
  title: string;
  state: NodeState;
  date?: string;
  connects: string[];
  backlinks: string[];
  tags: string[];
  description?: string;
  url: string;
}

// Static pages that aren't MDX content but participate in the graph.
// Add an entry here for every top-level page you want reachable via the door
// or referenced in `connects:` from an essay/experiment.
const STATIC_NODES: Omit<Node, 'backlinks'>[] = [
  {
    id: 'page/allons-jouer',
    collection: 'page',
    slug: 'allons-jouer',
    title: 'Allons jouer',
    state: 'stable',
    connects: [],
    tags: ['instrument', 'cajun', 'accordion'],
    description:
      'Cajun accordion teaching app — home / free play / lesson / reference / tuner.',
    url: '/allons-jouer',
  },
];

type AnyEntry = CollectionEntry<'essays'> | CollectionEntry<'experiments'>;

function fromEntry(
  collection: 'essays' | 'experiments',
  entry: AnyEntry,
): Omit<Node, 'backlinks'> {
  const { data } = entry;
  return {
    id: `${collection}/${entry.id}`,
    collection,
    slug: entry.id,
    title: data.title,
    state: data.state,
    date: data.date ? data.date.toISOString() : undefined,
    connects: data.connects,
    tags: data.tags,
    description: data.description,
    url: `/${collection}/${entry.id}`,
  };
}

export async function buildGraph(): Promise<Node[]> {
  const essays = await getCollection('essays');
  const experiments = await getCollection('experiments');

  const base: Omit<Node, 'backlinks'>[] = [
    ...essays.map((e) => fromEntry('essays', e)),
    ...experiments.map((e) => fromEntry('experiments', e)),
    ...STATIC_NODES,
  ];

  return base.map((node) => ({
    ...node,
    backlinks: base
      .filter((other) => other.slug !== node.slug)
      .filter(
        (other) =>
          other.connects.includes(node.slug) ||
          other.connects.includes(node.id),
      )
      .map((other) => other.slug),
  }));
}

export async function getNode(slug: string): Promise<Node | undefined> {
  const graph = await buildGraph();
  return graph.find((n) => n.slug === slug);
}

export async function getBacklinks(slug: string): Promise<Node[]> {
  const graph = await buildGraph();
  const node = graph.find((n) => n.slug === slug);
  if (!node) return [];
  return graph.filter((n) => node.backlinks.includes(n.slug));
}

export async function getForwardLinks(slug: string): Promise<Node[]> {
  const graph = await buildGraph();
  const node = graph.find((n) => n.slug === slug);
  if (!node) return [];
  return graph.filter(
    (n) => node.connects.includes(n.slug) || node.connects.includes(n.id),
  );
}
