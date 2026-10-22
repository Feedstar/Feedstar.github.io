export function normalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s_\-/]+/g, ' ')
    .trim();
}
export function searchEntries(entries, query, kind = 'all') {
  const terms = normalize(query).split(/\s+/).filter(Boolean).slice(0, 16);
  return entries
    .filter((entry) => kind === 'all' || entry.kind === kind)
    .map((entry, index) => {
      const title = normalize(entry.title);
      const tags = normalize([entry.category, ...entry.tags].join(' '));
      const summary = normalize(entry.description);
      const text = normalize(entry.text);
      let score = 0;
      for (const term of terms) {
        const weight =
          (title.includes(term) ? 12 : 0) +
          (tags.includes(term) ? 7 : 0) +
          (summary.includes(term) ? 4 : 0) +
          (text.includes(term) ? 1 : 0);
        if (!weight) return null;
        score += weight;
      }
      return { entry, score, index };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ entry }) => entry);
}
export function searchExcerpt(entry, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (
    !terms.length ||
    terms.some((term) => normalize(entry.description).includes(term))
  )
    return entry.description;
  const text = entry.text || entry.description;
  const lower = text.toLocaleLowerCase('zh-CN');
  const positions = terms
    .map((term) => lower.indexOf(term))
    .filter((position) => position >= 0);
  if (!positions.length) return entry.description;
  const start = Math.max(0, Math.min(...positions) - 36);
  return `${start ? '…' : ''}${text.slice(start, start + 160)}${text.length > start + 160 ? '…' : ''}`;
}
