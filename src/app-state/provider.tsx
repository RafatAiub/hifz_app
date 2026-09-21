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
import {
  applyRecallOutcome,
  approveSabaq as approveSabaqState,
  buildImportedStates,
  classifyHifzHealth,
  deriveWeakQueue,
  type ImportStrength,
  isMemorizedStage,
  migrateMemoryState,
  promoteDueSabqiToManzil,
  requestMorePractice as requestMorePracticeState,
  resolveMistakesOnCleanStreak,
  unresolvedMistakeCountByAyah,
} from '@/domain/hifz';
import { buildDailyPlan, normalizeSurahOrder, scheduleNextReview } from '@/domain/planner';
import {
  computeMilestones,
  computeStreak,
  computeSurahForecasts,
  computeSurahProgress,
  computeVelocity,
  computeWeeklyActivity,
} from '@/domain/stats';
import type {
  AyahKey,
  AyahOutcome,
  DailyActivity,
  HifzHealth,
  HifzStage,
  HifzVelocity,
  MemoryState,
  Milestone,
  MistakeRecord,
  RecallRating,
  RecitationTestSummary,
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
  /** Retention-first breakdown -- avoids "X Juz memorized" fake precision. */
  hifzHealth: HifzHealth;
  /** Ayahs touched per day, trailing 7 days, oldest first. */
  weeklyActivity: DailyActivity[];
  /** Weak-Ayah queue size. */
  weakCount: number;
  /** Ayahs waiting on teacher approval (SABAQ_READY). */
  pendingApprovals: number;
}

