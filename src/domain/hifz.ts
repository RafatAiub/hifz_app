/**
 * Deterministic, traditional-Madrasa Hifz rules -- the single centralized,
 * testable place for the retention-first lifecycle. No LLM calls, no dates
 * pulled from anywhere but the `now` passed in.
 *
 *   Retention  > speed
 *   Revision   > new memorization
 *   Teacher    > AI
 *   Sabqi/Manzil rules > SM-2 (SM-2 only schedules *within* what these rules
 *                        already allow)
 *
 * planner.ts consumes these selectors to assemble the daily plan; provider.ts
 * applies the transitions when a session completes.
 */
import type {
  AyahKey,
  HifzHealth,
  HifzStage,
  MemoryState,
  MistakeRecord,
  QuranContentPack,
  RecallRating,
  RevisionGateState,
  StudentProfile,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_SAT_SABAQ_COUNT = 7;
export const DEFAULT_RECENT_REVISION_DAYS = 14;
/** Unresolved mistakes on one ayah that push it into the Weak-Ayah queue. */
export const WEAK_MISTAKE_THRESHOLD = 2;
/** Clean recalls (no hint, not "again") needed to clear a weak ayah. */
export const WEAK_CLEAR_STREAK = 3;
/** Weak-queue size that blocks new Sabaq (revision/recovery day instead). */
export const WEAK_BACKLOG_LIMIT = 5;
export const SABQI_RETENTION_FLOOR = 0.6;
export const MANZIL_RETENTION_FLOOR = 0.55;
export const STRONG_STRENGTH = 0.75;

/** Stages that count as "memorized" (Sabaq has been locked in). */
export const MEMORIZED_STAGES: HifzStage[] = [
  'SABAQ_APPROVED',
  'SABQI',
  'MANZIL',
  'MAINTENANCE',
];
/** Continuous old-revision rotation -- never gated by nextDueAt. */
export const OLD_REVISION_STAGES: HifzStage[] = ['MANZIL', 'MAINTENANCE'];

export function isMemorizedStage(stage: HifzStage): boolean {
  return MEMORIZED_STAGES.includes(stage);
}

function iso(now: Date): string {
  return now.toISOString();
}

// ---------------------------------------------------------------------------
// Migration / import
// ---------------------------------------------------------------------------

/**
 * Backfills the lifecycle fields on a MemoryState persisted by an earlier
 * build (storage does `JSON.parse(...) as MemoryState`, so an old row really
 * is missing `stage` etc. at runtime). A pre-lifecycle state only ever
 * existed for an ayah the student had reviewed, so it is treated as old
 * revision (MANZIL) unless it was clearly still being learned.
 */
export function migrateMemoryState(
  raw: Partial<MemoryState> & { ayahKey: AyahKey },
  opts: { memorized: boolean; now: Date },
): MemoryState {
  const strength = raw.strength ?? 0.5;
  const stage: HifzStage =
    raw.stage ??
    (opts.memorized
      ? inferStageFromStrength(strength)
      : strength > 0
        ? 'LEARNING'
        : 'UNSEEN');
  return {
    ayahKey: raw.ayahKey,
    strength,
    lastReviewedAt: raw.lastReviewedAt ?? null,
    nextDueAt: raw.nextDueAt ?? iso(opts.now),
    hesitationCount: raw.hesitationCount ?? 0,
    hintCount: raw.hintCount ?? 0,
    successfulRecalls: raw.successfulRecalls ?? 0,
    failedRecalls: raw.failedRecalls ?? 0,
    easeFactor: raw.easeFactor ?? 2.5,
    intervalDays: raw.intervalDays ?? 1,
    repetitionCount: raw.repetitionCount ?? 0,
    consecutiveAgainCount: raw.consecutiveAgainCount ?? 0,
    isLeech: raw.isLeech ?? false,
    stage,
    stageUpdatedAt: raw.stageUpdatedAt ?? iso(opts.now),
    approvedAt:
      raw.approvedAt ?? (isMemorizedStage(stage) ? iso(opts.now) : null),
    cleanRecallStreak: raw.cleanRecallStreak ?? 0,
    unresolvedMistakes: raw.unresolvedMistakes ?? 0,
  };
}

export type ImportStrength = 'strong' | 'medium' | 'weak' | 'unknown';

const IMPORT_STRENGTH_VALUE: Record<ImportStrength, number> = {
  strong: 0.85,
  medium: 0.62,
  weak: 0.38,
  unknown: 0.5,
};

export function inferStageFromStrength(strength: number): HifzStage {
  if (strength >= STRONG_STRENGTH) return 'MAINTENANCE';
  if (strength < 0.45) return 'SABQI';
  return 'MANZIL';
}

/**
 * Turns an existing-Hifz range (a partially-memorized student or a completed
 * Hafiz importing what they already hold) into MemoryStates classified
 * strong / medium / weak / unknown. Completed Huffaz land in MAINTENANCE so
 * the daily flow becomes Muraja'ah, never new Sabaq.
 */
export function buildImportedStates(input: {
  contentPack: QuranContentPack;
  surahNumber: number;
  fromAyah?: number;
  toAyah?: number;
  strength: ImportStrength;
  hifzStatus?: StudentProfile['hifzStatus'];
  now: Date;
}): MemoryState[] {
  const from = input.fromAyah ?? 1;
  const to = input.toAyah ?? Number.MAX_SAFE_INTEGER;
  const value = IMPORT_STRENGTH_VALUE[input.strength];
  const stage: HifzStage =
    input.hifzStatus === 'hafiz'
      ? 'MAINTENANCE'
      : input.strength === 'strong'
        ? 'MAINTENANCE'
        : input.strength === 'weak'
          ? 'SABQI'
          : 'MANZIL';
  return input.contentPack.ayahs
    .filter(
      (ayah) =>
        ayah.surahNumber === input.surahNumber &&
        ayah.ayahNumber >= from &&
        ayah.ayahNumber <= to,
    )
    .map((ayah) => ({
      ayahKey: ayah.key,
      strength: value,
      lastReviewedAt: null,
      nextDueAt: iso(input.now),
      hesitationCount: 0,
      hintCount: 0,
      successfulRecalls: input.strength === 'weak' ? 0 : 1,
      failedRecalls: 0,
      easeFactor: 2.5,
      intervalDays: 1,
      repetitionCount: 1,
      consecutiveAgainCount: 0,
      isLeech: false,
      stage,
      stageUpdatedAt: iso(input.now),
      approvedAt: new Date(
        input.now.getTime() -
          (DEFAULT_RECENT_REVISION_DAYS + 1) * DAY_MS,
      ).toISOString(),
      cleanRecallStreak: 0,
      unresolvedMistakes: 0,
    }));
}

// ---------------------------------------------------------------------------
// Weak-Ayah queue + mistake ledger
// ---------------------------------------------------------------------------

export function unresolvedMistakeCountByAyah(
  mistakes: MistakeRecord[],
): Map<AyahKey, number> {
  const counts = new Map<AyahKey, number>();
  for (const m of mistakes) {
    if (m.resolvedAt) continue;
    counts.set(m.ayahKey, (counts.get(m.ayahKey) ?? 0) + 1);
  }
  return counts;
}

/**
 * Ayahs that need targeted repair: a leech, or >= WEAK_MISTAKE_THRESHOLD
 * unresolved mistakes. Weakest first. Repeated mistakes therefore feed the
 * queue automatically; a weak item only leaves once it is resolved (see
 * resolveMistakesOnCleanStreak) -- i.e. after repeated clean recalls.
 */
export function deriveWeakQueue(input: {
  memoryStates: MemoryState[];
  mistakes: MistakeRecord[];
}): AyahKey[] {
  const counts = unresolvedMistakeCountByAyah(input.mistakes);
  return input.memoryStates
    .filter((s) => {
      const mistakeCount = counts.get(s.ayahKey) ?? s.unresolvedMistakes ?? 0;
      return s.isLeech || mistakeCount >= WEAK_MISTAKE_THRESHOLD;
    })
    .filter((s) => s.stage !== 'UNSEEN')
    .sort((a, b) => a.strength - b.strength)
    .map((s) => s.ayahKey);
}

/**
 * Marks every unresolved mistake on `ayahKey` resolved once the student has
 * strung together WEAK_CLEAR_STREAK clean recalls. Returns the ledger
 * unchanged below that threshold.
 */
export function resolveMistakesOnCleanStreak(
  mistakes: MistakeRecord[],
  ayahKey: AyahKey,
  cleanRecallStreak: number,
  now: Date,
): MistakeRecord[] {
  if (cleanRecallStreak < WEAK_CLEAR_STREAK) return mistakes;
  let changed = false;
  const next = mistakes.map((m) => {
    if (m.ayahKey === ayahKey && !m.resolvedAt) {
      changed = true;
      return { ...m, resolvedAt: iso(now) };
    }
    return m;
  });
  return changed ? next : mistakes;
}

// ---------------------------------------------------------------------------
// Retention + revision gate
// ---------------------------------------------------------------------------

function retentionForStages(
  memoryStates: MemoryState[],
  stages: HifzStage[],
): number {
  const inScope = memoryStates.filter((s) => stages.includes(s.stage));
  if (inScope.length === 0) return 1;
  return inScope.reduce((sum, s) => sum + s.strength, 0) / inScope.length;
}

/**
 * The revision gate. New Sabaq is NOT automatically available: a weak Sabqi/
 * Manzil, a weak-ayah backlog, or missed days turn today into a revision/
 * recovery day. The teacher always wins -- `newSabaqPaused` forces the gate
 * shut, `revisionGateEnabled: false` forces it open. A completed Hafiz never
 * gets new Sabaq (Muraja'ah only).
 */
export function evaluateRevisionGate(input: {
  profile: StudentProfile;
  memoryStates: MemoryState[];
  mistakes: MistakeRecord[];
  missedDays: number;
}): RevisionGateState {
  const { profile } = input;
  const weakCount = deriveWeakQueue(input).length;
  const sabqiRetention = retentionForStages(input.memoryStates, ['SABQI']);
  const manzilRetention = retentionForStages(
    input.memoryStates,
    OLD_REVISION_STAGES,
  );
  const base = { weakCount, sabqiRetention, manzilRetention };

  if (profile.hifzStatus === 'hafiz') {
    return { blocked: true, reason: 'completed-hafiz', overridable: false, ...base };
  }
  if (profile.newSabaqPaused) {
    return { blocked: true, reason: 'teacher-paused', overridable: true, ...base };
  }
  if (profile.revisionGateEnabled === false) {
    return { blocked: false, reason: 'ok', overridable: true, ...base };
  }
  if (input.missedDays >= 2) {
    return { blocked: true, reason: 'missed-days', overridable: true, ...base };
  }
  if (weakCount >= WEAK_BACKLOG_LIMIT) {
    return { blocked: true, reason: 'weak-backlog', overridable: true, ...base };
  }
  if (
    sabqiRetention < SABQI_RETENTION_FLOOR ||
    manzilRetention < MANZIL_RETENTION_FLOOR
  ) {
    return { blocked: true, reason: 'low-retention', overridable: true, ...base };
  }
  return { blocked: false, reason: 'ok', overridable: true, ...base };
}

/**
 * Deterministic adaptive Sabaq size. Strong retention + no weak backlog +
 * calibration finished can nudge the lesson one ayah larger; weak retention
 * or a weak backlog nudges it smaller. Always clamped by available time and
 * (during the 7-session calibration) held small.
 */
export function adaptiveSabaqSize(input: {
  profile: StudentProfile;
  gate: RevisionGateState;
  availableMinutes: number;
  capacityLinesPerMinute: number;
}): number {
  const { profile, gate } = input;
  if (gate.blocked) return 0;

  let size = Math.max(1, profile.maxNewAyahsPerSession || 3);
  if (gate.sabqiRetention < 0.7 || gate.manzilRetention < 0.65) {
    size = Math.max(1, size - 1);
  }
  if (gate.weakCount >= 3) size = Math.max(1, size - 1);
  if (
    gate.sabqiRetention >= 0.85 &&
    gate.manzilRetention >= 0.8 &&
    gate.weakCount === 0 &&
    profile.calibrationSessions >= 7
  ) {
    size += 1;
  }
  if (profile.calibrationSessions < 7) size = Math.min(size, 3);

  const timeCap = Math.max(
    1,
    Math.floor((input.availableMinutes * input.capacityLinesPerMinute) / 2),
  );
  return Math.max(1, Math.min(size, timeCap, 8));
}

// ---------------------------------------------------------------------------
// Rotation selectors (traditional daily flow)
// ---------------------------------------------------------------------------

function numericKeyCompare(a: AyahKey, b: AyahKey): number {
  const [as, aa] = a.split(':').map(Number) as [number, number];
  const [bs, ba] = b.split(':').map(Number) as [number, number];
  return as - bs || aa - ba;
}

/**
 * Continuous old-revision rotation (Amukhta / Manzil / Dawr): the MANZIL and
 * MAINTENANCE ayahs revised least recently, up to `limit`. Deliberately NOT
 * filtered by nextDueAt, so old memorization keeps cycling no matter how much
 * new Sabaq the student adds.
 */
export function buildManzilRotation(input: {
  memoryStates: MemoryState[];
  limit: number;
}): AyahKey[] {
  if (input.limit <= 0) return [];
  return input.memoryStates
    .filter((s) => OLD_REVISION_STAGES.includes(s.stage))
    .sort((a, b) => {
      const ta = a.lastReviewedAt ? Date.parse(a.lastReviewedAt) : 0;
      const tb = b.lastReviewedAt ? Date.parse(b.lastReviewedAt) : 0;
      if (ta !== tb) return ta - tb;
      return numericKeyCompare(a.ayahKey, b.ayahKey);
    })
    .slice(0, input.limit)
    .map((s) => s.ayahKey);
}

/**
 * Sabqi / Sat Sabaq: the recent approved lessons, all revised daily. SABQI
 * stage already *is* the recent-revision window (promoteDueSabqiToManzil
 * ages items out after profile.recentRevisionDays), so this lists them all;
 * `limit` is only a session-length safety valve and drops the strongest
 * (closest to graduating to Manzil) first.
 */
export function buildSabqiSet(input: {
  memoryStates: MemoryState[];
  limit: number;
}): AyahKey[] {
  if (input.limit <= 0) return [];
  return input.memoryStates
    .filter((s) => s.stage === 'SABQI' || s.stage === 'SABAQ_APPROVED')
    .sort((a, b) => {
      if (a.isLeech !== b.isLeech) return a.isLeech ? -1 : 1;
      if (a.strength !== b.strength) return a.strength - b.strength;
      return numericKeyCompare(a.ayahKey, b.ayahKey);
    })
    .slice(0, input.limit)
    .map((s) => s.ayahKey);
}

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

export interface RecallInput {
  rating: RecallRating;
  hints: number;
  now: Date;
  teacherModeEnabled: boolean;
  /** Explicit teacher approval of this ayah's Sabaq in this session. */
  teacherApproved: boolean;
}

/**
 * Advances the lifecycle stage for one ayah after a recall. SM-2 scheduling
 * is applied separately (planner.scheduleNextReview) -- this only moves the
 * traditional stage:
 *
 *   UNSEEN/LEARNING  --clean-->  SABAQ_READY
 *   SABAQ_READY      --approved-->  SABQI (+approvedAt)   [approved =
 *                     teacher approval in teacher mode, else a clean recall]
 *   MAINTENANCE      --"again"-->  SABQI  (dropped back for real revision)
 *
 * SABQI -> MANZIL is time-based, not recall-based -- see
 * promoteDueSabqiToManzil.
 */
export function applyRecallOutcome(
  state: MemoryState,
  input: RecallInput,
): MemoryState {
  const clean = input.rating !== 'again' && input.hints === 0;
  const cleanRecallStreak = clean ? state.cleanRecallStreak + 1 : 0;
  let stage = state.stage;
  let approvedAt = state.approvedAt;

  if (stage === 'UNSEEN' || stage === 'LEARNING') {
    stage = clean ? 'SABAQ_READY' : 'LEARNING';
  }
  if (stage === 'SABAQ_READY' || stage === 'SABAQ_APPROVED') {
    const approved = input.teacherModeEnabled ? input.teacherApproved : clean;
    if (approved) {
      stage = 'SABQI';
      approvedAt = approvedAt ?? iso(input.now);
    } else if (stage === 'SABAQ_APPROVED') {
      stage = 'SABQI';
      approvedAt = approvedAt ?? iso(input.now);
    }
  }
  if (stage === 'MAINTENANCE' && input.rating === 'again') {
    stage = 'SABQI';
  }

  return {
    ...state,
    stage,
    stageUpdatedAt:
      stage === state.stage ? state.stageUpdatedAt : iso(input.now),
    approvedAt,
    cleanRecallStreak,
  };
}

/** Teacher action: approve a ready Sabaq now (moves it straight to SABQI). */
export function approveSabaq(state: MemoryState, now: Date): MemoryState {
  if (state.stage === 'SABQI' || OLD_REVISION_STAGES.includes(state.stage)) {
    return state;
  }
  return {
    ...state,
    stage: 'SABQI',
    stageUpdatedAt: iso(now),
    approvedAt: state.approvedAt ?? iso(now),
  };
}

/**
 * Teacher action: sends a ready-but-not-yet-solid Sabaq back for more
 * practice instead of approving it. Resets the clean-recall streak so the
 * next attempt has to re-earn a clean run, but keeps mistake history and
 * `approvedAt` untouched (it hasn't been approved yet). No-op outside
 * SABAQ_READY -- a teacher can only ask for more practice on something
 * actually waiting for review.
 */
export function requestMorePractice(state: MemoryState, now: Date): MemoryState {
  if (state.stage !== 'SABAQ_READY') return state;
  return {
    ...state,
    stage: 'LEARNING',
    stageUpdatedAt: iso(now),
    cleanRecallStreak: 0,
  };
}

/**
 * Ages SABQI items into MANZIL once they have been approved longer than
 * profile.recentRevisionDays. This is what makes Sabqi and Manzil one
 * pipeline instead of two hand-maintained lists.
 */
export function promoteDueSabqiToManzil(
  states: MemoryState[],
  profile: StudentProfile,
  now: Date,
): MemoryState[] {
  const windowMs =
    (profile.recentRevisionDays || DEFAULT_RECENT_REVISION_DAYS) * DAY_MS;
  let changed = false;
  const next = states.map((s) => {
    if (
      s.stage === 'SABQI' &&
      s.approvedAt &&
      now.getTime() - Date.parse(s.approvedAt) >= windowMs
    ) {
      changed = true;
      return { ...s, stage: 'MANZIL' as HifzStage, stageUpdatedAt: iso(now) };
    }
    return s;
  });
  return changed ? next : states;
}

// ---------------------------------------------------------------------------
// Hifz Health (no fake precision)
// ---------------------------------------------------------------------------

export function classifyHifzHealth(input: {
  memoryStates: MemoryState[];
  mistakes: MistakeRecord[];
}): HifzHealth {
  const weak = new Set(deriveWeakQueue(input));
  const memorized = input.memoryStates.filter(
    (s) => isMemorizedStage(s.stage),
  );
  let strong = 0;
  let needsRevision = 0;
  let weakCount = 0;
  for (const s of memorized) {
    if (weak.has(s.ayahKey)) {
      weakCount += 1;
    } else if (
      s.strength >= STRONG_STRENGTH &&
      OLD_REVISION_STAGES.includes(s.stage)
    ) {
      strong += 1;
    } else {
      needsRevision += 1;
    }
  }
  return { total: memorized.length, strong, needsRevision, weak: weakCount };
}
