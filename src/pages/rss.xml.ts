import type { APIRoute } from 'astro';
import { contentDirectory } from '../lib/content-directory';
import { escapeXml as xml } from '../lib/content-dates.mjs';
import { siteProfile } from '../lib/site-profile';
export const GET: APIRoute = async ({ site }) => {
  const absolute = (path: string) => new URL(path, site).href;
  const entries = (await contentDirectory()).filter(
    (entry) => entry.kind !== 'lab',
  );
  const items = entries
    .map((entry) => {
      const url = absolute(entry.url);
      // RSS requires a time component; midnight UTC only serializes a known calendar
      // date. Undated experiment notes intentionally have no pubDate at all.
      const date = entry.publishedDate
        ? `<pubDate>${new Date(`${entry.publishedDate}T00:00:00Z`).toUTCString()}</pubDate>`
        : '';
      return `<item><title>${xml(entry.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(entry.description)}</description><category>${xml(entry.category)}</category>${date}</item>`;
    })
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Feedstar · 实验手记与工作文档</title><link>${xml(absolute('/'))}</link><description>${xml(siteProfile.description)}</description><language>zh-CN</language>
<atom:link href="${xml(absolute('/rss.xml'))}" rel="self" type="application/rss+xml"/>
${items}</channel></rss>`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
};
