import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Mic } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { deriveSurahRecitationStatus, type SurahLifecycleStage } from '@/domain/recitation';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const lifecycleLabel: Record<SurahLifecycleStage, string> = {
  NOT_STARTED: 'শুরু হয়নি',
  LEARNING: 'শেখা হচ্ছে',
  MEMORIZING: 'মুখস্থ হচ্ছে',
  READY_FOR_TEST: 'পড়া দেওয়ার জন্য প্রস্তুত',
  MEMORIZED: 'মজবুত',
  REVISION: 'রিভিশনে আছে',
};

export default function MemorizedSurahsScreen() {
  const { memoryStates, mistakes, recitationTests } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const memorized = useMemo(() => {
    return quranDemoPack.surahs
      .map((surah) =>
        deriveSurahRecitationStatus({
          surahNumber: surah.number,
          contentPack: quranDemoPack,
          memoryStates,
          mistakes,
          recitationTests,
        }),
      )
      .filter((status) => status.memorizedAyahs === status.totalAyahs && status.totalAyahs > 0)
      .sort((a, b) => a.surahNumber - b.surahNumber);
  }, [memoryStates, mistakes, recitationTests]);

  return (
    <AppScreen
      eyebrow="তিলাওয়াত পরীক্ষা"
      title="আমার মুখস্থ সূরা"
      hasTabBar={false}
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      {memorized.length === 0 ? (
        <Text style={styles.empty}>এখনো কোনো সূরা সম্পূর্ণ মুখস্থ হয়নি।</Text>
      ) : (
        memorized.map((status) => (
          <Pressable
            key={status.surahNumber}
            style={styles.row}
            onPress={() => router.push(`/recitation-test?surahNumber=${status.surahNumber}`)}
          >
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{status.nameBn}</Text>
              <Text
                style={[
                  styles.rowStatus,
                  status.lifecycle === 'REVISION' && styles.rowStatusMuted,
                  status.weakWordCount > 0 && styles.rowStatusWeak,
                ]}
              >
                {lifecycleLabel[status.lifecycle]}
                {status.weakWordCount > 0 ? ` · দুর্বল ${status.weakWordCount}` : ''}
              </Text>
            </View>
            <View style={styles.rowAction}>
              <Mic color={colors.white} size={16} />
              <Text style={styles.rowActionText}>পড়া দিন</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>
        ))
      )}
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    empty: {
      marginTop: spacing.xxl,
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
      textAlign: 'center' as const,
    },
    row: {
      minHeight: 64,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
    },
    rowCopy: { flex: 1 },
    rowTitle: { color: colors.ink, fontFamily: typography.bengaliMedium, fontSize: 15 },
    rowStatus: { color: colors.primary, fontFamily: typography.bengali, fontSize: 12, marginTop: 2 },
    rowStatusMuted: { color: colors.muted },
    rowStatusWeak: { color: colors.coral },
    rowAction: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    rowActionText: { color: colors.white, fontFamily: typography.bengaliMedium, fontSize: 12 },
  };
}
