# potnuse

Personal site at rdmontgomery.com. A rhizome, not a tree — no index, only a door that opens to a random node. Astro + React islands + MDX, deployed to Cloudflare Workers.

## Content model

Three collections under `src/content/`, all sharing a base schema (`title`, `date`, `state`, `connects`, `tags`, `description`) defined in `src/content.config.ts`:

- **essays** — long-form writing
- **experiments** — exploratory projects
- **exchanges** — conversations with LLMs (adds `with: Claude` by default)

`state` runs `seedling → germinating → stable → fossil`. `connects` is a list of slugs that forms graph edges for random navigation.

## Exchange style

Exchanges are edited conversations, not transcripts. The reader should feel they're reading a literary form, not a ChatGPT paste.

**Voice convention:**

- **Rick's voice** is prose — direct, in the narrative flow. Often opens a section by naming a thinker, asking a question, or pushing back.
- **Claude's voice** sits in blockquotes (`>`). Every line of a Claude response is prefixed. Multi-paragraph responses use `>` on each paragraph with blank `>` lines between them.
- Never label speakers with "Rick:" / "Claude:" — the blockquote itself does the work.

**Components** (imported at the top of every exchange):

```mdx
import Gloss from '@/components/Gloss.astro';
import Pull from '@/components/Pull.astro';
import Marginal from '@/components/Marginal.astro';
```

- `<Gloss def="...">term</Gloss>` — inline tooltip definition. Use on first introduction of a thinker, a technical term, or anything a casual reader might need glossed. Keep definitions tight (~1-2 sentences). The `def` attribute uses double quotes; apostrophes are fine inside but avoid nested double quotes — swap to single quotes inside if needed.
- `<Pull>short punchy line</Pull>` — pullquote that breaks out of the prose. Use sparingly, 2-4 per long piece. Lift the most-quotable sentence from the surrounding passage; don't invent new text.
- `<Marginal>sidenote</Marginal>` — floats into the right gutter on wide screens, collapses inline on mobile. Use for tangents, citations, Straussian reads — the thing that would be a footnote in print. Place near the paragraph it comments on, not at the end of the section.

**Section breaks** use `---` on its own line. Subsections use `### Title` headers (sentence case, not title case).

**Reference existing exchanges for tone and pacing:** `src/content/exchanges/dsl-hobbies.mdx` (short one-shot), `src/content/exchanges/mumford-magick.mdx` (long multi-turn).

## What to avoid

- **Caveman mode.** Don't compress Claude's voice into terse bullet fragments ("Instinct right. Efficiency optimization applied before effectiveness asked."). The discursive texture *is* the product of these pieces — that's the entire thesis of the mumford-magick exchange. Preserve articles, connectives, and the conversational "you."
- **Labeling speakers.** No "Rick:" / "Claude:" prefixes in the body.
- **Orphan glossaries.** Don't append a block of `<Gloss>` terms at the bottom as a summary. Glosses belong inline at first use.
- **Emojis.** Not in content, not in code, not in commit messages — unless Rick explicitly asks.
- **Over-Pulling.** A pullquote every paragraph kills the effect. Reserve for the genuinely load-bearing lines.

## Commands

- `pnpm dev` — local dev server at localhost:4321
- `pnpm build` — static build to `./dist/`
- `pnpm preview` — preview the build locally

Deploy is `pnpm build && npx wrangler deploy`. Confirm with Rick before deploying.

## Frontmatter checklist for new exchanges

```yaml
---
title: lowercase title
date: YYYY-MM-DD
state: seedling        # start here
with: Claude
connects: [slug-of-related-node]
tags: [topic, topic, topic]
description: One-sentence hook that shows up on index pages.
---
```
