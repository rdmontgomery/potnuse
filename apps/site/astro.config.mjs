// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// Pure static for now. Cloudflare Pages serves the dist/ directory directly.
// When we add a server route (agentic tooling, etc.), re-add the cloudflare adapter.
export default defineConfig({
  integrations: [react(), mdx()],
});
