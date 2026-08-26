import { randomUUID } from 'expo-crypto';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { quranDemoPack } from '@/data/quran-pack';
import { buildDailyPlan, normalizeSurahOrder, scheduleNextReview } from '@/domain/planner';
import {
  computeMilestones,
  computeStreak,
  computeSurahForecasts,
  computeSurahProgress,
  computeVelocity,
} from '@/domain/stats';
import type {
  AyahKey,
  AyahOutcome,
  HifzVelocity,
  MemoryState,
  Milestone,
  RecallRating,
  SessionEvent,
  SessionPlan,
  StreakState,
  StudentProfile,
  SurahTestResult,
  SurahForecast,
  SurahProgress,
} from '@/domain/types';
import { createStorageRepository } from '@/storage/create-repository';
import type { StorageRepository } from '@/storage/repository';

interface AppStats {
  completedSessions: number;
  memorizedAyahs: number;
  reviewStrength: number;
  streak: StreakState;
  surahProgress: SurahProgress[];
  milestones: Milestone[];
  velocity: HifzVelocity;
  surahForecasts: SurahForecast[];
}

interface AppContextValue {
  ready: boolean;
  profile: StudentProfile | null;
  plan: SessionPlan | null;
  stats: AppStats;
  repository: StorageRepository;
  setAvailableMinutes(minutes: number): Promise<void>;
  setThemePreference(preference: StudentProfile['themePreference']): Promise<void>;
  setArabicTextScale(scale: number): Promise<void>;
  setArabicFont(font: StudentProfile['arabicFont']): Promise<void>;
  setUiFont(font: StudentProfile['uiFont']): Promise<void>;
  setSurahOrder(order: number[]): Promise<void>;
  setMaxNewAyahsPerSession(count: number): Promise<void>;
  setSurahMemorized(surahNumber: number, memorized: boolean): Promise<void>;
  refreshPlan(minutes?: number): void;
  completeSession(input: {
    rating: RecallRating;
    repetitions: number;
    hints: number;
    recordingUri: string | null;
    newAyahKeys: AyahKey[];
    ayahOutcomes?: AyahOutcome[];
    surahTest?: SurahTestResult | null;
  }): Promise<void>;
}

const repository = createStorageRepository();
const AppContext = createContext<AppContextValue | null>(null);

