#!/usr/bin/env node
// Regenerates src/data/quran-pack-data.json (Juz Amma, surahs 78-114) from
// the risan/quran-json dataset (Arabic + Bengali translation, itself sourced
// from Tanzil). Surah 112 (Al-Ikhlas) is intentionally left untouched here —
// it is the hand-reviewed pilot and lives inline in src/data/quran-pack.ts
// with an immutability checksum test guarding it.
//
// This script only fills line/page fields with a placeholder (see
// LINES_PER_PAGE below) — it does not know the real mushaf layout. If you
// re-run this script, you MUST re-run, in order:
//   node scripts/build-quran-pack-layout.mjs   (fetches real line/page data)
//   node scripts/merge-quran-pack-layout.mjs   (merges it back in)
// Skipping those two steps silently reverts every ayah's line/page data back
// to the placeholder and mislabels lineDataSource.
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const AR_URL = 'https://raw.githubusercontent.com/risan/quran-json/main/dist/quran.json';
const BN_URL = 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran_bn.json';

// Standard Bangla transliterations for surahs 78-114 (Juz Amma), matching
// the transliteration convention already used for surah 112 in
// src/data/quran-pack.ts ("আল-ইখলাস").
const BN_SURAH_NAMES = {
  78: 'আন-নাবা', 79: 'আন-নাযিআত', 80: 'আবাসা', 81: 'আত-তাকভীর',
  82: 'আল-ইনফিতার', 83: 'আল-মুতাফফিফীন', 84: 'আল-ইনশিকাক', 85: 'আল-বুরূজ',
  86: 'আত-তারিক', 87: 'আল-আলা', 88: 'আল-গাশিয়া', 89: 'আল-ফজর',
  90: 'আল-বালাদ', 91: 'আশ-শামস', 92: 'আল-লাইল', 93: 'আদ-দুহা',
  94: 'আশ-শারহ', 95: 'আত-তীন', 96: 'আল-আলাক', 97: 'আল-কদর',
  98: 'আল-বাইয়্যিনাহ', 99: 'আয-যালযালাহ', 100: 'আল-আদিয়াত', 101: 'আল-কারিয়াহ',
  102: 'আত-তাকাসুর', 103: 'আল-আসর', 104: 'আল-হুমাযাহ', 105: 'আল-ফীল',
  106: 'কুরাইশ', 107: 'আল-মাউন', 108: 'আল-কাওসার', 109: 'আল-কাফিরুন',
  110: 'আন-নাসর', 111: 'আল-মাসাদ', 113: 'আল-ফালাক', 114: 'আন-নাস',
};

const LINES_PER_PAGE = 13;
const PAGE_OFFSET = 100; // real page 1 is reserved for the Al-Ikhlas pilot

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

function main() {
  return Promise.all([fetchJson(AR_URL), fetchJson(BN_URL)]).then(([ar, bn]) => {
    const surahs = [];
    const ayahs = [];
    let lineCursor = 0;

    for (let number = 78; number <= 114; number += 1) {
      if (number === 112) continue; // pilot surah, kept out of the generated pack

      const arSurah = ar.find((s) => s.id === number);
      const bnSurah = bn.find((s) => s.id === number);
      surahs.push({
        number,
        nameArabic: arSurah.name,
        nameBn: BN_SURAH_NAMES[number],
        ayahCount: arSurah.total_verses,
      });

      arSurah.verses.forEach((verse, index) => {
        const bnVerse = bnSurah.verses[index];
        const lineStart = (lineCursor % LINES_PER_PAGE) + 1;
        const lineEnd = Math.min(LINES_PER_PAGE, lineStart + 1);
        const page = PAGE_OFFSET + Math.floor(lineCursor / LINES_PER_PAGE);
        lineCursor += 2;

        ayahs.push({
          key: `${number}:${verse.id}`,
          surahNumber: number,
          ayahNumber: verse.id,
          page,
          lineStart,
          lineEnd,
          arabic: verse.text,
          translationBn: bnVerse.translation,
          audioUrl: `https://everyayah.com/data/Alafasy_128kbps/${String(number).padStart(3, '0')}${String(verse.id).padStart(3, '0')}.mp3`,
          lineDataVerified: false,
        });
      });
    }

    const checksumSha256 = createHash('sha256')
      .update(JSON.stringify(ayahs.map((a) => [a.key, a.arabic])))
      .digest('hex');

    return { surahs, ayahs, checksumSha256 };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then(async ({ surahs, ayahs, checksumSha256 }) => {
      const outPath = new URL('../src/data/quran-pack-data.json', import.meta.url);
      const payload = {
        generatedFrom: 'risan/quran-json (Tanzil-derived Arabic + Bengali translation)',
        checksumSha256,
        surahs,
        ayahs,
      };
      await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
      console.log(`Wrote ${ayahs.length} ayahs across ${surahs.length} surahs to ${outPath}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
