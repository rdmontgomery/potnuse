// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Pure static for now. Cloudflare Pages serves the dist/ directory directly.
// When we add a server route (agentic tooling, etc.), re-add the cloudflare adapter.
export default defineConfig({
  integrations: [react(), mdx()],
  markdown: {
    // Warm dark theme; the background is overridden in prose CSS so code blocks
    // sit on --bg-card rather than punching a black hole in the page.
    shikiConfig: { theme: 'vesper', wrap: false },
    // Math is typeset at build time, so pages ship HTML and CSS, not a script.
    // Single dollars are left alone: the prose is full of prices like $5,
    // so math is always $$...$$ (inline when it sits inside a line of text,
    // display when it sits on lines of its own).
    remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
    rehypePlugins: [rehypeKatex],
  },
});
