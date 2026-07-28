import { useAudioPlayer } from 'expo-audio';
import { Download, Pause, Play, WifiOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { QuranAyahRow } from '@/components/quran-ayah';
import { AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { resolveAudioSource } from '@/services/audio-cache';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function QuranScreen() {
  const player = useAudioPlayer();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const surah = quranDemoPack.surahs[0];
  const title = useMemo(
    () => `${surah?.nameBn ?? 'সূরা'} · ${surah?.nameArabic ?? ''}`,
    [surah],
  );

  async function play(url: string, key: string) {
    if (activeKey === key && player.playing) {
      player.pause();
      return;
    }
    const source = await resolveAudioSource(url);
    player.replace({ uri: source });
    player.play();
    setActiveKey(key);
  }

  async function downloadPack() {
    setDownloading(true);
    try {
      await Promise.all(
        quranDemoPack.ayahs.map((ayah) => resolveAudioSource(ayah.audioUrl)),
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppScreen
      eyebrow="IndoPak 13-line"
      title="কুরআন"
      action={
        <IconAction
          label="সূরার অডিও offline রাখুন"
          disabled={downloading}
          icon={<Download color={colors.ink} size={21} />}
          onPress={() => void downloadPack()}
        />
      }
    >
      <View style={styles.surahHeader}>
        <Text style={styles.surahTitle}>{title}</Text>
        <Text style={styles.meta}>{surah?.ayahCount ?? 0} আয়াত</Text>
      </View>

      <View style={styles.offlineNote}>
        <WifiOff color={colors.primary} size={18} />
        <Text style={styles.offlineText}>
          একবার download হলে পুরো সূরা airplane mode-এ শুনতে পারবেন।
        </Text>
      </View>

      {quranDemoPack.ayahs.map((ayah) => (
        <View key={ayah.key}>
          <QuranAyahRow ayah={ayah} active={activeKey === ayah.key} />
          <View style={styles.audioRow}>
            <IconAction
              label={activeKey === ayah.key && player.playing ? 'থামান' : 'শুনুন'}
              selected={activeKey === ayah.key}
              icon={
                activeKey === ayah.key && player.playing ? (
                  <Pause color={colors.primary} size={20} fill={colors.primary} />
                ) : (
                  <Play color={colors.primary} size={20} fill={colors.primary} />
                )
              }
              onPress={() => void play(ayah.audioUrl, ayah.key)}
            />
            <Text style={styles.listenLabel}>আয়াত {ayah.ayahNumber} শুনুন</Text>
          </View>
        </View>
      ))}

      <Text style={styles.attribution}>
        Quran text: {quranDemoPack.sourceName}. Audio: EveryAyah / Alafasy.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  surahHeader: {
    paddingVertical: spacing.lg,
    borderTopColor: colors.line,
    borderBottomColor: colors.line,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  surahTitle: {
    flex: 1,
    color: colors.ink,
    fontFamily: typography.bengaliMedium,
    fontSize: 18,
  },
  meta: {
    color: colors.muted,
    fontFamily: typography.bengali,
    fontSize: 13,
  },
  offlineNote: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.mint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  offlineText: {
    flex: 1,
    color: colors.ink,
    fontFamily: typography.bengali,
    fontSize: 12,
    lineHeight: 19,
  },
  audioRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listenLabel: {
    color: colors.primary,
    fontFamily: typography.bengaliMedium,
    fontSize: 13,
  },
  attribution: {
    color: colors.muted,
    fontFamily: typography.bengali,
    fontSize: 11,
    lineHeight: 18,
    marginTop: spacing.xl,
  },
});
