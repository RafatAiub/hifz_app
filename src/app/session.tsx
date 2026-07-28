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
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Square,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useApp } from '@/app-state/provider';
import { QuranAyahRow } from '@/components/quran-ayah';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { getAyahs } from '@/data/quran-pack';
import type { RecallRating } from '@/domain/types';
import { resolveAudioSource } from '@/services/audio-cache';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const stages = [
  { key: 'listen', title: 'মন দিয়ে শুনুন', hint: 'প্রতি আয়াত শুনে মুখে ধীরে বলুন।' },
  { key: 'read', title: 'দেখে পুনরাবৃত্তি', hint: 'শব্দ ও থামার জায়গা লক্ষ্য করুন।' },
  { key: 'recite', title: 'এবার না দেখে', hint: 'ভুলে গেলে hint নিতে পারেন।' },
  { key: 'record', title: 'নিজেকে শুনান', hint: 'Record করে একবার নিজেই শুনুন।' },
  { key: 'rate', title: 'আজ কেমন হলো?', hint: 'সত্যি অনুভূতিটা বেছে নিন।' },
] as const;

export default function SessionScreen() {
  const { plan, completeSession } = useApp();
  const ayahs = useMemo(
    () => getAyahs(plan?.steps.flatMap((step) => step.ayahKeys) ?? []),
    [plan],
  );
  const [stageIndex, setStageIndex] = useState(0);
  const [ayahIndex, setAyahIndex] = useState(0);
  const [repetitions, setRepetitions] = useState(0);
  const [hints, setHints] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState<RecallRating>('good');
  const player = useAudioPlayer();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  const stage = stages[stageIndex] ?? stages[0];
  const currentAyah = ayahs[ayahIndex] ?? ayahs[0];

  async function playAyah() {
    if (!currentAyah) return;
    setBusy(true);
    try {
      const uri = await resolveAudioSource(currentAyah.audioUrl);
      player.replace({ uri });
      player.play();
      setRepetitions((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      setRecordingUri(recorder.uri);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      return;
    }
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  function moveAyah() {
    if (ayahIndex < ayahs.length - 1) {
      setAyahIndex((value) => value + 1);
      setRevealed(false);
      return;
    }
    setAyahIndex(0);
    setStageIndex((value) => Math.min(stages.length - 1, value + 1));
    setRevealed(false);
    void Haptics.selectionAsync();
  }

  async function finish() {
    setBusy(true);
    try {
      await completeSession({
        rating,
        repetitions,
        hints,
        recordingUri,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  async function shareRecording() {
    if (!recordingUri || !(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(recordingUri, {
      dialogTitle: 'আজকের তিলাওয়াত শেয়ার করুন',
    });
  }

  if (!plan || !currentAyah) {
    return (
      <AppScreen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      scroll={false}
      contentStyle={styles.screen}
      title={stage.title}
      eyebrow={`${stageIndex + 1}/${stages.length} · ${stage.hint}`}
      action={
        <IconAction
          label="Session বন্ধ করুন"
          icon={<X color={colors.ink} size={22} />}
          onPress={() => router.back()}
        />
      }
    >
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((stageIndex + 1) / stages.length) * 100}%` },
          ]}
        />
      </View>

      {stage.key === 'rate' ? (
        <View style={styles.ratingArea}>
          <Text style={styles.ratingQuestion}>
            না দেখে বলার সময় কতটা স্বস্তি ছিল?
          </Text>
          <View style={styles.ratings}>
            {(
              [
                ['again', 'আবার দরকার'],
                ['hard', 'কঠিন ছিল'],
                ['good', 'ভালো হয়েছে'],
                ['easy', 'সহজ ছিল'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: rating === value }}
                onPress={() => setRating(value)}
                style={[
                  styles.rating,
                  rating === value && styles.ratingSelected,
                ]}
              >
                <View style={styles.ratingCheck}>
                  {rating === value ? (
                    <Check color={colors.white} size={15} />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.ratingLabel,
                    rating === value && styles.ratingLabelSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <ActionButton
            label="আজকের session শেষ করুন"
            loading={busy}
            icon={<Check color={colors.white} size={21} />}
            onPress={() => void finish()}
          />
        </View>
      ) : (
        <>
          <View style={styles.mushaf}>
            <View style={styles.mushafMeta}>
              <Text style={styles.surah}>সূরা আল-ইখলাস</Text>
              <Text style={styles.ayahCounter}>
                আয়াত {ayahIndex + 1}/{ayahs.length}
              </Text>
            </View>
            <QuranAyahRow
              ayah={currentAyah}
              active
              hidden={stage.key === 'recite' && !revealed}
            />
          </View>

          <View style={styles.controls}>
            {stage.key === 'listen' ? (
              <ActionButton
                label={busy ? 'Audio প্রস্তুত হচ্ছে' : 'আয়াতটি শুনুন'}
                loading={busy}
                icon={<Play color={colors.white} size={21} fill={colors.white} />}
                onPress={() => void playAyah()}
              />
            ) : null}

            {stage.key === 'read' ? (
              <View style={styles.repeatRow}>
                <IconAction
                  label="আরেকবার পড়েছি"
                  icon={<RotateCcw color={colors.primary} size={22} />}
                  onPress={() => setRepetitions((value) => value + 1)}
                />
                <Text style={styles.repeatText}>
                  {repetitions} বার পুনরাবৃত্তি
                </Text>
              </View>
            ) : null}

            {stage.key === 'recite' ? (
              <ActionButton
                label={revealed ? 'আয়াত আবার ঢাকুন' : 'একটি hint দেখুন'}
                tone="quiet"
                icon={
                  revealed ? (
                    <EyeOff color={colors.primary} size={21} />
                  ) : (
                    <Eye color={colors.primary} size={21} />
                  )
                }
                onPress={() => {
                  setRevealed((value) => !value);
                  if (!revealed) setHints((value) => value + 1);
                }}
              />
            ) : null}

            {stage.key === 'record' ? (
              <>
                <ActionButton
                  label={
                    recorderState.isRecording
                      ? `Recording থামান · ${Math.round(
                          recorderState.durationMillis / 1000,
                        )}s`
                      : recordingUri
                        ? 'আবার record করুন'
                        : 'তিলাওয়াত record করুন'
                  }
                  tone={recorderState.isRecording ? 'danger' : 'primary'}
                  icon={
                    recorderState.isRecording ? (
                      <Square color={colors.white} size={20} fill={colors.white} />
                    ) : (
                      <Mic color={colors.white} size={21} />
                    )
                  }
                  onPress={() => void toggleRecording()}
                />
                {recordingUri ? (
                  <View style={styles.recordingActions}>
                    <IconAction
                      label={player.playing ? 'Recording থামান' : 'Recording শুনুন'}
                      icon={
                        player.playing ? (
                          <Pause color={colors.primary} size={20} />
                        ) : (
                          <Play color={colors.primary} size={20} />
                        )
                      }
                      onPress={() => {
                        if (player.playing) player.pause();
                        else {
                          player.replace({ uri: recordingUri });
                          player.play();
                        }
                      }}
                    />
                    <IconAction
                      label="Teacher-কে শেয়ার করুন"
                      icon={<Share2 color={colors.primary} size={20} />}
                      onPress={() => void shareRecording()}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>

          <View style={styles.bottom}>
            <ActionButton
              label={ayahIndex < ayahs.length - 1 ? 'পরের আয়াত' : 'পরের ধাপ'}
              icon={<ArrowRight color={colors.white} size={21} />}
              onPress={moveAyah}
            />
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.line,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  mushaf: {
    flex: 1,
    minHeight: 286,
    justifyContent: 'center',
    borderTopColor: colors.line,
    borderBottomColor: colors.line,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  mushafMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  surah: {
    color: colors.primary,
    fontFamily: typography.bengaliMedium,
    fontSize: 13,
  },
  ayahCounter: {
    color: colors.muted,
    fontFamily: typography.bengali,
    fontSize: 12,
  },
  controls: {
    minHeight: 114,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
  },
  repeatRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  repeatText: {
    color: colors.ink,
    fontFamily: typography.bengaliMedium,
    fontSize: 15,
  },
  recordingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  bottom: {
    marginTop: 'auto',
  },
  ratingArea: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  ratingQuestion: {
    color: colors.ink,
    fontFamily: typography.bengaliMedium,
    fontSize: 20,
    lineHeight: 31,
    marginBottom: spacing.xl,
  },
  ratings: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  rating: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ratingSelected: {
    backgroundColor: colors.mint,
    borderColor: colors.primary,
  },
  ratingCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingLabel: {
    color: colors.ink,
    fontFamily: typography.bengaliMedium,
    fontSize: 15,
  },
  ratingLabelSelected: {
    color: colors.primary,
  },
});
