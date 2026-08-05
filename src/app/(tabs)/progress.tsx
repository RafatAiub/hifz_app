import { Award, BookOpenCheck, CircleGauge, Gauge, Layers3, Medal } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { AppScreen } from '@/components/ui';
import { HifzMap } from '@/components/hifz-map';
import { ProgressRing } from '@/components/progress-ring';
import { StreakBadge } from '@/components/streak-badge';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

export default function ProgressScreen() {
  const { stats, profile } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const calibration = Math.min(7, profile?.calibrationSessions ?? 0);

  return (
    <AppScreen eyebrow="চাপ নয়, পরিষ্কার অগ্রগতি" title="আপনার অগ্রগতি">
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Award color={colors.gold} size={30} />
        </View>
        <Text style={styles.heroValue}>{stats.completedSessions}</Text>
        <Text style={styles.heroLabel}>টি session সম্পন্ন</Text>
        <View style={styles.heroStreak}>
          <StreakBadge streak={stats.streak} />
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric
          icon={<BookOpenCheck color={colors.primary} size={22} />}
          value={`${stats.memorizedAyahs}`}
          label="আয়াত শেখা"
        />
        <Metric
          icon={<CircleGauge color={colors.coral} size={22} />}
          value={`${stats.reviewStrength}%`}
          label="মনে থাকার শক্তি"
        />
        <Metric
          icon={<Layers3 color={colors.gold} size={22} />}
          value={`${calibration}/7`}
          label="গতি শেখা"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App এখন যা শিখছে</Text>
        <View style={styles.calibrationRow}>
          <ProgressRing progress={calibration / 7} label={`${calibration}/৭`} />
          <Text style={styles.body}>
            কোন আয়াতে বেশি সময় লাগে, কতক্ষণ পড়লে ক্লান্তি আসে, আর কখন review দিলে
            সবচেয়ে ভালো মনে থাকে। প্রতিটি session-এর পর plan নিজে বদলাবে।
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.velocityHeader}>
          <Gauge color={colors.primary} size={20} />
          <Text style={styles.sectionTitleInline}>হিফজের গতি</Text>
        </View>
        <Text style={styles.body}>
          {stats.velocity.ayahsPerDay > 0
            ? `গত ${stats.velocity.windowDays} দিনে দিনে গড়ে ${stats.velocity.ayahsPerDay.toFixed(1)}টি নতুন আয়াত মুখস্থ হচ্ছে।`
            : `এখনো গতি হিসাব করার মতো যথেষ্ট নতুন হিফজ হয়নি। আরও কিছু session শেষ করলে এখানে দেখা যাবে।`}
        </Text>
        {stats.surahForecasts.length > 0 ? (
          <View style={styles.forecastList}>
            {stats.surahForecasts.map((forecast) => (
              <View key={forecast.surahNumber} style={styles.forecastRow}>
                <Text style={styles.forecastSurah} numberOfLines={1}>
                  সূরা {forecast.nameBn}
                </Text>
                <Text style={styles.forecastValue}>
                  {forecast.daysLeft !== null
                    ? `আর ${forecast.daysLeft} দিন বাকি`
                    : `${forecast.remainingAyahs}টি আয়াত বাকি`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>হিফজ ম্যাপ</Text>
        <Text style={styles.body}>প্রতিটি ঘর একটি সূরা। সবুজ মানে সম্পূর্ণ মুখস্থ।</Text>
        <View style={styles.mapWrap}>
          <HifzMap surahs={stats.surahProgress} />
        </View>
      </View>

      {stats.milestones.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>অর্জন</Text>
          <View style={styles.milestoneList}>
            {stats.milestones.map((milestone) => (
              <View key={milestone.id} style={styles.milestoneRow}>
                <Medal color={colors.gold} size={18} />
                <Text style={styles.milestoneText}>{milestone.titleBn}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.promise}>
        <Text style={styles.promiseTitle}>কোনো শাস্তির streak নেই</Text>
        <Text style={styles.body}>
          একদিন বাদ পড়লে app backlog চাপিয়ে দেবে না। আপনার সময় অনুযায়ী recovery
          session তৈরি করবে।
        </Text>
      </View>
    </AppScreen>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metric}>
      {icon}
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    hero: {
      minHeight: 176,
      borderRadius: radius.lg,
      backgroundColor: colors.spotlight,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: spacing.lg,
      ...colors.elevation.card,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    heroValue: {
      color: colors.onSpotlight,
      fontFamily: typography.bengaliMedium,
      fontSize: 39,
      lineHeight: 49,
      marginTop: spacing.sm,
    },
    heroLabel: {
      color: colors.onSpotlightMuted,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    heroStreak: {
      marginTop: spacing.md,
    },
    metrics: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    metric: {
      flex: 1,
      minHeight: 132,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      justifyContent: 'space-between' as const,
    },
    metricValue: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 22,
    },
    metricLabel: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
      lineHeight: 17,
    },
    section: {
      marginTop: spacing.xxl,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 18,
      marginBottom: spacing.sm,
    },
    velocityHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    sectionTitleInline: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 18,
    },
    forecastList: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    forecastRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    forecastSurah: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    forecastValue: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    body: {
      flex: 1,
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
      lineHeight: 22,
    },
    calibrationRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.lg,
    },
    mapWrap: {
      marginTop: spacing.md,
    },
    milestoneList: {
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    milestoneRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    milestoneText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    promise: {
      marginTop: spacing.xxl,
      padding: spacing.lg,
      borderRadius: radius.md,
      borderLeftColor: colors.gold,
      borderLeftWidth: 3,
      backgroundColor: colors.paleGold,
    },
    promiseTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 15,
      marginBottom: spacing.xs,
    },
  };
}
