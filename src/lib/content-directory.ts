import { getCollection } from 'astro:content';
import { experimentCatalog, experimentHref } from './experiment-catalog';

export interface DirectoryEntry {
  id: string;
  kind: 'journal' | 'docs' | 'lab';
  title: string;
  description: string;
  url: string;
  category: string;
  tags: string[];
  text: string;
  publishedDate?: string;
  updatedDate?: string;
}
export const kindLabels = {
  journal: '实验手记',
  docs: '工作文档',
  lab: '仿真实验',
};

function plainText(markdown: string) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`#*_~|>\\]/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function contentDirectory(): Promise<DirectoryEntry[]> {
  const [notes, documents] = await Promise.all([
    getCollection('journal'),
    getCollection('docs'),
  ]);
  return [
    ...documents
      .sort(
        (a, b) =>
          (b.data.publishedDate || '').localeCompare(
            a.data.publishedDate || '',
          ) || a.data.order - b.data.order,
      )
      .map((entry) => ({
        id: `docs:${entry.id}`,
        kind: 'docs' as const,
        url: `/docs/${entry.id}/`,
        title: entry.data.title,
        description: entry.data.description,
        category: entry.data.category,
        tags: entry.data.tags,
        text: plainText(entry.body || ''),
        publishedDate: entry.data.publishedDate,
        updatedDate: entry.data.updatedDate,
      })),
    ...notes
      .sort((a, b) => a.data.number.localeCompare(b.data.number))
      .map((entry) => ({
        id: `journal:${entry.id}`,
        kind: 'journal' as const,
        url: `/journal/${entry.id}/`,
        title: entry.data.title,
        description: entry.data.description,
        category: entry.data.category,
        tags: ['MuJoCo', entry.data.example],
        text: plainText(entry.body || ''),
      })),
    ...experimentCatalog.map((entry) => ({
      id: `lab:${entry.id}`,
      kind: 'lab' as const,
      url: experimentHref(entry.id),
      title: entry.title,
      description: entry.description,
      category: entry.subject,
      tags: ['MuJoCo', entry.english, entry.id],
      text: entry.connection,
    })),
  ];
}
