import { useAudioPlayer } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Pause, Play, RotateCcw, X } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { QuranAyahRow } from '@/components/quran-ayah';
import { getAyahs, quranDemoPack } from '@/data/quran-pack';
import type { AyahKey } from '@/domain/types';
import { resolveAudioSource } from '@/services/audio-cache';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const surahName = (n: number) =>
  quranDemoPack.surahs.find((s) => s.number === n)?.nameBn ?? `সূরা ${n}`;

export default function TeacherReviewScreen() {
  const { ayahKey } = useLocalSearchParams<{ ayahKey: string }>();
  const { approveSabaq, requestMorePractice } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const player = useAudioPlayer();
  const [busy, setBusy] = useState(false);

  const key = ayahKey as AyahKey | undefined;
  const ayah = key ? getAyahs([key])[0] : undefined;

  async function play() {
    if (!ayah) return;
    if (player.playing) {
      player.pause();
      return;
    }
    const source = await resolveAudioSource(ayah.audioUrl);
    player.replace({ uri: source });
    player.play();
  }

  async function act(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      router.back();
    } finally {
      setBusy(false);
    }
  }

  if (!ayah || !key) {
    return (
      <AppScreen scroll={false} hasTabBar={false} contentStyle={styles.center}>
        <Text style={styles.notFound}>আয়াত পাওয়া যায়নি।</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      eyebrow="শুনানি ও অনুমোদন"
      title="Review & Approve"
      hasTabBar={false}
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {surahName(ayah.surahNumber)} — আয়াত {ayah.ayahNumber}
        </Text>
        <QuranAyahRow ayah={ayah} active />
        <IconAction
          label={player.playing ? 'থামান' : 'শুনুন'}
          selected={player.playing}
          icon={
            player.playing ? (
              <Pause color={colors.primary} size={20} fill={colors.primary} />
            ) : (
              <Play color={colors.primary} size={20} fill={colors.primary} />
            )
          }
          onPress={() => void play()}
        />
      </View>

      <ActionButton
        label="Approve"
        disabled={busy}
        icon={<Check color={colors.white} size={20} />}
        onPress={() => void act(() => approveSabaq([key]))}
      />
      <View style={styles.gap} />
      <ActionButton
        label="আরো অনুশীলন"
        tone="quiet"
        disabled={busy}
        icon={<RotateCcw color={colors.primary} size={20} />}
        onPress={() => void act(() => requestMorePractice(key))}
      />
      <View style={styles.gap} />
      <ActionButton
        label="Reject"
        tone="danger"
        disabled={busy}
        icon={<X color={colors.white} size={20} />}
        onPress={() => router.back()}
      />
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    notFound: { color: colors.muted, fontFamily: typography.bengali, fontSize: 13 },
    card: {
      marginBottom: spacing.xl,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      gap: spacing.sm,
    },
    cardTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 14,
    },
    gap: { height: spacing.sm },
  };
}
