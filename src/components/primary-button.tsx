import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';

interface PrimaryButtonProps extends ComponentProps<typeof Pressable> {
  label: string;
  icon?: ReactNode;
  loading?: boolean;
  tone?: 'primary' | 'quiet' | 'danger';
}

export function PrimaryButton({
  label,
  icon,
  loading = false,
  tone = 'primary',
  disabled,
  style,
  ...props
}: PrimaryButtonProps) {
  const foreground = tone === 'quiet' ? colors.primary : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.primary,
        tone === 'quiet' && styles.quiet,
        tone === 'danger' && styles.danger,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          <View style={styles.icon}>
            {icon ?? <ArrowLeft color={foreground} size={21} strokeWidth={2.3} />}
          </View>
          <Text style={[styles.label, tone === 'quiet' && styles.quietLabel]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    width: '100%',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  quiet: {
    backgroundColor: colors.mint,
    borderColor: colors.primarySoft,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: colors.coral,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.48,
  },
  icon: {
    width: 24,
    alignItems: 'center',
  },
  label: {
    color: colors.white,
    fontFamily: type.bengaliMedium,
    fontSize: 16,
  },
  quietLabel: {
    color: colors.primary,
  },
});
