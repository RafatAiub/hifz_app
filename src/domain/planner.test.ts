import { describe, expect, it } from 'vitest';

import { quranDemoPack } from '@/data/quran-pack';
import {
  buildDailyPlan,
  getPrecedingAyahKeys,
  moveInOrder,
  normalizeSurahOrder,
  scheduleNextReview,
} from '@/domain/planner';
import type { MemoryState, StudentProfile } from '@/domain/types';

function profile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    availableMinutes: 20,
    preferredTime: '06:30',
    capacityLinesPerMinute: 0.6,
    calibrationSessions: 0,
    memorizedAyahKeys: [],
    recoveryPreference: 'gentle',
    mushafLayout: 'indopak-16',
    themePreference: 'system',
    arabicTextScale: 1,
    arabicFont: 'uthmanic',
    uiFont: 'sans',
    surahOrder: normalizeSurahOrder([], quranDemoPack),
    maxNewAyahsPerSession: 3,
    hifzStatus: 'partial',
    teacherModeEnabled: false,
    satSabaqCount: 7,
    recentRevisionDays: 14,
    manzilAyahsPerDay: 0,
    revisionGateEnabled: true,
    newSabaqPaused: false,
    lastActiveAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function dueStates(
  count: number,
  strength = 0.3,
  stage: MemoryState['stage'] = 'SABQI',
): MemoryState[] {
  return quranDemoPack.ayahs.slice(0, count).map((ayah, index) => ({
    ayahKey: ayah.key,
    strength: strength + index * 0.05,
    lastReviewedAt: '2026-07-20T00:00:00.000Z',
    nextDueAt: '2026-07-21T00:00:00.000Z',
    hesitationCount: 0,
    hintCount: 0,
    successfulRecalls: 1,
    failedRecalls: 0,
    easeFactor: 2.5,
    intervalDays: 1,
    repetitionCount: 1,
    consecutiveAgainCount: 0,
    isLeech: false,
    stage,
    stageUpdatedAt: '2026-07-20T00:00:00.000Z',
    approvedAt: '2026-07-20T00:00:00.000Z',
    cleanRecallStreak: 1,
    unresolvedMistakes: 0,
  }));
}

describe('buildDailyPlan', () => {
  const now = new Date('2026-07-28T06:00:00.000Z');

  it('starts calibration with a small new portion', () => {
    const result = buildDailyPlan({
      profile: profile(),
      memoryStates: [],
      contentPack: quranDemoPack,
      now,
    });
    expect(result.calibrationDay).toBe(1);
    expect(result.steps.some((step) => step.kind === 'new')).toBe(true);
    expect(result.steps.flatMap((step) => step.ayahKeys).length).toBeLessThanOrEqual(3);
  });

  it('uses recovery mode after missed days', () => {
    const result = buildDailyPlan({
      profile: profile({ lastActiveAt: '2026-07-22T06:00:00.000Z' }),
      memoryStates: dueStates(4),
      contentPack: quranDemoPack,
      now,
    });
    expect(result.isRecoveryPlan).toBe(true);
    expect(result.steps.some((step) => step.kind === 'sabqi')).toBe(true);
  });

  it('keeps a five minute session actionable', () => {
    const result = buildDailyPlan({
      profile: profile({ availableMinutes: 5 }),
      memoryStates: [],
      contentPack: quranDemoPack,
      now,
    });
    expect(result.steps).toHaveLength(1);
    expect(result.estimatedMinutes).toBe(5);
  });

  it('prioritizes the weakest due ayah', () => {
    const states = dueStates(3);
    states[2]!.strength = 0.05;
    const result = buildDailyPlan({
      profile: profile(),
      memoryStates: states,
      contentPack: quranDemoPack,
      now,
    });
    expect(result.steps[0]?.ayahKeys[0]).toBe(states[2]!.ayahKey);
  });

  it('routes a leech into the dedicated weakness-repair step', () => {
    const states = dueStates(3);
    states[2]!.isLeech = true;
    states[2]!.strength = 0.9;
    const result = buildDailyPlan({
      profile: profile(),
      memoryStates: states,
      contentPack: quranDemoPack,
      now,
    });
    const weakness = result.steps.find((step) => step.kind === 'weakness');
    expect(weakness?.ayahKeys).toContain(states[2]!.ayahKey);
    expect(weakness?.hasLeechItems).toBe(true);
  });

  it('blocks new Sabaq when the revision gate is shut and exposes the reason', () => {
    const result = buildDailyPlan({
      profile: profile({ newSabaqPaused: true }),
      memoryStates: dueStates(3),
      contentPack: quranDemoPack,
      now,
    });
    expect(result.revisionGate.blocked).toBe(true);
    expect(result.revisionGate.reason).toBe('teacher-paused');
    expect(result.steps.some((step) => step.kind === 'new')).toBe(false);
  });

  it('keeps the Madrasa step order: manzil -> sabqi -> weakness -> new', () => {
    const states = dueStates(4);
    states[0]!.stage = 'MANZIL';
    states[1]!.isLeech = true;
    const result = buildDailyPlan({
      profile: profile(),
      memoryStates: states,
      contentPack: quranDemoPack,
      now,
    });
    const order = result.steps.map((step) => step.kind);
    const rank = (kind: string) =>
      ['manzil', 'sabqi', 'weakness', 'new'].indexOf(kind);
    expect(order).toEqual([...order].sort((a, b) => rank(a) - rank(b)));
  });
});