interface AppContextValue {
  ready: boolean;
  profile: StudentProfile | null;
  plan: SessionPlan | null;
  stats: AppStats;
  memoryStates: MemoryState[];
  mistakes: MistakeRecord[];
  recitationTests: RecitationTestSummary[];
  repository: StorageRepository;
  activeSurahNumber: number;
  setActiveSurah(surahNumber: number): Promise<void>;
  setRevisionGateEnabled(enabled: boolean): Promise<void>;
  setAvailableMinutes(minutes: number): Promise<void>;
  setThemePreference(preference: StudentProfile['themePreference']): Promise<void>;
  setArabicTextScale(scale: number): Promise<void>;
  setArabicFont(font: StudentProfile['arabicFont']): Promise<void>;
  setUiFont(font: StudentProfile['uiFont']): Promise<void>;
  setSurahOrder(order: number[]): Promise<void>;
  setMaxNewAyahsPerSession(count: number): Promise<void>;
  setSurahMemorized(
    surahNumber: number,
    memorized: boolean,
    strength?: ImportStrength,
  ): Promise<void>;
  importMemorizedRange(input: {
    surahNumber: number;
    fromAyah?: number;
    toAyah?: number;
    strength: ImportStrength;
  }): Promise<void>;
  setHifzStatus(status: StudentProfile['hifzStatus']): Promise<void>;
  setTeacherModeEnabled(enabled: boolean): Promise<void>;
  setTeacherSetting(
    patch: Partial<
      Pick<
        StudentProfile,
        | 'satSabaqCount'
        | 'recentRevisionDays'
        | 'manzilAyahsPerDay'
        | 'revisionGateEnabled'
        | 'newSabaqPaused'
      >
    >,
  ): Promise<void>;
  approveSabaq(ayahKeys: AyahKey[]): Promise<void>;
  requestMorePractice(ayahKey: AyahKey): Promise<void>;
  /** Persists one completed "পড়া দিন" run and merges its per-word
   * mistakes into the existing ledger (source: 'ai') -- see
   * domain/recitation.ts. Reuses deriveWeakQueue/Weak-Ayah-Repair, no
   * parallel weakness system. */
  saveRecitationTest(
    summary: RecitationTestSummary,
    mistakes: Array<Omit<MistakeRecord, 'id' | 'sessionId' | 'occurredAt' | 'source' | 'teacherVerified' | 'resolvedAt'>>,
  ): Promise<void>;
  setAyahStage(ayahKey: AyahKey, stage: HifzStage): Promise<void>;
  verifyMistake(id: string): Promise<void>;
  resolveMistake(id: string): Promise<void>;
  refreshPlan(minutes?: number): void;
  completeSession(input: {
    rating: RecallRating;
    repetitions: number;
    hints: number;
    recordingUri: string | null;
    newAyahKeys: AyahKey[];
    ayahOutcomes?: AyahOutcome[];
    surahTest?: SurahTestResult | null;
    teacherApproved?: boolean;
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
    activeSurahNumber: 78,
    maxNewAyahsPerSession: 3,
    hifzStatus: 'new',
    teacherModeEnabled: false,
    satSabaqCount: 7,
    recentRevisionDays: 14,
    manzilAyahsPerDay: 0,
    revisionGateEnabled: true,
    newSabaqPaused: false,
    lastActiveAt: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

/**
 * Backfills any fields missing from a profile loaded from storage --
 * necessary because a profile persisted by an earlier build is missing the
 * lifecycle/teacher keys entirely (storage does `JSON.parse(...) as
 * StudentProfile`). Always re-normalizes surahOrder so it stays complete.
 */
function hydrateProfile(raw: Partial<StudentProfile> | null, now: Date): StudentProfile {
  const defaults = makeDefaultProfile(now);
  if (!raw) return defaults;
  return {
    ...defaults,
    ...raw,
    activeSurahNumber: raw.activeSurahNumber ?? defaults.activeSurahNumber,
    surahOrder: normalizeSurahOrder(raw.surahOrder ?? [], quranDemoPack),
  };
}

/**
 * Reconciles persisted memory states with the current lifecycle model:
 * backfills `stage` on legacy rows, and creates a MANZIL/MAINTENANCE state
 * for every memorized ayah that has no state yet (a Hafiz or partial student
 * who only ever ticked "already memorized"). Old memorization therefore
 * enters the revision rotation instead of sitting inert.
 */
function reconcileMemoryStates(
  raw: MemoryState[],
  profile: StudentProfile,
  now: Date,
): { states: MemoryState[]; changed: boolean } {
  const memorizedSet = new Set(profile.memorizedAyahKeys);
  const migrated = raw.map((state) =>
    migrateMemoryState(state, { memorized: memorizedSet.has(state.ayahKey), now }),
  );
  const haveState = new Set(migrated.map((state) => state.ayahKey));
  const importedStates: MemoryState[] = [];
  for (const key of profile.memorizedAyahKeys) {
    if (haveState.has(key)) continue;
    const [surahNumber, ayahNumber] = key.split(':').map(Number) as [number, number];
    importedStates.push(
      ...buildImportedStates({
        contentPack: quranDemoPack,
        surahNumber,
        fromAyah: ayahNumber,
        toAyah: ayahNumber,
        strength: profile.hifzStatus === 'hafiz' ? 'strong' : 'unknown',
        hifzStatus: profile.hifzStatus,
        now,
      }),
    );
  }
  const states = [...migrated, ...importedStates];
  const changed =
    importedStates.length > 0 ||
    raw.length !== migrated.length ||
    raw.some((state, index) => state.stage !== migrated[index]?.stage);
  return { states, changed };
}

function strengthFromRating(rating: RecallRating) {
  return { again: 0.2, hard: 0.45, good: 0.7, easy: 0.9 }[rating];
}

function baseState(ayahKey: AyahKey, now: Date): MemoryState {
  return {
    ayahKey,
    strength: 0,
    lastReviewedAt: null,
    nextDueAt: now.toISOString(),
    hesitationCount: 0,
    hintCount: 0,
    successfulRecalls: 0,
    failedRecalls: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitionCount: 0,
    consecutiveAgainCount: 0,
    isLeech: false,
    stage: 'UNSEEN',
    stageUpdatedAt: now.toISOString(),
    approvedAt: null,
    cleanRecallStreak: 0,
    unresolvedMistakes: 0,
  };
}

function planFor(
  profile: StudentProfile,
  memoryStates: MemoryState[],
  mistakes: MistakeRecord[],
  minutes?: number,
): SessionPlan {
  return buildDailyPlan({
    profile,
    memoryStates,
    mistakes,
    contentPack: quranDemoPack,
    now: new Date(),
    availableMinutes: minutes,
  });
}

export function AppProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [memoryStates, setMemoryStates] = useState<MemoryState[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [recitationTests, setRecitationTests] = useState<RecitationTestSummary[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [plan, setPlan] = useState<SessionPlan | null>(null);

  useEffect(() => {
    void (async () => {
      await repository.initialize();
      const now = new Date();
      const rawProfile = await repository.getProfile();
      const savedProfile = hydrateProfile(rawProfile, now);
      const needsProfileMigration =
        !rawProfile ||
        !Array.isArray(rawProfile.surahOrder) ||
        typeof rawProfile.maxNewAyahsPerSession !== 'number' ||
        typeof rawProfile.arabicFont !== 'string' ||
        typeof rawProfile.uiFont !== 'string' ||
        typeof rawProfile.hifzStatus !== 'string' ||
        typeof rawProfile.teacherModeEnabled !== 'boolean';
      if (needsProfileMigration) {
        await repository.saveProfile(savedProfile);
      }
      const rawStates = await repository.getMemoryStates();
      const savedMistakes = await repository.getMistakes();
      const { states: savedStates, changed: statesChanged } = reconcileMemoryStates(
        rawStates,
        savedProfile,
        now,
      );
      if (statesChanged) {
        await repository.saveMemoryStates(savedStates);
      }
      const savedEvents = await repository.getSessionEvents();
      const savedRecitationTests = await repository.getRecitationTests();
      setProfile(savedProfile);
      setMemoryStates(savedStates);
      setMistakes(savedMistakes);
      setRecitationTests(savedRecitationTests);
      setEvents(savedEvents);
      setPlan(planFor(savedProfile, savedStates, savedMistakes));
      setReady(true);
    })();
  }, []);

  const refreshPlan = useCallback(
    (minutes?: number) => {
      if (!profile) return;
      setPlan(planFor(profile, memoryStates, mistakes, minutes));
    },
    [memoryStates, mistakes, profile],
  );

  const persistProfile = useCallback(
    async (patch: Partial<StudentProfile>, rebuildPlan = false) => {
      if (!profile) return;
      const nextProfile: StudentProfile = {
        ...profile,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await repository.saveProfile(nextProfile);
      setProfile(nextProfile);
      if (rebuildPlan) setPlan(planFor(nextProfile, memoryStates, mistakes));
    },
    [memoryStates, mistakes, profile],
  );

  const setAvailableMinutes = useCallback(
    (minutes: number) => persistProfile({ availableMinutes: minutes }, true),
    [persistProfile],
  );
  const setThemePreference = useCallback(
    (preference: StudentProfile['themePreference']) =>
      persistProfile({ themePreference: preference }),
    [persistProfile],
  );
  const setArabicTextScale = useCallback(
    (scale: number) => persistProfile({ arabicTextScale: scale }),
    [persistProfile],
  );
  const setArabicFont = useCallback(
    (font: StudentProfile['arabicFont']) => persistProfile({ arabicFont: font }),
    [persistProfile],
  );
  const setUiFont = useCallback(
    (font: StudentProfile['uiFont']) => persistProfile({ uiFont: font }),
    [persistProfile],
  );
  const setMaxNewAyahsPerSession = useCallback(
    (count: number) =>
      persistProfile({ maxNewAyahsPerSession: Math.max(1, Math.round(count)) }, true),
    [persistProfile],
  );
  const setHifzStatus = useCallback(
    (status: StudentProfile['hifzStatus']) => persistProfile({ hifzStatus: status }, true),
    [persistProfile],
  );
  const setTeacherModeEnabled = useCallback(
    (enabled: boolean) => persistProfile({ teacherModeEnabled: enabled }, true),
    [persistProfile],
  );
  const setTeacherSetting = useCallback(
    (patch: Parameters<AppContextValue['setTeacherSetting']>[0]) =>
      persistProfile(patch, true),
    [persistProfile],
  );

  const setSurahOrder = useCallback(
    (order: number[]) =>
      persistProfile({ surahOrder: normalizeSurahOrder(order, quranDemoPack) }, true),
    [persistProfile],
  );

  const setActiveSurah = useCallback(
    async (surahNumber: number) => {
      const order = profile?.surahOrder ?? [];
      const nextOrder = [surahNumber, ...order.filter((n) => n !== surahNumber)];
      await persistProfile(
        {
          activeSurahNumber: surahNumber,
          surahOrder: normalizeSurahOrder(nextOrder, quranDemoPack),
        },
        true,
      );
    },
    [persistProfile, profile],
  );

  const setRevisionGateEnabled = useCallback(
    async (enabled: boolean) => {
      await persistProfile({ revisionGateEnabled: enabled }, true);
    },
    [persistProfile],
  );

  const applyStatesAndPlan = useCallback(
    async (
      nextProfile: StudentProfile,
      nextStates: MemoryState[],
      nextMistakes: MistakeRecord[],
    ) => {
      await repository.saveProfile(nextProfile);
      await repository.saveMemoryStates(nextStates);
      await repository.saveMistakes(nextMistakes);
      setProfile(nextProfile);
      setMemoryStates(nextStates);
      setMistakes(nextMistakes);
      setPlan(planFor(nextProfile, nextStates, nextMistakes));
    },
    [],
  );

  const importMemorizedRange = useCallback(
    async (input: {
      surahNumber: number;
      fromAyah?: number;
      toAyah?: number;
      strength: ImportStrength;
    }) => {
      if (!profile) return;
      const now = new Date();
      const imported = buildImportedStates({
        contentPack: quranDemoPack,
        ...input,
        hifzStatus: profile.hifzStatus,
        now,
      });
      const importedKeys = new Set(imported.map((state) => state.ayahKey));
      const nextStates = [
        ...memoryStates.filter((state) => !importedKeys.has(state.ayahKey)),
        ...imported,
      ];
      const memorizedSet = new Set(profile.memorizedAyahKeys);
      importedKeys.forEach((key) => memorizedSet.add(key));
      await applyStatesAndPlan(
        {
          ...profile,
          memorizedAyahKeys: Array.from(memorizedSet),
          updatedAt: now.toISOString(),
        },
        nextStates,
        mistakes,
      );
    },
    [applyStatesAndPlan, memoryStates, mistakes, profile],
  );

  const setSurahMemorized = useCallback(
    async (surahNumber: number, memorized: boolean, strength: ImportStrength = 'unknown') => {
      if (!profile) return;
      const now = new Date();
      const surahAyahKeys = quranDemoPack.ayahs
        .filter((ayah) => ayah.surahNumber === surahNumber)
        .map((ayah) => ayah.key);
      const surahKeySet = new Set(surahAyahKeys);
      const memorizedSet = new Set(profile.memorizedAyahKeys);
      let nextStates: MemoryState[];
      if (memorized) {
        surahAyahKeys.forEach((key) => memorizedSet.add(key));
        const imported = buildImportedStates({
          contentPack: quranDemoPack,
          surahNumber,
          strength,
          hifzStatus: profile.hifzStatus,
          now,
        });
        nextStates = [
          ...memoryStates.filter((state) => !surahKeySet.has(state.ayahKey)),
          ...imported,
        ];
      } else {
        surahAyahKeys.forEach((key) => memorizedSet.delete(key));
        nextStates = memoryStates.filter((state) => !surahKeySet.has(state.ayahKey));
      }
      await applyStatesAndPlan(
        {
          ...profile,
          memorizedAyahKeys: Array.from(memorizedSet),
          updatedAt: now.toISOString(),
        },
        nextStates,
        mistakes,
      );
    },
    [applyStatesAndPlan, memoryStates, mistakes, profile],
  );

  const approveSabaq = useCallback(
    async (ayahKeys: AyahKey[]) => {
      if (!profile) return;
      const now = new Date();
      const target = new Set(ayahKeys);
      const memorizedSet = new Set(profile.memorizedAyahKeys);
      const nextStates = memoryStates.map((state) => {
        if (!target.has(state.ayahKey)) return state;
        const approved = approveSabaqState(state, now);
        if (isMemorizedStage(approved.stage)) memorizedSet.add(approved.ayahKey);
        return approved;
      });
      await applyStatesAndPlan(
        {
          ...profile,
          memorizedAyahKeys: Array.from(memorizedSet),
          updatedAt: now.toISOString(),
        },
        nextStates,
        mistakes,
      );
    },
    [applyStatesAndPlan, memoryStates, mistakes, profile],
  );

  const requestMorePractice = useCallback(
    async (ayahKey: AyahKey) => {
      if (!profile) return;
      const now = new Date();
      const nextStates = memoryStates.map((state) =>
        state.ayahKey === ayahKey ? requestMorePracticeState(state, now) : state,
      );
      await applyStatesAndPlan(
        { ...profile, updatedAt: now.toISOString() },
        nextStates,
        mistakes,
      );
    },
    [applyStatesAndPlan, memoryStates, mistakes, profile],
  );

  const setAyahStage = useCallback(
    async (ayahKey: AyahKey, stage: HifzStage) => {
      if (!profile) return;
      const now = new Date();
      const memorizedSet = new Set(profile.memorizedAyahKeys);
      let found = false;
      const mapped = memoryStates.map((state) => {
        if (state.ayahKey !== ayahKey) return state;
        found = true;
        return {
          ...state,
          stage,
          stageUpdatedAt: now.toISOString(),
          approvedAt:
            isMemorizedStage(stage) && !state.approvedAt
              ? now.toISOString()
              : state.approvedAt,
        };
      });
      const nextStates = found
        ? mapped
        : [
            ...mapped,
            {
              ...baseState(ayahKey, now),
              stage,
              approvedAt: isMemorizedStage(stage) ? now.toISOString() : null,
            },
          ];
      if (isMemorizedStage(stage)) memorizedSet.add(ayahKey);
      else memorizedSet.delete(ayahKey);
      await applyStatesAndPlan(
        {
          ...profile,
          memorizedAyahKeys: Array.from(memorizedSet),
          updatedAt: now.toISOString(),
        },
        nextStates,
        mistakes,
      );
    },
    [applyStatesAndPlan, memoryStates, mistakes, profile],
  );

  const patchMistake = useCallback(
    async (id: string, patch: Partial<MistakeRecord>) => {
      if (!profile) return;
      const nextMistakes = mistakes.map((mistake) =>
        mistake.id === id ? { ...mistake, ...patch } : mistake,
      );
      const counts = unresolvedMistakeCountByAyah(nextMistakes);
      const nextStates = memoryStates.map((state) => ({
        ...state,
        unresolvedMistakes: counts.get(state.ayahKey) ?? 0,
      }));
      await applyStatesAndPlan(profile, nextStates, nextMistakes);
    },
    [applyStatesAndPlan, memoryStates, mistakes, profile],
  );

  const verifyMistake = useCallback(
    (id: string) => patchMistake(id, { teacherVerified: true }),
    [patchMistake],
  );
  const resolveMistake = useCallback(
    (id: string) => patchMistake(id, { resolvedAt: new Date().toISOString() }),
    [patchMistake],
  );

  const saveRecitationTest = useCallback(
    async (
      summary: RecitationTestSummary,
      mistakeDrafts: Array<
        Omit<MistakeRecord, 'id' | 'sessionId' | 'occurredAt' | 'source' | 'teacherVerified' | 'resolvedAt'>
      >,
    ) => {
      if (!profile) return;
      const now = new Date();
      const sessionId = randomUUID();
      const newMistakes: MistakeRecord[] = mistakeDrafts.map((draft) => ({
        ...draft,
        id: randomUUID(),
        sessionId,
        occurredAt: now.toISOString(),
        source: 'ai',
        teacherVerified: false,
        resolvedAt: null,
      }));
      const nextMistakes = [...mistakes, ...newMistakes];
      const counts = unresolvedMistakeCountByAyah(nextMistakes);
      const nextStates = memoryStates.map((state) => ({
        ...state,
        unresolvedMistakes: counts.get(state.ayahKey) ?? 0,
      }));
      const nextTests = [summary, ...recitationTests];
      await repository.saveRecitationTests(nextTests);
      setRecitationTests(nextTests);
      await applyStatesAndPlan(profile, nextStates, nextMistakes);
    },
    [applyStatesAndPlan, memoryStates, mistakes, profile, recitationTests],
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
      teacherApproved = false,
    }: Parameters<AppContextValue['completeSession']>[0]) => {
      if (!profile || !plan) return;
      const now = new Date();
      const completedAyahKeys = Array.from(
        new Set(plan.steps.flatMap((step) => step.ayahKeys)),
      ) as AyahKey[];
      const newKeySet = new Set(newAyahKeys);

      const newMistakes: MistakeRecord[] = [];
      for (const outcome of ayahOutcomes) {
        const [surahNumber, ayahNumber] = outcome.ayahKey
          .split(':')
          .map(Number) as [number, number];
        for (const type of outcome.mistakes ?? []) {
          newMistakes.push({
            id: randomUUID(),
            ayahKey: outcome.ayahKey,
            surahNumber,
            ayahNumber,
            wordPosition: outcome.lastRevealedWordIndex ?? null,
            type,
            detectedWord: null,
            sessionId: '',
            occurredAt: now.toISOString(),
            source: 'student',
            aiConfidence: null,
            teacherVerified: false,
            resolvedAt: null,
          });
        }
      }

      const sessionId = randomUUID();
      newMistakes.forEach((mistake) => {
        mistake.sessionId = sessionId;
      });
      const result = {
        id: sessionId,
        planId: plan.id,
        profileId: profile.id,
        completedAt: now.toISOString(),
        completedAyahKeys,
        newAyahKeys,
        ayahOutcomes,
        surahTest,
        mistakes: newMistakes,
        teacherApproved,
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

      let mergedMistakes = [...mistakes, ...newMistakes];

      const ratingScore = { again: 0, hard: 1, good: 2, easy: 3 } as const;
      const outcomeRatings: number[] = ayahOutcomes.map(
        (outcome) => ratingScore[outcome.rating],
      );
      const averageOutcome = outcomeRatings.length
        ? outcomeRatings.reduce((sum, value) => sum + value, 0) / outcomeRatings.length
        : ratingScore[rating];
      const capacityDelta = averageOutcome >= 2.5 ? 0.05 : averageOutcome < 1 ? -0.05 : 0;

      const byKey = new Map(memoryStates.map((state) => [state.ayahKey, state]));
      const outcomesByKey = new Map(ayahOutcomes.map((outcome) => [outcome.ayahKey, outcome]));
      const memorized = new Set(profile.memorizedAyahKeys);

      completedAyahKeys.forEach((ayahKey) => {
        const current = byKey.get(ayahKey) ?? baseState(ayahKey, now);
        const outcome = outcomesByKey.get(ayahKey);
        const ayahRating = outcome?.rating ?? rating;
        const ayahHints = outcome?.hints ?? hints;
        const clean = ayahRating !== 'again' && ayahHints === 0;

        const schedule = scheduleNextReview(current, ayahRating, now);
        const staged = applyRecallOutcome(current, {
          rating: ayahRating,
          hints: ayahHints,
          now,
          teacherModeEnabled: profile.teacherModeEnabled,
          teacherApproved: teacherApproved && newKeySet.has(ayahKey),
        });

        let next: MemoryState = {
          ...current,
          strength: strengthFromRating(ayahRating),
          lastReviewedAt: now.toISOString(),
          nextDueAt: schedule.nextDueAt,
          hesitationCount: current.hesitationCount + (ayahRating === 'hard' ? 1 : 0),
          hintCount: current.hintCount + ayahHints,
          successfulRecalls: current.successfulRecalls + (ayahRating === 'again' ? 0 : 1),
          failedRecalls: current.failedRecalls + (ayahRating === 'again' ? 1 : 0),
          easeFactor: schedule.easeFactor,
          intervalDays: schedule.intervalDays,
          repetitionCount: schedule.repetitionCount,
          consecutiveAgainCount: schedule.consecutiveAgainCount,
          isLeech: schedule.isLeech,
          stage: staged.stage,
          stageUpdatedAt: staged.stageUpdatedAt,
          approvedAt: staged.approvedAt,
          cleanRecallStreak: staged.cleanRecallStreak,
        };

        if (clean && next.cleanRecallStreak >= 3) {
          mergedMistakes = resolveMistakesOnCleanStreak(
            mergedMistakes,
            ayahKey,
            next.cleanRecallStreak,
            now,
          );
          next = { ...next, isLeech: false, consecutiveAgainCount: 0 };
        }
        byKey.set(ayahKey, next);
      });

      const counts = unresolvedMistakeCountByAyah(mergedMistakes);
      let nextStates = Array.from(byKey.values()).map((state) => ({
        ...state,
        unresolvedMistakes: counts.get(state.ayahKey) ?? 0,
      }));

      const nextProfile: StudentProfile = {
        ...profile,
        calibrationSessions: Math.min(7, profile.calibrationSessions + 1),
        capacityLinesPerMinute: Math.max(
          0.35,
          Math.min(1.5, profile.capacityLinesPerMinute + capacityDelta),
        ),
        lastActiveAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      nextStates = promoteDueSabqiToManzil(nextStates, nextProfile, now);
      nextStates.forEach((state) => {
        if (isMemorizedStage(state.stage)) memorized.add(state.ayahKey);
      });
      nextProfile.memorizedAyahKeys = Array.from(memorized);

      await repository.appendSessionEvent(event);
      await repository.saveProfile(nextProfile);
      await repository.saveMemoryStates(nextStates);
      await repository.saveMistakes(mergedMistakes);
      setEvents((current) => [event, ...current]);
      setProfile(nextProfile);
      setMemoryStates(nextStates);
      setMistakes(mergedMistakes);
      setPlan(planFor(nextProfile, nextStates, mergedMistakes));
    },
    [memoryStates, mistakes, plan, profile],
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
    const hifzHealth = classifyHifzHealth({ memoryStates, mistakes });
    return {
      completedSessions: events.length,
      memorizedAyahs: memorizedAyahKeys.length,
      reviewStrength: strength,
      streak,
      surahProgress,
      milestones,
      velocity,
      surahForecasts,
      hifzHealth,
      weeklyActivity: computeWeeklyActivity(events),
      weakCount: deriveWeakQueue({ memoryStates, mistakes }).length,
      pendingApprovals: memoryStates.filter((state) => state.stage === 'SABAQ_READY').length,
    };
  }, [events, memoryStates, mistakes, profile?.memorizedAyahKeys]);

  const activeSurahNumber = useMemo(() => {
    if (profile?.activeSurahNumber) {
      return profile.activeSurahNumber;
    }
    const memorizedSet = new Set(profile?.memorizedAyahKeys ?? []);
    const order = profile?.surahOrder ?? [];
    for (const sNum of order) {
      const surahAyahs = quranDemoPack.ayahs.filter((a) => a.surahNumber === sNum);
      const isComplete = surahAyahs.length > 0 && surahAyahs.every((a) => memorizedSet.has(a.key));
      if (!isComplete) return sNum;
    }
    return order[0] ?? 78;
  }, [profile]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      profile,
      plan,
      stats,
      memoryStates,
      mistakes,
      recitationTests,
      repository,
      activeSurahNumber,
      setActiveSurah,
      setRevisionGateEnabled,
      setAvailableMinutes,
      setThemePreference,
      setArabicTextScale,
      setArabicFont,
      setUiFont,
      setSurahOrder,
      setMaxNewAyahsPerSession,
      setSurahMemorized,
      importMemorizedRange,
      setHifzStatus,
      setTeacherModeEnabled,
      setTeacherSetting,
      approveSabaq,
      requestMorePractice,
      saveRecitationTest,
      setAyahStage,
      verifyMistake,
      resolveMistake,
      refreshPlan,
      completeSession,
    }),
    [
      approveSabaq,
      completeSession,
      importMemorizedRange,
      memoryStates,
      mistakes,
      plan,
      profile,
      ready,
      recitationTests,
      refreshPlan,
      requestMorePractice,
      repository,
      activeSurahNumber,
      setActiveSurah,
      setRevisionGateEnabled,
      setArabicFont,
      setArabicTextScale,
      setAvailableMinutes,
      setAyahStage,
      setHifzStatus,
      setMaxNewAyahsPerSession,
      setSurahMemorized,
      setSurahOrder,
      setTeacherModeEnabled,
      setTeacherSetting,
      setThemePreference,
      setUiFont,
      stats,
      verifyMistake,
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
