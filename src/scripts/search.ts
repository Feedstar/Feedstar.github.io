import type { DirectoryEntry } from '../lib/content-directory';
import { searchEntries, searchExcerpt } from '../lib/search.mjs';

export function startSearch() {
  const root = document.querySelector<HTMLElement>('[data-search]');
  if (!root) return;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const query = root.querySelector<HTMLInputElement>('[name="q"]')!;
  const kind = root.querySelector<HTMLSelectElement>('[name="type"]')!;
  const results = root.querySelector<HTMLOListElement>('.search-results')!;
  const status = root.querySelector<HTMLElement>('[data-search-status]')!;
  const error = root.querySelector<HTMLElement>('[data-search-error]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-search-retry]')!;
  const rows = new Map(
    [...results.querySelectorAll<HTMLElement>('[data-search-id]')].map(
      (row) => [row.dataset.searchId!, row],
    ),
  );
  let entries: DirectoryEntry[] = [...rows].map(([id, row]) => ({
    id,
    kind: row.dataset.kind as DirectoryEntry['kind'],
    title: row.querySelector('h2')!.childNodes[0].textContent || '',
    description:
      row.querySelector('[data-search-description]')!.textContent || '',
    category: row.dataset.category!,
    tags: JSON.parse(row.dataset.tags!),
    text: '',
    url: row.querySelector('a')!.getAttribute('href')!,
  }));
  let loading = true;
  let timer: ReturnType<typeof setTimeout>;
  const update = (writeURL = true) => {
    const matches = searchEntries(
      entries,
      query.value,
      kind.value,
    ) as DirectoryEntry[];
    const visible = new Set(matches.map((entry) => entry.id));
    rows.forEach((row, id) => {
      row.hidden = !visible.has(id);
    });
    for (const entry of matches) {
      const row = rows.get(entry.id)!;
      row.querySelector('[data-search-description]')!.textContent =
        searchExcerpt(entry, query.value);
      results.append(row);
    }
    root.querySelector<HTMLElement>('[data-search-empty]')!.hidden =
      matches.length > 0;
    status.textContent = `${matches.length} 项${query.value.trim() ? '匹配内容' : '内容'}${loading ? ' · 正在加载正文索引' : ''}`;
    if (writeURL) {
      const url = new URL(location.href);
      if (query.value.trim()) url.searchParams.set('q', query.value.trim());
      else url.searchParams.delete('q');
      if (kind.value !== 'all') url.searchParams.set('type', kind.value);
      else url.searchParams.delete('type');
      history.replaceState(null, '', url);
    }
  };
  const readURL = () => {
    const params = new URLSearchParams(location.search);
    query.value = (params.get('q') || '').slice(0, 160);
    const value = params.get('type') || 'all';
    kind.value = ['all', 'docs', 'journal', 'lab'].includes(value)
      ? value
      : 'all';
    update(false);
  };
  const load = async () => {
    loading = true;
    retry.hidden = true;
    error.hidden = true;
    update(false);
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/search-index.json', {
        cache: 'no-cache',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Index unavailable');
      const data: unknown = await response.json();
      if (
        !Array.isArray(data) ||
        data.length !== rows.size ||
        new Set(data.map((item) => item?.id)).size !== rows.size ||
        data.some(
          (item) =>
            !rows.has(item?.id) ||
            !['title', 'description', 'text', 'category'].every(
              (key) => typeof item[key] === 'string',
            ) ||
            !Array.isArray(item.tags) ||
            !item.tags.every((tag: unknown) => typeof tag === 'string'),
        )
      )
        throw new Error('Invalid index');
      entries = data;
    } catch {
      error.hidden = false;
      retry.hidden = false;
    } finally {
      clearTimeout(deadline);
      loading = false;
      update(false);
    }
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(timer);
    update();
  });
  query.addEventListener('input', (event) => {
    if ((event as InputEvent).isComposing) return;
    clearTimeout(timer);
    timer = setTimeout(update, 100);
  });
  query.addEventListener('compositionend', () => {
    clearTimeout(timer);
    update();
  });
  kind.addEventListener('change', () => update());
  retry.addEventListener('click', () => {
    void load();
  });
  window.addEventListener('popstate', readURL);
  readURL();
  void load();
}
