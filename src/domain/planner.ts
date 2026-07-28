import type {
  AyahKey,
  MemoryState,
  QuranContentPack,
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

const DAY_MS = 24 * 60 * 60 * 1000;

function makeStep(
  kind: SessionStep['kind'],
  title: string,
  ayahKeys: AyahKey[],
  estimatedMinutes: number,
  repetitionTarget: number,
): SessionStep {
  return {
    id: `${kind}-${ayahKeys.join('-') || 'none'}`,
    kind,
    title,
    ayahKeys,
    estimatedMinutes,
    repetitionTarget,
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
    .sort((a, b) => a.strength - b.strength);
  const lastActive = profile.lastActiveAt
    ? new Date(profile.lastActiveAt).getTime()
    : now.getTime();
  const missedDays = Math.max(0, Math.floor((now.getTime() - lastActive) / DAY_MS) - 1);
  const isRecoveryPlan = missedDays >= 2 || due.length >= 6;
  const steps: SessionStep[] = [];

  const warmup = due.slice(0, 1).map((state) => state.ayahKey);
  if (warmup.length > 0) {
    steps.push(makeStep('warmup', 'শান্তভাবে শুরু', warmup, Math.min(3, budget), 2));
  }

  const reviewBudget = isRecoveryPlan ? Math.ceil(budget * 0.75) : Math.ceil(budget * 0.45);
  const reviewKeys = due
    .slice(warmup.length, warmup.length + Math.max(1, Math.floor(reviewBudget / 3)))
    .map((state) => state.ayahKey);

  if (reviewKeys.length > 0) {
    const recentKeys = reviewKeys.slice(0, Math.ceil(reviewKeys.length / 2));
    const olderKeys = reviewKeys.slice(recentKeys.length);
    steps.push(makeStep('sabqi', 'সাম্প্রতিক অংশ ঝালাই', recentKeys, recentKeys.length * 3, 2));
    if (olderKeys.length > 0) {
      steps.push(makeStep('manzil', 'পুরোনো অংশ শক্ত করুন', olderKeys, olderKeys.length * 3, 1));
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
      steps.push(makeStep('new', 'আজকের নতুন হিফজ', newKeys, newMinutes, 5));
    }
  }

  if (steps.length === 0) {
    const fallback = contentPack.ayahs.slice(0, 1).map((ayah) => ayah.key);
    steps.push(makeStep('new', 'আজকের ছোট শুরু', fallback, budget, 5));
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

export function nextReviewDate(
  rating: 'again' | 'hard' | 'good' | 'easy',
  now: Date,
) {
  const intervalDays = { again: 1, hard: 2, good: 4, easy: 7 }[rating];
  return new Date(now.getTime() + intervalDays * DAY_MS).toISOString();
}
