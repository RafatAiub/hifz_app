import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Lightbulb,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { getWordSkeletons } from '@/domain/tajweed-words';
import { getAyahs, quranDemoPack } from '@/data/quran-pack';
import {
  buildExpectedWords,
  confidenceLabel,
  createRecitationTracker,
  diffTranscriptWords,
  finishRecitation,
  ingestSilence,
  ingestWord,
  normalizeArabic,
  requestHint,
  summarizeRecitation,
  type ExpectedWord,
  type HintResult,
  type RecitationMistakeEvent,
  type RecitationTrackerState,
} from '@/domain/recitation';
import type { AyahKey, MistakeRecord, MistakeType, RecitationTestSummary } from '@/domain/types';
import {
  createExpoQuranRecognizer,
  type RecognizerErrorInfo,
} from '@/services/quran-recognizer';
import { resolveAudioSource } from '@/services/audio-cache';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors, useTypography } from '@/theme/theme-context';
import { ARABIC_READING_SIZE, radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

type Phase = 'intro' | 'listening' | 'paused' | 'finished' | 'repair';

const mistakeTypeLabel: Record<MistakeType, string> = {
  OMISSION: 'শব্দ বাদ পড়েছে',
  ADDITION: 'বাড়তি শব্দ',
  SUBSTITUTION: 'শব্দ বদলে গেছে',
  SEQUENCE: 'ক্রম এলোমেলো',
  HESITATION: 'অনেকক্ষণ থেমে গিয়েছিলেন',
  PROMPT: 'Hint নেওয়া হয়েছে',
  HARAKAH: 'হরকত',
  TAJWEED: 'তাজবীদ',
  WAQF: 'ওয়াক্‌ফ',
  MUTASHABIHAT: 'মুতাশাবিহ আয়াতে গুলিয়ে ফেলেছেন',
  WORD_REPETITION: 'শব্দ পুনরাবৃত্তি করেছেন',
  AYAH_SKIPPED: 'পুরো আয়াত বাদ পড়েছে',
  AYAH_REPEATED: 'আয়াত আবার শুরু করেছেন',
  EARLY_STOP: 'মাঝপথে থেমে গেছেন',
};

const errorMessages: Record<string, string> = {
  'not-allowed': 'Microphone/speech recognition permission দেওয়া হয়নি।',
  'audio-capture': 'Microphone থেকে audio পাওয়া যাচ্ছে না।',
  network: 'Network সমস্যা হয়েছে — সংযোগ চেক করে আবার চেষ্টা করুন।',
  'no-speech': 'কোনো আওয়াজ শোনা যায়নি।',
  'language-not-supported': 'এই ডিভাইসে আরবি speech recognition সমর্থিত নয়।',
  'service-not-allowed': 'Speech recognition service পাওয়া যায়নি।',
};

function formatClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RecitationTestScreen() {
  const { surahNumber: surahParam } = useLocalSearchParams<{ surahNumber: string }>();
  const surahNumber = Number(surahParam);
  const { memoryStates, saveRecitationTest, resolveMistake } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const fonts = useTypography();
  const player = useAudioPlayer();

  const surah = useMemo(
    () => quranDemoPack.surahs.find((s) => s.number === surahNumber),
    [surahNumber],
  );
  const expectedWords = useMemo(
    () => buildExpectedWords(surahNumber, quranDemoPack),
    [surahNumber],
  );
  const surahAyahs = useMemo(
    () =>
      quranDemoPack.ayahs
        .filter((a) => a.surahNumber === surahNumber)
        .sort((a, b) => a.ayahNumber - b.ayahNumber),
    [surahNumber],
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [tracker, setTracker] = useState<RecitationTrackerState>(() =>
    createRecitationTracker(expectedWords),
  );
  const [hint, setHint] = useState<HintResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<RecognizerErrorInfo | null>(null);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeRecitation> | null>(null);
  const [savedMistakes, setSavedMistakes] = useState<MistakeRecord[]>([]);

  const recognizerRef = useRef(createExpoQuranRecognizer());
  const lastTranscriptRef = useRef('');
  const startedAtRef = useRef<number>(0);
  const pausedAccumMsRef = useRef(0);
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;

  // Repair-mode sub-state: recites just the ayahs with open mistakes.
  const [repairAyahs, setRepairAyahs] = useState<number[]>([]);
  const [repairIndex, setRepairIndex] = useState(0);
  const [repairTracker, setRepairTracker] = useState<RecitationTrackerState | null>(null);
  const [repairResult, setRepairResult] = useState<'clean' | 'mistakes' | null>(null);
  const repairTrackerRef = useRef(repairTracker);
  repairTrackerRef.current = repairTracker;

  const unsubscribesRef = useRef<Array<() => void>>([]);

  const clearSubscriptions = useCallback(() => {
    unsubscribesRef.current.forEach((unsub) => unsub());
    unsubscribesRef.current = [];
  }, []);

  useEffect(() => () => {
    clearSubscriptions();
    recognizerRef.current.abort();
  }, [clearSubscriptions]);

  // Elapsed-time ticker while actively listening (main test only).
  useEffect(() => {
    if (phase !== 'listening') return;
    const id = setInterval(() => {
      setElapsedMs(pausedAccumMsRef.current + (Date.now() - startedAtRef.current));
      setTracker((current) => ingestSilence(current, Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  function attachListeners(onWord: (word: string, ts: number) => void, onFinalReset: () => void) {
    const offResult = recognizerRef.current.onResult((chunk) => {
      const newWords = diffTranscriptWords(lastTranscriptRef.current, chunk.transcript);
      newWords.forEach((word) => onWord(word, chunk.timestampMs));
      if (chunk.isFinal) {
        lastTranscriptRef.current = '';
        onFinalReset();
      } else {
        lastTranscriptRef.current = chunk.transcript;
      }
    });
    const offError = recognizerRef.current.onError((info) => setError(info));
    unsubscribesRef.current = [offResult, offError];
  }

  async function startMainTest() {
    setError(null);
    const supported = recognizerRef.current.isSupported();
    if (!supported) {
      setError({ code: 'service-not-allowed', message: 'unsupported' });
      return;
    }
    const granted = await recognizerRef.current.requestPermissions();
    if (!granted) {
      setError({ code: 'not-allowed', message: 'denied' });
      return;
    }
    lastTranscriptRef.current = '';
    setTracker(createRecitationTracker(expectedWords));
    setHint(null);
    pausedAccumMsRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    attachListeners(
      (word, ts) => setTracker((current) => ingestWord(current, word, ts)),
      () => {},
    );
    recognizerRef.current.start({ contextWords: expectedWords.map((w) => w.text) });
    setPhase('listening');
  }

  function pauseTest() {
    recognizerRef.current.stop();
    pausedAccumMsRef.current = elapsedMs;
    setPhase('paused');
  }

  function resumeTest() {
    lastTranscriptRef.current = '';
    startedAtRef.current = Date.now();
    recognizerRef.current.start({ contextWords: expectedWords.map((w) => w.text) });
    setPhase('listening');
  }

  function onRequestHint() {
    const { state, hint: next } = requestHint(trackerRef.current, Date.now());
    setTracker(state);
    setHint(next);
  }

  async function finishMainTest() {
    clearSubscriptions();
    recognizerRef.current.stop();
    const finished = finishRecitation(trackerRef.current, Date.now());
    setTracker(finished);
    const result = summarizeRecitation(finished);
    setSummary(result);

    const testSummary: RecitationTestSummary = {
      id: randomUUID(),
      surahNumber,
      completedAt: new Date().toISOString(),
      ayahsCompleted: result.ayahsCompleted,
      ayahsTotal: result.ayahsTotal,
      accuracy: result.accuracy,
      mistakeCount: result.mistakeCount,
      hintsUsed: result.hintsUsed,
      hesitationCount: result.hesitationCount,
      completedFully: result.completedFully,
      recall: result.recall,
    };
    const mistakeDrafts = finished.mistakes.map((m) => toMistakeDraft(surahNumber, m));
    await saveRecitationTest(testSummary, mistakeDrafts);
    // We don't get generated ids back from saveRecitationTest; rebuild a
    // display-only view of what was just logged for the result cards.
    setSavedMistakes(
      mistakeDrafts.map((draft, i) => ({
        ...draft,
        id: `draft-${i}`,
        sessionId: testSummary.id,
        occurredAt: testSummary.completedAt,
        source: 'ai',
        teacherVerified: false,
        resolvedAt: null,
      })),
    );
    setPhase('finished');
  }

  function startRepair() {
    const ayahNumbers = Array.from(new Set(savedMistakes.map((m) => m.ayahNumber))).sort(
      (a, b) => a - b,
    );
    if (ayahNumbers.length === 0) return;
    setRepairAyahs(ayahNumbers);
    setRepairIndex(0);
    setRepairResult(null);
    setPhase('repair');
  }

  async function startRepairListening() {
    setError(null);
    const granted = await recognizerRef.current.requestPermissions();
    if (!granted) {
      setError({ code: 'not-allowed', message: 'denied' });
      return;
    }
    const ayahNumber = repairAyahs[repairIndex]!;
    const words = expectedWords.filter((w) => w.ayahNumber === ayahNumber);
    lastTranscriptRef.current = '';
    const fresh = createRecitationTracker(words);
    setRepairTracker(fresh);
    setRepairResult(null);
    attachListeners(
      (word, ts) =>
        setRepairTracker((current) => (current ? ingestWord(current, word, ts) : current)),
      () => {},
    );
    recognizerRef.current.start({ contextWords: words.map((w) => w.text) });
  }

  async function finishRepairAttempt() {
    clearSubscriptions();
    recognizerRef.current.stop();
    const current = repairTrackerRef.current;
    if (!current) return;
    const finished = finishRecitation(current, Date.now());
    setRepairTracker(finished);
    const clean = finished.mistakes.length === 0;
    setRepairResult(clean ? 'clean' : 'mistakes');
    if (clean) {
      const ayahNumber = repairAyahs[repairIndex]!;
      const toResolve = savedMistakes.filter(
        (m) => m.ayahNumber === ayahNumber && !m.resolvedAt && m.id.startsWith('draft-'),
      );
      // These are freshly-logged drafts (ids only exist in our local
      // display copy); the persisted ledger versions were merged with
      // real ids inside saveRecitationTest, so re-resolve by matching
      // ayah+word+type against the current ledger via resolveMistake is
      // not directly addressable here without those real ids. We mark
      // local state resolved for an honest result screen; the underlying
      // ledger entries remain until the student clears them with clean
      // recalls in the normal Weak-Ayah flow, same as any other mistake.
      setSavedMistakes((all) =>
        all.map((m) =>
          toResolve.some((r) => r.ayahNumber === m.ayahNumber && r.wordPosition === m.wordPosition)
            ? { ...m, resolvedAt: new Date().toISOString() }
            : m,
        ),
      );
    }
  }

  function nextRepairAyah() {
    if (repairIndex + 1 < repairAyahs.length) {
      setRepairIndex((i) => i + 1);
      setRepairResult(null);
      setRepairTracker(null);
    } else {
      setPhase('finished');
    }
  }

  async function playAyah(ayahNumber: number) {
    const ayah = surahAyahs.find((a) => a.ayahNumber === ayahNumber);
    if (!ayah) return;
    const source = await resolveAudioSource(ayah.audioUrl);
    player.replace({ uri: source });
    player.play();
  }

  if (!surah) {
    return (
      <AppScreen scroll={false} hasTabBar={false} contentStyle={styles.center}>
        <Text style={styles.notFound}>সূরা পাওয়া যায়নি।</Text>
      </AppScreen>
    );
  }

  const currentAyahNumber = tracker.expected[Math.min(tracker.cursor, tracker.expected.length - 1)]?.ayahNumber ?? 1;
  const ayahsSoFar = new Set(tracker.expected.slice(0, tracker.cursor).map((w) => w.ayahNumber)).size;

  if (phase === 'intro') {
    return (
      <AppScreen scroll={false} hasTabBar={false} contentStyle={styles.introScreen}>
        <IconAction
          label="ফিরে যান"
          style={styles.backButton}
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
        <View style={styles.introBody}>
          <Text style={styles.introEyebrow}>পড়া দিন</Text>
          <Text style={styles.introTitle}>সূরা {surah.nameBn}</Text>
          <Text style={[styles.introArabic, { fontFamily: fonts.arabicBold }]}>
            {surah.nameArabic}
          </Text>
          <Text style={styles.introHint}>পড়া শুরু করুন — কুরআনের লেখা লুকানো থাকবে।</Text>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {errorMessages[error.code] ?? 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।'}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="তিলাওয়াত শুরু করুন"
          style={styles.micButton}
          onPress={() => void startMainTest()}
        >
          <Mic color={colors.white} size={36} />
        </Pressable>
      </AppScreen>
    );
  }

  if (phase === 'listening' || phase === 'paused') {
    return (
      <AppScreen scroll={false} hasTabBar={false} contentStyle={styles.introScreen}>
        <IconAction
          label="বন্ধ করুন"
          style={styles.backButton}
          icon={<X color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
        <View style={styles.introBody}>
          <Text style={styles.introTitle}>সূরা {surah.nameBn}</Text>
          <Text style={styles.listeningLabel}>
            {phase === 'listening' ? 'শুনছি…' : 'থামানো আছে'}
          </Text>
          <Text style={styles.ayahProgress}>
            {Math.min(ayahsSoFar + (tracker.cursor < tracker.expected.length ? 1 : 0), surahAyahs.length)}
            {' / '}
            {surahAyahs.length}
          </Text>
          <Text style={styles.clock}>{formatClock(elapsedMs)}</Text>
          {hint ? (
            <View style={styles.hintBanner}>
              <Lightbulb color={colors.gold} size={16} />
              <Text style={[styles.hintText, { fontFamily: fonts.arabicBold }]}>{hint.reveal}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {errorMessages[error.code] ?? 'সমস্যা হয়েছে — আবার চেষ্টা করুন।'}
              </Text>
              <Pressable onPress={() => void startMainTest()}>
                <Text style={styles.retryText}>আবার চেষ্টা করুন</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <View style={styles.controlRow}>
          <IconAction
            label="Hint"
            icon={<Lightbulb color={colors.gold} size={20} />}
            onPress={onRequestHint}
          />
          {phase === 'listening' ? (
            <IconAction label="থামান" icon={<Pause color={colors.ink} size={20} />} onPress={pauseTest} />
          ) : (
            <IconAction label="চালিয়ে যান" icon={<Play color={colors.primary} size={20} />} onPress={resumeTest} />
          )}
        </View>
        <ActionButton
          label="শেষ করুন"
          icon={<Check color={colors.white} size={20} />}
          onPress={() => void finishMainTest()}
        />
      </AppScreen>
    );
  }

  if (phase === 'repair') {
    const ayahNumber = repairAyahs[repairIndex];
    const ayah = surahAyahs.find((a) => a.ayahNumber === ayahNumber);
    const listeningNow = !!repairTracker && !repairResult;
    return (
      <AppScreen hasTabBar={false} eyebrow={`মেরামত ${repairIndex + 1}/${repairAyahs.length}`} title="দুর্বল অংশ ঠিক করুন" action={
        <IconAction label="ফিরে যান" icon={<ArrowLeft color={colors.ink} size={21} />} onPress={() => setPhase('finished')} />
      }>
        {ayah ? (
          <View style={styles.repairCard}>
            <Text style={styles.repairAyahLabel}>আয়াত {ayah.ayahNumber}</Text>
            <View style={styles.arabicBlock}>
              <Text style={[styles.arabicText, { fontFamily: fonts.arabicBold }]}>{ayah.arabic}</Text>
            </View>
            <IconAction
              label="শুনুন"
              icon={<Volume2 color={colors.primary} size={20} />}
              onPress={() => void playAyah(ayah.ayahNumber)}
            />
          </View>
        ) : null}

        {!repairTracker ? (
          <ActionButton
            label="এখন আবার পড়ুন"
            icon={<Mic color={colors.white} size={20} />}
            onPress={() => void startRepairListening()}
          />
        ) : listeningNow ? (
          <>
            <Text style={styles.listeningLabel}>শুনছি…</Text>
            <ActionButton
              label="শেষ করুন"
              icon={<Check color={colors.white} size={20} />}
              onPress={() => void finishRepairAttempt()}
            />
          </>
        ) : (
          <View style={styles.repairResultBlock}>
            {repairResult === 'clean' ? (
              <Text style={styles.repairCleanText}>মাশাআল্লাহ — এবার পরিষ্কার হয়েছে।</Text>
            ) : (
              <Text style={styles.repairMistakeText}>এখনো কিছু ভুল হচ্ছে — আরেকবার চেষ্টা করুন।</Text>
            )}
            <View style={styles.repairActions}>
              {repairResult !== 'clean' ? (
                <ActionButton
                  label="আবার চেষ্টা করুন"
                  tone="quiet"
                  icon={<RotateCcw color={colors.primary} size={20} />}
                  onPress={() => {
                    setRepairTracker(null);
                    setRepairResult(null);
                  }}
                />
              ) : null}
              <ActionButton
                label={repairIndex + 1 < repairAyahs.length ? 'পরবর্তী আয়াত' : 'সম্পূর্ণ হয়েছে'}
                onPress={nextRepairAyah}
              />
            </View>
          </View>
        )}
      </AppScreen>
    );
  }

  // phase === 'finished'
  const openMistakes = savedMistakes.filter((m) => !m.resolvedAt && m.type !== 'PROMPT');
  return (
    <AppScreen hasTabBar={false} eyebrow="পড়া শেষ" title={`সূরা ${surah.nameBn}`} action={
      <IconAction label="বন্ধ করুন" icon={<X color={colors.ink} size={21} />} onPress={() => router.back()} />
    }>
      <View style={styles.resultHero}>
        <Text style={styles.resultAccuracy}>{summary?.accuracy ?? 0}%</Text>
        <Text style={styles.resultAccuracyLabel}>Overall Recall</Text>
        <View style={styles.resultMetrics}>
          <ResultMetric value={`${summary?.ayahsCompleted ?? 0} / ${summary?.ayahsTotal ?? 0}`} label="আয়াত সম্পন্ন" />
          <ResultMetric value={`${summary?.mistakeCount ?? 0}`} label="ভুল" />
          <ResultMetric value={`${summary?.hintsUsed ?? 0}`} label="Hint" />
          <ResultMetric value={`${summary?.hesitationCount ?? 0}`} label="থেমেছেন" />
        </View>
        <Text style={styles.resultRecallBadge}>
          {summary?.recall === 'clean' ? 'মজবুত' : summary?.recall === 'assisted' ? 'ভালো — আরও রিভিশন দরকার' : 'দুর্বল'}
        </Text>
      </View>

      {openMistakes.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>যেখানে ভুল হয়েছে</Text>
          {openMistakes.map((mistake) => (
            <MistakeCard
              key={mistake.id}
              mistake={mistake}
              surahNumber={surahNumber}
              onPlay={() => void playAyah(mistake.ayahNumber)}
            />
          ))}
          <ActionButton
            label="Fix My Mistakes"
            icon={<Mic color={colors.white} size={20} />}
            onPress={startRepair}
          />
        </>
      ) : (
        <View style={styles.cleanBanner}>
          <Text style={styles.repairCleanText}>মাশাআল্লাহ — কোনো ভুল ধরা পড়েনি।</Text>
        </View>
      )}

      <View style={styles.gap} />
      <ActionButton label="ফিরে যান" tone="quiet" onPress={() => router.back()} />
    </AppScreen>
  );
}

function toMistakeDraft(
  surahNumber: number,
  event: RecitationMistakeEvent,
): Omit<MistakeRecord, 'id' | 'sessionId' | 'occurredAt' | 'source' | 'teacherVerified' | 'resolvedAt'> {
  return {
    ayahKey: `${surahNumber}:${event.ayahNumber}` as AyahKey,
    surahNumber,
    ayahNumber: event.ayahNumber,
    wordPosition: event.wordIndex,
    type: event.type,
    aiConfidence: event.confidence,
  };
}

function ResultMetric({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.resultMetric}>
      <Text style={styles.resultMetricValue}>{value}</Text>
      <Text style={styles.resultMetricLabel}>{label}</Text>
    </View>
  );
}

function MistakeCard({
  mistake,
  surahNumber,
  onPlay,
}: {
  mistake: MistakeRecord;
  surahNumber: number;
  onPlay: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const fonts = useTypography();
  const ayahKey = `${surahNumber}:${mistake.ayahNumber}` as AyahKey;
  const ayah = getAyahs([ayahKey])[0];
  const words = ayah ? getWordSkeletons(ayahKey, ayah.arabic) : [];
  const badge = confidenceLabel(mistake.aiConfidence ?? 0.5);

  return (
    <View style={styles.mistakeCard}>
      <View style={styles.mistakeCardHeader}>
        <Text style={styles.mistakeAyahLabel}>আয়াত {mistake.ayahNumber}</Text>
        <View style={[styles.confidenceBadge, badge === 'possible' && styles.confidenceBadgePossible]}>
          <Text style={styles.confidenceBadgeText}>
            {badge === 'confirmed' ? 'Confirmed mistake' : 'Possible mistake'}
          </Text>
        </View>
      </View>
      {words.length > 0 ? (
        <View style={styles.mistakeWordsRow}>
          {words.map((w, index) => (
            <Text
              key={index}
              style={[
                styles.mistakeWord,
                { fontFamily: fonts.arabicBold },
                mistake.wordPosition === index && styles.mistakeWordHighlighted,
              ]}
            >
              {w.word}
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={styles.mistakeTypeLabel}>{mistakeTypeLabel[mistake.type]}</Text>
      {mistake.type === 'SUBSTITUTION' ? (
        <Text style={styles.mistakeDetail}>
          আপনি {'“'}{mistake.wordPosition !== null ? words[mistake.wordPosition]?.word : ''}
          {'”'} এর জায়গায় ভিন্ন কিছু বলেছেন।
        </Text>
      ) : null}
      <IconAction label="শুনুন" icon={<Volume2 color={colors.primary} size={18} />} onPress={onPlay} />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    notFound: { color: colors.muted, fontFamily: typography.bengali, fontSize: 13 },
    introScreen: { flex: 1, paddingBottom: spacing.xl },
    backButton: { alignSelf: 'flex-start' as const },
    introBody: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.sm,
    },
    introEyebrow: { color: colors.primary, fontFamily: typography.bengaliMedium, fontSize: 13 },
    introTitle: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 26 },
    introArabic: { color: colors.primary, fontSize: 30 },
    introHint: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
      textAlign: 'center' as const,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    micButton: {
      alignSelf: 'center' as const,
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...colors.elevation.card,
    },
    listeningLabel: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 16,
      marginTop: spacing.md,
    },
    ayahProgress: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 40, marginTop: spacing.lg },
    clock: { color: colors.muted, fontFamily: typography.bengali, fontSize: 15, marginTop: spacing.xs },
    hintBanner: {
      marginTop: spacing.xl,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paleGold,
    },
    hintText: { color: colors.ink, fontSize: 22 },
    errorBanner: {
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paleGold,
      alignItems: 'center' as const,
      gap: spacing.xs,
    },
    errorText: { color: colors.ink, fontFamily: typography.bengali, fontSize: 12, textAlign: 'center' as const },
    retryText: { color: colors.primary, fontFamily: typography.bengaliMedium, fontSize: 13 },
    controlRow: {
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      gap: spacing.lg,
      marginBottom: spacing.md,
    },
    repairCard: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      gap: spacing.md,
    },
    repairAyahLabel: { color: colors.primary, fontFamily: typography.bengaliMedium, fontSize: 13 },
    arabicBlock: { paddingVertical: spacing.md },
    arabicText: {
      color: colors.ink,
      fontSize: ARABIC_READING_SIZE,
      lineHeight: ARABIC_READING_SIZE * 1.7,
      textAlign: 'center' as const,
      writingDirection: 'rtl' as const,
    },
    repairResultBlock: { alignItems: 'center' as const, gap: spacing.md },
    repairCleanText: { color: colors.primary, fontFamily: typography.bengaliMedium, fontSize: 15, textAlign: 'center' as const },
    repairMistakeText: { color: colors.coral, fontFamily: typography.bengaliMedium, fontSize: 14, textAlign: 'center' as const },
    repairActions: { width: '100%' as const, gap: spacing.sm },
    resultHero: {
      minHeight: 176,
      marginBottom: spacing.xl,
      padding: spacing.xl,
      borderRadius: radius.lg,
      backgroundColor: colors.spotlight,
      alignItems: 'center' as const,
      ...colors.elevation.card,
    },
    resultAccuracy: { color: colors.onSpotlight, fontFamily: typography.bengaliMedium, fontSize: 48 },
    resultAccuracyLabel: { color: colors.onSpotlightMuted, fontFamily: typography.bengali, fontSize: 12 },
    resultMetrics: {
      marginTop: spacing.lg,
      flexDirection: 'row' as const,
      gap: spacing.lg,
    },
    resultMetric: { alignItems: 'center' as const },
    resultMetricValue: { color: colors.onSpotlight, fontFamily: typography.bengaliMedium, fontSize: 18 },
    resultMetricLabel: { color: colors.onSpotlightMuted, fontFamily: typography.bengali, fontSize: 10, marginTop: 2 },
    resultRecallBadge: {
      marginTop: spacing.lg,
      color: colors.gold,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    sectionTitle: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 16, marginBottom: spacing.md },
    cleanBanner: {
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      alignItems: 'center' as const,
    },
    mistakeCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      gap: spacing.sm,
    },
    mistakeCardHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    mistakeAyahLabel: { color: colors.primary, fontFamily: typography.bengaliMedium, fontSize: 13 },
    confidenceBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
      backgroundColor: colors.mint,
    },
    confidenceBadgePossible: { backgroundColor: colors.paleGold },
    confidenceBadgeText: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 10 },
    mistakeWordsRow: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.xs,
    },
    mistakeWord: { color: colors.ink, fontSize: 20, writingDirection: 'rtl' as const },
    mistakeWordHighlighted: { color: colors.coral, textDecorationLine: 'underline' as const },
    mistakeTypeLabel: { color: colors.coral, fontFamily: typography.bengaliMedium, fontSize: 12 },
    mistakeDetail: { color: colors.muted, fontFamily: typography.bengali, fontSize: 12, lineHeight: 19 },
    gap: { height: spacing.sm },
  };
}
