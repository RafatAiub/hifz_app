import { describe, expect, it } from 'vitest';

import { getAyahs, quranDemoPack } from '@/data/quran-pack';
import tajweedData from '@/data/quran-tajweed-data.json';
import { tajweedColors } from '@/theme/tokens';

type TajweedSegment = { text: string; rule?: keyof typeof tajweedColors };
const segmentsByAyah = tajweedData as Record<string, TajweedSegment[]>;

// Mirrors scripts/build-tajweed-data.mjs: the tajweed source and this app's
// existing text are independent digitizations that pick different (but
// canonically valid) codepoints for some diacritics -- see that script's
// comments for why matching consonant skeletons (rasm) is a safe bar for
// "unreviewed" content, while hand-reviewed content requires an exact match.
const ARABIC_DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
function rasmOf(text: string) {
  return text.normalize('NFC').replace(ARABIC_DIACRITICS, '');
}

describe('Quran tajweed overlay integrity', () => {
  it('reconstructs verse text matching the existing rasm for every covered ayah', () => {
    const arabicByKey = new Map<string, string>(
      quranDemoPack.ayahs.map((a) => [a.key, a.arabic]),
    );
    for (const [key, segments] of Object.entries(segmentsByAyah)) {
      const reconstructed = segments.map((seg) => seg.text).join('');
      expect(rasmOf(reconstructed)).toBe(rasmOf(arabicByKey.get(key) ?? ''));
    }
  });

  it('only uses recognized tajweed rule keys', () => {
    const validRules = new Set(Object.keys(tajweedColors));
    for (const segments of Object.values(segmentsByAyah)) {
      for (const seg of segments) {
        if (seg.rule) expect(validRules.has(seg.rule)).toBe(true);
      }
    }
  });

  it('never overrides the hand-reviewed Al-Ikhlas text', () => {
    const alIkhlas = getAyahs(['112:1', '112:2', '112:3', '112:4']);
    for (const ayah of alIkhlas) {
      const segments = segmentsByAyah[ayah.key];
      if (!segments) continue;
      expect(segments.map((seg) => seg.text).join('')).toBe(ayah.arabic);
    }
  });

  it('covers a meaningful majority of Juz Amma ayahs', () => {
    const totalAyahs = quranDemoPack.ayahs.length;
    const covered = Object.keys(segmentsByAyah).length;
    expect(covered).toBeGreaterThan(totalAyahs * 0.5);
  });
});
