import type { PropsWithChildren, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, type } from '@/theme/tokens';

interface ScreenProps extends PropsWithChildren {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  scroll?: boolean;
  contentStyle?: ScrollViewProps['contentContainerStyle'];
}

export function Screen({
  children,
  title,
  eyebrow,
  action,
  scroll = true,
  contentStyle,
}: ScreenProps) {
  const heading = title ? (
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  ) : null;

  if (!scroll) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={[styles.content, contentStyle]}>
          {heading}
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {heading}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 112,
  },
  heading: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: type.bengaliMedium,
    fontSize: 12,
  },
  title: {
    color: colors.ink,
    fontFamily: type.bengaliMedium,
    fontSize: 25,
    lineHeight: 34,
  },
});
