import { Text, View } from 'react-native';

import { useThemedStyles } from '@/theme/create-styles';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

export function Waveform({
  samples,
  label,
  tone = 'primary',
}: {
  samples: number[];
  label: string;
  tone?: 'primary' | 'muted';
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bars}>
        {samples.length === 0 ? (
          <Text style={styles.empty}>এখনো কোনো recording নেই</Text>
        ) : (
          samples.map((value, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                tone === 'primary' ? styles.barPrimary : styles.barMuted,
                { height: Math.max(3, value * 40) },
              ]}
            />
          ))
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    wrap: {
      marginTop: spacing.sm,
    },
    label: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
      marginBottom: spacing.xs,
    },
    bars: {
      height: 44,
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
      gap: 2,
    },
    bar: {
      width: 3,
      borderRadius: radius.sm,
    },
    barPrimary: {
      backgroundColor: colors.primary,
    },
    barMuted: {
      backgroundColor: colors.line,
    },
    empty: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
    },
  };
}
