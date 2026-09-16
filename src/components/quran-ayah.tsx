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

function toEasternArabicDigits(value: number) {
  return String(value)
    .split('')
    .map((d) => EASTERN_ARABIC_DIGITS[Number(d)] ?? d)
    .join('');
}

/**
 * End-of-ayah marker drawn as a self-contained circular medallion instead
 * of relying on the U+06DD font glyph. The two shipped mushaf fonts (KFGQPC
 * Uthmanic HAFS and Amiri) compose that glyph in incompatible ways, and one
 * of them renders a stray extra medallion on the web build — a plain View
 * with the number inside is identical on web, iOS and Android and at every
 * text scale. The digits use Amiri (always bundled) so the KFGQPC digit
 * ligatures can't turn a bare number back into an oversized glyph.
 */
function VerseNumberMedallion({ number, scale }: { number: number; scale: number }) {
  const styles = useThemedStyles(createStyles);
  const size = 30 * scale;
  return (
    <View
      accessibilityLabel={`আয়াত ${number}`}
      style={[styles.medallion, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.medallionText, { fontSize: 13 * scale }]}>
        {toEasternArabicDigits(number)}
      </Text>
    </View>
  );
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
  onWordReveal?: (wordIndex: number) => void;
  active?: boolean;
}) {
  const { profile } = useApp();
  const scale = profile?.arabicTextScale ?? 1;
  const styles = useThemedStyles(createStyles);
  const fonts = useTypography();
  return (
    <View style={[styles.row, active && styles.active]}>
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
          <View style={styles.arabicLine}>
            <VerseNumberMedallion number={ayah.ayahNumber} scale={scale} />
            <TajweedArabicText
              ayahKey={ayah.key}
              text={ayah.arabic}
              style={[
                styles.arabic,
                {
                  fontFamily: fonts.arabicBold,
                  fontSize: ARABIC_READING_SIZE * scale,
                  lineHeight: ARABIC_READING_LINE_HEIGHT * scale,
                },
              ]}
            />
          </View>
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
    copy: {
      flex: 1,
    },
    arabicLine: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'flex-end' as const,
      gap: spacing.sm,
    },
    arabic: {
      flexShrink: 1,
      color: colors.ink,
      fontFamily: typography.arabicBold,
      fontSize: 36,
      lineHeight: 64,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    medallion: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.mint,
    },
    medallionText: {
      color: colors.primary,
      fontFamily: typography.amiri,
      textAlign: 'center' as const,
      writingDirection: 'ltr' as const,
      includeFontPadding: false,
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
