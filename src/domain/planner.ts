import {
  adaptiveSabaqSize,
  buildManzilRotation,
  buildSabqiSet,
  deriveWeakQueue,
  evaluateRevisionGate,
  isMemorizedStage,
  OLD_REVISION_STAGES,
} from './hifz';
import type {
  AyahKey,
  MemoryState,
  MistakeRecord,
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
  /** Persistent mistake ledger -- feeds the weakness step and revision gate. */
  mistakes?: MistakeRecord[];
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

/**
 * Returns a complete, deduplicated surah order: every surah present in
 * `contentPack` appears exactly once. Surahs the user listed come first (in
 * their chosen order); any surah they haven't ordered yet (a fresh profile,
 * or new content added later) is appended afterwards in ascending number
 * order, so new hifz selection always has a well-defined next surah.
 */
export function normalizeSurahOrder(
  order: number[] | undefined | null,
  contentPack: QuranContentPack,
): number[] {
  const validNumbers = new Set(contentPack.surahs.map((surah) => surah.number));
  const seen = new Set<number>();
  const normalized: number[] = [];
  for (const surahNumber of order ?? []) {
    if (validNumbers.has(surahNumber) && !seen.has(surahNumber)) {
      seen.add(surahNumber);
      normalized.push(surahNumber);
    }
  }
  const remaining = contentPack.surahs
    .map((surah) => surah.number)
    .filter((number) => !seen.has(number))
    .sort((a, b) => a - b);
  return [...normalized, ...remaining];
}

/**
 * Pure array move: takes the item at `fromIndex` out and reinserts it at
 * `toIndex`, returning a new array (the input is never mutated). Both
 * indices are clamped into range, so an out-of-bounds call reorders rather
 * than corrupts. This is the single path every surah-order edit goes
 * through -- one step up/down or a jump to the top -- so chained calls
 * always compose instead of racing each other.
 */
export function moveInOrder<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const next = list.slice();
  if (next.length === 0) return next;
  const clamp = (value: number) => Math.max(0, Math.min(next.length - 1, Math.trunc(value)));
  const from = clamp(fromIndex);
  const to = clamp(toIndex);
  const removed = next.splice(from, 1);
  next.splice(to, 0, ...removed);
  return next;
}

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

/** Ayahs already held (either historic flag, or a memorized-stage state). */
function memorizedKeySet(
  profile: StudentProfile,
  memoryStates: MemoryState[],
): Set<AyahKey> {
  const set = new Set<AyahKey>(profile.memorizedAyahKeys);
  for (const state of memoryStates) {
    if (isMemorizedStage(state.stage)) set.add(state.ayahKey);
  }
  return set;
}

/** Next new-Sabaq ayahs: resume a teacher-assigned/in-progress LEARNING run
 * first, then pull fresh from the chosen surah order. */
function pickNewSabaqKeys(
  profile: StudentProfile,
  memoryStates: MemoryState[],
  contentPack: QuranContentPack,
  size: number,
): AyahKey[] {
  if (size <= 0) return [];
  const surahRank = new Map(
    normalizeSurahOrder(profile.surahOrder, contentPack).map(
      (number, index) => [number, index] as const,
    ),
  );
  const orderAyahs = (a: { surahNumber: number; ayahNumber: number }, b: typeof a) => {
    const rankA = surahRank.get(a.surahNumber) ?? Number.MAX_SAFE_INTEGER;
    const rankB = surahRank.get(b.surahNumber) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.ayahNumber - b.ayahNumber;
  };

  const inProgress = new Set(
    memoryStates
      .filter((s) => s.stage === 'LEARNING' || s.stage === 'SABAQ_READY')
      .map((s) => s.ayahKey),
  );
  const memorized = memorizedKeySet(profile, memoryStates);
  const picked = contentPack.ayahs
    .filter((ayah) => inProgress.has(ayah.key))
    .sort(orderAyahs)
    .map((ayah) => ayah.key);

  if (picked.length < size) {
    const fresh = contentPack.ayahs
      .filter((ayah) => !memorized.has(ayah.key) && !inProgress.has(ayah.key))
      .sort(orderAyahs)
      .map((ayah) => ayah.key);
    picked.push(...fresh);
  }
  return picked.slice(0, size);
}

/**
 * Retention-first daily plan. Step order is the Bangladesh/South-Asian
 * Madrasa flow:  Manzil (old revision)  ->  Sabqi / Sat Sabaq  ->  weakness
 * repair  ->  new Sabaq. New Sabaq only appears when the revision gate is
 * open. There is no LLM in this path.
 */
