import { describe, expect, it } from 'vitest';

import { quranDemoPack } from '@/data/quran-pack';
import {
  buildExpectedWords,
  confidenceLabel,
  createRecitationTracker,
  deriveSurahLifecycle,
  diffTranscriptWords,
  finishRecitation,
  ingestRecognizedText,
  ingestSilence,
  ingestWord,
  normalizeArabic,
  requestHint,
  summarizeRecitation,
  wordSimilarity,
} from '@/domain/recitation';
import type { HifzStage, RecitationTestSummary } from '@/domain/types';

// Surah Al-Asr (103), 3 ayahs -- small and deterministic, good for exact
// scenario tests. Word text is always pulled from the real shipped pack
// (never hand-retyped) so a Uthmani-orthography mismatch can't produce a
// false pass/fail here.
const SURAH = 103;

function expected() {
  return buildExpectedWords(SURAH, quranDemoPack);
}

/** The canonical, correctly-ordered word list as plain display text. */
function canonicalWords() {
  return expected().map((w) => w.text);
}

function recite(words: string[], startMs = 0, stepMs = 500) {
  let state = createRecitationTracker(expected());
  words.forEach((word, i) => {
    state = ingestWord(state, normalizeArabic(word), startMs + i * stepMs);
  });
  return state;
}

describe('normalizeArabic', () => {
  it('is stable (idempotent) and strips combining marks', () => {
    const word = canonicalWords()[0]!;
    const normalized = normalizeArabic(word);
    expect(normalizeArabic(normalized)).toBe(normalized);
    expect(normalized).not.toMatch(/\p{M}/u);
  });

  it('folds Quranic long-vowel marks (dagger alif) into a full alef letter, not empty', () => {
    // Ayah 3 contains ٱلصَّـٰلِحَٰتِ (dagger alif U+0670 twice) -- these
    // spell real vowels, so they must not disappear during normalization.
    const word = expected().find((w) => w.text.includes('ٰ'));
    expect(word).toBeDefined();
    expect(normalizeArabic(word!.text)).toContain('ا');
  });

  it('never returns an empty string for a real word', () => {
    for (const word of canonicalWords()) {
      expect(normalizeArabic(word).length).toBeGreaterThan(0);
    }
  });
});

describe('wordSimilarity', () => {
  it('is 1 for identical strings and less for a one-letter change', () => {
    const [a, b] = ['لفي', 'في']; // لفي vs في
    expect(wordSimilarity(a, a)).toBe(1);
    expect(wordSimilarity(a, b)).toBeLessThan(1);
    expect(wordSimilarity(a, b)).toBeGreaterThan(0);
  });
});

describe('buildExpectedWords', () => {
  it('produces a flat, ordered word sequence spanning all ayahs of the Surah', () => {
    const words = expected();
    expect(words[0]!.ayahNumber).toBe(1);
    expect(words.at(-1)!.ayahNumber).toBe(3);
    words.forEach((w, i) => expect(w.globalIndex).toBe(i));
  });

  it('matches the pack: 1 word in ayah 1, 4 in ayah 2', () => {
    const words = expected();
    expect(words.filter((w) => w.ayahNumber === 1)).toHaveLength(1);
    expect(words.filter((w) => w.ayahNumber === 2)).toHaveLength(4);
  });
});

describe('perfect recitation', () => {
  it('advances the cursor through every word with zero mistakes', () => {
    const state = recite(canonicalWords());
    expect(state.cursor).toBe(expected().length);
    expect(state.mistakes).toHaveLength(0);
    const summary = summarizeRecitation(finishRecitation(state, 99999));
    expect(summary.completedFully).toBe(true);
    expect(summary.mistakeCount).toBe(0);
    expect(summary.accuracy).toBe(100);
    expect(summary.recall).toBe('clean');
  });
});

