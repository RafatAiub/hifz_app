import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, type } from '@/theme/tokens';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, compact && styles.compactMark]}>
        <Text style={[styles.arabic, compact && styles.compactArabic]}>ح</Text>
      </View>
      {!compact ? <Text style={styles.name}>হিফজ</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactMark: {
    width: 34,
    height: 34,
  },
  arabic: {
    color: colors.white,
    fontFamily: type.arabic,
    fontSize: 26,
    lineHeight: 34,
  },
  compactArabic: {
    fontSize: 21,
    lineHeight: 28,
  },
  name: {
    color: colors.ink,
    fontFamily: type.bengaliMedium,
    fontSize: 21,
  },
});
