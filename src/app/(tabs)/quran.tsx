import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import {
  BookOpen,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  GraduationCap,
  Layers,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Search,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { QuranAyahRow } from '@/components/quran-ayah';
import { AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { deriveSurahRecitationStatus, type SurahLifecycleStage } from '@/domain/recitation';
import { resolveAudioSource } from '@/services/audio-cache';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const lifecycleLabel: Record<SurahLifecycleStage, string> = {
  NOT_STARTED: 'এখনো শুরু হয়নি',
  LEARNING: 'শেখা হচ্ছে',
  MEMORIZING: 'মুখস্থ হচ্ছে',
  READY_FOR_TEST: 'মুখস্থ — পড়া দেওয়ার জন্য প্রস্তুত',
  MEMORIZED: 'মুখস্থ — মজবুত',
  REVISION: 'মুখস্থ — রিভিশনে আছে',
};

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
    <AppScreen eyebrow="IndoPak ১৬-লাইন মুশহাফ লে-আউট" title="কুরআন">
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

const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toEasternDigits(value: number) {
  return String(value)
    .split('')
    .map((d) => EASTERN_ARABIC_DIGITS[Number(d)] ?? d)
    .join('');
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
  const { memoryStates, mistakes, recitationTests } = useApp();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'mushaf' | 'list'>('mushaf');
  const [maskedKeys, setMaskedKeys] = useState<Set<string>>(new Set());
  const [continuousPlaying, setContinuousPlaying] = useState(false);

  const surah = quranDemoPack.surahs.find((s) => s.number === surahNumber);
  const ayahs = useMemo(
    () => quranDemoPack.ayahs.filter((a) => a.surahNumber === surahNumber),
    [surahNumber],
  );
  const status = useMemo(
    () =>
      deriveSurahRecitationStatus({
        surahNumber,
        contentPack: quranDemoPack,
        memoryStates,
        mistakes,
        recitationTests,
      }),
    [surahNumber, memoryStates, mistakes, recitationTests],
  );
  const isMemorized = status.memorizedAyahs === status.totalAyahs && status.totalAyahs > 0;
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

  function toggleMask(key: string) {
    setMaskedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllMasks() {
    if (maskedKeys.size === ayahs.length) {
      setMaskedKeys(new Set());
    } else {
      setMaskedKeys(new Set(ayahs.map((a) => a.key)));
    }
  }

  return (
    <AppScreen
      eyebrow="পবিত্র কুরআনুল কারীম"
      title={viewMode === 'mushaf' ? 'মুসহাফ পাতা' : 'কুরআন'}
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

      <Text style={styles.statusLine}>
        {lifecycleLabel[status.lifecycle]}
        {status.weakWordCount > 0 ? ` · দুর্বল ${status.weakWordCount}` : ''}
      </Text>

      <View style={styles.modeSwitchRow}>
        <Pressable
          style={[styles.modeTab, viewMode === 'mushaf' && styles.modeTabActive]}
          onPress={() => setViewMode('mushaf')}
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === 'mushaf' }}
        >
          <BookOpen color={viewMode === 'mushaf' ? colors.primary : colors.muted} size={16} />
          <Text style={[styles.modeTabText, viewMode === 'mushaf' && styles.modeTabTextActive]}>
            মুসহাফ পাতা (Real Quran)
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, viewMode === 'list' && styles.modeTabActive]}
          onPress={() => setViewMode('list')}
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === 'list' }}
        >
          <Layers color={viewMode === 'list' ? colors.primary : colors.muted} size={16} />
          <Text style={[styles.modeTabText, viewMode === 'list' && styles.modeTabTextActive]}>
            আয়াত ও অনুবাদ
          </Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        {isMemorized ? (
          <Pressable
            style={styles.recitationPrimary}
            onPress={() => router.push(`/recitation-test?surahNumber=${surahNumber}`)}
          >
            <Mic color={colors.white} size={18} />
            <Text style={styles.recitationPrimaryText}>পড়া দিন</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.actionSecondary} onPress={() => router.push('/plan')}>
            <GraduationCap color={colors.primary} size={16} />
            <Text style={styles.actionSecondaryText}>হিফজ শুরু করুন</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.actionSecondary}
          onPress={() =>
            router.push(status.weakWordCount > 0 ? '/weak-repair' : '/plan')
          }
        >
          <RotateCcw color={colors.primary} size={16} />
          <Text style={styles.actionSecondaryText}>রিভিশন করুন</Text>
        </Pressable>
      </View>

      {viewMode === 'mushaf' ? (
        <View style={styles.mushafContainer}>
          <View style={styles.mushafControlStrip}>
            <Pressable
              style={styles.maskAllBtn}
              onPress={toggleAllMasks}
              accessibilityRole="button"
            >
              {maskedKeys.size === ayahs.length ? (
                <>
                  <Eye color={colors.primary} size={16} />
                  <Text style={styles.maskAllText}>সব আয়াত দেখান</Text>
                </>
              ) : (
                <>
                  <EyeOff color={colors.primary} size={16} />
                  <Text style={styles.maskAllText}>হিফজ টেস্ট (সব ঢাকুন)</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.mushafHint}>আয়াতে ট্যাপ করে ঢাকুন/খুলুন</Text>
          </View>

          <View style={styles.mushafPageFrame}>
            <View style={styles.mushafInnerFrame}>
              <View style={styles.surahBanner}>
                <View style={styles.surahBannerLine} />
                <View style={styles.surahBannerCenter}>
                  <Text style={styles.surahBannerArabic}>{surah?.nameArabic}</Text>
                  <Text style={styles.surahBannerMeta}>
                    সূরা {surah?.nameBn} · {surah?.ayahCount} আয়াত
                  </Text>
                </View>
                <View style={styles.surahBannerLine} />
              </View>

              <View style={styles.bismillahWrap}>
                <Text style={styles.bismillahArabic}>
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </Text>
              </View>

              <View style={styles.mushafTextContainer}>
                {ayahs.map((ayah) => {
                  const isMasked = maskedKeys.has(ayah.key);
                  const isPlaying = activeKey === ayah.key && player.playing;
                  return (
                    <Pressable
                      key={ayah.key}
                      onPress={() => toggleMask(ayah.key)}
                      style={[
                        styles.mushafAyahBlock,
                        isMasked && styles.mushafAyahMasked,
                        isPlaying && styles.mushafAyahPlaying,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`আয়াত ${ayah.ayahNumber}, ${isMasked ? 'লুকানো' : 'খোলা'}`}
                    >
                      {isMasked ? (
                        <View style={styles.maskedCover}>
                          <EyeOff color={colors.gold} size={16} />
                          <Text style={styles.maskedCoverText}>
                            আয়াত {toEasternDigits(ayah.ayahNumber)} লুকানো · প্রকাশ করতে ট্যাপ করুন
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.ayahVerseFlow}>
                          <Text style={styles.mushafArabicFlow}>
                            {ayah.arabic}{' '}
                            <Text style={styles.inlineMedallion}>
                              ۝{toEasternDigits(ayah.ayahNumber)}
                            </Text>
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.offlineNote}>
            <WifiOff color={colors.primary} size={18} />
            <Text style={styles.offlineText}>
              একবার download হলে পুরো সূরা airplane mode-এ শুনতে পারবেন।
            </Text>
          </View>

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
        </>
      )}

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
    statusLine: {
      marginTop: spacing.sm,
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    actionRow: {
      marginTop: spacing.md,
      flexDirection: 'row' as const,
      gap: spacing.sm,
    },
    recitationPrimary: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    recitationPrimaryText: {
      color: colors.white,
      fontFamily: typography.bengaliMedium,
      fontSize: 14,
    },
    actionSecondary: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    actionSecondaryText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
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
    modeSwitchRow: {
      marginTop: spacing.md,
      flexDirection: 'row' as const,
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: 4,
      borderColor: colors.line,
      borderWidth: 1,
    },
    modeTab: {
      flex: 1,
      minHeight: 40,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      borderRadius: radius.sm,
    },
    modeTabActive: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    modeTabText: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 12,
    },
    modeTabTextActive: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
    },
    mushafContainer: {
      marginTop: spacing.md,
    },
    mushafControlStrip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: spacing.sm,
      paddingHorizontal: 4,
    },
    maskAllBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    maskAllText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    mushafHint: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
    },
    mushafPageFrame: {
      borderRadius: radius.lg,
      borderWidth: 3,
      borderColor: colors.gold,
      backgroundColor: colors.surface,
      padding: 6,
      ...colors.elevation.card,
    },
    mushafInnerFrame: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.gold,
      padding: spacing.md,
      backgroundColor: '#FCFBF7',
    },
    surahBanner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.mint,
      borderColor: colors.gold,
      borderWidth: 1,
    },
    surahBannerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.gold,
      marginHorizontal: spacing.sm,
    },
    surahBannerCenter: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    surahBannerArabic: {
      color: colors.primary,
      fontFamily: typography.arabicBold,
      fontSize: 20,
      lineHeight: 28,
    },
    surahBannerMeta: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    bismillahWrap: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingBottom: spacing.md,
      marginBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    bismillahArabic: {
      color: colors.gold,
      fontFamily: typography.arabicBold,
      fontSize: 22,
      lineHeight: 36,
      textAlign: 'center' as const,
    },
    mushafTextContainer: {
      gap: 4,
    },
    mushafAyahBlock: {
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: radius.sm,
    },
    mushafAyahMasked: {
      backgroundColor: colors.paleGold,
      borderWidth: 1,
      borderColor: colors.gold,
      borderStyle: 'dashed' as const,
      marginVertical: 4,
      paddingVertical: 10,
    },
    mushafAyahPlaying: {
      backgroundColor: colors.mint,
    },
    maskedCover: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.sm,
    },
    maskedCoverText: {
      color: colors.gold,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    ayahVerseFlow: {
      flexDirection: 'row' as const,
      justifyContent: 'flex-end' as const,
    },
    mushafArabicFlow: {
      color: colors.ink,
      fontFamily: typography.arabicBold,
      fontSize: 26,
      lineHeight: 48,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    inlineMedallion: {
      color: colors.gold,
      fontFamily: typography.arabicBold,
      fontSize: 20,
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
