import type { QuranContentPack } from '@/domain/types';

// Demo content pack. Quran text is kept immutable and attributed to Tanzil.
export const quranDemoPack: QuranContentPack = {
  id: 'indopak-13-demo',
  version: '2026.07-demo.1',
  layout: 'indopak-13',
  sourceName: 'Tanzil Project',
  sourceUrl: 'https://tanzil.net',
  checksumSha256: 'pending-build-check',
  surahs: [
    {
      number: 112,
      nameArabic: 'الإخلاص',
      nameBn: 'আল-ইখলাস',
      ayahCount: 4,
    },
  ],
  ayahs: [
    {
      key: '112:1',
      surahNumber: 112,
      ayahNumber: 1,
      page: 1,
      lineStart: 1,
      lineEnd: 3,
      arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      translationBn: 'বলুন, তিনি আল্লাহ, এক।',
      audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/112001.mp3',
    },
    {
      key: '112:2',
      surahNumber: 112,
      ayahNumber: 2,
      page: 1,
      lineStart: 4,
      lineEnd: 6,
      arabic: 'ٱللَّهُ ٱلصَّمَدُ',
      translationBn: 'আল্লাহ অমুখাপেক্ষী।',
      audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/112002.mp3',
    },
    {
      key: '112:3',
      surahNumber: 112,
      ayahNumber: 3,
      page: 1,
      lineStart: 7,
      lineEnd: 9,
      arabic: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
      translationBn: 'তিনি কাউকে জন্ম দেননি এবং তাঁকেও জন্ম দেওয়া হয়নি।',
      audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/112003.mp3',
    },
    {
      key: '112:4',
      surahNumber: 112,
      ayahNumber: 4,
      page: 1,
      lineStart: 10,
      lineEnd: 13,
      arabic: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ',
      translationBn: 'এবং তাঁর সমতুল্য কেউ নেই।',
      audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/112004.mp3',
    }
  ]
};

export function getAyahs(keys: string[]) {
  const selected = new Set(keys);
  return quranDemoPack.ayahs.filter((ayah) => selected.has(ayah.key));
}
