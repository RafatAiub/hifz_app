import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { ArrowLeft, Pause, Play, ShieldAlert, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { QuranAyahRow } from '@/components/quran-ayah';
import { getAyahs, quranDemoPack } from '@/data/quran-pack';
import { deriveWeakQueue } from '@/domain/hifz';
import type { AyahKey } from '@/domain/types';
import { resolveAudioSource } from '@/services/audio-cache';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const surahName = (n: number) =>
  quranDemoPack.surahs.find((s) => s.number === n)?.nameBn ?? `সূরা ${n}`;

export default function WeakAyahRepairScreen() {
  const { memoryStates, mistakes } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const player = useAudioPlayer();
  const [activeKey, setActiveKey] = useState<AyahKey | null>(null);

  const queue = useMemo(
    () => deriveWeakQueue({ memoryStates, mistakes }),
    [memoryStates, mistakes],
  );
  const strengthByKey = useMemo(
    () => new Map(memoryStates.map((s) => [s.ayahKey, s.strength])),
    [memoryStates],
  );
  const ayahs = useMemo(() => getAyahs(queue), [queue]);

  async function play(ayahKey: AyahKey, url: string) {
    if (activeKey === ayahKey && player.playing) {
      player.pause();
      return;
    }
    const source = await resolveAudioSource(url);
    player.replace({ uri: source });
    player.play();
    setActiveKey(ayahKey);
  }

  return (
    <AppScreen
      eyebrow="পুনরুদ্ধার"
      title="দুর্বল আয়াত"
      hasTabBar={false}
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      {queue.length === 0 ? (
        <View style={styles.empty}>
          <Sparkles color={colors.gold} size={22} />
          <Text style={styles.emptyText}>কোনো দুর্বল আয়াত নেই — মাশাআল্লাহ।</Text>
        </View>
      ) : (
        <>
          <View style={styles.banner}>
            <ShieldAlert color={colors.coral} size={18} />
            <Text style={styles.bannerText}>
              {queue.length}টি আয়াত বারবার ভুল হচ্ছে — এগুলো আগে পাকা করুন।
            </Text>
          </View>

          {ayahs.map((ayah) => {
            const strength = Math.round((strengthByKey.get(ayah.key) ?? 0) * 100);
            const playing = activeKey === ayah.key && player.playing;
            return (
              <View key={ayah.key} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {surahName(ayah.surahNumber)} — আয়াত {ayah.ayahNumber}
                  </Text>
                  <Text style={[styles.cardStrength, { color: colors.coral }]}>
                    শক্তি {strength}%
                  </Text>
                </View>
                <QuranAyahRow ayah={ayah} active={activeKey === ayah.key} />
                <IconAction
                  label={playing ? 'থামান' : 'শুনুন'}
                  selected={activeKey === ayah.key}
                  icon={
                    playing ? (
                      <Pause color={colors.primary} size={20} fill={colors.primary} />
                    ) : (
                      <Play color={colors.primary} size={20} fill={colors.primary} />
                    )
                  }
                  onPress={() => void play(ayah.key, ayah.audioUrl)}
                />
              </View>
            );
          })}

          <ActionButton
            label="সবগুলো আয়াত নিয়ে কাজ করুন"
            onPress={() => router.push('/session?focus=weakness')}
          />
        </>
      )}
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    empty: {
      marginTop: spacing.xxl,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
      textAlign: 'center' as const,
    },
    banner: {
      marginBottom: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paleGold,
      borderLeftColor: colors.coral,
      borderLeftWidth: 3,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: spacing.sm,
    },
    bannerText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    card: {
      marginBottom: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      gap: spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    cardTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    cardStrength: {
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
  };
}
