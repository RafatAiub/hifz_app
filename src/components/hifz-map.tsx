import { Text, View } from 'react-native';

import type { SurahProgress } from '@/domain/types';
import { useThemedStyles } from '@/theme/create-styles';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';
import { useBreakpoint } from '@/theme/use-breakpoint';

export function HifzMap({ surahs }: { surahs: SurahProgress[] }) {
  const styles = useThemedStyles(createStyles);
  const breakpoint = useBreakpoint();
  const cellSize = breakpoint === 'wide' ? 34 : breakpoint === 'compact' ? 26 : 30;

  function cellTone(progress: SurahProgress) {
    if (progress.totalCount === 0) return styles.cellEmpty;
    if (progress.memorizedCount >= progress.totalCount) return styles.cellComplete;
    if (progress.memorizedCount > 0) return styles.cellPartial;
    return styles.cellEmpty;
  }

  return (
    <View style={styles.grid}>
      {surahs.map((surah) => (
        <View
          key={surah.surahNumber}
          style={[
            styles.cell,
            cellTone(surah),
            { width: cellSize, height: cellSize },
          ]}
        >
          <Text
            style={[
              styles.cellNumber,
              surah.memorizedCount >= surah.totalCount &&
                surah.totalCount > 0 &&
                styles.cellNumberComplete,
            ]}
          >
            {surah.surahNumber}
          </Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    grid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.xs,
    },
    cell: {
      borderRadius: radius.sm,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    cellEmpty: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    cellPartial: {
      backgroundColor: colors.paleGold,
    },
    cellComplete: {
      backgroundColor: colors.primary,
    },
    cellNumber: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 9,
    },
    cellNumberComplete: {
      color: colors.white,
    },
  };
}
