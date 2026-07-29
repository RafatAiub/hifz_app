export type AyahKey = `${number}:${number}`;

export interface StudentProfile {
  id: string;
  availableMinutes: number;
  preferredTime: string;
  capacityLinesPerMinute: number;
  calibrationSessions: number;
  memorizedAyahKeys: AyahKey[];
  recoveryPreference: 'gentle' | 'strict';
  mushafLayout: 'indopak-13';
  themePreference: 'system' | 'light' | 'dark';
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
  lineDataVerified: boolean;
}

export interface QuranContentPack {
  id: string;
  version: string;
  layout: 'indopak-13';
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

export interface SessionResult {
  id: string;
  planId: string;
  profileId: string;
  completedAt: string;
  completedAyahKeys: AyahKey[];
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
