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
  arabicFont: 'uthmanic' | 'amiri';
  uiFont: 'sans' | 'serif';
  /** Surah numbers (78-114) in the order the user wants to memorize them.
   * Always contains every Juz Amma surah exactly once -- see
   * normalizeSurahOrder() in domain/planner.ts. Drives which surah's ayahs
   * the planner offers next for new hifz. */
  surahOrder: number[];
  /** Upper bound on new (not-yet-memorized) ayahs offered per session,
   * regardless of how much time/capacity would otherwise allow. This is the
   * *base* size; adaptiveSabaqSize() nudges it down on weak retention. */
  maxNewAyahsPerSession: number;
  /** Student lifecycle. 'hafiz' routes the daily flow to Muraja'ah only --
   * no new Sabaq is ever offered. */
  hifzStatus: 'new' | 'partial' | 'hafiz';
  /** Teacher console + in-session teacher approval appear only when true. */
  teacherModeEnabled: boolean;
  /** How many recent approved lessons stay in daily Sabqi / Sat Sabaq
   * (traditional default 7, kept configurable). */
  satSabaqCount: number;
  /** Days an approved Sabaq stays in SABQI before it rotates into MANZIL. */
  recentRevisionDays: number;
  /** Target MANZIL (old-revision) ayahs per day. 0 = auto from amount
   * memorized / student strength / available time. */
  manzilAyahsPerDay: number;
  /** When false, the revision gate never blocks new Sabaq -- the teacher
   * override. */
  revisionGateEnabled: boolean;
  /** Teacher hard pause: no new Sabaq regardless of the gate. */
  newSabaqPaused: boolean;
  activeSurahNumber?: number;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MistakeType =
  | 'OMISSION'
  | 'ADDITION'
  | 'SUBSTITUTION'
  | 'SEQUENCE'
  | 'HESITATION'
  | 'PROMPT'
  | 'HARAKAH'
  | 'TAJWEED'
  | 'WAQF'
  | 'MUTASHABIHAT'
  /** Recitation-test-only additions -- see domain/recitation.ts. */
  | 'WORD_REPETITION'
  | 'AYAH_SKIPPED'
  | 'AYAH_REPEATED'
  | 'EARLY_STOP';

export type MistakeSource = 'student' | 'ai' | 'teacher';

/**
 * One persisted recitation mistake. Repeated unresolved mistakes on an ayah
 * move it into the Weak-Ayah queue (deriveWeakQueue). AI may *detect* a
 * probable mistake, but `source: 'ai'` is never authoritative -- a teacher
 * still sets `teacherVerified`.
 */
export interface MistakeRecord {
  id: string;
  ayahKey: AyahKey;
  surahNumber: number;
  ayahNumber: number;
  /** 0-based word index when known (from a masked-word reveal), else null. */
  wordPosition: number | null;
  type: MistakeType;
  /** What the recognizer actually heard at this position (ADDITION,
   * SUBSTITUTION, WORD_REPETITION, AYAH_REPEATED) -- the canonical
   * expected word is always looked up fresh from the Quran text at
   * ayahKey/wordPosition, never stored, so the two can be shown side by
   * side without risking the display text drifting from the source. Null
   * when the mistake type has no specific "what was said" (OMISSION,
   * AYAH_SKIPPED, HESITATION, EARLY_STOP) or the source isn't ASR. */
  detectedWord: string | null;
  sessionId: string;
  occurredAt: string;
  source: MistakeSource;
  /** Model confidence when source === 'ai'; null otherwise. */
  aiConfidence: number | null;
  teacherVerified: boolean;
  resolvedAt: string | null;
}

export type RevisionGateReason =
  | 'ok'
  | 'missed-days'
  | 'weak-backlog'
  | 'low-retention'
  | 'teacher-paused'
  | 'completed-hafiz';

export interface RevisionGateState {
  /** True => today's plan offers no (or reduced) new Sabaq. */
  blocked: boolean;
  reason: RevisionGateReason;
  weakCount: number;
  /** Mean strength of SABQI items, 0..1 (1 when there are none yet). */
  sabqiRetention: number;
  /** Mean strength of MANZIL + MAINTENANCE items, 0..1. */
  manzilRetention: number;
  /** Whether the teacher can lift this gate. false for completed-hafiz,
   * where new Sabaq simply does not apply. */
  overridable: boolean;
}

