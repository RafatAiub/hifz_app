import { describe, expect, it } from 'vitest';

import { quranDemoPack } from '@/data/quran-pack';
import { buildDailyPlan } from '@/domain/planner';
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
    mushafLayout: 'indopak-13',
    lastActiveAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function dueStates(count: number, strength = 0.3): MemoryState[] {
  return quranDemoPack.ayahs.slice(0, count).map((ayah, index) => ({
    ayahKey: ayah.key,
    strength: strength + index * 0.05,
    lastReviewedAt: '2026-07-20T00:00:00.000Z',
    nextDueAt: '2026-07-21T00:00:00.000Z',
    hesitationCount: 0,
    hintCount: 0,
    successfulRecalls: 1,
    failedRecalls: 0,
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
});