describe('word omission', () => {
  it('flags the exact omitted word and keeps tracking forward', () => {
    const all = expected();
    const omittedWord = all[2]!; // ayah 2, 3rd word -- لَفِي
    const words = canonicalWords();
    words.splice(2, 1); // drop it
    const state = recite(words);
    const omission = state.mistakes.find((m) => m.type === 'OMISSION');
    expect(omission).toBeDefined();
    expect(omission!.ayahNumber).toBe(omittedWord.ayahNumber);
    expect(omission!.expectedWord).toBe(omittedWord.text);
    expect(state.cursor).toBe(all.length);
  });
});

describe('word substitution', () => {
  it('detects a near-miss word as SUBSTITUTION with expected + detected recorded', () => {
    // spec's worked example: لَفِي recited as فِي (drop the leading ل)
    const all = expected();
    const target = all[2]!;
    const near = target.text.slice(1); // فِي
    const words = canonicalWords();
    words[2] = near;
    const state = recite(words);
    const sub = state.mistakes.find((m) => m.type === 'SUBSTITUTION');
    expect(sub).toBeDefined();
    expect(sub!.ayahNumber).toBe(target.ayahNumber);
    expect(sub!.expectedWord).toBe(target.text);
    expect(sub!.detectedWord).toBe(normalizeArabic(near));
    expect(state.cursor).toBe(all.length);
  });
});

describe('word addition', () => {
  it('flags an inserted word that matches nothing nearby without derailing the cursor', () => {
    const words = canonicalWords();
    words.splice(1, 0, 'يعني'); // يعني -- an unrelated filler word
    const state = recite(words.slice(0, 3)); // word1, filler, word2
    const addition = state.mistakes.find((m) => m.type === 'ADDITION');
    expect(addition).toBeDefined();
    expect(state.cursor).toBe(2); // both real words matched despite the insertion
    // the rest of the Surah still recites cleanly afterwards
    const full = recite(words);
    expect(full.cursor).toBe(expected().length);
  });
});

describe('word repetition', () => {
  it('flags an immediate repeat of the previous word without rewinding the cursor', () => {
    const words = canonicalWords();
    words.splice(1, 0, words[0]!); // repeat the first word
    const state = recite(words.slice(0, 3)); // word1, repeat, word2
    const repeat = state.mistakes.find((m) => m.type === 'WORD_REPETITION');
    expect(repeat).toBeDefined();
    expect(state.cursor).toBe(2); // word 1 + word 2 matched; the repeat did not advance
    const full = recite(words);
    expect(full.cursor).toBe(expected().length);
  });
});

describe('ayah repeated', () => {
  it('detects a rewind to an earlier ayah and resumes tracking from there', () => {
    const all = canonicalWords();
    // recite ayah 1 + first word of ayah 2, then restart from ayah 1
    const words = [all[0]!, all[1]!, all[0]!, all[1]!, all[2]!];
    const state = recite(words);
    const ayahRepeat = state.mistakes.find((m) => m.type === 'AYAH_REPEATED');
    expect(ayahRepeat).toBeDefined();
    expect(state.cursor).toBe(3);
  });
});

describe('ayah skipped', () => {
  it('flags a fully-bypassed ayah and continues from the later ayah', () => {
    const all = expected();
    const ayah1 = canonicalWords()[0]!;
    const ayah3FirstTwo = all.filter((w) => w.ayahNumber === 3).slice(0, 2).map((w) => w.text);
    const words = [ayah1, ...ayah3FirstTwo];
    const state = recite(words);
    const skipped = state.mistakes.find((m) => m.type === 'AYAH_SKIPPED');
    expect(skipped).toBeDefined();
    expect(skipped!.ayahNumber).toBe(2);
    expect(state.expected[state.cursor - 1]!.ayahNumber).toBe(3);
  });
});

describe('recovery after a mistake', () => {
  it('a mid-surah mistake does not prevent completing the rest of the surah', () => {
    const all = expected();
    const target = all[2]!;
    const words = canonicalWords();
    words[2] = target.text.slice(1); // substitution mid-surah
    const state = recite(words);
    const summary = summarizeRecitation(finishRecitation(state, 99999));
    expect(summary.completedFully).toBe(true);
    expect(summary.ayahsCompleted).toBe(3);
    expect(summary.mistakeCount).toBe(1);
  });
});

