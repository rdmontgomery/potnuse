import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const nodeSchema = z.object({
  title: z.string(),
  date: z.coerce.date().optional(),
  state: z
    .enum(['seedling', 'germinating', 'stable', 'fossil'])
    .default('seedling'),
  connects: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
});

export const collections = {
  essays: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/essays' }),
    schema: nodeSchema,
  }),
  experiments: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/experiments' }),
    schema: nodeSchema,
  }),
};
