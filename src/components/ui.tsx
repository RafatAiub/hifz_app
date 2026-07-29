import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

export function AppScreen({
  children,
  title,
  eyebrow,
  action,
  scroll = true,
  contentStyle,
  hasTabBar = true,
}: PropsWithChildren<{
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  scroll?: boolean;
  contentStyle?: ScrollViewProps['contentContainerStyle'];
  hasTabBar?: boolean;
}>) {
  const styles = useThemedStyles(createUiStyles);
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + (hasTabBar ? 88 : spacing.xl);

  const heading = title ? (
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            contentStyle,
            { paddingBottom: bottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {heading}
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            styles.flex,
            contentStyle,
            { paddingBottom: bottomPadding },
          ]}
        >
          {heading}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function ActionButton({
  label,
  icon,
  loading = false,
  tone = 'primary',
  disabled,
  style,
  ...props
}: ComponentProps<typeof Pressable> & {
  label: string;
  icon?: ReactNode;
  loading?: boolean;
  tone?: 'primary' | 'quiet' | 'danger';
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createUiStyles);
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
          {icon ?? <ArrowLeft color={foreground} size={21} strokeWidth={2.3} />}
          <Text style={[styles.label, tone === 'quiet' && styles.quietLabel]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconAction({
  icon,
  label,
  selected = false,
  style,
  ...props
}: ComponentProps<typeof Pressable> & {
  icon: ReactNode;
  label: string;
  selected?: boolean;
}) {
  const styles = useThemedStyles(createUiStyles);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.iconButton,
        selected && styles.selectedIcon,
        pressed && styles.pressed,
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
      ]}
      {...props}
    >
      {icon}
    </Pressable>
  );
}

function createUiStyles(colors: ColorPalette) {
  return {
    safe: {
      flex: 1,
      backgroundColor: colors.canvas,
    },
    flex: {
      flex: 1,
    },
    content: {
      width: '100%' as const,
      maxWidth: 720,
      alignSelf: 'center' as const,
      paddingHorizontal: spacing.lg,
    },
    heading: {
      minHeight: 76,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: spacing.md,
    },
    headingCopy: {
      flex: 1,
    },
    eyebrow: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    title: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 25,
      lineHeight: 34,
    },
    button: {
      minHeight: 56,
      width: '100%' as const,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.sm,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    quiet: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
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
    label: {
      color: colors.white,
      fontFamily: typography.bengaliMedium,
      fontSize: 16,
    },
    quietLabel: {
      color: colors.primary,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    selectedIcon: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
  };
}
