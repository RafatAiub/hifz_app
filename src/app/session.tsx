import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Check,
  Eye,
  Link2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { QuranAyahRow } from '@/components/quran-ayah';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { Waveform } from '@/components/waveform';
import { getAyahs, quranDemoPack } from '@/data/quran-pack';
import { getPrecedingAyahKeys } from '@/domain/planner';
import type {
  AyahKey,
  AyahOutcome,
  QuranAyah,
  RecallRating,
  SessionStepKind,
  SurahTestResult,
} from '@/domain/types';
import { resolveAudioSource } from '@/services/audio-cache';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

type Phase = 'review' | 'listen' | 'attempt' | 'chain' | 'rate' | 'surah-test';
type MaskLevel = 0 | 1 | 2;
type SessionUnit = { ayah: QuranAyah; kind: SessionStepKind };

const ratingOptions: Array<{ value: RecallRating; label: string; note: string }> = [
  { value: 'again', label: 'আবার', note: 'এখনো স্বাধীনভাবে হয়নি' },
  { value: 'hard', label: 'কঠিন', note: 'হয়েছে, তবে থামতে হয়েছে' },
  { value: 'good', label: 'ভালো', note: 'স্বচ্ছন্দে বলতে পেরেছি' },
  { value: 'easy', label: 'সহজ', note: 'একদম স্থির ছিল' },
];

const phaseCopy: Record<Phase, { label: string; title: string; hint: string }> = {
  review: {
    label: 'ঝালাই',
    title: 'মনে থেকে বলুন',
    hint: 'শব্দে ট্যাপ করলে hint খুলবে। শেষে সত্যি rating দিন।',
  },
  listen: {
    label: 'শোনা',
    title: 'একবার গভীরভাবে শুনুন',
    hint: 'মাখরাজ, বিরতি ও ছন্দ লক্ষ্য করুন। তারপর দ্রুত recall-এ যাবেন।',
  },
  attempt: {
    label: 'Active recall',
    title: 'সহায়তা ধীরে ধীরে কমান',
    hint: 'App আপনার সফলতার সাথে text আড়াল করবে।',
  },
  chain: {
    label: 'সংযোগ',
    title: 'আগের আয়াত থেকে মিলিয়ে বলুন',
    hint: 'হিফজ শুধু আলাদা আয়াত নয়; transition-টিও মনে থাকতে হবে।',
  },
  rate: {
    label: 'Evidence',
    title: 'এই আয়াত কতটা স্থির?',
    hint: 'আপনার উত্তর দিয়েই পরের review date তৈরি হবে।',
  },
  'surah-test': {
    label: 'সামি‘ test',
    title: 'পুরো সূরা না দেখে শুনান',
    hint: 'Text বন্ধ থাকবে। শেষে নিজে শুনুন বা teacher-কে পাঠান।',
  },
};

function averageRating(ratings: RecallRating[]): RecallRating {
  if (!ratings.length) return 'good';
  const score = { again: 0, hard: 1, good: 2, easy: 3 } as const;
  const average = ratings.reduce((sum, rating) => sum + score[rating], 0) / ratings.length;
  return average < 0.75 ? 'again' : average < 1.5 ? 'hard' : average < 2.5 ? 'good' : 'easy';
}

