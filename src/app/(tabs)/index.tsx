import { router } from 'expo-router';
import {
  Check,
  ChevronRight,
  Clock3,
  RotateCcw,
  Settings,
  Sparkles,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const stepLabels = {
  warmup: 'শুরু',
  new: 'নতুন হিফজ',
  sabqi: 'সাবকি',
  manzil: 'মানযিল',
};

export default function TodayScreen() {
  const { ready, plan, profile, setAvailableMinutes } = useApp();
  const minutes = profile?.availableMinutes ?? 20;

  return (
    <AppScreen
      eyebrow="আপনার হিফজ সহকারী"
      title="আসসালামু আলাইকুম"
      action={
        <IconAction
          label="সেটিংস"
          icon={<Settings color={colors.ink} size={21} />}
          onPress={() => router.push('/settings')}
        />
      }
    >
      <View style={styles.focusBand}>
        <View style={styles.focusCopy}>
          <View style={styles.readyRow}>
            <Sparkles color={colors.gold} size={18} fill={colors.gold} />
            <Text style={styles.readyText}>
              {plan?.isRecoveryPlan ? 'আজ একটু হালকা রাখা হয়েছে' : 'আজকের plan তৈরি'}
            </Text>
          </View>
          <Text style={styles.bigNumber}>{plan?.estimatedMinutes ?? minutes}</Text>
          <Text style={styles.minuteLabel}>মিনিট, শুধু আপনার জন্য</Text>
        </View>
        <View style={styles.ring}>
          <Text style={styles.ringArabic}>اقرأ</Text>
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
              <Text style={styles.stepKind}>{stepLabels[step.kind]}</Text>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepMeta}>
                {step.ayahKeys.length} আয়াত · {step.estimatedMinutes} মিনিট
              </Text>
            </View>
          </View>
        ))}
      </View>

      {plan?.calibrationDay ? (
        <View style={styles.note}>
          <RotateCcw color={colors.primary} size={19} />
          <Text style={styles.noteText}>
            প্রথম ৭টি session-এ app আপনার আরামদায়ক গতি শিখবে। আজ calibration
            {` ${plan.calibrationDay}/7`}।
          </Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  focusBand: {
    minHeight: 176,
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  focusCopy: {
    flex: 1,
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  readyText: {
    color: colors.mint,
    fontFamily: typography.bengaliMedium,
    fontSize: 13,
  },
  bigNumber: {
    color: colors.white,
    fontFamily: typography.bengaliMedium,
    fontSize: 47,
    lineHeight: 57,
    marginTop: spacing.sm,
  },
  minuteLabel: {
    color: colors.mint,
    fontFamily: typography.bengali,
    fontSize: 14,
  },
  ring: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringArabic: {
    color: colors.white,
    fontFamily: typography.arabic,
    fontSize: 30,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  duration: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: typography.bengaliMedium,
    fontSize: 19,
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    gap: spacing.md,
  },
  track: {
    width: 28,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mint,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  noteText: {
    flex: 1,
    color: colors.ink,
    fontFamily: typography.bengali,
    fontSize: 13,
    lineHeight: 21,
  },
});
