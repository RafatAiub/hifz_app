import { Award, BookOpenCheck, CircleGauge, Layers3 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { AppScreen } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function ProgressScreen() {
  const { stats, profile } = useApp();
  const calibration = Math.min(7, profile?.calibrationSessions ?? 0);

  return (
    <AppScreen eyebrow="চাপ নয়, পরিষ্কার অগ্রগতি" title="আপনার অগ্রগতি">
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Award color={colors.gold} size={30} />
        </View>
        <Text style={styles.heroValue}>{stats.completedSessions}</Text>
        <Text style={styles.heroLabel}>টি session সম্পন্ন</Text>
      </View>

      <View style={styles.metrics}>
        <Metric
          icon={<BookOpenCheck color={colors.primary} size={22} />}
          value={`${stats.memorizedAyahs}`}
          label="আয়াত শেখা"
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
        <Text style={styles.body}>
          কোন আয়াতে বেশি সময় লাগে, কতক্ষণ পড়লে ক্লান্তি আসে, আর কখন review দিলে
          সবচেয়ে ভালো মনে থাকে। প্রতিটি session-এর পর plan নিজে বদলাবে।
        </Text>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${(calibration / 7) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.promise}>
        <Text style={styles.promiseTitle}>কোনো শাস্তির streak নেই</Text>
        <Text style={styles.body}>
          একদিন বাদ পড়লে app backlog চাপিয়ে দেবে না। আপনার সময় অনুযায়ী recovery
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
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      {icon}
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 176,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: {
    color: colors.white,
    fontFamily: typography.bengaliMedium,
    fontSize: 39,
    lineHeight: 49,
    marginTop: spacing.sm,
  },
  heroLabel: {
    color: colors.mint,
    fontFamily: typography.bengali,
    fontSize: 13,
  },
  metrics: {
    flexDirection: 'row',
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
    justifyContent: 'space-between',
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
  body: {
    color: colors.muted,
    fontFamily: typography.bengali,
    fontSize: 13,
    lineHeight: 22,
  },
  bar: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.line,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  promise: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
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
});
