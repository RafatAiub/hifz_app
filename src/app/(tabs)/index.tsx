import { router } from 'expo-router';
import {
  BookOpenCheck,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  Mic,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sparkles,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { BrandMark } from '@/components/brand-mark';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import type { RevisionGateReason, SessionStepKind } from '@/domain/types';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';
import { useBreakpoint } from '@/theme/use-breakpoint';

const stepLabels: Record<SessionStepKind, string> = {
  warmup: 'শুরু',
  manzil: 'মনজিল · আমুখতা',
  sabqi: 'সবক়ি · সাত সবক',
  weakness: 'দুর্বল আয়াত',
  new: 'নতুন সবক',
};

const gateCopy: Record<RevisionGateReason, string> = {
  ok: '',
  'missed-days': 'কয়েকদিন বিরতি হয়েছে — আজ শুধু ঝালাই, নতুন সবক পরে।',
  'weak-backlog': 'দুর্বল আয়াত জমে গেছে — আজ পুনরুদ্ধারের দিন, নতুন সবক বন্ধ।',
  'low-retention': 'সবক়ি/মনজিল এখনো কাঁচা — আগে সেটা পাকা করুন, নতুন সবক বন্ধ।',
  'teacher-paused': 'উস্তাদ আপাতত নতুন সবক বন্ধ রেখেছেন।',
  'completed-hafiz': 'মুরাজাআ মোড — পুরো কুরআন ঘোরানো হচ্ছে, নতুন সবক নেই।',
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
  const gate = plan?.revisionGate;
  const health = stats.hifzHealth;
  const showTeacher = profile?.teacherModeEnabled ?? false;

  return (
    <AppScreen
      eyebrow="আপনার জন্য প্রস্তুত"
      title="আজকের হিফজ"
      action={
        <View style={styles.headerActions}>
          {showTeacher ? (
            <IconAction
              label="উস্তাদ মোড"
              icon={<GraduationCap color={colors.ink} size={21} />}
              onPress={() => router.push('/teacher')}
            />
          ) : null}
          <IconAction
            label="সেটিংস"
            icon={<Settings color={colors.ink} size={21} />}
            onPress={() => router.push('/settings')}
          />
        </View>
      }
    >
      <View style={styles.identityRow}>
        <View style={styles.wordmark}>
          <BrandMark size={42} />
          <View>
            <View style={styles.wordmarkTitleRow}>
              <Text style={styles.wordmarkArabic}>حِفْظ</Text>
              <Text style={styles.wordmarkDot}>·</Text>
              <Text style={styles.wordmarkName}>HIFZ</Text>
            </View>
            <Text style={styles.wordmarkNote}>পবিত্র কুরআন হিফজের শান্ত সহচর</Text>
          </View>
        </View>
        {stats.streak.currentStreak > 0 ? (
          <View style={styles.continuityBadge}>
            <Sparkles color={colors.gold} size={14} />
            <Text style={styles.continuity}>{stats.streak.currentStreak} দিন ধারাবাহিক</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.hadithCard}>
        <Text style={styles.hadithArabic}>خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ</Text>
        <Text style={styles.hadithBangla}>
          “তোমাদের মধ্যে সর্বোত্তম ব্যক্তি সে, যে নিজে কুরআন শেখে এবং অন্যকে শেখায়।”
        </Text>
        <Text style={styles.hadithSource}>— সহীহ বুখারী ৫০২৭</Text>
      </View>

      <View style={styles.focusBand}>
        <View style={styles.focusCopy}>
          <View style={styles.readyRow}>
            <BookOpenCheck color={colors.gold} size={18} />
            <Text style={styles.readyText}>
              {plan?.isRecoveryPlan ? 'আজকের হালকা পুনরুদ্ধার' : 'আজকের হিফজ ও দাওর প্রস্তুত'}
            </Text>
          </View>
          <View style={styles.durationStatement}>
            <Text style={styles.bigNumber}>{plan?.estimatedMinutes ?? minutes}</Text>
            <Text style={styles.minuteLabel}>মিনিট লক্ষ্য</Text>
          </View>
          <View style={styles.planFacts}>
            <View style={styles.madrasahTag}>
              <Text style={styles.madrasahTagLabel}>সবক়ি/মনজিল:</Text>
              <Text style={styles.madrasahTagVal}>{reviewAyahs} আয়াত</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.madrasahTag}>
              <Text style={styles.madrasahTagLabel}>নতুন সবক:</Text>
              <Text style={styles.madrasahTagVal}>{newAyahs} আয়াত</Text>
            </View>
          </View>
        </View>
        <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
          <Text style={styles.ringArabic}>اقْرَأْ</Text>
        </View>
      </View>

      {gate ? (
        <Pressable
          style={styles.gateBanner}
          onPress={() => router.push('/revision-gate')}
          accessibilityRole="button"
        >
          <ShieldAlert color={colors.gold} size={18} />
          <Text style={styles.gateText}>
            {gate.blocked && gateCopy[gate.reason]
              ? gateCopy[gate.reason]
              : 'সবক়ি ও মনজিল মজবুত — নতুন সবক খোলা আছে।'}
          </Text>
          <Text style={styles.gateStrength}>
            {Math.round(((gate.sabqiRetention + gate.manzilRetention) / 2) * 100)}%
          </Text>
        </Pressable>
      ) : null}

      {health.total > 0 ? (
        <View style={styles.healthRow}>
          <HealthCell value={health.total} label="মোট হিফজ" tone={colors.ink} />
          <HealthCell value={health.strong} label="পাকা" tone={colors.primary} />
          <HealthCell value={health.needsRevision} label="ঝালাই দরকার" tone={colors.gold} />
          <HealthCell value={health.weak} label="দুর্বল" tone={colors.coral} />
        </View>
      ) : null}

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
        label="বিসমিল্লাহ — আজকের হিফজ শুরু করুন"
        disabled={!ready || !plan}
        onPress={() => router.push('/session')}
      />

      <View style={styles.quickActionLinks}>
        <Pressable
          style={styles.quickActionPill}
          onPress={() => router.push('/plan')}
          accessibilityRole="button"
        >
          <Clock3 color={colors.primary} size={15} />
          <Text style={styles.quickActionText}>আজকের পর্যায়ক্রম দেখুন</Text>
          <ChevronRight color={colors.primary} size={14} />
        </Pressable>
        <Pressable
          style={styles.quickActionPill}
          onPress={() => router.push('/memorized-surahs')}
          accessibilityRole="button"
        >
          <Mic color={colors.primary} size={15} />
          <Text style={styles.quickActionText}>মুখস্থ সূরা পরীক্ষা</Text>
          <ChevronRight color={colors.primary} size={14} />
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>আজকের তারতীব (পর্যায়ক্রম)</Text>
        <View style={styles.time}>
          <Clock3 color={colors.muted} size={16} />
          <Text style={styles.timeText}>{plan?.estimatedMinutes ?? 0} মিনিট</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {plan?.steps.map((step, index) => {
          const content = (
            <>
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
            </>
          );
          return step.kind === 'weakness' ? (
            <Pressable
              key={step.id}
              style={styles.step}
              onPress={() => router.push('/weak-repair')}
              accessibilityRole="button"
            >
              {content}
            </Pressable>
          ) : (
            <View key={step.id} style={styles.step}>
              {content}
            </View>
          );
        })}
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

function HealthCell({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.healthCell}>
      <Text style={[styles.healthValue, { color: tone }]}>{value}</Text>
      <Text style={styles.healthLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    headerActions: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
    },
    gateBanner: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paleGold,
      borderLeftColor: colors.gold,
      borderLeftWidth: 3,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: spacing.sm,
    },
    gateText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    gateStrength: {
      color: colors.gold,
      fontFamily: typography.bengaliMedium,
      fontSize: 15,
    },
    healthRow: {
      flexDirection: 'row' as const,
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    healthCell: {
      flex: 1,
      minHeight: 58,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 2,
      paddingHorizontal: 2,
    },
    healthValue: {
      fontFamily: typography.bengaliMedium,
      fontSize: 19,
    },
    healthLabel: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 9,
      textAlign: 'center' as const,
    },
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
    wordmarkTitleRow: {
      flexDirection: 'row' as const,
      alignItems: 'baseline' as const,
      gap: 4,
    },
    wordmarkArabic: {
      color: colors.primary,
      fontFamily: typography.arabicBold,
      fontSize: 22,
      lineHeight: 30,
    },
    wordmarkDot: {
      color: colors.gold,
      fontSize: 14,
      fontWeight: 'bold' as const,
    },
    wordmarkName: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
      letterSpacing: 0.5,
    },
    wordmarkNote: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 10,
    },
    continuityBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.paleGold,
      borderWidth: 1,
      borderColor: colors.gold,
    },
    continuity: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    hadithCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.gold,
      borderWidth: 1,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    hadithArabic: {
      color: colors.primary,
      fontFamily: typography.arabicBold,
      fontSize: 16,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
      marginBottom: 4,
    },
    hadithBangla: {
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    hadithSource: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 10,
      marginTop: 4,
      textAlign: 'right' as const,
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
      gap: spacing.xs,
      flexWrap: 'wrap' as const,
      marginTop: 4,
    },
    madrasahTag: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
    },
    madrasahTagLabel: {
      color: colors.onSpotlightMuted,
      fontFamily: typography.bengali,
      fontSize: 11,
    },
    madrasahTagVal: {
      color: colors.gold,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    quickActionLinks: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    quickActionPill: {
      flex: 1,
      minHeight: 42,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 5,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      borderWidth: 1,
      borderColor: colors.line,
    },
    quickActionText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
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
    recitationLink: {
      minHeight: 44,
      marginTop: spacing.md,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.xs,
    },
    recitationLinkText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
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
