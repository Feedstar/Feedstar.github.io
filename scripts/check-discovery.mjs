import assert from 'node:assert/strict';
import { searchEntries, searchExcerpt } from '../src/lib/search.mjs';
import {
  validDate,
  displayDate,
  escapeXml,
} from '../src/lib/content-dates.mjs';
assert.equal(validDate('2024-02-29'), true);
for (const date of [
  '2025-02-29',
  '2024-02-31',
  '2024-13-01',
  '2024.7.12',
  '2024-7-12',
])
  assert.equal(validDate(date), false);
assert.equal(displayDate('2024-07-12'), '2024.07.12');
assert.equal(escapeXml('<A & "B">'), '&lt;A &amp; &quot;B&quot;&gt;');
const entries = [
  {
    id: 'body',
    kind: 'docs',
    title: '配置新机器人',
    category: '强化学习',
    description: '训练记录',
    tags: ['ROS 2'],
    text: '奖励由关节速度和姿态决定，使用 MuJoCo。',
  },
  {
    id: 'title',
    kind: 'journal',
    title: '关节与奖励',
    category: '实验手记',
    description: '理解控制',
    tags: ['MuJoCo'],
    text: '运动',
  },
  {
    id: 'lab',
    kind: 'lab',
    title: '小实验',
    category: '控制',
    description: '调节单关节',
    tags: ['Mini-Pi'],
    text: '观察响应',
  },
];
assert.deepEqual(
  searchEntries(entries, '关节 奖励').map((entry) => entry.id),
  ['title', 'body'],
);
assert.deepEqual(
  searchEntries(entries, '关节', 'docs').map((entry) => entry.id),
  ['body'],
);
assert.deepEqual(
  searchEntries(entries, 'ｍｕｊｏｃｏ').map((entry) => entry.id),
  ['title', 'body'],
);
assert.deepEqual(
  searchEntries(entries, 'Mini_Pi').map((entry) => entry.id),
  ['lab'],
);
assert.equal(searchEntries(entries, '<script>alert(1)</script>').length, 0);
assert.equal(searchEntries(entries, '不存在').length, 0);
assert.equal(searchEntries(entries, '  ').length, 3);
assert.match(searchExcerpt(entries[0], '奖励'), /奖励由关节速度/);
console.log(
  'PASS: real calendar dates, XML escaping, Chinese and Latin full-text search, ranking, type filtering and excerpts.',
);