function makeDefaultProfile(now: Date): StudentProfile {
  const iso = now.toISOString();
  return {
    id: randomUUID(),
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
    lastActiveAt: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

/**
 * Backfills any fields missing from a profile loaded from storage --
 * necessary because a profile persisted by an earlier build of this app
 * (before `arabicFont`, `uiFont`, `surahOrder` or `maxNewAyahsPerSession`
 * existed) is missing those keys entirely, and buildDailyPlan() would
 * throw trying to iterate an undefined surahOrder. Always re-normalizes
 * surahOrder too, so it stays complete if the content pack ever grows.
 */
function hydrateProfile(raw: Partial<StudentProfile> | null, now: Date): StudentProfile {
  const defaults = makeDefaultProfile(now);
  if (!raw) return defaults;
  return {
    ...defaults,
    ...raw,
    surahOrder: normalizeSurahOrder(raw.surahOrder ?? [], quranDemoPack),
  };
}

function strengthFromRating(rating: RecallRating) {
  return { again: 0.2, hard: 0.45, good: 0.7, easy: 0.9 }[rating];
}

export function AppProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [memoryStates, setMemoryStates] = useState<MemoryState[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [plan, setPlan] = useState<SessionPlan | null>(null);

  useEffect(() => {
    void (async () => {
      await repository.initialize();
      const now = new Date();
      const rawProfile = await repository.getProfile();
      const savedProfile = hydrateProfile(rawProfile, now);
      const needsMigration =
        !rawProfile ||
        !Array.isArray(rawProfile.surahOrder) ||
        typeof rawProfile.maxNewAyahsPerSession !== 'number' ||
        typeof rawProfile.arabicFont !== 'string' ||
        typeof rawProfile.uiFont !== 'string';
      if (needsMigration) {
        await repository.saveProfile(savedProfile);
      }
      const savedStates = await repository.getMemoryStates();
      const savedEvents = await repository.getSessionEvents();
      setProfile(savedProfile);
      setMemoryStates(savedStates);
      setEvents(savedEvents);
      setPlan(
        buildDailyPlan({
          profile: savedProfile,
          memoryStates: savedStates,
          contentPack: quranDemoPack,
          now,
        }),
      );
      setReady(true);
    })();
  }, []);

  const refreshPlan = useCallback(
    (minutes?: number) => {
      if (!profile) return;
      setPlan(
        buildDailyPlan({
          profile,
          memoryStates,
          contentPack: quranDemoPack,
          now: new Date(),
          availableMinutes: minutes,
        }),
      );
    },
    [memoryStates, profile],
  );

  const setAvailableMinutes = useCallback(
    async (minutes: number) => {
      if (!profile) return;
      const nextProfile = {
        ...profile,
        availableMinutes: minutes,
        updatedAt: new Date().toISOString(),
      };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
      setPlan(
        buildDailyPlan({
          profile: nextProfile,
          memoryStates,
          contentPack: quranDemoPack,
          now: new Date(),
        }),
      );
    },
    [memoryStates, profile],
  );

  const setThemePreference = useCallback(
    async (preference: StudentProfile['themePreference']) => {
      if (!profile) return;
      const nextProfile = {
        ...profile,
        themePreference: preference,
        updatedAt: new Date().toISOString(),
      };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
    },
    [profile],
  );

  const setArabicTextScale = useCallback(
    async (scale: number) => {
      if (!profile) return;
      const nextProfile = {
        ...profile,
        arabicTextScale: scale,
        updatedAt: new Date().toISOString(),
      };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
    },
    [profile],
  );

  const setArabicFont = useCallback(
    async (font: StudentProfile['arabicFont']) => {
      if (!profile) return;
      const nextProfile = { ...profile, arabicFont: font, updatedAt: new Date().toISOString() };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
    },
    [profile],
  );

  const setUiFont = useCallback(
    async (font: StudentProfile['uiFont']) => {
      if (!profile) return;
      const nextProfile = { ...profile, uiFont: font, updatedAt: new Date().toISOString() };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
    },
    [profile],
  );

  const setSurahOrder = useCallback(
    async (order: number[]) => {
      if (!profile) return;
      const nextProfile: StudentProfile = {
        ...profile,
        surahOrder: normalizeSurahOrder(order, quranDemoPack),
        updatedAt: new Date().toISOString(),
      };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
      setPlan(
        buildDailyPlan({
          profile: nextProfile,
          memoryStates,
          contentPack: quranDemoPack,
          now: new Date(),
        }),
      );
    },
    [memoryStates, profile],
  );

  const setMaxNewAyahsPerSession = useCallback(
    async (count: number) => {
      if (!profile) return;
      const nextProfile: StudentProfile = {
        ...profile,
        maxNewAyahsPerSession: Math.max(1, Math.round(count)),
        updatedAt: new Date().toISOString(),
      };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
      setPlan(
        buildDailyPlan({
          profile: nextProfile,
          memoryStates,
          contentPack: quranDemoPack,
          now: new Date(),
        }),
      );
    },
    [memoryStates, profile],
  );

  const setSurahMemorized = useCallback(
    async (surahNumber: number, memorized: boolean) => {
      if (!profile) return;
      const surahAyahKeys = quranDemoPack.ayahs
        .filter((ayah) => ayah.surahNumber === surahNumber)
        .map((ayah) => ayah.key);
      const memorizedSet = new Set(profile.memorizedAyahKeys);
      if (memorized) {
        surahAyahKeys.forEach((key) => memorizedSet.add(key));
      } else {
        surahAyahKeys.forEach((key) => memorizedSet.delete(key));
      }
      const nextProfile: StudentProfile = {
        ...profile,
        memorizedAyahKeys: Array.from(memorizedSet),
        updatedAt: new Date().toISOString(),
      };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
      setPlan(
        buildDailyPlan({
          profile: nextProfile,
          memoryStates,
          contentPack: quranDemoPack,
          now: new Date(),
        }),
      );
    },
    [memoryStates, profile],
  );

  const completeSession = useCallback(
    async ({
      rating,
      repetitions,
      hints,
      recordingUri,
      newAyahKeys,
      ayahOutcomes = [],
      surahTest = null,
    }: {
      rating: RecallRating;
      repetitions: number;
      hints: number;
      recordingUri: string | null;
      newAyahKeys: AyahKey[];
      ayahOutcomes?: AyahOutcome[];
      surahTest?: SurahTestResult | null;
    }) => {
      if (!profile || !plan) return;
      const now = new Date();
      const completedAyahKeys = Array.from(
        new Set(plan.steps.flatMap((step) => step.ayahKeys)),
      ) as AyahKey[];
      const result = {
        id: randomUUID(),
        planId: plan.id,
        profileId: profile.id,
        completedAt: now.toISOString(),
        completedAyahKeys,
        newAyahKeys,
        ayahOutcomes,
        surahTest,
        repetitions,
        hints,
        rating,
        recordingUri,
        wasInterrupted: false,
      };
      const event: SessionEvent = {
        id: randomUUID(),
        profileId: profile.id,
        type: 'session.completed',
        occurredAt: result.completedAt,
        payload: result,
        syncState: 'pending',
      };

      const memorized = new Set(profile.memorizedAyahKeys);
      completedAyahKeys.forEach((key) => memorized.add(key));
      const ratingScore = { again: 0, hard: 1, good: 2, easy: 3 } as const;
      const outcomeRatings: number[] = ayahOutcomes.map((outcome) => ratingScore[outcome.rating]);
      const averageOutcome = outcomeRatings.length
        ? outcomeRatings.reduce((sum, value) => sum + value, 0) / outcomeRatings.length
        : ratingScore[rating];
      const capacityDelta = averageOutcome >= 2.5 ? 0.05 : averageOutcome < 1 ? -0.05 : 0;
      const nextProfile: StudentProfile = {
        ...profile,
        memorizedAyahKeys: Array.from(memorized),
        calibrationSessions: Math.min(7, profile.calibrationSessions + 1),
        capacityLinesPerMinute: Math.max(
          0.35,
          Math.min(
            1.5,
            profile.capacityLinesPerMinute + capacityDelta,
          ),
        ),
        lastActiveAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const byKey = new Map(memoryStates.map((state) => [state.ayahKey, state]));
      const outcomesByKey = new Map(ayahOutcomes.map((outcome) => [outcome.ayahKey, outcome]));
      completedAyahKeys.forEach((ayahKey) => {
        const current = byKey.get(ayahKey);
        const outcome = outcomesByKey.get(ayahKey);
        const ayahRating = outcome?.rating ?? rating;
        const ayahHints = outcome?.hints ?? hints;
        const schedule = scheduleNextReview(current, ayahRating, now);
        byKey.set(ayahKey, {
          ayahKey,
          strength: strengthFromRating(ayahRating),
          lastReviewedAt: now.toISOString(),
          nextDueAt: schedule.nextDueAt,
          hesitationCount: (current?.hesitationCount ?? 0) + (ayahRating === 'hard' ? 1 : 0),
          hintCount: (current?.hintCount ?? 0) + ayahHints,
          successfulRecalls:
            (current?.successfulRecalls ?? 0) + (ayahRating === 'again' ? 0 : 1),
          failedRecalls:
            (current?.failedRecalls ?? 0) + (ayahRating === 'again' ? 1 : 0),
          easeFactor: schedule.easeFactor,
          intervalDays: schedule.intervalDays,
          repetitionCount: schedule.repetitionCount,
          consecutiveAgainCount: schedule.consecutiveAgainCount,
          isLeech: schedule.isLeech,
        });
      });
      const nextStates = Array.from(byKey.values());

      await repository.appendSessionEvent(event);
      await repository.saveProfile(nextProfile);
      await repository.saveMemoryStates(nextStates);
      setEvents((current) => [event, ...current]);
      setProfile(nextProfile);
      setMemoryStates(nextStates);
      setPlan(
        buildDailyPlan({
          profile: nextProfile,
          memoryStates: nextStates,
          contentPack: quranDemoPack,
          now,
        }),
      );
    },
    [memoryStates, plan, profile],
  );

  const stats = useMemo<AppStats>(() => {
    const strength =
      memoryStates.length === 0
        ? 0
        : Math.round(
            (memoryStates.reduce((sum, state) => sum + state.strength, 0) /
              memoryStates.length) *
              100,
          );
    const memorizedAyahKeys = profile?.memorizedAyahKeys ?? [];
    const streak = computeStreak(events);
    const surahProgress = computeSurahProgress(memorizedAyahKeys, quranDemoPack);
    const milestones = computeMilestones(events, memorizedAyahKeys, quranDemoPack, streak);
    const velocity = computeVelocity(events);
    const surahForecasts = computeSurahForecasts(surahProgress, velocity);
    return {
      completedSessions: events.length,
      memorizedAyahs: memorizedAyahKeys.length,
      reviewStrength: strength,
      streak,
      surahProgress,
      milestones,
      velocity,
      surahForecasts,
    };
  }, [events, memoryStates, profile?.memorizedAyahKeys]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      profile,
      plan,
      stats,
      repository,
      setAvailableMinutes,
      setThemePreference,
      setArabicTextScale,
      setArabicFont,
      setUiFont,
      setSurahOrder,
      setMaxNewAyahsPerSession,
      setSurahMemorized,
      refreshPlan,
      completeSession,
    }),
    [
      completeSession,
      plan,
      profile,
      ready,
      refreshPlan,
      setAvailableMinutes,
      setThemePreference,
      setArabicTextScale,
      setArabicFont,
      setUiFont,
      setSurahOrder,
      setMaxNewAyahsPerSession,
      setSurahMemorized,
      stats,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return value;
}
