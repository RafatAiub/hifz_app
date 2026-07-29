import Svg, { Circle } from 'react-native-svg';
import { Text, View } from 'react-native';

import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { typography, type ColorPalette } from '@/theme/tokens';

export function ProgressRing({
  progress,
  size = 56,
  strokeWidth = 6,
  label,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={styles.rotateWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.line}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
      {label ? (
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    wrap: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    rotateWrap: {
      transform: [{ rotate: '-90deg' }],
    },
    labelWrap: {
      position: 'absolute' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    label: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
  };
}