describe('long hesitation', () => {
  it('flags a stall only once per idle stretch, not every tick', () => {
    const words = canonicalWords();
    let state = createRecitationTracker(expected());
    state = ingestWord(state, normalizeArabic(words[0]!), 0);
    state = ingestSilence(state, 4500);
    state = ingestSilence(state, 5000); // still idle -- should not double-flag
    expect(state.mistakes.filter((m) => m.type === 'HESITATION')).toHaveLength(1);
    state = ingestWord(state, normalizeArabic(words[1]!), 5200);
    state = ingestSilence(state, 9800);
    expect(state.mistakes.filter((m) => m.type === 'HESITATION')).toHaveLength(2);
  });

  it('does not flag a normal short pause', () => {
    const words = canonicalWords();
    let state = createRecitationTracker(expected());
    state = ingestWord(state, normalizeArabic(words[0]!), 0);
    state = ingestSilence(state, 1500);
    expect(state.mistakes.filter((m) => m.type === 'HESITATION')).toHaveLength(0);
  });
});

describe('hints', () => {
  it('first hint reveals only the next word and is recorded as a PROMPT mistake', () => {
    const state = createRecitationTracker(expected());
    const { state: next, hint } = requestHint(state, 0);
    expect(hint?.level).toBe(1);
    expect(hint?.reveal).toBe(canonicalWords()[0]);
    expect(next.mistakes.some((m) => m.type === 'PROMPT')).toBe(true);
  });

  it('a clean recall with a hint used is assessed as assisted, not clean', () => {
    let state = createRecitationTracker(expected());
    state = requestHint(state, 0).state;
    canonicalWords().forEach((w, i) => {
      state = ingestWord(state, normalizeArabic(w), (i + 1) * 500);
    });
    const summary = summarizeRecitation(finishRecitation(state, 99999));
    expect(summary.hintsUsed).toBeGreaterThan(0);
    expect(summary.recall).toBe('assisted');
  });
});

describe('early stop', () => {
  it('flags EARLY_STOP when finished before the surah is complete', () => {
    const words = canonicalWords().slice(0, 2);
    const state = recite(words);
    const finished = finishRecitation(state, 99999);
    expect(finished.mistakes.some((m) => m.type === 'EARLY_STOP')).toBe(true);
    const summary = summarizeRecitation(finished);
    expect(summary.completedFully).toBe(false);
    expect(summary.recall).toBe('failed');
  });
});

describe('ingestRecognizedText', () => {
  it('tokenizes and ingests a whole ASR chunk in one call, same result as word-by-word', () => {
    const chunk = canonicalWords().join(' ');
    const state = ingestRecognizedText(createRecitationTracker(expected()), chunk, 0);
    expect(state.cursor).toBe(expected().length);
    expect(state.mistakes).toHaveLength(0);
  });
});

describe('generic across every Surah in the pack (not hardcoded to Al-Asr)', () => {
  it('perfectly recites every shipped Surah with zero mistakes', () => {
    for (const surah of quranDemoPack.surahs) {
      const words = buildExpectedWords(surah.number, quranDemoPack);
      expect(words.length).toBeGreaterThan(0);
      let state = createRecitationTracker(words);
      words.forEach((w, i) => {
        state = ingestWord(state, w.normalized, i * 400);
      });
      const summary = summarizeRecitation(finishRecitation(state, 999999));
      expect({ surah: surah.number, ...summary }).toMatchObject({
        surah: surah.number,
        completedFully: true,
        mistakeCount: 0,
        accuracy: 100,
      });
    }
  });
});

