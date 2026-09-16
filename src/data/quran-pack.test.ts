import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { getAyahs, quranDemoPack } from '@/data/quran-pack';

const AL_IKHLAS_TEXT_HASH =
  'ac6b5b007a7420fbab2d5958e796db6832cd10239bd3012f070c63a97f2b0b77';

describe('Quran content integrity', () => {
  it('contains every declared surah without duplicate keys', () => {
    const declared = quranDemoPack.surahs.reduce(
      (total, surah) => total + surah.ayahCount,
      0,
    );
    expect(quranDemoPack.ayahs).toHaveLength(declared);
    expect(new Set(quranDemoPack.ayahs.map((ayah) => ayah.key)).size).toBe(
      declared,
    );
  });

  it('keeps the reviewed Al-Ikhlas pilot text immutable', () => {
    const alIkhlas = quranDemoPack.ayahs
      .filter((ayah) => ayah.surahNumber === 112)
      .map((ayah) => [ayah.key, ayah.arabic]);
    const hash = createHash('sha256')
      .update(JSON.stringify(alIkhlas))
      .digest('hex');
    expect(hash).toBe(AL_IKHLAS_TEXT_HASH);
    expect(quranDemoPack.ayahs.filter((a) => a.surahNumber === 112)).toHaveLength(4);
  });

  it('ships every ayah verified against a recognised international source', () => {
    for (const ayah of quranDemoPack.ayahs) {
      expect(ayah.lineDataVerified).toBe(true);
    }
  });

  it('has valid page lines and audio for every ayah', () => {
    for (const ayah of quranDemoPack.ayahs) {
      expect(ayah.lineStart).toBeGreaterThanOrEqual(1);
      expect(ayah.lineEnd).toBeLessThanOrEqual(16);
      expect(ayah.lineEnd).toBeGreaterThanOrEqual(ayah.lineStart);
      expect(ayah.audioUrl).toMatch(/^https:\/\/everyayah\.com\/.+\.mp3$/);
    }
  });

  it('traces every ayah\'s line data to a known source', () => {
    for (const ayah of quranDemoPack.ayahs) {
      const expectedSource =
        ayah.surahNumber === 112 ? 'hand-reviewed-tanzil' : 'quran-foundation-indopak-16';
      expect(ayah.lineDataSource).toBe(expectedSource);
      expect(ayah.lineDataVerified).toBe(true);
    }
  });

  it('covers Juz Amma (surahs 78-114)', () => {
    const surahNumbers = new Set(quranDemoPack.surahs.map((s) => s.number));
    for (let number = 78; number <= 114; number += 1) {
      expect(surahNumbers.has(number)).toBe(true);
    }
    expect(quranDemoPack.surahs).toHaveLength(37);
  });

  it('getAyahs filters across surahs by key', () => {
    const result = getAyahs(['112:1', '114:1', '114:6']);
    expect(result.map((a) => a.key).sort()).toEqual(['112:1', '114:1', '114:6']);
  });
});
