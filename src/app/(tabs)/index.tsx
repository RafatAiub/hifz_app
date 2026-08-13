import { router } from 'expo-router';
import {
  BookOpenCheck,
  Check,
  ChevronRight,
  Clock3,
  RotateCcw,
  Settings,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';
import { useBreakpoint } from '@/theme/use-breakpoint';

const stepLabels = {
  warmup: 'শুরু',
  new: 'নতুন হিফজ',
  sabqi: 'সাবকি',
  manzil: 'মানযিল',
};

export default function TodayScreen() {
  const { ready, plan, profile, stats, setAvailableMinutes } = useApp();
  const minutes = profile?.availableMinutes ?? 20;
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const breakpoint = useBreakpoint();
  const ringSize = breakpoint === 'compact' ? 68 : 90;
  const newAyahs = plan?.steps
    .filter((step) => step.kind === 'new')
    .reduce((total, step) => total + step.ayahKeys.length, 0) ?? 0;
  const reviewAyahs = plan?.steps
    .filter((step) => step.kind !== 'new')
    .reduce((total, step) => total + step.ayahKeys.length, 0) ?? 0;

  return (
    <AppScreen
      eyebrow="আপনার জন্য প্রস্তুত"
      title="আজকের হিফজ"
      action={
        <IconAction
          label="সেটিংস"
          icon={<Settings color={colors.ink} size={21} />}
          onPress={() => router.push('/settings')}
        />
      }
    >
      <View style={styles.identityRow}>
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkArabic}>حِفْظ</Text>
          <View>
            <Text style={styles.wordmarkName}>HIFZ</Text>
            <Text style={styles.wordmarkNote}>শান্তভাবে, প্রতিদিন</Text>
          </View>
        </View>
        {stats.streak.currentStreak > 0 ? (
          <Text style={styles.continuity}>{stats.streak.currentStreak} দিন ধারাবাহিক</Text>
        ) : null}
      </View>

      <View style={styles.focusBand}>
        <View style={styles.focusCopy}>
          <View style={styles.readyRow}>
            <BookOpenCheck color={colors.gold} size={18} />
            <Text style={styles.readyText}>
              {plan?.isRecoveryPlan ? 'আজ হালকা পুনরুদ্ধার' : 'আজকের পথ প্রস্তুত'}
            </Text>
          </View>
          <View style={styles.durationStatement}>
            <Text style={styles.bigNumber}>{plan?.estimatedMinutes ?? minutes}</Text>
            <Text style={styles.minuteLabel}>মিনিট</Text>
          </View>
          <View style={styles.planFacts}>
            <Text style={styles.planFact}>{reviewAyahs} ঝালাই</Text>
            <View style={styles.factDivider} />
            <Text style={styles.planFact}>{newAyahs} নতুন আয়াত</Text>
          </View>
        </View>
        <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
          <Text style={styles.ringArabic}>اقْرَأْ</Text>
        </View>
      </View>

      <View style={styles.durationRow}>
        {[10, 20, 30].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: minutes === value }}
            onPress={() => void setAvailableMinutes(value)}
            style={[styles.duration, minutes === value && styles.durationSelected]}
          >
            <Text
              style={[
                styles.durationText,
                minutes === value && styles.durationTextSelected,
              ]}
            >
              {value} মিনিট
            </Text>
          </Pressable>
        ))}
      </View>

      <ActionButton
        label="আজকের হিফজ শুরু করুন"
        disabled={!ready || !plan}
        onPress={() => router.push('/session')}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>আজ কী হবে</Text>
        <View style={styles.time}>
          <Clock3 color={colors.muted} size={16} />
          <Text style={styles.timeText}>{plan?.estimatedMinutes ?? 0} মিনিট</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {plan?.steps.map((step, index) => (
          <View key={step.id} style={styles.step}>
            <View style={styles.track}>
              <View style={styles.dot}>
                {index === 0 ? (
                  <ChevronRight color={colors.white} size={16} />
                ) : (
                  <Check color={colors.primary} size={15} />
                )}
              </View>
              {index < plan.steps.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepKind}>
                {stepLabels[step.kind]}
                {step.hasLeechItems ? ' · বিশেষ ঝালাই' : ''}
              </Text>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepMeta}>
                {step.ayahKeys.length} আয়াত · {step.estimatedMinutes} মিনিট
              </Text>
            </View>
          </View>
        ))}
      </View>

      {plan?.calibrationDay ? (
        <View style={styles.note}>
          <RotateCcw color={colors.primary} size={19} />
          <Text style={styles.noteText}>
            প্রথম ৭টি session-এ app আপনার আরামদায়ক গতি শিখবে। আজ calibration
            {` ${plan.calibrationDay}/7`}।
          </Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    identityRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    wordmark: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    wordmarkArabic: {
      color: colors.primary,
      fontFamily: typography.arabicBold,
      fontSize: 24,
      lineHeight: 34,
    },
    wordmarkName: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    wordmarkNote: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 10,
    },
    continuity: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    focusBand: {
      minHeight: 176,
      marginBottom: spacing.lg,
      padding: spacing.xl,
      borderRadius: radius.lg,
      backgroundColor: colors.spotlight,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      overflow: 'hidden' as const,
      gap: spacing.md,
      ...colors.elevation.card,
    },
    focusCopy: {
      flex: 1,
      minWidth: 140,
    },
    readyRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    readyText: {
      color: colors.onSpotlightMuted,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    bigNumber: {
      color: colors.onSpotlight,
      fontFamily: typography.bengaliMedium,
      fontSize: 47,
      lineHeight: 57,
    },
    durationStatement: {
      flexDirection: 'row' as const,
      alignItems: 'baseline' as const,
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    minuteLabel: {
      color: colors.onSpotlightMuted,
      fontFamily: typography.bengali,
      fontSize: 14,
    },
    planFacts: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    planFact: {
      color: colors.onSpotlightMuted,
      fontFamily: typography.bengali,
      fontSize: 12,
    },
    factDivider: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.gold,
    },
    ring: {
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    ringArabic: {
      color: colors.white,
      fontFamily: typography.arabic,
      fontSize: 30,
    },
    durationRow: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    duration: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    durationSelected: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
    durationText: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    durationTextSelected: {
      color: colors.primary,
    },
    sectionHeader: {
      marginTop: spacing.xxl,
      marginBottom: spacing.lg,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 19,
    },
    time: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
    },
    timeText: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    timeline: {
      gap: 0,
    },
    step: {
      minHeight: 84,
      flexDirection: 'row' as const,
      gap: spacing.md,
    },
    track: {
      width: 28,
      alignItems: 'center' as const,
    },
    dot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.mint,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    line: {
      width: 1,
      flex: 1,
      backgroundColor: colors.line,
    },
    stepCopy: {
      flex: 1,
      paddingBottom: spacing.lg,
    },
    stepKind: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    stepTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 16,
      lineHeight: 25,
    },
    stepMeta: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    note: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: spacing.md,
    },
    noteText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 13,
      lineHeight: 21,
    },
  };
}
