import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    number: z.string(),
    example: z.string(),
  }),
});
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    order: z.number(),
    cover: z.string(),
  }),
});
export const collections = { journal, docs };
