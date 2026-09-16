import { router } from 'expo-router';
import { ArrowLeft, Lock, ShieldCheck, Unlock } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { ProgressRing } from '@/components/progress-ring';
import {
  MANZIL_RETENTION_FLOOR,
  SABQI_RETENTION_FLOOR,
  WEAK_BACKLOG_LIMIT,
} from '@/domain/hifz';
import type { RevisionGateReason } from '@/domain/types';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const gateCopy: Record<RevisionGateReason, string> = {
  ok: 'নতুন সবক খোলা আছে — Revision শক্তি যথেষ্ট।',
  'missed-days': 'কয়েকদিন বিরতি হয়েছে — আজ শুধু ঝালাই, নতুন সবক পরে।',
  'weak-backlog': 'দুর্বল আয়াত জমে গেছে — আজ পুনরুদ্ধারের দিন, নতুন সবক বন্ধ।',
  'low-retention': 'সবক়ি/মনজিল এখনো কাঁচা — আগে সেটা পাকা করুন, নতুন সবক বন্ধ।',
  'teacher-paused': 'উস্তাদ আপাতত নতুন সবক বন্ধ রেখেছেন।',
  'completed-hafiz': 'মুরাজাআ মোড — পুরো কুরআন ঘোরানো হচ্ছে, নতুন সবক নেই।',
};

export default function RevisionGateScreen() {
  const { plan } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const gate = plan?.revisionGate;

  const strength = gate
    ? Math.round(((gate.sabqiRetention + gate.manzilRetention) / 2) * 100)
    : 0;

  return (
    <AppScreen
      eyebrow="নতুন সবক Unlock চেক"
      title="Revision শক্তি"
      hasTabBar={false}
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      <View style={styles.ringWrap}>
        <ProgressRing progress={strength / 100} size={168} strokeWidth={12} />
        <View style={styles.ringLabel}>
          <Text style={styles.ringValue}>{strength}%</Text>
          <Text style={styles.ringCaption}>
            {gate?.blocked ? (
              <>
                <Lock color={colors.coral} size={12} /> Locked
              </>
            ) : (
              'Unlocked'
            )}
          </Text>
        </View>
      </View>

      <Text style={styles.gateMessage}>{gate ? gateCopy[gate.reason] : ''}</Text>

      {gate ? (
        <View style={styles.breakdown}>
          <BreakdownRow
            label="মনজিল · আমুখতা"
            value={Math.round(gate.manzilRetention * 100)}
            floor={Math.round(MANZIL_RETENTION_FLOOR * 100)}
          />
          <BreakdownRow
            label="সবক়ি · সাত সবক"
            value={Math.round(gate.sabqiRetention * 100)}
            floor={Math.round(SABQI_RETENTION_FLOOR * 100)}
          />
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>দুর্বল আয়াত</Text>
            <Text
              style={[
                styles.breakdownValue,
                gate.weakCount >= WEAK_BACKLOG_LIMIT && { color: colors.coral },
              ]}
            >
              {gate.weakCount} / {WEAK_BACKLOG_LIMIT}
            </Text>
          </View>
        </View>
      ) : null}

      {!gate?.blocked ? (
        <ActionButton
          label="নতুন সবক শুরু করুন"
          icon={<Unlock color={colors.white} size={20} />}
          onPress={() => router.push('/session')}
        />
      ) : gate.overridable ? (
        <>
          <ActionButton
            label="Revision শক্তি বাড়ান"
            icon={<ShieldCheck color={colors.white} size={20} />}
            onPress={() => router.push('/session')}
          />
          <Text style={styles.lockedNote}>নতুন সবক এখনো Locked</Text>
        </>
      ) : (
        <ActionButton
          label="ঝালাই শুরু করুন"
          icon={<ShieldCheck color={colors.white} size={20} />}
          onPress={() => router.push('/session')}
        />
      )}
    </AppScreen>
  );
}

function BreakdownRow({ label, value, floor }: { label: string; value: number; floor: number }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const ok = value >= floor;
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[styles.breakdownValue, { color: ok ? colors.primary : colors.coral }]}>
        {value}% <Text style={styles.breakdownFloor}>· লক্ষ্য {floor}%+</Text>
      </Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    ringWrap: {
      marginTop: spacing.lg,
      alignSelf: 'center' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    ringLabel: {
      position: 'absolute' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    ringValue: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 40,
    },
    ringCaption: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      marginTop: 2,
    },
    gateMessage: {
      marginTop: spacing.xl,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 13,
      lineHeight: 21,
      textAlign: 'center' as const,
    },
    breakdown: {
      marginTop: spacing.xl,
      marginBottom: spacing.xl,
      gap: spacing.sm,
    },
    breakdownRow: {
      minHeight: 52,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    breakdownLabel: {
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    breakdownValue: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    breakdownFloor: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
    },
    lockedNote: {
      marginTop: spacing.sm,
      color: colors.coral,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      textAlign: 'center' as const,
    },
  };
}
