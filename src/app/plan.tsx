import { router } from 'expo-router';
import { ArrowLeft, Check, ChevronRight, Clock3 } from 'lucide-react-native';
import { View, Text } from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import type { SessionStepKind } from '@/domain/types';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const stepLabels: Record<SessionStepKind, string> = {
  warmup: 'শুরু',
  manzil: 'মনজিল · আমুখতা',
  sabqi: 'সবক়ি · সাত সবক',
  weakness: 'দুর্বল আয়াত',
  new: 'নতুন সবক',
};

const weekdaysBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
const monthsBn = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

function formatDateBn(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return `${weekdaysBn[date.getUTCDay()]}, ${date.getUTCDate()} ${monthsBn[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export default function DailyPlanScreen() {
  const { plan, profile } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  function start() {
    if (profile?.hifzStatus === 'hafiz') {
      router.push('/session');
      return;
    }
    router.push('/revision-gate');
  }

  return (
    <AppScreen
      eyebrow={plan ? formatDateBn(plan.date) : ''}
      title="আজ কী হবে"
      hasTabBar={false}
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      {plan?.isRecoveryPlan ? (
        <View style={styles.recoveryBanner}>
          <Text style={styles.recoveryText}>আজ হালকা পুনরুদ্ধারের দিন — নতুন সবক পরে।</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {plan?.steps.map((step) => (
          <View key={step.id} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowKind}>
                {stepLabels[step.kind]}
                {step.hasLeechItems ? ' · বিশেষ ঝালাই' : ''}
              </Text>
              <Text style={styles.rowTitle}>{step.title}</Text>
              <Text style={styles.rowMeta}>{step.ayahKeys.length} আয়াত</Text>
            </View>
            <View style={styles.rowTime}>
              <Clock3 color={colors.muted} size={14} />
              <Text style={styles.rowTimeText}>{step.estimatedMinutes} মিনিট</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>মোট সময়</Text>
        <Text style={styles.totalValue}>{plan?.estimatedMinutes ?? 0} মিনিট</Text>
      </View>

      <ActionButton
        label="এখন রিভিশন শুরু"
        disabled={!plan}
        icon={<ChevronRight color={colors.white} size={20} />}
        onPress={start}
      />

      {plan && !plan.revisionGate.blocked ? (
        <View style={styles.gateHint}>
          <Check color={colors.primary} size={16} />
          <Text style={styles.gateHintText}>Revision শক্তি যথেষ্ট — আজ নতুন সবক খোলা।</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    recoveryBanner: {
      marginBottom: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paleGold,
      borderLeftColor: colors.gold,
      borderLeftWidth: 3,
    },
    recoveryText: {
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      minHeight: 68,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    rowCopy: {
      flex: 1,
    },
    rowKind: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    rowTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 15,
      marginTop: 2,
    },
    rowMeta: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
      marginTop: 2,
    },
    rowTime: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
    },
    rowTimeText: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 12,
    },
    totalRow: {
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingTop: spacing.md,
      borderTopColor: colors.line,
      borderTopWidth: 1,
    },
    totalLabel: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    totalValue: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 18,
    },
    gateHint: {
      marginTop: spacing.lg,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.xs,
    },
    gateHintText: {
      color: colors.primary,
      fontFamily: typography.bengali,
      fontSize: 12,
    },
  };
}
