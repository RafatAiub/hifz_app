import { describe, expect, it } from 'vitest';

import {
  computeMilestones,
  computeStreak,
  computeSurahForecasts,
  computeSurahProgress,
  computeVelocity,
} from '@/domain/stats';
import { quranDemoPack } from '@/data/quran-pack';
import type { AyahKey, SessionEvent } from '@/domain/types';

function event(occurredAt: string, newAyahKeys: AyahKey[] = []): SessionEvent {
  return {
    id: occurredAt,
    profileId: 'profile-1',
    type: 'session.completed',
    occurredAt,
    payload: {
      id: occurredAt,
      planId: 'plan-1',
      profileId: 'profile-1',
      completedAt: occurredAt,
      completedAyahKeys: newAyahKeys,
      newAyahKeys,
      repetitions: 1,
      hints: 0,
      rating: 'good',
      recordingUri: null,
      wasInterrupted: false,
    },
    syncState: 'synced',
  };
}

describe('computeStreak', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');

  it('returns zero streak with no events', () => {
    expect(computeStreak([], now)).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
    });
  });

  it('counts consecutive days ending today', () => {
    const events = [
      event('2026-07-26T06:00:00.000Z'),
      event('2026-07-27T06:00:00.000Z'),
      event('2026-07-28T06:00:00.000Z'),
    ];
    const streak = computeStreak(events, now);
    expect(streak.currentStreak).toBe(3);
    expect(streak.longestStreak).toBe(3);
    expect(streak.lastCompletedDate).toBe('2026-07-28');
  });

  it('resets current streak after a missed day but keeps longest', () => {
    const events = [
      event('2026-07-20T06:00:00.000Z'),
      event('2026-07-21T06:00:00.000Z'),
      event('2026-07-22T06:00:00.000Z'),
      event('2026-07-24T06:00:00.000Z'),
    ];
    const streak = computeStreak(events, now);
    expect(streak.currentStreak).toBe(0);
    expect(streak.longestStreak).toBe(3);
  });
});

describe('computeSurahProgress', () => {
  it('reports memorized ratio per surah', () => {
    const progress = computeSurahProgress(['112:1', '112:2'], quranDemoPack);
    const alIkhlas = progress.find((p) => p.surahNumber === 112);
    expect(alIkhlas?.memorizedCount).toBe(2);
    expect(alIkhlas?.totalCount).toBe(4);
  });
});

describe('computeVelocity', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');

  it('returns 0 ayahs/day with no recent new-hifz events', () => {
    expect(computeVelocity([], now).ayahsPerDay).toBe(0);
  });

  it('averages distinct new ayahs over the trailing window', () => {
    const events = [
      event('2026-07-27T06:00:00.000Z', ['78:1', '78:2'] as AyahKey[]),
      event('2026-07-26T06:00:00.000Z', ['78:3'] as AyahKey[]),
    ];
    const velocity = computeVelocity(events, now, 3);
    expect(velocity.ayahsPerDay).toBeCloseTo(3 / 3);
  });

  it('ignores events outside the trailing window', () => {
    const events = [event('2026-01-01T06:00:00.000Z', ['78:1'] as AyahKey[])];
    expect(computeVelocity(events, now, 14).ayahsPerDay).toBe(0);
  });
});

describe('computeSurahForecasts', () => {
  it('forecasts days left only for partially-memorized surahs', () => {
    const progress = computeSurahProgress(
      quranDemoPack.ayahs.filter((a) => a.surahNumber === 114).slice(0, 3).map((a) => a.key),
      quranDemoPack,
    );
    const forecasts = computeSurahForecasts(progress, { ayahsPerDay: 1, windowDays: 14 });
    const surah114 = forecasts.find((f) => f.surahNumber === 114);
    expect(surah114?.remainingAyahs).toBe(3);
    expect(surah114?.daysLeft).toBe(3);
  });

  it('returns null daysLeft when velocity is 0 instead of guessing', () => {
    const progress = computeSurahProgress(['112:1'], quranDemoPack);
    const forecasts = computeSurahForecasts(progress, { ayahsPerDay: 0, windowDays: 14 });
    expect(forecasts.find((f) => f.surahNumber === 112)?.daysLeft).toBeNull();
  });

  it('excludes fully memorized and untouched surahs', () => {
    const memorized = quranDemoPack.ayahs.filter((a) => a.surahNumber === 114).map((a) => a.key);
    const progress = computeSurahProgress(memorized, quranDemoPack);
    const forecasts = computeSurahForecasts(progress, { ayahsPerDay: 1, windowDays: 14 });
    expect(forecasts.some((f) => f.surahNumber === 114)).toBe(false);
    expect(forecasts.some((f) => f.surahNumber === 78)).toBe(false);
  });
});

describe('computeMilestones', () => {
  it('awards a surah-complete milestone once all its ayahs are memorized', () => {
    const memorized = quranDemoPack.ayahs
      .filter((a) => a.surahNumber === 114)
      .map((a) => a.key);
    const milestones = computeMilestones(
      [event('2026-07-28T06:00:00.000Z')],
      memorized,
      quranDemoPack,
      { currentStreak: 1, longestStreak: 1, lastCompletedDate: '2026-07-28' },
    );
    expect(milestones.some((m) => m.id === 'surah-complete-114')).toBe(true);
  });
});
