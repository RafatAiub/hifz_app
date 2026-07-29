import { Flame } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { StreakState } from '@/domain/types';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

export function StreakBadge({ streak }: { streak: StreakState }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const active = streak.currentStreak > 0;
  return (
    <View style={[styles.wrap, active ? styles.active : styles.inactive]}>
      <Flame
        color={active ? colors.white : colors.muted}
        fill={active ? colors.gold : 'transparent'}
        size={18}
      />
      <View>
        <Text style={[styles.value, active && styles.valueActive]}>
          {streak.currentStreak} দিন
        </Text>
        <Text style={[styles.caption, active && styles.captionActive]}>
          {active ? 'চলমান ধারাবাহিকতা' : 'আজ শুরু করুন'}
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    wrap: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
    },
    active: {
      backgroundColor: colors.primary,
    },
    inactive: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    value: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 14,
    },
    valueActive: {
      color: colors.white,
    },
    caption: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 10,
    },
    captionActive: {
      color: colors.mint,
    },
  };
}
