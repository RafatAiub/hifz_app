#!/usr/bin/env node
// Generates docs/alim-review-packet.csv — a per-surah summary (not every
// ayah) of where this app now says each surah starts/ends, page and line,
// so a reviewer can open the printed/PDF 16-line mushaf to that exact page
// and spot-check the boundary rather than checking all 560 ayahs by hand.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const packData = JSON.parse(await readFile(new URL('../src/data/quran-pack-data.json', import.meta.url), 'utf8'));
const alIkhlas = {
  surah: { number: 112, nameArabic: 'الإخلاص', nameBn: 'আল-ইখলাস' },
  ayahs: [
    { page: 1, lineStart: 1, lineEnd: 3, lineDataSource: 'hand-reviewed-tanzil' },
    { page: 1, lineStart: 4, lineEnd: 6, lineDataSource: 'hand-reviewed-tanzil' },
    { page: 1, lineStart: 7, lineEnd: 9, lineDataSource: 'hand-reviewed-tanzil' },
    { page: 1, lineStart: 10, lineEnd: 13, lineDataSource: 'hand-reviewed-tanzil' },
  ],
};
const surahs = [...packData.surahs, alIkhlas.surah].sort((a, b) => a.number - b.number);
const ayahsBySurah = new Map(surahs.map((s) => [s.number, []]));
for (const ayah of packData.ayahs) ayahsBySurah.get(ayah.surahNumber)?.push(ayah);
ayahsBySurah.set(112, alIkhlas.ayahs);

const rows = [['surah_number', 'surah_name_bn', 'surah_name_ar', 'first_page', 'first_line', 'last_page', 'last_line', 'source', 'reviewer_ok']];

for (const surah of surahs) {
  const ayahs = ayahsBySurah.get(surah.number) ?? [];
  const first = ayahs[0];
  const last = ayahs[ayahs.length - 1];
  rows.push([
    surah.number,
    surah.nameBn,
    surah.nameArabic,
    first.page,
    first.lineStart,
    last.page,
    last.lineEnd,
    first.lineDataSource,
    '',
  ]);
}

const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
const outPath = new URL('../docs/alim-review-packet.csv', import.meta.url);
await writeFile(outPath, csv, 'utf8');
console.log(`Wrote ${rows.length - 1} surah rows to docs/alim-review-packet.csv`);
