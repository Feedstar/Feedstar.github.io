import type { APIRoute } from 'astro';
import { contentDirectory } from '../lib/content-directory';
import { escapeXml as xml } from '../lib/content-dates.mjs';
export const GET: APIRoute = async ({ site }) => {
  const content = (await contentDirectory()).filter(
    (entry) => entry.kind !== 'lab',
  );
  const urls = [
    ...['/', '/lab/', '/journal/', '/docs/', '/about/', '/subscribe/'].map(
      (url) => ({ url, updatedDate: undefined as string | undefined }),
    ),
    ...content,
  ];
  // Original writing dates predate site migration, so they are not sitemap lastmod.
  const body = urls
    .map(
      (entry) =>
        `<url><loc>${xml(new URL(entry.url, site).href)}</loc>${entry.updatedDate ? `<lastmod>${entry.updatedDate}</lastmod>` : ''}</url>`,
    )
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
