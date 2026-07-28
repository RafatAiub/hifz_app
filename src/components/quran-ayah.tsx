import { StyleSheet, Text, View } from 'react-native';

import type { QuranAyah } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function QuranAyahRow({
  ayah,
  hidden = false,
  active = false,
}: {
  ayah: QuranAyah;
  hidden?: boolean;
  active?: boolean;
}) {
  return (
    <View style={[styles.row, active && styles.active]}>
      <View style={styles.number}>
        <Text style={styles.numberText}>{ayah.ayahNumber}</Text>
      </View>
      <View style={styles.copy}>
        {hidden ? (
          <View accessibilityLabel="আয়াতটি লুকানো আছে" style={styles.hiddenLine} />
        ) : (
          <Text selectable style={styles.arabic}>
            {ayah.arabic}
          </Text>
        )}
        <Text style={styles.translation}>{ayah.translationBn}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
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
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: typography.arabic,
    fontSize: 31,
    lineHeight: 55,
    textAlign: 'right',
    writingDirection: 'rtl',
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
});
