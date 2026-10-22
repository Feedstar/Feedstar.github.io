import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { validDate } from './lib/content-dates.mjs';
const calendarDate = z
  .string()
  .refine(validDate, 'Use a real calendar date: YYYY-MM-DD');
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
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
      order: z.number(),
      cover: z.string(),
      publishedDate: calendarDate.optional(),
      updatedDate: calendarDate.optional(),
    })
    .refine(
      (entry) =>
        !entry.updatedDate ||
        !entry.publishedDate ||
        entry.updatedDate >= entry.publishedDate,
      {
        message: 'An update cannot precede the original writing date',
        path: ['updatedDate'],
      },
    ),
});
export const collections = { journal, docs };
