import { describe, expect, it } from 'vitest';

import { getWordSkeletons } from '@/domain/tajweed-words';

describe('getWordSkeletons', () => {
  it('keeps the first Arabic base letter with its marks', () => {
    const result = getWordSkeletons('missing', 'قُلْ هُوَ');

    expect(result.map((item) => item.skeleton)).toEqual(['قُ', 'هُ']);
  });

  it('preserves complete words separately from their recall cues', () => {
    const result = getWordSkeletons('missing', 'اللَّهُ الصَّمَدُ');

    expect(result.map((item) => item.word)).toEqual(['اللَّهُ', 'الصَّمَدُ']);
    expect(result.every((item) => item.skeleton.length < item.word.length)).toBe(true);
  });
});
