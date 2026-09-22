/**
 * Quran-aware recitation testing: deterministic word alignment + mistake
 * detection. This module owns "did the recitation match the canonical
 * text, and where did it diverge" -- it never calls an LLM and never
 * guesses. Speech recognition (services/quran-recognizer.ts) only supplies
 * a stream of recognized words; everything about correctness is decided
 * here so the logic stays testable without a microphone.
 *
 * Pipeline (see also services/quran-recognizer.ts):
 *   audio -> ASR words -> normalizeArabic -> alignment vs canonical
 *   Surah -> mistake events -> RecitationTestSummary + MistakeRecord[]
 *
 * The canonical Quran text (QuranAyah.arabic) is never mutated -- only
 * `normalized` strings, produced here, are used for comparison.
 */
import { isMemorizedStage, OLD_REVISION_STAGES } from './hifz';
import { getWordSkeletons } from './tajweed-words';
import type {
  AyahKey,
  HifzStage,
  MemoryState,
  MistakeRecord,
  MistakeType,
  QuranContentPack,
  RecitationTestSummary,
} from './types';

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const DIACRITICS_AND_QURANIC_MARKS =
  /[ؐ-ًؚ-ٟۖ-ۭࣔ-ࣣ࣡-ࣿ]/g;
const TATWEEL = /ـ/g;
// ٰ (dagger alif / superscript alef) is not a mere diacritic -- it
// spells a long "aa" vowel that everyday transcription (and ASR output)
// writes as a full alef letter, so it folds into ا like the other
// alef variants rather than being stripped.
const ALEF_VARIANTS = /[آأإٰٱ]/g;
const ALEF_MAKSURA = /ى/g;
const TEH_MARBUTA = /ة/g;
const NON_ARABIC_LETTER = /[^ء-ي\s]/g;

/**
 * Reduces an Arabic word/phrase to a comparison-only form: diacritics,
 * quranic annotation marks (waqf signs, small high marks) and tatweel
 * stripped; alef/alef-maksura/teh-marbuta variants folded together. Never
 * used for display -- `QuranAyah.arabic` stays untouched everywhere in the
 * UI.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS_AND_QURANIC_MARKS, '')
    .replace(TATWEEL, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(ALEF_MAKSURA, 'ي')
    .replace(TEH_MARBUTA, 'ه')
    .replace(NON_ARABIC_LETTER, '')
    .trim();
}

/** Splits a chunk of recognized ASR text into normalized word tokens. */
export function tokenizeRecognizedText(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => normalizeArabic(word))
    .filter(Boolean);
}

/**
 * A continuous/interim ASR stream repeats the whole "transcript so far"
 * on every result event, not just the newly recognized words -- and that
 * buffer resets whenever the recognizer emits an `isFinal` result and
 * starts a fresh utterance segment. Feeding the full transcript into the
 * tracker on every event would double-count words already ingested; this
 * extracts only the genuinely new words, so callers can feed a live
 * stream into ingestWord/ingestRecognizedText exactly once per word.
 */
export function diffTranscriptWords(previousText: string, newText: string): string[] {
  const previousWords = tokenizeRecognizedText(previousText);
  const newWords = tokenizeRecognizedText(newText);
  const extendsPrevious =
    newWords.length >= previousWords.length &&
    previousWords.every((word, i) => newWords[i] === word);
  return extendsPrevious ? newWords.slice(previousWords.length) : newWords;
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i]![0] = i;
  for (let j = 0; j < cols; j += 1) dp[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[rows - 1]![cols - 1]!;
}

/** 0..1, 1 = identical. Used only to classify a near-miss as SUBSTITUTION
 * (vs. an unrelated inserted word). */
