import { useAudioPlayer } from 'expo-audio';
import { AlertTriangle, ChevronLeft, Download, Pause, Play, Search, WifiOff, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { QuranAyahRow } from '@/components/quran-ayah';
import { AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { resolveAudioSource } from '@/services/audio-cache';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

export default function QuranScreen() {
  const [openSurah, setOpenSurah] = useState<number | null>(null);

  return openSurah === null ? (
    <SurahList onSelect={setOpenSurah} />
  ) : (
    <SurahDetail surahNumber={openSurah} onBack={() => setOpenSurah(null)} />
  );
}

function SurahList({ onSelect }: { onSelect: (surahNumber: number) => void }) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return quranDemoPack.surahs;
    return quranDemoPack.surahs.filter(
      (surah) =>
        surah.nameBn.toLowerCase().includes(needle) ||
        surah.nameArabic.includes(needle) ||
        String(surah.number).includes(needle),
    );
  }, [query]);

  return (
    <AppScreen eyebrow="IndoPak 16-line" title="কুরআন">
      <View style={styles.searchRow}>
        <Search color={colors.muted} size={18} />
        <TextInput
          accessibilityLabel="সূরা খুঁজুন"
          value={query}
          onChangeText={setQuery}
          placeholder="সূরার নাম বা নম্বর দিয়ে খুঁজুন"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
        {query ? (
          <Pressable accessibilityLabel="মুছুন" onPress={() => setQuery('')} hitSlop={8}>
            <X color={colors.muted} size={18} />
          </Pressable>
        ) : null}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.noResults}>কোনো সূরা পাওয়া যায়নি।</Text>
      ) : null}

      <View style={styles.list}>
        {filtered.map((surah) => (
          <Pressable
            key={surah.number}
            style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
            onPress={() => onSelect(surah.number)}
          >
            <View style={styles.listNumber}>
              <Text style={styles.listNumberText}>{surah.number}</Text>
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle} numberOfLines={1}>
                {surah.nameBn} · {surah.nameArabic}
              </Text>
              <Text style={styles.listMeta}>{surah.ayahCount} আয়াত</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

function SurahDetail({
  surahNumber,
  onBack,
}: {
  surahNumber: number;
  onBack: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const player = useAudioPlayer();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const surah = quranDemoPack.surahs.find((s) => s.number === surahNumber);
  const ayahs = useMemo(
    () => quranDemoPack.ayahs.filter((a) => a.surahNumber === surahNumber),
    [surahNumber],
  );
  const hasUnverifiedLines = ayahs.some((a) => !a.lineDataVerified);
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
      await Promise.all(ayahs.map((ayah) => resolveAudioSource(ayah.audioUrl)));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppScreen
      eyebrow="IndoPak 16-line"
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
      <Pressable style={styles.backRow} onPress={onBack} accessibilityRole="button">
        <ChevronLeft color={colors.primary} size={18} />
        <Text style={styles.backLabel}>সূরার তালিকা</Text>
      </Pressable>

      <View style={styles.surahHeader}>
        <Text style={styles.surahTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta}>{surah?.ayahCount ?? 0} আয়াত</Text>
      </View>

      <View style={styles.offlineNote}>
        <WifiOff color={colors.primary} size={18} />
        <Text style={styles.offlineText}>
          একবার download হলে পুরো সূরা airplane mode-এ শুনতে পারবেন।
        </Text>
      </View>

      {hasUnverifiedLines ? (
        <View style={styles.warningNote}>
          <AlertTriangle color={colors.danger} size={18} />
          <Text style={styles.warningText}>
            এই সূরার লাইন বিভাজন IndoPak 16-line mushaf layout-এর official data থেকে নেওয়া, কিন্তু
            এখনো একজন আলেম দ্বারা সরাসরি যাচাই করা হয়নি।
          </Text>
        </View>
      ) : null}

      {ayahs.map((ayah) => (
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
            <Text style={styles.listenLabel}>আয়াত {ayah.ayahNumber} শুনুন</Text>
          </View>
        </View>
      ))}

      <Text style={styles.attribution}>
        Quran text: {quranDemoPack.sourceName}. Audio: EveryAyah / Alafasy.
      </Text>
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    searchRow: {
      marginTop: spacing.md,
      minHeight: 48,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      height: 46,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 14,
    },
    noResults: {
      marginTop: spacing.lg,
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
      textAlign: 'center' as const,
    },
    list: {
      marginTop: spacing.md,
    },
    listRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomColor: colors.line,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    listRowPressed: {
      opacity: 0.7,
    },
    listNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.mint,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    listNumberText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    listCopy: {
      flex: 1,
    },
    listTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 15,
    },
    listMeta: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 12,
      marginTop: 2,
    },
    backRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
      paddingVertical: spacing.sm,
    },
    backLabel: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 14,
    },
    surahHeader: {
      paddingVertical: spacing.lg,
      borderTopColor: colors.line,
      borderBottomColor: colors.line,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: spacing.md,
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
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    offlineText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    warningNote: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paleGold,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    warningText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    audioRow: {
      minHeight: 56,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
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
  };
}
