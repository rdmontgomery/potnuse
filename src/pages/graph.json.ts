import type { APIRoute } from 'astro';
import { buildGraph } from '@/lib/graph';

export const prerender = true;

export const GET: APIRoute = async () => {
  const graph = await buildGraph();
  return new Response(JSON.stringify(graph), {
    headers: { 'Content-Type': 'application/json' },
  });
};
