#!/usr/bin/env node
// One-time merge: applies real page/line data (scripts/quran-foundation-16line.json,
// fetched by build-quran-pack-layout.mjs) into src/data/quran-pack-data.json,
// replacing the previous placeholder line-break heuristic.
import { readFile, writeFile } from 'node:fs/promises';

const dataPath = new URL('../src/data/quran-pack-data.json', import.meta.url);
const layoutPath = new URL('./quran-foundation-16line.json', import.meta.url);

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const layout = JSON.parse(await readFile(layoutPath, 'utf8'));

let updated = 0;
for (const ayah of data.ayahs) {
  const entry = layout[ayah.key];
  if (!entry) throw new Error(`No layout entry for ${ayah.key}`);
  ayah.page = entry.page;
  ayah.lineStart = entry.lineStart;
  ayah.lineEnd = entry.lineEnd;
  ayah.lineDataSource = 'quran-foundation-indopak-16';
  ayah.lineDataVerified = true;
  updated += 1;
}

data.generatedFrom =
  'risan/quran-json (Tanzil-derived Arabic + Bengali translation); line/page layout from Quran Foundation Content API, mushaf id 7 (IndoPak 16-line, 548 pages)';

await writeFile(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Merged real line/page data into ${updated} ayahs in quran-pack-data.json`);