describe('diffTranscriptWords', () => {
  it('returns only the newly added words when the transcript grows', () => {
    const words = canonicalWords();
    const prev = words.slice(0, 2).join(' ');
    const next = words.slice(0, 4).join(' ');
    expect(diffTranscriptWords(prev, next)).toEqual(
      words.slice(2, 4).map((w) => normalizeArabic(w)),
    );
  });

  it('treats a segment reset (new text does not extend old) as all-new', () => {
    const words = canonicalWords();
    const prev = words.slice(0, 3).join(' ');
    const next = words.slice(3, 5).join(' '); // fresh utterance segment after an isFinal
    expect(diffTranscriptWords(prev, next)).toEqual(
      words.slice(3, 5).map((w) => normalizeArabic(w)),
    );
  });

  it('returns nothing new when the transcript is unchanged', () => {
    const words = canonicalWords();
    const text = words.slice(0, 2).join(' ');
    expect(diffTranscriptWords(text, text)).toEqual([]);
  });
});

function test(overrides: Partial<RecitationTestSummary> = {}): RecitationTestSummary {
  return {
    id: 't1',
    surahNumber: 103,
    completedAt: '2026-09-16T00:00:00.000Z',
    ayahsCompleted: 3,
    ayahsTotal: 3,
    accuracy: 100,
    mistakeCount: 0,
    hintsUsed: 0,
    hesitationCount: 0,
    completedFully: true,
    recall: 'clean',
    ...overrides,
  };
}

describe('deriveSurahLifecycle', () => {
  it('is NOT_STARTED when no ayah has any progress', () => {
    const stages: HifzStage[] = ['UNSEEN', 'UNSEEN', 'UNSEEN'];
    expect(deriveSurahLifecycle({ ayahStages: stages, lastTest: null })).toBe('NOT_STARTED');
  });

  it('is LEARNING when less than half the ayahs are memorized', () => {
    const stages: HifzStage[] = ['SABQI', 'LEARNING', 'UNSEEN', 'UNSEEN'];
    expect(deriveSurahLifecycle({ ayahStages: stages, lastTest: null })).toBe('LEARNING');
  });

  it('is MEMORIZING once at least half the ayahs are memorized but not all', () => {
    const stages: HifzStage[] = ['SABQI', 'SABQI', 'LEARNING'];
    expect(deriveSurahLifecycle({ ayahStages: stages, lastTest: null })).toBe('MEMORIZING');
  });

  it('is READY_FOR_TEST once fully memorized but never tested', () => {
    const stages: HifzStage[] = ['SABQI', 'SABQI', 'SABQI'];
    expect(deriveSurahLifecycle({ ayahStages: stages, lastTest: null })).toBe('READY_FOR_TEST');
  });

  it('stays READY_FOR_TEST after a failed test (must retest, not silently pass)', () => {
    const stages: HifzStage[] = ['SABQI', 'SABQI', 'SABQI'];
    expect(
      deriveSurahLifecycle({ ayahStages: stages, lastTest: test({ recall: 'failed' }) }),
    ).toBe('READY_FOR_TEST');
  });

  it('is MEMORIZED after a passing test while ayahs are still in recent rotation', () => {
    const stages: HifzStage[] = ['SABQI', 'SABQI', 'SABQI'];
    expect(
      deriveSurahLifecycle({ ayahStages: stages, lastTest: test({ recall: 'clean' }) }),
    ).toBe('MEMORIZED');
  });

  it('is REVISION once most ayahs have aged into old-revision rotation, even with a passing test', () => {
    const stages: HifzStage[] = ['MANZIL', 'MANZIL', 'MAINTENANCE'];
    expect(
      deriveSurahLifecycle({ ayahStages: stages, lastTest: test({ recall: 'assisted' }) }),
    ).toBe('REVISION');
  });
});

describe('confidenceLabel', () => {
  it('buckets confidence into confirmed vs possible instead of asserting certainty', () => {
    expect(confidenceLabel(0.9)).toBe('confirmed');
    expect(confidenceLabel(0.5)).toBe('possible');
  });
});