describe('scheduleNextReview', () => {
  const now = new Date('2026-07-28T06:00:00.000Z');

  it('grows the interval and ease across consecutive good ratings', () => {
    const first = scheduleNextReview(undefined, 'good', now);
    expect(first.intervalDays).toBe(1);
    expect(first.repetitionCount).toBe(1);

    const second = scheduleNextReview(
      { easeFactor: first.easeFactor, intervalDays: first.intervalDays, repetitionCount: first.repetitionCount, consecutiveAgainCount: 0 },
      'good',
      now,
    );
    expect(second.intervalDays).toBe(3);

    const third = scheduleNextReview(
      { easeFactor: second.easeFactor, intervalDays: second.intervalDays, repetitionCount: second.repetitionCount, consecutiveAgainCount: 0 },
      'good',
      now,
    );
    expect(third.intervalDays).toBeGreaterThan(second.intervalDays);
  });

  it('resets to a short interval on again and lowers ease', () => {
    const warm = scheduleNextReview(
      { easeFactor: 2.5, intervalDays: 6, repetitionCount: 3, consecutiveAgainCount: 0 },
      'again',
      now,
    );
    expect(warm.intervalDays).toBe(1);
    expect(warm.repetitionCount).toBe(0);
    expect(warm.easeFactor).toBeLessThan(2.5);
  });

  it('marks an item as a leech after repeated again ratings', () => {
    let state: Parameters<typeof scheduleNextReview>[0] = undefined;
    let result = scheduleNextReview(state, 'again', now);
    for (let i = 0; i < 3; i += 1) {
      state = result;
      result = scheduleNextReview(state, 'again', now);
    }
    expect(result.consecutiveAgainCount).toBe(4);
    expect(result.isLeech).toBe(true);
  });
});

describe('buildDailyPlan with a pre-migration persisted profile', () => {
  // Simulates a profile saved by an earlier build of the app, before
  // surahOrder/maxNewAyahsPerSession existed -- storage.getProfile() just
  // does `JSON.parse(...) as StudentProfile`, so an old row really does
  // come back missing these keys at runtime despite the static type.
  // provider.tsx's hydrateProfile() is what's supposed to backfill this
  // before it ever reaches buildDailyPlan; this test guards the case
  // where it doesn't (a defensive floor, not a substitute for that fix).
  it('does not throw when surahOrder/maxNewAyahsPerSession are missing', () => {
    const legacyProfile = profile();
    delete (legacyProfile as Partial<StudentProfile>).surahOrder;
    delete (legacyProfile as Partial<StudentProfile>).maxNewAyahsPerSession;

    expect(() =>
      buildDailyPlan({
        profile: legacyProfile,
        memoryStates: [],
        contentPack: quranDemoPack,
        now: new Date('2026-07-28T06:00:00.000Z'),
      }),
    ).not.toThrow();
  });
});

