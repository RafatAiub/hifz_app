import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { quranDemoPack } from '@/data/quran-pack';

const EXPECTED_TEXT_HASH =
  'ac6b5b007a7420fbab2d5958e796db6832cd10239bd3012f070c63a97f2b0b77';

describe('Quran content integrity', () => {
  it('contains the complete declared surah without duplicate keys', () => {
    const declared = quranDemoPack.surahs.reduce(
      (total, surah) => total + surah.ayahCount,
      0,
    );
    expect(quranDemoPack.ayahs).toHaveLength(declared);
    expect(new Set(quranDemoPack.ayahs.map((ayah) => ayah.key)).size).toBe(
      declared,
    );
  });

  it('matches the reviewed immutable Arabic text checksum', () => {
    const payload = quranDemoPack.ayahs.map((ayah) => [ayah.key, ayah.arabic]);
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    expect(hash).toBe(EXPECTED_TEXT_HASH);
  });

  it('has valid page lines and audio for every ayah', () => {
    for (const ayah of quranDemoPack.ayahs) {
      expect(ayah.lineStart).toBeGreaterThanOrEqual(1);
      expect(ayah.lineEnd).toBeLessThanOrEqual(13);
      expect(ayah.lineEnd).toBeGreaterThanOrEqual(ayah.lineStart);
      expect(ayah.audioUrl).toMatch(/^https:\/\/everyayah\.com\/.+\.mp3$/);
    }
  });
});
