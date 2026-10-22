import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { searchEntries } from '../src/lib/search.mjs';
const root = new URL('../dist/', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const index = JSON.parse(read('search-index.json'));
const documents = fs
  .readdirSync(new URL('../src/content/docs/', import.meta.url))
  .filter((name) => name.endsWith('.md'));
const notes = fs
  .readdirSync(new URL('../src/content/journal/', import.meta.url))
  .filter((name) => name.endsWith('.md'));
const articles = index.filter((entry) => entry.kind !== 'lab');
assert.equal(
  index.filter((entry) => entry.kind === 'docs').length,
  documents.length,
);
assert.equal(
  index.filter((entry) => entry.kind === 'journal').length,
  notes.length,
);
assert.equal(new Set(index.map((item) => item.id)).size, index.length);
assert.ok(index.filter((item) => item.kind === 'lab').length >= 11);
assert.ok(
  searchEntries(index, 'SolidWorks').some(
    (entry) => entry.url === '/docs/gazebo-custom-robot/',
  ),
);
const dates = {
  'gazebo-custom-robot': '2024-07-12',
  'reinforcement-learning-new-robot': '2024-07-27',
  'mini-pi-plus-beyondmimic': '2025-10-31',
  'gvhmr-motion-reconstruction': '2025-11-13',
  mimickit: '2025-11-25',
  'urdf-export-checklist': '2025-11-04',
};
const rss = read('rss.xml');
assert.equal((rss.match(/<item>/g) || []).length, articles.length);
assert.equal(
  (rss.match(/<pubDate>/g) || []).length,
  articles.filter((entry) => entry.publishedDate).length,
);
assert.equal(
  new Set(
    [...rss.matchAll(/<guid[^>]*>(.*?)<\/guid>/g)].map((match) => match[1]),
  ).size,
  17,
);
assert.ok(!rss.includes('lastBuildDate'));
const sitemap = read('sitemap.xml');
assert.equal((sitemap.match(/<url>/g) || []).length, articles.length + 6);
assert.ok(!/404|\/search|\?example/.test(sitemap));
for (const [slug, date] of Object.entries(dates)) {
  const html = read(`docs/${slug}/index.html`);
  assert.ok(html.includes(`datetime="${date}"`), slug);
  assert.ok(
    html.includes(`property="article:published_time" content="${date}"`),
  );
  assert.ok(html.includes(`"datePublished":"${date}"`));
  if (!index.find((entry) => entry.id === `docs:${slug}`).updatedDate)
    assert.ok(!html.includes('article:modified_time'));
  assert.equal(
    index.find((entry) => entry.id === `docs:${slug}`).publishedDate,
    date,
  );
}
for (const note of index.filter((item) => item.kind === 'journal')) {
  const html = read(`${note.url.slice(1)}index.html`);
  assert.ok(
    !/<time\b|datePublished|dateModified|article:published_time|日期未记录/.test(
      html,
    ),
    note.id,
  );
}
assert.equal(
  (sitemap.match(/<lastmod>/g) || []).length,
  articles.filter((entry) => entry.updatedDate).length,
);
const files = fs
  .readdirSync(root, { recursive: true })
  .filter((file) => file.endsWith('.html'));
for (const file of files) {
  const html = read(file.replaceAll('\\', '/'));
  if (html.includes('http-equiv="refresh"')) {
    assert.ok(html.includes('name="robots" content="noindex"'));
    continue;
  }
  assert.equal((html.match(/<h1\b/g) || []).length, 1, file);
  for (const property of ['og:image', 'og:url', 'og:site_name', 'og:locale'])
    assert.ok(html.includes(`property="${property}"`), `${file}: ${property}`);
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(html.includes('rel="apple-touch-icon"'));
  assert.ok(html.includes('rel="alternate" type="application/rss+xml"'));
  const data = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];
  assert.equal(data.length, 1, file);
  assert.ok(JSON.parse(data[0][1])['@graph'].length >= 3);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)[^\"]*"/g)) {
    const resource = match[1];
    if (resource.startsWith('//')) continue;
    const disk = new URL(
      resource.slice(1) + (resource.endsWith('/') ? 'index.html' : ''),
      root,
    );
    assert.ok(fs.existsSync(disk), `${file}: missing ${resource}`);
  }
}
assert.ok(read('about/index.html').includes('"@type":"ProfilePage"'));
assert.ok(read('index.html').includes('hero-identity'));
assert.ok(read('search/index.html').includes('noindex, follow'));
const manifest = JSON.parse(read('site.webmanifest'));
for (const icon of [
  ...manifest.icons,
  { src: '/apple-touch-icon.png', sizes: '180x180' },
]) {
  const buffer = fs.readFileSync(new URL(icon.src.slice(1), root));
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  assert.equal(
    `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`,
    icon.sizes,
  );
}
console.log(
  `PASS: ${files.length} HTML pages; author-supplied dates only; ${index.length} searchable entries; ${articles.length} RSS items; ${articles.length + 6} sitemap routes; metadata, local links and icon sizes.`,
);
