import tajweedData from '@/data/quran-tajweed-data.json';
import type { TajweedRule } from '@/theme/tokens';

type TajweedSegment = { text: string; rule?: TajweedRule };
const segmentsByAyah = tajweedData as Record<string, TajweedSegment[]>;

export interface WordSkeleton {
  word: string;
  skeleton: string;
  rule?: TajweedRule;
}

/** Keeps tajweed metadata aligned while splitting a verse into word hints. */
export function getWordSkeletons(ayahKey: string, arabic: string): WordSkeleton[] {
  const segments = segmentsByAyah[ayahKey];
  if (!segments) {
    return arabic.split(/\s+/).filter(Boolean).map((word) => ({
      word,
      skeleton: firstArabicCluster(word),
    }));
  }

  const characters = segments.flatMap((segment) =>
    Array.from(segment.text).map((character) => ({ character, rule: segment.rule })),
  );
  const words: Array<Array<(typeof characters)[number]>> = [];
  let current: Array<(typeof characters)[number]> = [];
  for (const item of characters) {
    if (/\s/u.test(item.character)) {
      if (current.length) words.push(current);
      current = [];
    } else {
      current.push(item);
    }
  }
  if (current.length) words.push(current);

  return words.map((items) => {
    const word = items.map((item) => item.character).join('');
    const baseIndex = items.findIndex((item) => !/\p{M}/u.test(item.character));
    const safeIndex = Math.max(0, baseIndex);
    let skeleton = items[safeIndex]?.character ?? word.charAt(0);
    for (let index = safeIndex + 1; index < items.length; index += 1) {
      const character = items[index]?.character ?? '';
      if (!/\p{M}/u.test(character)) break;
      skeleton += character;
    }
    return { word, skeleton, rule: items[safeIndex]?.rule };
  });
}

function firstArabicCluster(word: string) {
  const characters = Array.from(word);
  let result = characters[0] ?? '';
  for (let index = 1; index < characters.length; index += 1) {
    const character = characters[index] ?? '';
    if (!/\p{M}/u.test(character)) break;
    result += character;
  }
  return result;
}
