import type {
  AyahKey,
  MemoryState,
  QuranContentPack,
  RecallRating,
  SessionPlan,
  SessionStep,
  StudentProfile,
} from './types';

export interface BuildDailyPlanInput {
  profile: StudentProfile;
  memoryStates: MemoryState[];
  contentPack: QuranContentPack;
  now: Date;
  availableMinutes?: number;
}

export function getPrecedingAyahKeys(
  ayahKey: AyahKey,
  contentPack: QuranContentPack,
  allowedKeys: Iterable<AyahKey>,
  count = 1,
): AyahKey[] {
  const current = contentPack.ayahs.find((ayah) => ayah.key === ayahKey);
  if (!current || count <= 0) return [];
  const allowed = new Set(allowedKeys);
  return contentPack.ayahs
    .filter(
      (ayah) =>
        ayah.surahNumber === current.surahNumber &&
        ayah.ayahNumber < current.ayahNumber &&
        allowed.has(ayah.key),
    )
    .sort((a, b) => b.ayahNumber - a.ayahNumber)
    .slice(0, count)
    .reverse()
    .map((ayah) => ayah.key);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function makeStep(
  kind: SessionStep['kind'],
  title: string,
  ayahKeys: AyahKey[],
  estimatedMinutes: number,
  repetitionTarget: number,
  leechKeys: Set<AyahKey>,
): SessionStep {
  return {
    id: `${kind}-${ayahKeys.join('-') || 'none'}`,
    kind,
    title,
    ayahKeys,
    estimatedMinutes,
    repetitionTarget,
    hasLeechItems: ayahKeys.some((key) => leechKeys.has(key)),
  };
}

export function buildDailyPlan({
  profile,
  memoryStates,
  contentPack,
  now,
  availableMinutes = profile.availableMinutes,
}: BuildDailyPlanInput): SessionPlan {
  const budget = Math.max(5, Math.min(60, availableMinutes));
  const due = memoryStates
    .filter((state) => new Date(state.nextDueAt).getTime() <= now.getTime())
    .sort((a, b) => {
      if (a.isLeech !== b.isLeech) return a.isLeech ? -1 : 1;
      return a.strength - b.strength;
    });
  const lastActive = profile.lastActiveAt
    ? new Date(profile.lastActiveAt).getTime()
    : now.getTime();
  const missedDays = Math.max(0, Math.floor((now.getTime() - lastActive) / DAY_MS) - 1);
  const isRecoveryPlan = missedDays >= 2 || due.length >= 6;
  const steps: SessionStep[] = [];
  const leechKeys = new Set(
    memoryStates.filter((state) => state.isLeech).map((state) => state.ayahKey),
  );

  const warmup = due.slice(0, 1).map((state) => state.ayahKey);
  if (warmup.length > 0) {
    steps.push(makeStep('warmup', 'শান্তভাবে শুরু', warmup, Math.min(3, budget), 2, leechKeys));
  }

  const reviewBudget = isRecoveryPlan ? Math.ceil(budget * 0.75) : Math.ceil(budget * 0.45);
  const reviewKeys = due
    .slice(warmup.length, warmup.length + Math.max(1, Math.floor(reviewBudget / 3)))
    .map((state) => state.ayahKey);

  if (reviewKeys.length > 0) {
    const recentKeys = reviewKeys.slice(0, Math.ceil(reviewKeys.length / 2));
    const olderKeys = reviewKeys.slice(recentKeys.length);
    steps.push(
      makeStep('sabqi', 'সাম্প্রতিক অংশ ঝালাই', recentKeys, recentKeys.length * 3, 2, leechKeys),
    );
    if (olderKeys.length > 0) {
      steps.push(
        makeStep('manzil', 'পুরোনো অংশ শক্ত করুন', olderKeys, olderKeys.length * 3, 1, leechKeys),
      );
    }
  }

  const usedMinutes = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
  const newMinutes = Math.max(0, budget - usedMinutes);
  const canAddNew = !isRecoveryPlan || due.length < 4;

  if (canAddNew && newMinutes >= 5) {
    const memorized = new Set(profile.memorizedAyahKeys);
    const capacity = profile.calibrationSessions < 7
      ? Math.min(profile.capacityLinesPerMinute, 0.6)
      : profile.capacityLinesPerMinute;
    const maxNewAyahs = Math.max(1, Math.min(3, Math.floor((newMinutes * capacity) / 2)));
    const newKeys = contentPack.ayahs
      .filter((ayah) => !memorized.has(ayah.key))
      .slice(0, maxNewAyahs)
      .map((ayah) => ayah.key);

    if (newKeys.length > 0) {
      steps.push(makeStep('new', 'আজকের নতুন হিফজ', newKeys, newMinutes, 5, leechKeys));
    }
  }

  if (steps.length === 0) {
    const fallback = contentPack.ayahs.slice(0, 1).map((ayah) => ayah.key);
    steps.push(makeStep('new', 'আজকের ছোট শুরু', fallback, budget, 5, leechKeys));
  }

  return {
    id: `plan-${profile.id}-${now.toISOString().slice(0, 10)}-${budget}`,
    date: now.toISOString().slice(0, 10),
    estimatedMinutes: steps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
    isRecoveryPlan,
    calibrationDay: profile.calibrationSessions < 7 ? profile.calibrationSessions + 1 : null,
    steps,
  };
}

const MIN_EASE_FACTOR = 1.3;
const MAX_EASE_FACTOR = 3.2;
const DEFAULT_EASE_FACTOR = 2.5;
const LEECH_THRESHOLD = 4;

const EASE_DELTA: Record<RecallRating, number> = {
  again: -0.3,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

const INTERVAL_MULTIPLIER: Record<RecallRating, number> = {
  again: 1,
  hard: 0.8,
  good: 1,
  easy: 1.3,
};

export interface ScheduleResult {
  easeFactor: number;
  intervalDays: number;
  nextDueAt: string;
  repetitionCount: number;
  consecutiveAgainCount: number;
  isLeech: boolean;
}

/**
 * SM-2 derived scheduler: ease factor shifts per rating, interval grows
 * multiplicatively once past the initial learning steps, and `again`
 * resets the item to a short interval instead of erasing history.
 */
export function scheduleNextReview(
  state: Pick<
    MemoryState,
    'easeFactor' | 'intervalDays' | 'repetitionCount' | 'consecutiveAgainCount'
  > | undefined,
  rating: RecallRating,
  now: Date,
): ScheduleResult {
  const easeFactor = state?.easeFactor ?? DEFAULT_EASE_FACTOR;
  const previousInterval = state?.intervalDays ?? 0;
  const previousRepetitions = state?.repetitionCount ?? 0;

  if (rating === 'again') {
    const nextEase = Math.max(MIN_EASE_FACTOR, easeFactor + EASE_DELTA.again);
    const consecutiveAgainCount = (state?.consecutiveAgainCount ?? 0) + 1;
    return {
      easeFactor: nextEase,
      intervalDays: 1,
      nextDueAt: new Date(now.getTime() + DAY_MS).toISOString(),
      repetitionCount: 0,
      consecutiveAgainCount,
      isLeech: consecutiveAgainCount >= LEECH_THRESHOLD,
    };
  }

  const nextEase = Math.min(
    MAX_EASE_FACTOR,
    Math.max(MIN_EASE_FACTOR, easeFactor + EASE_DELTA[rating]),
  );
  const repetitionCount = previousRepetitions + 1;

  let intervalDays: number;
  if (repetitionCount === 1) {
    intervalDays = 1;
  } else if (repetitionCount === 2) {
    intervalDays = rating === 'hard' ? 2 : rating === 'easy' ? 4 : 3;
  } else {
    intervalDays = Math.round(
      Math.max(1, previousInterval) * nextEase * INTERVAL_MULTIPLIER[rating],
    );
  }

  return {
    easeFactor: nextEase,
    intervalDays,
    nextDueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    repetitionCount,
    consecutiveAgainCount: 0,
    isLeech: false,
  };
}