describe('buildDailyPlan surah order + session cap', () => {
  const now = new Date('2026-07-28T06:00:00.000Z');

  it('offers new ayahs from the first surah in the user-chosen order', () => {
    const result = buildDailyPlan({
      profile: profile({ surahOrder: normalizeSurahOrder([93, 78], quranDemoPack) }),
      memoryStates: [],
      contentPack: quranDemoPack,
      now,
    });
    const newStep = result.steps.find((step) => step.kind === 'new');
    expect(newStep?.ayahKeys.every((key) => key.startsWith('93:'))).toBe(true);
  });

  it('moves to the next ordered surah once the first is fully memorized', () => {
    const surah93Keys = quranDemoPack.ayahs
      .filter((a) => a.surahNumber === 93)
      .map((a) => a.key);
    const result = buildDailyPlan({
      profile: profile({
        surahOrder: normalizeSurahOrder([93, 78], quranDemoPack),
        memorizedAyahKeys: surah93Keys,
      }),
      memoryStates: [],
      contentPack: quranDemoPack,
      now,
    });
    const newStep = result.steps.find((step) => step.kind === 'new');
    expect(newStep?.ayahKeys.every((key) => key.startsWith('78:'))).toBe(true);
  });

  it('never offers more new ayahs than the configured per-session cap', () => {
    const result = buildDailyPlan({
      profile: profile({ maxNewAyahsPerSession: 1, availableMinutes: 45 }),
      memoryStates: [],
      contentPack: quranDemoPack,
      now,
    });
    const newStep = result.steps.find((step) => step.kind === 'new');
    expect(newStep?.ayahKeys.length).toBeLessThanOrEqual(1);
  });

  it('names the new step after the first surah in the chosen order', () => {
    const result = buildDailyPlan({
      profile: profile({ surahOrder: normalizeSurahOrder([93, 78], quranDemoPack) }),
      memoryStates: [],
      contentPack: quranDemoPack,
      now,
    });
    const newStep = result.steps.find((step) => step.kind === 'new');
    const surah93 = quranDemoPack.surahs.find((s) => s.number === 93)!;
    expect(newStep?.title).toContain(surah93.nameBn);
  });
});

describe('moveInOrder', () => {
  it('moves an item one step toward the front', () => {
    expect(moveInOrder([1, 2, 3, 4], 2, 1)).toEqual([1, 3, 2, 4]);
  });

  it('jumps an item to the front without dropping or duplicating the rest', () => {
    const result = moveInOrder([10, 20, 30, 40, 50], 3, 0);
    expect(result).toEqual([40, 10, 20, 30, 50]);
    expect(new Set(result).size).toBe(5);
  });

  it('composes across rapid successive moves (no lost updates)', () => {
    let order = [1, 2, 3, 4, 5];
    order = moveInOrder(order, 4, 0);
    order = moveInOrder(order, 4, 0);
    order = moveInOrder(order, 4, 0);
    expect(order).toEqual([3, 4, 5, 1, 2]);
  });

  it('clamps out-of-range indices instead of corrupting the list', () => {
    expect(moveInOrder([1, 2, 3], -5, 99)).toEqual([2, 3, 1]);
    expect(moveInOrder([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
    expect(moveInOrder([], 0, 1)).toEqual([]);
  });

  it('returns a fresh array and never mutates the input', () => {
    const input = [1, 2, 3];
    const result = moveInOrder(input, 0, 2);
    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe('normalizeSurahOrder', () => {
  it('keeps the user-chosen surahs first, in their order', () => {
    const order = normalizeSurahOrder([100, 79], quranDemoPack);
    expect(order.slice(0, 2)).toEqual([100, 79]);
  });

  it('appends every remaining surah exactly once, ascending', () => {
    const order = normalizeSurahOrder([100, 79], quranDemoPack);
    expect(new Set(order).size).toBe(quranDemoPack.surahs.length);
    const remainder = order.slice(2);
    expect(remainder).toEqual([...remainder].sort((a, b) => a - b));
  });

  it('drops duplicate and invalid surah numbers', () => {
    const order = normalizeSurahOrder([78, 78, 9999, -1], quranDemoPack);
    expect(order[0]).toBe(78);
    expect(order).not.toContain(9999);
    expect(order).not.toContain(-1);
    expect(new Set(order).size).toBe(order.length);
  });
});

describe('getPrecedingAyahKeys', () => {
  it('links only to an already learned ayah in the same surah', () => {
    expect(getPrecedingAyahKeys('112:3', quranDemoPack, ['112:1', '112:2', '111:5'])).toEqual([
      '112:2',
    ]);
  });

  it('does not cross a surah boundary', () => {
    expect(getPrecedingAyahKeys('112:1', quranDemoPack, ['111:5'])).toEqual([]);
  });
});