export default function SessionScreen() {
  const { plan, profile, completeSession } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const units = useMemo<SessionUnit[]>(() => {
    if (!plan) return [];
    return plan.steps.flatMap((step) =>
      getAyahs(step.ayahKeys).map((ayah) => ({ ayah, kind: step.kind })),
    );
  }, [plan]);
  const newAyahKeys = useMemo(
    () => new Set(units.filter((item) => item.kind === 'new').map((item) => item.ayah.key)),
    [units],
  );
  const [unitIndex, setUnitIndex] = useState(0);
  const unit = units[unitIndex];
  const [phase, setPhase] = useState<Phase>(unit?.kind === 'new' ? 'listen' : 'review');
  const [maskLevel, setMaskLevel] = useState<MaskLevel>(0);
  const [attemptHints, setAttemptHints] = useState(0);
  const [ayahHints, setAyahHints] = useState(0);
  const [ayahRepetitions, setAyahRepetitions] = useState(0);
  const [cleanLevelTwoPasses, setCleanLevelTwoPasses] = useState(0);
  const [outcomes, setOutcomes] = useState<AyahOutcome[]>([]);
  const [rating, setRating] = useState<RecallRating>('good');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [surahTest, setSurahTest] = useState<SurahTestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [waveformSamples, setWaveformSamples] = useState<number[]>([]);
  const player = useAudioPlayer();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 120);

  const currentAyah = unit?.ayah;
  const currentSurah = currentAyah
    ? quranDemoPack.surahs.find((surah) => surah.number === currentAyah.surahNumber)
    : undefined;
  const allowedPreceding = new Set<AyahKey>([
    ...(profile?.memorizedAyahKeys ?? []),
    ...outcomes.map((outcome) => outcome.ayahKey),
  ]);
  const precedingAyahs = currentAyah
    ? getAyahs(getPrecedingAyahKeys(currentAyah.key, quranDemoPack, allowedPreceding))
    : [];
  const progress = units.length ? Math.min(1, (unitIndex + phaseProgress(phase)) / units.length) : 0;
  const currentCopy = phaseCopy[phase];

  async function playAyah(ayah = currentAyah) {
    if (!ayah) return;
    setBusy(true);
    try {
      const uri = await resolveAudioSource(ayah.audioUrl);
      player.replace({ uri });
      player.play();
      setAyahRepetitions((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  function registerHint() {
    setAttemptHints((value) => value + 1);
    setAyahHints((value) => value + 1);
  }

  function startAttempt() {
    setMaskLevel(0);
    setAttemptHints(0);
    setFeedback('প্রথমবার পুরো text দেখে পড়ুন। এরপর cue কমবে।');
    setPhase('attempt');
  }

  function submitAttempt(reportedClean: boolean) {
    const clean = reportedClean && attemptHints === 0;
    setAyahRepetitions((value) => value + 1);
    setAttemptHints(0);

    if (!clean) {
      setCleanLevelTwoPasses(0);
      setMaskLevel((level) => (level === 2 ? 1 : level));
      setFeedback('ঠিক আছে। Cue এক ধাপ বাড়ানো হলো; আবার শান্তভাবে চেষ্টা করুন।');
      void Haptics.selectionAsync();
      return;
    }

    if (maskLevel < 2) {
      setMaskLevel((level) => (level + 1) as MaskLevel);
      setFeedback(maskLevel === 0 ? 'এবার শুধু শব্দের শুরু থাকবে।' : 'এবার পুরো আয়াত আড়ালে।');
      void Haptics.selectionAsync();
      return;
    }

    const nextPasses = cleanLevelTwoPasses + 1;
    setCleanLevelTwoPasses(nextPasses);
    if (nextPasses < 2) {
      setFeedback('একটি clean recall হয়েছে। স্থির করতে আর একবার বলুন।');
      return;
    }
    if (precedingAyahs.length) {
      setFeedback('আয়াতটি তৈরি। এবার আগের আয়াতের সাথে সংযোগ করুন।');
      setPhase('chain');
    } else {
      setPhase('rate');
    }
  }

  function submitChain(clean: boolean) {
    if (!clean || attemptHints > 0) {
      setAttemptHints(0);
      setCleanLevelTwoPasses(0);
      setMaskLevel(1);
      setFeedback('Transition-এ সাহায্য লেগেছে। Cue নিয়ে আয়াতটি আরেকবার শক্ত করুন।');
      setPhase('attempt');
      return;
    }
    setAttemptHints(0);
    setPhase('rate');
  }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      setRecordingUri(recorder.uri);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      return;
    }
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setFeedback('Microphone permission না থাকলেও session চালিয়ে যেতে পারবেন।');
      return;
    }
    setWaveformSamples([]);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  useEffect(() => {
    if (!recorderState.isRecording) return;
    const normalized = Math.max(0, Math.min(1, ((recorderState.metering ?? -60) + 60) / 60));
    setWaveformSamples((values) =>
      values[values.length - 1] === normalized ? values : [...values, normalized].slice(-54),
    );
  }, [recorderState.isRecording, recorderState.metering]);

  function rateReview(value: RecallRating) {
    if (!currentAyah) return;
    const outcome: AyahOutcome = {
      ayahKey: currentAyah.key,
      rating: value,
      hints: ayahHints,
      repetitions: ayahRepetitions,
      cleanLevelTwoPasses: value === 'again' ? 0 : 1,
      linkedWithPrevious: false,
    };
    const nextOutcomes = [...outcomes, outcome];
    setOutcomes(nextOutcomes);
    moveToNextUnit(nextOutcomes);
  }

  function saveAyahOutcome() {
    if (!currentAyah) return;
    const outcome: AyahOutcome = {
      ayahKey: currentAyah.key,
      rating,
      hints: ayahHints,
      repetitions: ayahRepetitions,
      cleanLevelTwoPasses,
      linkedWithPrevious: precedingAyahs.length > 0,
    };
    const nextOutcomes = [...outcomes, outcome];
    setOutcomes(nextOutcomes);
    moveToNextUnit(nextOutcomes);
  }

  function moveToNextUnit(nextOutcomes = outcomes) {
    const nextIndex = unitIndex + 1;
    if (nextIndex < units.length) {
      const next = units[nextIndex]!;
      setUnitIndex(nextIndex);
      resetAyahState();
      setPhase(next.kind === 'new' ? 'listen' : 'review');
      return;
    }

    const testSurah = findCompletedSurah(
      nextOutcomes.filter((outcome) => newAyahKeys.has(outcome.ayahKey)),
      profile?.memorizedAyahKeys ?? [],
    );
    if (testSurah) {
      setPhase('surah-test');
      setRecordingUri(null);
      setWaveformSamples([]);
    } else {
      void finish(nextOutcomes, null);
    }
  }

  function resetAyahState() {
    setMaskLevel(0);
    setAttemptHints(0);
    setAyahHints(0);
    setAyahRepetitions(0);
    setCleanLevelTwoPasses(0);
    setRecordingUri(null);
    setWaveformSamples([]);
    setRating('good');
    setFeedback('');
  }

  function findCompletedSurah(nextOutcomes: AyahOutcome[], memorized: AyahKey[]) {
    const nowKnown = new Set<AyahKey>([...memorized, ...nextOutcomes.map((item) => item.ayahKey)]);
    const touchedSurahs = Array.from(new Set(nextOutcomes.map((item) => Number(item.ayahKey.split(':')[0]))));
    return quranDemoPack.surahs.find((surah) => {
      if (!touchedSurahs.includes(surah.number)) return false;
      const keys = quranDemoPack.ayahs
        .filter((ayah) => ayah.surahNumber === surah.number)
        .map((ayah) => ayah.key);
      return keys.length === surah.ayahCount && keys.every((key) => nowKnown.has(key));
    });
  }

  async function finish(nextOutcomes = outcomes, nextSurahTest = surahTest) {
    setBusy(true);
    try {
      const completedNewAyahKeys = nextOutcomes
        .filter((outcome) => newAyahKeys.has(outcome.ayahKey))
        .map((outcome) => outcome.ayahKey);
      const aggregateRating = averageRating(nextOutcomes.map((outcome) => outcome.rating));
      await completeSession({
        rating: aggregateRating,
        repetitions: nextOutcomes.reduce((sum, outcome) => sum + outcome.repetitions, 0),
        hints: nextOutcomes.reduce((sum, outcome) => sum + outcome.hints, 0),
        recordingUri: nextSurahTest?.recordingUri ?? recordingUri,
        newAyahKeys: completedNewAyahKeys,
        ayahOutcomes: nextOutcomes,
        surahTest: nextSurahTest,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  async function shareRecording() {
    if (!recordingUri || !(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(recordingUri, { dialogTitle: 'তিলাওয়াত teacher-কে পাঠান' });
  }

  if (!plan || !unit || !currentAyah) {
    return (
      <AppScreen scroll={false} hasTabBar={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (phase === 'surah-test') {
    const testSurah = findCompletedSurah(
      outcomes.filter((outcome) => newAyahKeys.has(outcome.ayahKey)),
      profile?.memorizedAyahKeys ?? [],
    );
    return (
      <AppScreen scroll={false} hasTabBar={false} contentStyle={styles.sessionScreen}>
        <SessionHeader
          label={currentCopy.label}
          title={currentCopy.title}
          hint={currentCopy.hint}
          onClose={() => router.back()}
        />
        <View style={styles.surahTestHero}>
          <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
          <Text style={styles.surahTestTitle}>সূরা {testSurah?.nameBn}</Text>
          <Text style={styles.surahTestArabic}>{testSurah?.nameArabic}</Text>
          <View style={styles.closedMushaf}>
            <Eye color={colors.gold} size={22} />
            <Text style={styles.closedText}>Mushaf বন্ধ · পুরো সূরা একসাথে</Text>
          </View>
        </View>
        <View style={styles.recordDock}>
          <ActionButton
            label={
              recorderState.isRecording
                ? `শুনানি থামান · ${Math.round(recorderState.durationMillis / 1000)}s`
                : recordingUri
                  ? 'আবার শুনান'
                  : 'শুনানি শুরু করুন'
            }
            tone={recorderState.isRecording ? 'danger' : 'primary'}
            icon={recorderState.isRecording ? <Square color={colors.white} size={19} /> : <Mic color={colors.white} size={20} />}
            onPress={() => void toggleRecording()}
          />
          {waveformSamples.length ? <Waveform samples={waveformSamples} label="পুরো সূরার তিলাওয়াত" /> : null}
          {recordingUri ? (
            <View style={styles.inlineActions}>
              <IconAction
                label={player.playing ? 'থামান' : 'নিজের শুনানি শুনুন'}
                icon={player.playing ? <Pause color={colors.primary} size={20} /> : <Play color={colors.primary} size={20} />}
                onPress={() => {
                  if (player.playing) player.pause();
                  else { player.replace({ uri: recordingUri }); player.play(); }
                }}
              />
              <IconAction label="Teacher-কে পাঠান" icon={<Share2 color={colors.primary} size={20} />} onPress={() => void shareRecording()} />
            </View>
          ) : null}
          <ActionButton
            label="না দেখে সম্পন্ন করেছি"
            tone="quiet"
            disabled={!recordingUri}
            icon={<Check color={colors.primary} size={20} />}
            onPress={() => {
              const result: SurahTestResult = {
                surahNumber: testSurah?.number ?? currentAyah.surahNumber,
                recordingUri,
                reviewMode: 'self',
                completedUnaided: true,
              };
              setSurahTest(result);
              void finish(outcomes, result);
            }}
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} hasTabBar={false} contentStyle={styles.sessionScreen}>
      <SessionHeader
        label={currentCopy.label}
        title={currentCopy.title}
        hint={currentCopy.hint}
        onClose={() => router.back()}
      />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.surahName}>সূরা {currentSurah?.nameBn}</Text>
        <Text style={styles.counter}>{unitIndex + 1}/{units.length} · আয়াত {currentAyah.ayahNumber}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.mushaf} showsVerticalScrollIndicator={false}>
        {phase === 'chain' ? (
          <>
            {precedingAyahs.map((ayah) => (
              <View key={ayah.key} style={styles.precedingAyah}>
                <Text style={styles.linkLabel}>আগের আয়াত</Text>
                <QuranAyahRow ayah={ayah} />
              </View>
            ))}
            <View style={styles.linkDivider}>
              <Link2 color={colors.gold} size={18} />
              <Text style={styles.linkDividerText}>এখান থেকে নতুন আয়াতে যান</Text>
            </View>
          </>
        ) : null}
        <QuranAyahRow
          key={`${currentAyah.key}-${phase}-${maskLevel}`}
          ayah={currentAyah}
          active={phase !== 'listen'}
          maskLevel={phase === 'attempt' ? maskLevel : phase === 'chain' || phase === 'review' ? 2 : undefined}
          onWordReveal={registerHint}
        />
      </ScrollView>

      {feedback ? (
        <View style={styles.feedback} accessibilityLiveRegion="polite">
          <Sparkles color={colors.gold} size={17} />
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      <View style={styles.controlDock}>
        {phase === 'listen' ? (
          <>
            <ActionButton
              label={busy ? 'Audio প্রস্তুত হচ্ছে' : 'রেফারেন্স শুনুন'}
              loading={busy}
              icon={<Volume2 color={colors.white} size={20} />}
              onPress={() => void playAyah()}
            />
            <Pressable style={styles.textAction} onPress={startAttempt}>
              <Text style={styles.textActionLabel}>শুনেছি · এখন মনে থেকে বলি</Text>
              <ArrowLeft color={colors.primary} size={18} />
            </Pressable>
          </>
        ) : null}

        {phase === 'attempt' ? (
          <>
            <View style={styles.masteryRow}>
              {[0, 1, 2].map((level) => (
                <View key={level} style={styles.masteryItem}>
                  <View style={[styles.masteryDot, maskLevel >= level && styles.masteryDotActive]} />
                  <Text style={[styles.masteryLabel, maskLevel === level && styles.masteryLabelActive]}>
                    {level === 0 ? 'দেখে' : level === 1 ? 'অক্ষর cue' : `আড়ালে ${cleanLevelTwoPasses}/2`}
                  </Text>
                </View>
              ))}
            </View>
            <ActionButton
              label={maskLevel === 0 ? 'পড়েছি · cue কমান' : 'পরিষ্কার বলতে পেরেছি'}
              icon={<Check color={colors.white} size={20} />}
              onPress={() => submitAttempt(true)}
            />
            {maskLevel > 0 ? (
              <Pressable style={styles.textAction} onPress={() => submitAttempt(false)}>
                <RotateCcw color={colors.primary} size={18} />
                <Text style={styles.textActionLabel}>Hint লেগেছে · আরেকবার</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {phase === 'chain' ? (
          <>
            <ActionButton label="সংযোগ পরিষ্কার হয়েছে" icon={<Link2 color={colors.white} size={20} />} onPress={() => submitChain(true)} />
            <Pressable style={styles.textAction} onPress={() => submitChain(false)}>
              <RotateCcw color={colors.primary} size={18} />
              <Text style={styles.textActionLabel}>Transition-এ থেমেছি</Text>
            </Pressable>
          </>
        ) : null}

        {phase === 'rate' ? (
          <>
            <RatingGrid selected={rating} onSelect={setRating} />
            <ActionButton label="আয়াতটি সংরক্ষণ করুন" icon={<Check color={colors.white} size={20} />} onPress={saveAyahOutcome} />
          </>
        ) : null}

        {phase === 'review' ? (
          <>
            <Text style={styles.reviewQuestion}>না দেখে কেমন হলো?</Text>
            <RatingGrid selected={null} onSelect={rateReview} compact />
          </>
        ) : null}
      </View>
    </AppScreen>
  );
}

function phaseProgress(phase: Phase) {
  return { review: 0.7, listen: 0.1, attempt: 0.4, chain: 0.65, rate: 0.9, 'surah-test': 1 }[phase];
}

function SessionHeader({ label, title, hint, onClose }: { label: string; title: string; hint: string; onClose(): void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.phaseLabel}>{label}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <IconAction label="Session বন্ধ করুন" icon={<X color={colors.ink} size={21} />} onPress={onClose} />
    </View>
  );
}

function RatingGrid({ selected, onSelect, compact = false }: { selected: RecallRating | null; onSelect(value: RecallRating): void; compact?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.ratingGrid}>
      {ratingOptions.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === option.value }}
          onPress={() => onSelect(option.value)}
          style={[styles.ratingOption, selected === option.value && styles.ratingSelected]}
        >
          <View style={[styles.ratingMark, selected === option.value && styles.ratingMarkSelected]}>
            {selected === option.value ? <Check color={colors.white} size={13} /> : null}
          </View>
          <View style={styles.ratingCopy}>
            <Text style={[styles.ratingLabel, selected === option.value && styles.ratingLabelSelected]}>{option.label}</Text>
            {!compact ? <Text style={styles.ratingNote}>{option.note}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    sessionScreen: { paddingBottom: spacing.md },
    center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    header: { minHeight: 104, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    headerCopy: { flex: 1 },
    phaseLabel: { color: colors.gold, fontFamily: typography.bengaliMedium, fontSize: 11, textTransform: 'uppercase' as const },
    title: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 23, lineHeight: 32 },
    hint: { color: colors.muted, fontFamily: typography.bengali, fontSize: 12, lineHeight: 19, marginTop: 2 },
    progressTrack: { height: 3, backgroundColor: colors.line, overflow: 'hidden' as const },
    progressFill: { height: '100%' as const, backgroundColor: colors.gold },
    contextRow: { minHeight: 48, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    surahName: { color: colors.primary, fontFamily: typography.bengaliMedium, fontSize: 13 },
    counter: { color: colors.muted, fontFamily: typography.bengali, fontSize: 12 },
    mushaf: { flexGrow: 1, justifyContent: 'center' as const, minHeight: 260, paddingVertical: spacing.lg },
    precedingAyah: { opacity: 0.72 },
    linkLabel: { color: colors.gold, fontFamily: typography.bengaliMedium, fontSize: 11 },
    linkDivider: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingVertical: spacing.md, borderBottomColor: colors.gold, borderBottomWidth: 1 },
    linkDividerText: { color: colors.muted, fontFamily: typography.bengali, fontSize: 12 },
    feedback: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.md, backgroundColor: colors.paleGold, borderRadius: radius.md, marginBottom: spacing.sm },
    feedbackText: { flex: 1, color: colors.ink, fontFamily: typography.bengali, fontSize: 12, lineHeight: 19 },
    controlDock: { paddingTop: spacing.md, borderTopColor: colors.line, borderTopWidth: 1, gap: spacing.sm },
    textAction: { minHeight: 46, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.sm },
    textActionLabel: { color: colors.primary, fontFamily: typography.bengaliMedium, fontSize: 13 },
    masteryRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: spacing.xs, marginBottom: spacing.sm },
    masteryItem: { flex: 1, alignItems: 'center' as const, gap: spacing.xs },
    masteryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
    masteryDotActive: { backgroundColor: colors.gold },
    masteryLabel: { color: colors.muted, fontFamily: typography.bengali, fontSize: 10, textAlign: 'center' as const },
    masteryLabelActive: { color: colors.ink, fontFamily: typography.bengaliMedium },
    ratingGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginBottom: spacing.sm },
    ratingOption: { width: '48.5%' as const, minHeight: 58, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
    ratingSelected: { backgroundColor: colors.mint, borderColor: colors.primary },
    ratingMark: { width: 22, height: 22, borderRadius: 11, borderColor: colors.line, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    ratingMarkSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    ratingCopy: { flex: 1 },
    ratingLabel: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 13 },
    ratingLabelSelected: { color: colors.primary },
    ratingNote: { color: colors.muted, fontFamily: typography.bengali, fontSize: 9, lineHeight: 14 },
    reviewQuestion: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 14, textAlign: 'center' as const },
    surahTestHero: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, borderTopColor: colors.gold, borderBottomColor: colors.gold, borderTopWidth: 1, borderBottomWidth: 1 },
    bismillah: { color: colors.gold, fontFamily: typography.arabicBold, fontSize: 20, lineHeight: 38 },
    surahTestTitle: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 28, marginTop: spacing.lg },
    surahTestArabic: { color: colors.primary, fontFamily: typography.arabicBold, fontSize: 28 },
    closedMushaf: { marginTop: spacing.xl, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
    closedText: { color: colors.muted, fontFamily: typography.bengali, fontSize: 12 },
    recordDock: { paddingTop: spacing.lg, gap: spacing.sm },
    inlineActions: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: spacing.md },
  };
}