export function buildDailyPlan({
  profile,
  memoryStates,
  contentPack,
  now,
  availableMinutes = profile.availableMinutes,
  mistakes = [],
}: BuildDailyPlanInput): SessionPlan {
  const budget = Math.max(5, Math.min(60, availableMinutes));
  const lastActive = profile.lastActiveAt
    ? new Date(profile.lastActiveAt).getTime()
    : now.getTime();
  const missedDays = Math.max(
    0,
    Math.floor((now.getTime() - lastActive) / DAY_MS) - 1,
  );

  const gate = evaluateRevisionGate({ profile, memoryStates, mistakes, missedDays });
  const isRecoveryPlan =
    missedDays >= 2 ||
    gate.reason === 'weak-backlog' ||
    gate.reason === 'low-retention';

  const leechKeys = new Set(
    memoryStates.filter((state) => state.isLeech).map((state) => state.ayahKey),
  );
  const claimed = new Set<AyahKey>();
  const steps: SessionStep[] = [];

  // Weakness repair claims its ayahs first (targeted repair takes priority
  // over generic rotation), but is *presented* third -- see step order below.
  const weaknessCap = Math.max(1, Math.min(4, Math.floor(budget / 8)));
  const weaknessKeys = deriveWeakQueue({ memoryStates, mistakes }).slice(0, weaknessCap);
  weaknessKeys.forEach((key) => claimed.add(key));

  // 1. Manzil / Amukhta -- continuous old revision, never due-gated.
  const oldCount = memoryStates.filter((s) =>
    OLD_REVISION_STAGES.includes(s.stage),
  ).length;
  const manzilAuto =
    profile.hifzStatus === 'hafiz'
      ? Math.max(10, Math.min(25, Math.round(oldCount * 0.03) || 10))
      : Math.max(3, Math.min(15, Math.round(oldCount * 0.08) || 3));
  const manzilTarget =
    profile.manzilAyahsPerDay > 0 ? profile.manzilAyahsPerDay : manzilAuto;
  const manzilShare = isRecoveryPlan ? 0.55 : 0.4;
  const manzilCap = Math.max(1, Math.floor((budget * manzilShare) / 2));
  const manzilKeys = buildManzilRotation({
    memoryStates,
    limit: Math.min(manzilTarget, manzilCap) + claimed.size,
  })
    .filter((key) => !claimed.has(key))
    .slice(0, Math.min(manzilTarget, manzilCap));
  manzilKeys.forEach((key) => claimed.add(key));
  if (manzilKeys.length > 0) {
    steps.push(
      makeStep(
        'manzil',
        'মনজিল · পুরোনো হিফজ ঝালাই',
        manzilKeys,
        Math.max(2, manzilKeys.length * 2),
        1,
        leechKeys,
      ),
    );
  }

  // 2. Sabqi / Sat Sabaq -- every recent approved lesson, daily.
  const sabqiCap =
    Math.max(1, Math.floor((budget * (isRecoveryPlan ? 0.35 : 0.3)) / 2)) + 3;
  const sabqiKeys = buildSabqiSet({
    memoryStates,
    limit: sabqiCap + claimed.size,
  })
    .filter((key) => !claimed.has(key))
    .slice(0, sabqiCap);
  sabqiKeys.forEach((key) => claimed.add(key));
  if (sabqiKeys.length > 0) {
    steps.push(
      makeStep(
        'sabqi',
        'সবক়ি · সাম্প্রতিক সবক',
        sabqiKeys,
        Math.max(2, sabqiKeys.length * 3),
        2,
        leechKeys,
      ),
    );
  }

  // 3. Weakness repair -- presented after the rotation, worked with more reps.
  if (weaknessKeys.length > 0) {
    steps.push(
      makeStep(
        'weakness',
        'দুর্বল আয়াত মেরামত',
        weaknessKeys,
        weaknessKeys.length * 3,
        4,
        leechKeys,
      ),
    );
  }

  // 4. New Sabaq -- only through the revision gate.
  const usedMinutes = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
  const newMinutes = Math.max(0, budget - usedMinutes);
  if (!gate.blocked && newMinutes >= 5) {
    const capacity =
      profile.calibrationSessions < 7
        ? Math.min(profile.capacityLinesPerMinute, 0.6)
        : profile.capacityLinesPerMinute;
    const size = adaptiveSabaqSize({
      profile,
      gate,
      availableMinutes: newMinutes,
      capacityLinesPerMinute: capacity,
    });
    const newKeys = pickNewSabaqKeys(profile, memoryStates, contentPack, size);
    if (newKeys.length > 0) {
      const firstSurahNumber = Number(newKeys[0]!.split(':')[0]);
      const firstSurahName = contentPack.surahs.find(
        (surah) => surah.number === firstSurahNumber,
      )?.nameBn;
      steps.push(
        makeStep(
          'new',
          firstSurahName ? `${firstSurahName} — নতুন সবক` : 'আজকের নতুন সবক',
          newKeys,
          newMinutes,
          5,
          leechKeys,
        ),
      );
    }
  }

  if (steps.length === 0) {
    const fallback = pickNewSabaqKeys(profile, memoryStates, contentPack, 1);
    const fallbackKeys =
      fallback.length > 0
        ? fallback
        : contentPack.ayahs.slice(0, 1).map((ayah) => ayah.key);
    steps.push(makeStep('new', 'আজকের ছোট শুরু', fallbackKeys, budget, 5, leechKeys));
  }

  return {
    id: `plan-${profile.id}-${now.toISOString().slice(0, 10)}-${budget}`,
    date: now.toISOString().slice(0, 10),
    estimatedMinutes: steps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
    isRecoveryPlan,
    calibrationDay:
      profile.calibrationSessions < 7 ? profile.calibrationSessions + 1 : null,
    steps,
    revisionGate: gate,
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
