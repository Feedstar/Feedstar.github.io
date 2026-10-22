import type { CollectionEntry } from 'astro:content';

// Undated documents stay at the end; never infer dates from their manual order.
export function compareDocumentDates(
  a: CollectionEntry<'docs'>,
  b: CollectionEntry<'docs'>,
) {
  return (
    (a.data.publishedDate || '9999-12-31').localeCompare(
      b.data.publishedDate || '9999-12-31',
    ) ||
    a.data.order - b.data.order ||
    a.id.localeCompare(b.id)
  );
}