export function wordSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - editDistance(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// Expected word sequence (canonical, per Surah)
// ---------------------------------------------------------------------------

export interface ExpectedWord {
  /** Position across the whole Surah -- what the tracker's cursor counts. */
  globalIndex: number;
  ayahNumber: number;
  /** 0-based position within its ayah -- matches MaskedAyah/getWordSkeletons order. */
  wordIndex: number;
  ayahKey: AyahKey;
  /** Original Uthmani text, exactly as shipped -- never modified. */
  text: string;
  /** Comparison-only form, see normalizeArabic. */
  normalized: string;
}

export function buildExpectedWords(
  surahNumber: number,
  contentPack: QuranContentPack,
  startAyah?: number,
  endAyah?: number,
): ExpectedWord[] {
  let ayahs = contentPack.ayahs
    .filter((ayah) => ayah.surahNumber === surahNumber)
    .sort((a, b) => a.ayahNumber - b.ayahNumber);
  if (startAyah !== undefined && endAyah !== undefined) {
    ayahs = ayahs.filter((a) => a.ayahNumber >= startAyah && a.ayahNumber <= endAyah);
  }
  const words: ExpectedWord[] = [];
  let globalIndex = 0;
  for (const ayah of ayahs) {
    const skeletons = getWordSkeletons(ayah.key, ayah.arabic);
    skeletons.forEach((skeleton, wordIndex) => {
      words.push({
        globalIndex,
        ayahNumber: ayah.ayahNumber,
        wordIndex,
        ayahKey: ayah.key,
        text: skeleton.word,
        normalized: normalizeArabic(skeleton.word),
      });
      globalIndex += 1;
    });
  }
  return words;
}

// ---------------------------------------------------------------------------
// Alignment / mistake engine
// ---------------------------------------------------------------------------

/** Deterministic mapping of alignment outcomes onto the shared MistakeType
 * taxonomy (src/domain/types.ts) -- reuses the existing ledger/weak-queue
 * instead of a parallel system. */
export const RECITATION_MISTAKE_TYPES = {
  omission: 'OMISSION',
  substitution: 'SUBSTITUTION',
  addition: 'ADDITION',
  repetition: 'WORD_REPETITION',
  ayahSkipped: 'AYAH_SKIPPED',
  ayahRepeated: 'AYAH_REPEATED',
  hesitation: 'HESITATION',
  prompt: 'PROMPT',
  earlyStop: 'EARLY_STOP',
} as const satisfies Record<string, MistakeType>;

/** How many expected words ahead/behind the cursor to search for a
 * resynchronization point. Small enough to stay fast and specific, large
 * enough to recover from a skipped or repeated ayah. */
export const ALIGNMENT_WINDOW = 12;
/** wordSimilarity() at/above this counts a near-miss as a SUBSTITUTION of
 * the expected word rather than an unrelated inserted word. */
export const SUBSTITUTION_THRESHOLD = 0.45;
/** Silence since the last recognized word before it counts as a stall
 * worth flagging, vs. a normal waqf/breath pause. */
export const LONG_HESITATION_MS = 4000;
/** Consecutive clean recalls (a full test with 0 mistakes at a location)
 * needed before a weak location is treated as recovered -- mirrors
 * WEAK_CLEAR_STREAK in hifz.ts so the two systems agree on "resolved". */
export const RECITATION_CLEAN_STREAK_TARGET = 3;

export interface RecitationMistakeEvent {
  ayahNumber: number;
  wordIndex: number | null;
  type: MistakeType;
  expectedWord: string | null;
  detectedWord: string | null;
  /** 0..1. UI buckets this into "Confirmed" (>=0.7) vs "Possible". */
  confidence: number;
  timestampMs: number;
}

export type RecallAssessment = 'clean' | 'assisted' | 'failed';

export interface RecitationTrackerState {
  expected: ExpectedWord[];
  /** Next expected globalIndex the tracker wants to hear. */
  cursor: number;
  mistakes: RecitationMistakeEvent[];
  hintsByAyah: Record<number, number>;
  /** ms since epoch of the last recognized word, for hesitation timing. */
  lastWordAt: number | null;
  hesitationFlaggedSinceLastWord: boolean;
  finished: boolean;
  finishedAtCursor: number | null;
}

export function createRecitationTracker(expected: ExpectedWord[]): RecitationTrackerState {
  return {
    expected,
    cursor: 0,
    mistakes: [],
    hintsByAyah: {},
    lastWordAt: null,
    hesitationFlaggedSinceLastWord: false,
    finished: false,
    finishedAtCursor: null,
  };
}

function pushMistake(
  events: RecitationMistakeEvent[],
  event: RecitationMistakeEvent,
): RecitationMistakeEvent[] {
  return [...events, event];
}

/** Groups a skipped index range [from, to) by ayah, splitting "the ayah
 * currently being left mid-way" (partial -> per-word OMISSION) from any
 * ayah fully contained in the gap (whole -> one AYAH_SKIPPED). */
function classifySkippedRange(
  expected: ExpectedWord[],
  from: number,
  to: number,
): Array<{ kind: 'omission'; index: number } | { kind: 'ayah-skipped'; ayahNumber: number }> {
  const out: Array<
    { kind: 'omission'; index: number } | { kind: 'ayah-skipped'; ayahNumber: number }
  > = [];
  let index = from;
  while (index < to) {
    const ayahNumber = expected[index]!.ayahNumber;
    const ayahStart = index;
    let ayahEnd = index;
    while (ayahEnd < to && expected[ayahEnd]!.ayahNumber === ayahNumber) ayahEnd += 1;
    const isFirstWordOfAyah = ayahStart === 0 || expected[ayahStart - 1]!.ayahNumber !== ayahNumber;
    const isLastWordOfAyahInPack =
      ayahEnd >= expected.length || expected[ayahEnd]!.ayahNumber !== ayahNumber;
    const fullyContained = isFirstWordOfAyah && isLastWordOfAyahInPack && ayahEnd - ayahStart > 1;
    if (fullyContained) {
      out.push({ kind: 'ayah-skipped', ayahNumber });
    } else {
      for (let i = ayahStart; i < ayahEnd; i += 1) out.push({ kind: 'omission', index: i });
    }
    index = ayahEnd;
  }
  return out;
}

/** Feeds one already-normalized recognized word into the tracker. Pure:
 * returns a new state, never mutates the input. */
export function ingestWord(
  state: RecitationTrackerState,
  word: string,
  timestampMs: number,
): RecitationTrackerState {
  if (state.finished || !word) return state;
  const { expected, cursor } = state;
  let mistakes = state.mistakes;
  let nextCursor = cursor;

  if (cursor >= expected.length) {
    // Trailing speech after the Surah is complete (e.g. a closing du'a) --
    // not part of the recitation being assessed.
    return { ...state, lastWordAt: timestampMs, hesitationFlaggedSinceLastWord: false };
  }

  // 1. Exact match at the cursor -- the common case.
  if (word === expected[cursor]!.normalized) {
    nextCursor = cursor + 1;
    return {
      ...state,
      cursor: nextCursor,
      lastWordAt: timestampMs,
      hesitationFlaggedSinceLastWord: false,
    };
  }

  // 2. Forward search: did the student skip ahead?
  const forwardLimit = Math.min(expected.length, cursor + ALIGNMENT_WINDOW);
  for (let j = cursor + 1; j < forwardLimit; j += 1) {
    if (expected[j]!.normalized !== word) continue;
    for (const gap of classifySkippedRange(expected, cursor, j)) {
      if (gap.kind === 'ayah-skipped') {
        mistakes = pushMistake(mistakes, {
          ayahNumber: gap.ayahNumber,
          wordIndex: null,
          type: RECITATION_MISTAKE_TYPES.ayahSkipped,
          expectedWord: null,
          detectedWord: null,
          confidence: 0.6,
          timestampMs,
        });
      } else {
        const missed = expected[gap.index]!;
        mistakes = pushMistake(mistakes, {
          ayahNumber: missed.ayahNumber,
          wordIndex: missed.wordIndex,
          type: RECITATION_MISTAKE_TYPES.omission,
          expectedWord: missed.text,
          detectedWord: null,
          confidence: j - cursor <= 2 ? 0.8 : 0.55,
          timestampMs,
        });
      }
    }
    return {
      ...state,
      cursor: j + 1,
      mistakes,
      lastWordAt: timestampMs,
      hesitationFlaggedSinceLastWord: false,
    };
  }

  // 3. Backward search: did the student repeat a word/ayah they already said?
  const backwardLimit = Math.max(0, cursor - ALIGNMENT_WINDOW);
  for (let b = cursor - 1; b >= backwardLimit; b -= 1) {
    if (expected[b]!.normalized !== word) continue;
    if (b === cursor - 1) {
      mistakes = pushMistake(mistakes, {
        ayahNumber: expected[b]!.ayahNumber,
        wordIndex: expected[b]!.wordIndex,
        type: RECITATION_MISTAKE_TYPES.repetition,
        expectedWord: expected[b]!.text,
        detectedWord: word,
        confidence: 0.75,
        timestampMs,
      });
      return {
        ...state,
        mistakes,
        lastWordAt: timestampMs,
        hesitationFlaggedSinceLastWord: false,
      };
    }
    mistakes = pushMistake(mistakes, {
      ayahNumber: expected[b]!.ayahNumber,
      wordIndex: expected[b]!.wordIndex,
      type: RECITATION_MISTAKE_TYPES.ayahRepeated,
      expectedWord: expected[b]!.text,
      detectedWord: word,
      confidence: 0.65,
      timestampMs,
    });
    return {
      ...state,
      cursor: b + 1,
      mistakes,
      lastWordAt: timestampMs,
      hesitationFlaggedSinceLastWord: false,
    };
  }

  // 4. No resync point found. A near-miss on the current word is a
  // substitution; otherwise it's an inserted word that isn't part of the
  // Surah at all.
  const expectedWord = expected[cursor]!;
  if (wordSimilarity(word, expectedWord.normalized) >= SUBSTITUTION_THRESHOLD) {
    mistakes = pushMistake(mistakes, {
      ayahNumber: expectedWord.ayahNumber,
      wordIndex: expectedWord.wordIndex,
      type: RECITATION_MISTAKE_TYPES.substitution,
      expectedWord: expectedWord.text,
      detectedWord: word,
      confidence: 0.7,
      timestampMs,
    });
    nextCursor = cursor + 1;
    return {
      ...state,
      cursor: nextCursor,
      mistakes,
      lastWordAt: timestampMs,
      hesitationFlaggedSinceLastWord: false,
    };
  }

  mistakes = pushMistake(mistakes, {
    ayahNumber: expectedWord.ayahNumber,
    wordIndex: expectedWord.wordIndex,
    type: RECITATION_MISTAKE_TYPES.addition,
    expectedWord: null,
    detectedWord: word,
    confidence: 0.5,
    timestampMs,
  });
  return { ...state, mistakes, lastWordAt: timestampMs, hesitationFlaggedSinceLastWord: false };
}

/** Feeds a raw chunk of recognized text (e.g. one ASR partial/final
 * result) through tokenization + ingestWord. */
export function ingestRecognizedText(
  state: RecitationTrackerState,
  text: string,
  timestampMs: number,
): RecitationTrackerState {
  const words = tokenizeRecognizedText(text);
  return words.reduce((next, word) => ingestWord(next, word, timestampMs), state);
}

/** Call periodically (e.g. every second) while listening. Flags
 * LONG_HESITATION once per idle stretch -- never repeatedly for the same
 * pause. */
export function ingestSilence(
  state: RecitationTrackerState,
  nowMs: number,
): RecitationTrackerState {
  if (state.finished || state.hesitationFlaggedSinceLastWord) return state;
  if (state.lastWordAt === null || state.cursor >= state.expected.length) return state;
  if (nowMs - state.lastWordAt < LONG_HESITATION_MS) return state;
  const at = state.expected[Math.min(state.cursor, state.expected.length - 1)]!;
  return {
    ...state,
    hesitationFlaggedSinceLastWord: true,
    mistakes: pushMistake(state.mistakes, {
      ayahNumber: at.ayahNumber,
      wordIndex: at.wordIndex,
      type: RECITATION_MISTAKE_TYPES.hesitation,
      expectedWord: at.text,
      detectedWord: null,
      confidence: 0.9,
      timestampMs: nowMs,
    }),
  };
}

export interface HintResult {
  level: 1 | 2 | 3;
  /** What to actually reveal, in canonical (un-normalized) text. */
  reveal: string;
  ayahNumber: number;
}

/** First hint reveals only the next expected word; second, the next
 * phrase (up to 3 words); beyond that, the whole ayah. Every call is
 * logged as a PROMPT mistake so it counts against the assessment. */
export function requestHint(
  state: RecitationTrackerState,
  timestampMs: number,
): { state: RecitationTrackerState; hint: HintResult | null } {
  if (state.finished || state.cursor >= state.expected.length) return { state, hint: null };
  const at = state.expected[state.cursor]!;
  const ayahWords = state.expected.filter((w) => w.ayahNumber === at.ayahNumber);
  const level = (Math.min(3, (state.hintsByAyah[at.ayahNumber] ?? 0) + 1)) as 1 | 2 | 3;
  const reveal =
    level === 1
      ? at.text
      : level === 2
        ? ayahWords
            .filter((w) => w.wordIndex >= at.wordIndex && w.wordIndex < at.wordIndex + 3)
            .map((w) => w.text)
            .join(' ')
        : ayahWords.map((w) => w.text).join(' ');
  const nextState: RecitationTrackerState = {
    ...state,
    hintsByAyah: { ...state.hintsByAyah, [at.ayahNumber]: level },
    mistakes: pushMistake(state.mistakes, {
      ayahNumber: at.ayahNumber,
      wordIndex: at.wordIndex,
      type: RECITATION_MISTAKE_TYPES.prompt,
      expectedWord: at.text,
      detectedWord: null,
      confidence: 1,
      timestampMs,
    }),
  };
  return { state: nextState, hint: { level, reveal, ayahNumber: at.ayahNumber } };
}

export function finishRecitation(
  state: RecitationTrackerState,
  timestampMs: number,
): RecitationTrackerState {
  if (state.finished) return state;
  const complete = state.cursor >= state.expected.length;
  let mistakes = state.mistakes;
  if (!complete) {
    const at = state.expected[Math.min(state.cursor, state.expected.length - 1)]!;
    mistakes = pushMistake(mistakes, {
      ayahNumber: at.ayahNumber,
      wordIndex: at.wordIndex,
      type: RECITATION_MISTAKE_TYPES.earlyStop,
      expectedWord: at.text,
      detectedWord: null,
      confidence: 1,
      timestampMs,
    });
  }
  return { ...state, mistakes, finished: true, finishedAtCursor: state.cursor };
}

export interface RecitationSummary {
  totalWords: number;
  wordsCompleted: number;
  ayahsTotal: number;
  ayahsCompleted: number;
  mistakeCount: number;
  hintsUsed: number;
  hesitationCount: number;
  /** 0..100, based on words matched cleanly (no mistake at that position)
   * against total expected words -- not a gamified/arbitrary number. */
  accuracy: number;
  recall: RecallAssessment;
  completedFully: boolean;
}

/** Turns the finished tracker state into the numbers the result screen
 * shows. Deliberately simple and auditable -- see section 17 of the spec:
 * no invented "engagement score", just counts of real events. */
export function summarizeRecitation(state: RecitationTrackerState): RecitationSummary {
  const totalWords = state.expected.length;
  const wordsCompleted = Math.min(state.cursor, totalWords);
  const ayahNumbers = new Set(state.expected.map((w) => w.ayahNumber));
  const ayahsTotal = ayahNumbers.size;
  const completedAyahNumbers = new Set(
    state.expected.slice(0, wordsCompleted).map((w) => w.ayahNumber),
  );
  const lastAyah = state.expected[wordsCompleted - 1]?.ayahNumber;
  const ayahsCompleted =
    wordsCompleted >= totalWords ? ayahsTotal : Math.max(0, completedAyahNumbers.size - (lastAyah ? 1 : 0));
  const hintsUsed = Object.values(state.hintsByAyah).reduce((sum, level) => sum + level, 0);
  const hesitationCount = state.mistakes.filter(
    (m) => m.type === RECITATION_MISTAKE_TYPES.hesitation,
  ).length;
  const mistakeCount = state.mistakes.filter(
    (m) => m.type !== RECITATION_MISTAKE_TYPES.prompt,
  ).length;
  // Accuracy is "words correctly recalled / whole Surah" -- a mistake type
  // tied to a specific word position counts against it, and (critically)
  // an incomplete recitation only gets credit for the words actually
  // spoken, not the untested remainder. HESITATION/PROMPT/EARLY_STOP don't
  // themselves consume a word position, so they're excluded here (a stall
  // or a hint isn't "a wrong word"); the missing remainder after an early
  // stop is what actually drags accuracy down, via wordsCompleted below.
  const positionalMistakeTypes = new Set<MistakeType>([
    RECITATION_MISTAKE_TYPES.omission,
    RECITATION_MISTAKE_TYPES.substitution,
    RECITATION_MISTAKE_TYPES.addition,
    RECITATION_MISTAKE_TYPES.repetition,
    RECITATION_MISTAKE_TYPES.ayahSkipped,
  ]);
  const positionalMistakes = state.mistakes.filter((m) =>
    positionalMistakeTypes.has(m.type),
  ).length;
  const correctlyRecalled = Math.max(0, wordsCompleted - positionalMistakes);
  const accuracy = totalWords === 0 ? 100 : Math.round((correctlyRecalled / totalWords) * 100);
  const completedFully = state.cursor >= totalWords;
  const recall: RecallAssessment =
    mistakeCount === 0 && hintsUsed === 0
      ? 'clean'
      : accuracy >= 70 || hintsUsed > 0
        ? 'assisted'
        : 'failed';
  return {
    totalWords,
    wordsCompleted,
    ayahsTotal,
    ayahsCompleted: Math.max(0, Math.min(ayahsTotal, ayahsCompleted)),
    mistakeCount,
    hintsUsed,
    hesitationCount,
    accuracy: Math.max(0, Math.min(100, accuracy)),
    recall,
    completedFully,
  };
}

/** Presentational bucket for a mistake's confidence -- section 4 of the
 * spec: AI uncertainty must never be shown as unquestionable fact. */
export function confidenceLabel(confidence: number): 'confirmed' | 'possible' {
  return confidence >= 0.7 ? 'confirmed' : 'possible';
}

// ---------------------------------------------------------------------------
// Surah-level lifecycle (derived, never persisted separately from ayah
// stages + the lightweight RecitationTestSummary log)
// ---------------------------------------------------------------------------

export type SurahLifecycleStage =
  | 'NOT_STARTED'
  | 'LEARNING'
  | 'MEMORIZING'
  | 'READY_FOR_TEST'
  | 'MEMORIZED'
  | 'REVISION';

/**
 * One deterministic ladder for every Surah -- no per-screen variation.
 * Entirely derived from existing per-ayah HifzStage (see domain/hifz.ts)
 * plus the most recent recitation-test outcome; nothing new is persisted
 * just to represent this. Passing one test does not retire a Surah from
 * revision -- once its ayahs age into MANZIL/MAINTENANCE (the existing
 * old-revision rotation), the Surah reads as REVISION rather than
 * MEMORIZED, same as the rest of the app's retention-first model.
 */
export function deriveSurahLifecycle(input: {
  ayahStages: HifzStage[];
  lastTest: RecitationTestSummary | null;
}): SurahLifecycleStage {
  const { ayahStages, lastTest } = input;
  if (ayahStages.length === 0) return 'NOT_STARTED';
  const anyProgress = ayahStages.some((stage) => stage !== 'UNSEEN');
  if (!anyProgress) return 'NOT_STARTED';

  const allMemorized = ayahStages.every(isMemorizedStage);
  if (!allMemorized) {
    const memorizedFraction = ayahStages.filter(isMemorizedStage).length / ayahStages.length;
    return memorizedFraction >= 0.5 ? 'MEMORIZING' : 'LEARNING';
  }

  if (!lastTest || lastTest.recall === 'failed') return 'READY_FOR_TEST';
  const oldRevisionFraction =
    ayahStages.filter((stage) => OLD_REVISION_STAGES.includes(stage)).length / ayahStages.length;
  return oldRevisionFraction >= 0.5 ? 'REVISION' : 'MEMORIZED';
}

export interface SurahRecitationStatus {
  surahNumber: number;
  nameBn: string;
  nameArabic: string;
  totalAyahs: number;
  memorizedAyahs: number;
  lifecycle: SurahLifecycleStage;
  /** Unresolved recitation-ledger mistakes anywhere in this Surah. */
  weakWordCount: number;
  lastTest: RecitationTestSummary | null;
}

export function deriveSurahRecitationStatus(input: {
  surahNumber: number;
  contentPack: QuranContentPack;
  memoryStates: MemoryState[];
  mistakes: MistakeRecord[];
  recitationTests: RecitationTestSummary[];
}): SurahRecitationStatus {
  const surah = input.contentPack.surahs.find((s) => s.number === input.surahNumber);
  const surahAyahKeys = new Set(
    input.contentPack.ayahs
      .filter((ayah) => ayah.surahNumber === input.surahNumber)
      .map((ayah) => ayah.key),
  );
  const statesByKey = new Map(input.memoryStates.map((state) => [state.ayahKey, state]));
  const ayahStages = Array.from(surahAyahKeys).map(
    (key) => statesByKey.get(key)?.stage ?? 'UNSEEN',
  );
  const memorizedAyahs = ayahStages.filter(isMemorizedStage).length;
  const weakWordCount = input.mistakes.filter(
    (m) => !m.resolvedAt && surahAyahKeys.has(m.ayahKey),
  ).length;
  const lastTest =
    input.recitationTests
      .filter((t) => t.surahNumber === input.surahNumber)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0] ?? null;
  return {
    surahNumber: input.surahNumber,
    nameBn: surah?.nameBn ?? `সূরা ${input.surahNumber}`,
    nameArabic: surah?.nameArabic ?? '',
    totalAyahs: surahAyahKeys.size,
    memorizedAyahs,
    lifecycle: deriveSurahLifecycle({ ayahStages, lastTest }),
    weakWordCount,
    lastTest,
  };
}
