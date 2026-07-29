import { StyleSheet, Text, View } from 'react-native';

import { TajweedArabicText } from '@/components/tajweed-arabic-text';
import { useThemedStyles } from '@/theme/create-styles';
import type { QuranAyah } from '@/domain/types';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

export function QuranAyahRow({
  ayah,
  hidden = false,
  active = false,
}: {
  ayah: QuranAyah;
  hidden?: boolean;
  active?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.row, active && styles.active]}>
      <View style={styles.number}>
        <Text style={styles.numberText}>{ayah.ayahNumber}</Text>
      </View>
      <View style={styles.copy}>
        {hidden ? (
          <View accessibilityLabel="আয়াতটি লুকানো আছে" style={styles.hiddenLine} />
        ) : (
          <TajweedArabicText ayahKey={ayah.key} text={ayah.arabic} style={styles.arabic} />
        )}
        <Text style={styles.translation}>{ayah.translationBn}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    row: {
      flexDirection: 'row' as const,
      gap: spacing.md,
      paddingVertical: spacing.lg,
      borderBottomColor: colors.line,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    active: {
      backgroundColor: colors.mint,
      marginHorizontal: -spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    number: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginTop: 5,
    },
    numberText: {
      color: colors.white,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    copy: {
      flex: 1,
    },
    arabic: {
      color: colors.ink,
      fontFamily: typography.arabicBold,
      fontSize: 36,
      lineHeight: 64,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    translation: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 14,
      lineHeight: 23,
      marginTop: spacing.xs,
    },
    hiddenLine: {
      height: 42,
      marginVertical: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.line,
    },
  };
}
