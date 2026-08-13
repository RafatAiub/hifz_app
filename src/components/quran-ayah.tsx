import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { MaskedAyah } from '@/components/masked-ayah';
import type { MaskLevel } from '@/components/masked-ayah';
import { TajweedArabicText } from '@/components/tajweed-arabic-text';
import { useThemedStyles } from '@/theme/create-styles';
import { useTypography } from '@/theme/theme-context';
import type { QuranAyah } from '@/domain/types';
import {
  ARABIC_READING_LINE_HEIGHT,
  ARABIC_READING_SIZE,
  radius,
  spacing,
  typography,
  type ColorPalette,
} from '@/theme/tokens';

const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Traditional mushaf end-of-ayah marker: the ۝ ornament with the verse
 * number written in Eastern Arabic numerals inside it. */
function verseEndOrnament(ayahNumber: number) {
  const digits = String(ayahNumber)
    .split('')
    .map((d) => EASTERN_ARABIC_DIGITS[Number(d)] ?? d)
    .join('');
  return ` ۝${digits}`;
}

export function QuranAyahRow({
  ayah,
  hidden = false,
  masked = false,
  maskLevel,
  onWordReveal,
  active = false,
}: {
  ayah: QuranAyah;
  hidden?: boolean;
  /** @deprecated Use maskLevel. Kept for persisted/older callers. */
  masked?: boolean;
  /** Word-by-word tap-to-reveal self-testing instead of showing the ayah. */
  maskLevel?: MaskLevel;
  onWordReveal?: () => void;
  active?: boolean;
}) {
  const { profile } = useApp();
  const scale = profile?.arabicTextScale ?? 1;
  const styles = useThemedStyles(createStyles);
  const fonts = useTypography();
  return (
    <View style={[styles.row, active && styles.active]}>
      <View style={styles.number}>
        <Text style={styles.numberText}>{ayah.ayahNumber}</Text>
      </View>
      <View style={styles.copy}>
        {maskLevel !== undefined || masked ? (
          <MaskedAyah
            ayah={ayah}
            maskLevel={maskLevel ?? 2}
            onReveal={onWordReveal ?? (() => {})}
          />
        ) : hidden ? (
          <View accessibilityLabel="আয়াতটি লুকানো আছে" style={styles.hiddenLine} />
        ) : (
          <TajweedArabicText
            ayahKey={ayah.key}
            text={ayah.arabic}
            trailing={verseEndOrnament(ayah.ayahNumber)}
            trailingStyle={styles.verseEnd}
            style={[
              styles.arabic,
              {
                fontFamily: fonts.arabicBold,
                fontSize: ARABIC_READING_SIZE * scale,
                lineHeight: ARABIC_READING_LINE_HEIGHT * scale,
              },
            ]}
          />
        )}
        <Text style={[styles.translation, { fontFamily: fonts.bengali }]}>
          {ayah.translationBn}
        </Text>
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
    verseEnd: {
      color: colors.primary,
    },
    hiddenLine: {
      height: 42,
      marginVertical: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.line,
    },
  };
}
