import { describe, expect, it } from 'vitest';

import { quranDemoPack } from '@/data/quran-pack';
import {
  adaptiveSabaqSize,
  applyRecallOutcome,
  buildImportedStates,
  classifyHifzHealth,
  deriveWeakQueue,
  evaluateRevisionGate,
  promoteDueSabqiToManzil,
  requestMorePractice,
  resolveMistakesOnCleanStreak,
} from '@/domain/hifz';
import { buildDailyPlan, normalizeSurahOrder } from '@/domain/planner';
import type {
  AyahKey,
  HifzStage,
  MemoryState,
  MistakeRecord,
  MistakeType,
  StudentProfile,
} from '@/domain/types';

const NOW = new Date('2026-08-27T06:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function profile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: 'p1',
    availableMinutes: 25,
    preferredTime: '06:30',
    capacityLinesPerMinute: 0.6,
    calibrationSessions: 7,
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
    lastActiveAt: NOW.toISOString(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function state(ayahKey: AyahKey, overrides: Partial<MemoryState> = {}): MemoryState {
  return {
    ayahKey,
    strength: 0.8,
    lastReviewedAt: NOW.toISOString(),
    nextDueAt: NOW.toISOString(),
    hesitationCount: 0,
    hintCount: 0,
    successfulRecalls: 3,
    failedRecalls: 0,
    easeFactor: 2.5,
    intervalDays: 4,
    repetitionCount: 3,
    consecutiveAgainCount: 0,
    isLeech: false,
    stage: 'MANZIL',
    stageUpdatedAt: NOW.toISOString(),
    approvedAt: new Date(NOW.getTime() - 30 * DAY).toISOString(),
    cleanRecallStreak: 2,
    unresolvedMistakes: 0,
    ...overrides,
  };
}

function mistake(ayahKey: AyahKey, overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  const [surahNumber, ayahNumber] = ayahKey.split(':').map(Number) as [number, number];
  return {
    id: `${ayahKey}-${Math.random()}`,
    ayahKey,
    surahNumber,
    ayahNumber,
    wordPosition: null,
    type: 'SUBSTITUTION' as MistakeType,
    sessionId: 's1',
    occurredAt: NOW.toISOString(),
    source: 'student',
    aiConfidence: null,
    teacherVerified: false,
    resolvedAt: null,
    ...overrides,
  };
}

describe('Sabaq approval -> Sabqi', () => {
  it('a clean recall with no teacher mode approves the Sabaq into SABQI', () => {
    const next = applyRecallOutcome(state('78:1', { stage: 'LEARNING', approvedAt: null }), {
      rating: 'good',
      hints: 0,
      now: NOW,
      teacherModeEnabled: false,
      teacherApproved: false,
    });
    // LEARNING -> SABAQ_READY -> SABQI in one clean pass when there is no teacher.
    expect(next.stage).toBe('SABQI');
    expect(next.approvedAt).toBe(NOW.toISOString());
  });

  it('in teacher mode a clean recall only reaches SABAQ_READY until the teacher approves', () => {
    const ready = applyRecallOutcome(state('78:1', { stage: 'LEARNING', approvedAt: null }), {
      rating: 'good',
      hints: 0,
      now: NOW,
      teacherModeEnabled: true,
      teacherApproved: false,
    });
    expect(ready.stage).toBe('SABAQ_READY');

    const approved = applyRecallOutcome(ready, {
      rating: 'good',
      hints: 0,
      now: NOW,
      teacherModeEnabled: true,
      teacherApproved: true,
    });
    expect(approved.stage).toBe('SABQI');
    expect(approved.approvedAt).toBe(NOW.toISOString());
  });
});

describe('Sabqi -> Manzil', () => {
  it('promotes a SABQI item once it is older than recentRevisionDays', () => {
    const fresh = state('78:2', {
      stage: 'SABQI',
      approvedAt: new Date(NOW.getTime() - 5 * DAY).toISOString(),
    });
    const stale = state('78:3', {
      stage: 'SABQI',
      approvedAt: new Date(NOW.getTime() - 20 * DAY).toISOString(),
    });
    const promoted = promoteDueSabqiToManzil(
      [fresh, stale],
      profile({ recentRevisionDays: 14 }),
      NOW,
    );
    expect(promoted[0]?.stage).toBe('SABQI');
    expect(promoted[1]?.stage).toBe('MANZIL');
  });
});

describe('revision gate', () => {
  it('is open with healthy retention and no backlog', () => {
    const gate = evaluateRevisionGate({
      profile: profile(),
      memoryStates: [state('78:1', { stage: 'SABQI', strength: 0.8 })],
      mistakes: [],
      missedDays: 0,
    });
    expect(gate.blocked).toBe(false);
    expect(gate.reason).toBe('ok');
  });

  it('shuts on a weak-ayah backlog', () => {
    const weakStates = ['78:1', '78:2', '78:3', '78:4', '78:5'].map((k) =>
      state(k as AyahKey, { stage: 'SABQI', strength: 0.3, isLeech: true }),
    );
    const gate = evaluateRevisionGate({
      profile: profile(),
      memoryStates: weakStates,
      mistakes: [],
      missedDays: 0,
    });
    expect(gate.blocked).toBe(true);
    expect(gate.reason).toBe('weak-backlog');
  });

  it('shuts on low Sabqi retention', () => {
    const gate = evaluateRevisionGate({
      profile: profile(),
      memoryStates: [
        state('78:1', { stage: 'SABQI', strength: 0.3 }),
        state('78:2', { stage: 'SABQI', strength: 0.35 }),
      ],
      mistakes: [],
      missedDays: 0,
    });
    expect(gate.blocked).toBe(true);
    expect(gate.reason).toBe('low-retention');
  });
});

describe('teacher override', () => {
  it('revisionGateEnabled=false forces the gate open despite missed days', () => {
    const gate = evaluateRevisionGate({
      profile: profile({ revisionGateEnabled: false }),
      memoryStates: [],
      mistakes: [],
      missedDays: 6,
    });
    expect(gate.blocked).toBe(false);
  });

  it('newSabaqPaused forces the gate shut even when everything is healthy', () => {
    const gate = evaluateRevisionGate({
      profile: profile({ newSabaqPaused: true }),
      memoryStates: [state('78:1', { stage: 'SABQI', strength: 0.9 })],
      mistakes: [],
      missedDays: 0,
    });
    expect(gate.blocked).toBe(true);
    expect(gate.reason).toBe('teacher-paused');
    expect(gate.overridable).toBe(true);
  });
});

describe('weakness creation / resolution', () => {
  it('two unresolved mistakes on an ayah put it in the Weak queue', () => {
    const states = [state('78:1', { stage: 'SABQI' }), state('78:2', { stage: 'SABQI' })];
    const mistakes = [mistake('78:1'), mistake('78:1')];
    expect(deriveWeakQueue({ memoryStates: states, mistakes })).toEqual(['78:1']);
  });

  it('a clean-recall streak resolves the mistakes and clears the ayah from the queue', () => {
    const states = [state('78:1', { stage: 'SABQI' })];
    let mistakes = [mistake('78:1'), mistake('78:1')];
    mistakes = resolveMistakesOnCleanStreak(mistakes, '78:1', 2, NOW);
    expect(deriveWeakQueue({ memoryStates: states, mistakes })).toEqual(['78:1']); // not yet

    mistakes = resolveMistakesOnCleanStreak(mistakes, '78:1', 3, NOW);
    expect(mistakes.every((m) => m.resolvedAt)).toBe(true);
    expect(deriveWeakQueue({ memoryStates: states, mistakes })).toEqual([]);
  });
});

describe('daily plan', () => {
  it('orders steps Manzil -> Sabqi -> Weakness -> New and carries the gate', () => {
    const states: MemoryState[] = [
      state('78:1', { stage: 'MANZIL', strength: 0.85, lastReviewedAt: new Date(NOW.getTime() - 9 * DAY).toISOString() }),
      state('78:2', { stage: 'MANZIL', strength: 0.85, lastReviewedAt: new Date(NOW.getTime() - 8 * DAY).toISOString() }),
      state('93:1', { stage: 'SABQI', strength: 0.8, approvedAt: new Date(NOW.getTime() - 2 * DAY).toISOString() }),
      // weak via repeated mistakes, but retention itself stays healthy so the gate stays open
      state('93:2', { stage: 'SABQI', strength: 0.72, approvedAt: new Date(NOW.getTime() - 2 * DAY).toISOString() }),
    ];
    const plan = buildDailyPlan({
      profile: profile(),
      memoryStates: states,
      mistakes: [mistake('93:2'), mistake('93:2')],
      contentPack: quranDemoPack,
      now: NOW,
    });
    expect(plan.steps.map((s) => s.kind)).toEqual(['manzil', 'sabqi', 'weakness', 'new']);
    expect(plan.revisionGate.blocked).toBe(false);
  });

  it('drops the new step when the gate is blocked', () => {
    const plan = buildDailyPlan({
      profile: profile({ newSabaqPaused: true }),
      memoryStates: [state('93:1', { stage: 'SABQI' })],
      mistakes: [],
      contentPack: quranDemoPack,
      now: NOW,
    });
    expect(plan.steps.some((s) => s.kind === 'new')).toBe(false);
  });
});

describe('missed days', () => {
  it('turns into a recovery plan with no new Sabaq after a gap', () => {
    const plan = buildDailyPlan({
      profile: profile({ lastActiveAt: new Date(NOW.getTime() - 5 * DAY).toISOString() }),
      memoryStates: [state('93:1', { stage: 'SABQI', strength: 0.8 })],
      mistakes: [],
      contentPack: quranDemoPack,
      now: NOW,
    });
    expect(plan.isRecoveryPlan).toBe(true);
    expect(plan.revisionGate.reason).toBe('missed-days');
    expect(plan.steps.some((s) => s.kind === 'new')).toBe(false);
  });
});

describe('existing-Hifz import', () => {
  it('classifies an imported strong range as MAINTENANCE and counts it strong', () => {
    const imported = buildImportedStates({
      contentPack: quranDemoPack,
      surahNumber: 114,
      strength: 'strong',
      now: NOW,
    });
    expect(imported.length).toBe(6);
    expect(imported.every((s) => s.stage === 'MAINTENANCE')).toBe(true);
    const health = classifyHifzHealth({ memoryStates: imported, mistakes: [] });
    expect(health.total).toBe(6);
    expect(health.strong).toBe(6);
  });

  it('classifies a weak imported range into SABQI for real revision', () => {
    const imported = buildImportedStates({
      contentPack: quranDemoPack,
      surahNumber: 113,
      strength: 'weak',
      now: NOW,
    });
    expect(imported.every((s) => s.stage === 'SABQI')).toBe(true);
  });
});

describe('completed-Hafiz mode', () => {
  it('never opens the revision gate and is not overridable', () => {
    const gate = evaluateRevisionGate({
      profile: profile({ hifzStatus: 'hafiz' }),
      memoryStates: [state('78:1', { stage: 'MAINTENANCE' })],
      mistakes: [],
      missedDays: 0,
    });
    expect(gate.blocked).toBe(true);
    expect(gate.reason).toBe('completed-hafiz');
    expect(gate.overridable).toBe(false);
  });

  it('a Hafiz daily plan is Muraja’ah only: rotation but no new Sabaq', () => {
    const hafizStates = quranDemoPack.ayahs
      .filter((a) => a.surahNumber === 114 || a.surahNumber === 113)
      .map((a) =>
        state(a.key, {
          stage: 'MAINTENANCE',
          lastReviewedAt: new Date(NOW.getTime() - 10 * DAY).toISOString(),
        }),
      );
    const plan = buildDailyPlan({
      profile: profile({ hifzStatus: 'hafiz' }),
      memoryStates: hafizStates,
      mistakes: [],
      contentPack: quranDemoPack,
      now: NOW,
    });
    expect(plan.steps.some((s) => s.kind === 'new')).toBe(false);
    expect(plan.steps.some((s) => s.kind === 'manzil')).toBe(true);
  });
});

describe('adaptive Sabaq size', () => {
  it('reduces on weak retention and grows on strong retention', () => {
    const base = profile({ maxNewAyahsPerSession: 3, calibrationSessions: 7 });
    const weak = adaptiveSabaqSize({
      profile: base,
      gate: {
        blocked: false,
        reason: 'ok',
        weakCount: 3,
        sabqiRetention: 0.5,
        manzilRetention: 0.5,
        overridable: true,
      },
      availableMinutes: 20,
      capacityLinesPerMinute: 0.8,
    });
    const strong = adaptiveSabaqSize({
      profile: base,
      gate: {
        blocked: false,
        reason: 'ok',
        weakCount: 0,
        sabqiRetention: 0.9,
        manzilRetention: 0.9,
        overridable: true,
      },
      availableMinutes: 20,
      capacityLinesPerMinute: 0.8,
    });
    expect(weak).toBeLessThan(3);
    expect(strong).toBeGreaterThan(3);
  });

  it('returns 0 when the gate is blocked', () => {
    expect(
      adaptiveSabaqSize({
        profile: profile(),
        gate: {
          blocked: true,
          reason: 'missed-days',
          weakCount: 0,
          sabqiRetention: 1,
          manzilRetention: 1,
          overridable: true,
        },
        availableMinutes: 30,
        capacityLinesPerMinute: 1,
      }),
    ).toBe(0);
  });
});

describe('teacher requests more practice', () => {
  it('sends a SABAQ_READY item back to LEARNING and resets the clean streak', () => {
    const ready = state('78:3', { stage: 'SABAQ_READY', cleanRecallStreak: 2 });
    const next = requestMorePractice(ready, NOW);
    expect(next.stage).toBe('LEARNING');
    expect(next.cleanRecallStreak).toBe(0);
    expect(next.stageUpdatedAt).toBe(NOW.toISOString());
  });

  it('is a no-op outside SABAQ_READY', () => {
    const sabqi = state('78:4', { stage: 'SABQI', cleanRecallStreak: 2 });
    expect(requestMorePractice(sabqi, NOW)).toBe(sabqi);
  });
});

// Reference so the HifzStage import is exercised by the type-checker.
const _stages: HifzStage[] = ['UNSEEN', 'SABQI', 'MANZIL'];
void _stages;