export interface HifzHealth {
  /** Distinct memorized ayahs (SABQI and older). */
  total: number;
  strong: number;
  needsRevision: number;
  weak: number;
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
  /** True when this ayah's text and line/page placement come from a
   * recognised international authority: the Tanzil / King Fahd Complex
   * (KFGQPC) verse text and the Quran Foundation published IndoPak 16-line
   * mushaf layout (mushaf id 7). That standard is what this app treats as
   * verification — every shipped ayah meets it. */
  lineDataVerified: boolean;
  /** Traceable provenance of the line/page data — which authoritative
   * dataset (or hand review) produced the numbers. */
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

/**
 * Traditional Madrasa Hifz lifecycle. The SM-2 fields below still run, but
 * *underneath* this -- daily Sabqi/Manzil rotation is driven by `stage`
 * (and by how long ago the lesson was approved), not by `nextDueAt`. So old
 * memorization can never fall out of rotation just because the student keeps
 * adding new pages.
 *
 *   UNSEEN -> LEARNING -> SABAQ_READY -> SABAQ_APPROVED
 *          -> SABQI (Sabqi / Sat Sabaq, recent revision)
 *          -> MANZIL (Amukhta / old revision, continuous rotation)
 *          -> MAINTENANCE (long-consolidated, light touch)
 */
export type HifzStage =
  | 'UNSEEN'
  | 'LEARNING'
  | 'SABAQ_READY'
  | 'SABAQ_APPROVED'
  | 'SABQI'
  | 'MANZIL'
  | 'MAINTENANCE';

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
  /** Traditional lifecycle stage -- see HifzStage. */
  stage: HifzStage;
  stageUpdatedAt: string;
  /** When this ayah's Sabaq was approved (teacher, or self when teacher mode
   * is off). Drives SABQI -> MANZIL after profile.recentRevisionDays. */
  approvedAt: string | null;
  /** Consecutive clean recalls (no hint, not "again"). A weak ayah must reach
   * WEAK_CLEAR_STREAK clean recalls before its mistakes are resolved. */
  cleanRecallStreak: number;
  /** Unresolved mistakes against this ayah, denormalised from the ledger for
   * fast Weak-Ayah-queue checks. */
  unresolvedMistakes: number;
}

export type SessionStepKind = 'warmup' | 'new' | 'sabqi' | 'manzil' | 'weakness';

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
  /** Why (and whether) new Sabaq is available today. */
  revisionGate: RevisionGateState;
}

export type RecallRating = 'again' | 'hard' | 'good' | 'easy';

export interface AyahOutcome {
  ayahKey: AyahKey;
  rating: RecallRating;
  hints: number;
  repetitions: number;
  cleanLevelTwoPasses: number;
  linkedWithPrevious: boolean;
  /** Mistake types the student (or teacher) tagged for this ayah in-session. */
  mistakes?: MistakeType[];
  /** Last masked word index revealed, so the ledger can pin a word position. */
  lastRevealedWordIndex?: number | null;
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
  /** Mistakes captured this session (also appended to the persistent ledger). */
  mistakes?: MistakeRecord[];
  /** Teacher approved the new Sabaq presented this session (teacher mode). */
  teacherApproved?: boolean;
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

export interface DailyActivity {
  /** YYYY-MM-DD, UTC date key. */
  date: string;
  /** Distinct ayahs touched (new + review) that day. */
  count: number;
}

/**
 * One completed "পড়া দিন" (Recitation Test) run -- see domain/recitation.ts
 * for how these numbers are computed. Persisted separately from
 * MemoryState/MistakeRecord: a Surah's per-word mistakes go into the
 * existing `mistakes` ledger (source: 'ai'), this is just the run's
 * summary + pass/fail so the Surah detail screen can show "last tested"
 * and the lifecycle can distinguish READY_FOR_TEST from MEMORIZED.
 */
export interface RecitationTestSummary {
  id: string;
  surahNumber: number;
  completedAt: string;
  ayahsCompleted: number;
  ayahsTotal: number;
  accuracy: number;
  mistakeCount: number;
  hintsUsed: number;
  hesitationCount: number;
  completedFully: boolean;
  /** 'clean' (no mistakes, no hints) | 'assisted' (needed help but got
   * through) | 'failed' (too many mistakes / stopped early). */
  recall: 'clean' | 'assisted' | 'failed';
}

export interface SurahForecast {
  surahNumber: number;
  nameBn: string;
  remainingAyahs: number;
  /** null when velocity is 0 (not enough recent data to forecast). */
  daysLeft: number | null;
}
