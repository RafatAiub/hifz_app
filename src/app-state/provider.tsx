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
import { buildDailyPlan, nextReviewDate } from '@/domain/planner';
import type {
  AyahKey,
  MemoryState,
  RecallRating,
  SessionEvent,
  SessionPlan,
  StudentProfile,
} from '@/domain/types';
import { createStorageRepository } from '@/storage/create-repository';
import type { StorageRepository } from '@/storage/repository';

interface AppStats {
  completedSessions: number;
  memorizedAyahs: number;
  reviewStrength: number;
}

interface AppContextValue {
  ready: boolean;
  profile: StudentProfile | null;
  plan: SessionPlan | null;
  stats: AppStats;
  repository: StorageRepository;
  setAvailableMinutes(minutes: number): Promise<void>;
  refreshPlan(minutes?: number): void;
  completeSession(input: {
    rating: RecallRating;
    repetitions: number;
    hints: number;
    recordingUri: string | null;
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
    mushafLayout: 'indopak-13',
    lastActiveAt: null,
    createdAt: iso,
    updatedAt: iso,
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
      const savedProfile = (await repository.getProfile()) ?? makeDefaultProfile(now);
      if (!(await repository.getProfile())) {
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

  const completeSession = useCallback(
    async ({
      rating,
      repetitions,
      hints,
      recordingUri,
    }: {
      rating: RecallRating;
      repetitions: number;
      hints: number;
      recordingUri: string | null;
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
      const nextProfile: StudentProfile = {
        ...profile,
        memorizedAyahKeys: Array.from(memorized),
        calibrationSessions: Math.min(7, profile.calibrationSessions + 1),
        capacityLinesPerMinute: Math.max(
          0.35,
          Math.min(
            1.5,
            profile.capacityLinesPerMinute +
              (rating === 'easy' ? 0.05 : rating === 'again' ? -0.05 : 0),
          ),
        ),
        lastActiveAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const byKey = new Map(memoryStates.map((state) => [state.ayahKey, state]));
      completedAyahKeys.forEach((ayahKey) => {
        const current = byKey.get(ayahKey);
        byKey.set(ayahKey, {
          ayahKey,
          strength: strengthFromRating(rating),
          lastReviewedAt: now.toISOString(),
          nextDueAt: nextReviewDate(rating, now),
          hesitationCount: (current?.hesitationCount ?? 0) + (rating === 'hard' ? 1 : 0),
          hintCount: (current?.hintCount ?? 0) + hints,
          successfulRecalls:
            (current?.successfulRecalls ?? 0) + (rating === 'again' ? 0 : 1),
          failedRecalls:
            (current?.failedRecalls ?? 0) + (rating === 'again' ? 1 : 0),
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
    return {
      completedSessions: events.length,
      memorizedAyahs: profile?.memorizedAyahKeys.length ?? 0,
      reviewStrength: strength,
    };
  }, [events.length, memoryStates, profile?.memorizedAyahKeys.length]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      profile,
      plan,
      stats,
      repository,
      setAvailableMinutes,
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
