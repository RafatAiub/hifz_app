export type AyahKey = `${number}:${number}`;

export interface StudentProfile {
  id: string;
  availableMinutes: number;
  preferredTime: string;
  capacityLinesPerMinute: number;
  calibrationSessions: number;
  memorizedAyahKeys: AyahKey[];
  recoveryPreference: 'gentle' | 'strict';
  mushafLayout: 'indopak-16';
  themePreference: 'system' | 'light' | 'dark';
  arabicTextScale: number;
  arabicFont: 'naskh' | 'amiri';
  uiFont: 'sans' | 'serif';
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuranAyah {
  key: AyahKey;
  surahNumber: number;
  ayahNumber: number;
  page: number;
  lineStart: number;
  lineEnd: number;
  arabic: string;
  translationBn: string;
  audioUrl: string;
  /** True only once a qualified human reviewer has checked this ayah's line
   * placement against a printed mushaf — a data source alone, however
   * reputable, does not set this to true. */
  lineDataVerified: boolean;
  /** Traceable provenance of the line/page data, independent of
   * lineDataVerified — e.g. which dataset or manual review produced it. */
  lineDataSource: 'hand-reviewed-tanzil' | 'quran-foundation-indopak-16';
}

export interface QuranContentPack {
  id: string;
  version: string;
  layout: 'indopak-16';
  sourceName: string;
  sourceUrl: string;
  checksumSha256: string;
  surahs: Array<{
    number: number;
    nameArabic: string;
    nameBn: string;
    ayahCount: number;
  }>;
  ayahs: QuranAyah[];
}

export interface MemoryState {
  ayahKey: AyahKey;
  strength: number;
  lastReviewedAt: string | null;
  nextDueAt: string;
  hesitationCount: number;
  hintCount: number;
  successfulRecalls: number;
  failedRecalls: number;
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  consecutiveAgainCount: number;
  isLeech: boolean;
}

export type SessionStepKind = 'warmup' | 'new' | 'sabqi' | 'manzil';

export interface SessionStep {
  id: string;
  kind: SessionStepKind;
  title: string;
  ayahKeys: AyahKey[];
  estimatedMinutes: number;
  repetitionTarget: number;
  hasLeechItems: boolean;
}

export interface SessionPlan {
  id: string;
  date: string;
  estimatedMinutes: number;
  isRecoveryPlan: boolean;
  calibrationDay: number | null;
  steps: SessionStep[];
}

export type RecallRating = 'again' | 'hard' | 'good' | 'easy';

export interface AyahOutcome {
  ayahKey: AyahKey;
  rating: RecallRating;
  hints: number;
  repetitions: number;
  cleanLevelTwoPasses: number;
  linkedWithPrevious: boolean;
}

export interface SurahTestResult {
  surahNumber: number;
  recordingUri: string | null;
  reviewMode: 'self' | 'teacher';
  completedUnaided: boolean;
}

export interface SessionResult {
  id: string;
  planId: string;
  profileId: string;
  completedAt: string;
  completedAyahKeys: AyahKey[];
  /** Subset of completedAyahKeys that came from 'new' hifz steps (not
   * warmup/sabqi/manzil review) -- used to compute memorization velocity. */
  newAyahKeys: AyahKey[];
  /** Per-ayah evidence for new hifz. Optional keeps older persisted events readable. */
  ayahOutcomes?: AyahOutcome[];
  /** Whole-surah gate. Automatic ASR is intentionally not authoritative in v1. */
  surahTest?: SurahTestResult | null;
  repetitions: number;
  hints: number;
  rating: RecallRating;
  recordingUri: string | null;
  wasInterrupted: boolean;
}

export interface SessionEvent {
  id: string;
  profileId: string;
  type: 'session.completed';
  occurredAt: string;
  payload: SessionResult;
  syncState: 'pending' | 'synced';
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

export type MilestoneKind =
  | 'surah-complete'
  | 'streak'
  | 'ayah-count';

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  titleBn: string;
  achievedAt: string;
}

export interface SurahProgress {
  surahNumber: number;
  nameBn: string;
  nameArabic: string;
  memorizedCount: number;
  totalCount: number;
}

export interface HifzVelocity {
  /** Average newly-memorized ayahs per day over the trailing window. */
  ayahsPerDay: number;
  windowDays: number;
}

export interface SurahForecast {
  surahNumber: number;
  nameBn: string;
  remainingAyahs: number;
  /** null when velocity is 0 (not enough recent data to forecast). */
  daysLeft: number | null;
}
