import { router } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  Minus,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react-native';
import { type ReactNode, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { deriveWeakQueue } from '@/domain/hifz';
import type { AyahKey, MistakeType } from '@/domain/types';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const surahName = (n: number) =>
  quranDemoPack.surahs.find((s) => s.number === n)?.nameBn ?? `সূরা ${n}`;

const mistakeLabels: Record<MistakeType, string> = {
  OMISSION: 'বাদ পড়া',
  ADDITION: 'বাড়তি',
  SUBSTITUTION: 'বদল',
  SEQUENCE: 'ক্রম',
  HESITATION: 'আটকানো',
  PROMPT: 'লোকমা',
  HARAKAH: 'হরকত',
  TAJWEED: 'তাজবীদ',
  WAQF: 'ওয়াক্‌ফ',
  WORD_REPETITION: 'পুনরাবৃত্তি',
  AYAH_SKIPPED: 'আয়াত বাদ পড়েছে',
  AYAH_REPEATED: 'আয়াত পুনরাবৃত্তি',
  EARLY_STOP: 'মাঝপথে থেমেছে',
  MUTASHABIHAT: 'মুতাশাবিহ',
};

export default function TeacherScreen() {
  const {
    profile,
    plan,
    stats,
    memoryStates,
    mistakes,
    approveSabaq,
    setAyahStage,
    verifyMistake,
    resolveMistake,
    setTeacherSetting,
    setMaxNewAyahsPerSession,
  } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const ready = useMemo(
    () =>
      memoryStates
        .filter((s) => s.stage === 'SABAQ_READY')
        .map((s) => s.ayahKey)
        .sort(),
    [memoryStates],
  );
  const weak = useMemo(
    () => deriveWeakQueue({ memoryStates, mistakes }).slice(0, 12),
    [memoryStates, mistakes],
  );
  const openMistakes = useMemo(
    () =>
      mistakes
        .filter((m) => !m.resolvedAt)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 15),
    [mistakes],
  );
  const strengthByKey = useMemo(
    () => new Map(memoryStates.map((s) => [s.ayahKey, s.strength])),
    [memoryStates],
  );

  if (!profile) return null;
  const gate = plan?.revisionGate;

  return (
    <AppScreen
      eyebrow="দ্রুত নিয়ন্ত্রণ"
      title="উস্তাদ মোড"
      hasTabBar={false}
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      <View style={styles.identityCard}>
        <View style={styles.identityIcon}>
          <GraduationCap color={colors.white} size={22} />
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityTitle}>আজকের সেশন</Text>
          <Text style={styles.identityMeta}>
            {plan?.estimatedMinutes ?? 0} মিনিট · Approval বাকি {stats.pendingApprovals} · দুর্বল{' '}
            {stats.weakCount}
          </Text>
        </View>
        <Clock3 color={colors.onSpotlightMuted} size={18} />
      </View>

      <Text style={styles.sectionTitle}>আজকের রিভিশন গেট</Text>
      <View style={styles.gateCard}>
        <ShieldCheck color={gate?.blocked ? colors.gold : colors.primary} size={20} />
        <Text style={styles.gateText}>
          {gate?.blocked
            ? 'নতুন সবক বন্ধ — আজ ঝালাইয়ের দিন।'
            : 'নতুন সবক খোলা আছে।'}
          {'  '}
          দুর্বল: {stats.weakCount} · Approval বাকি: {stats.pendingApprovals}
        </Text>
      </View>
      <View style={styles.toggleRow}>
        <Toggle
          active={profile.newSabaqPaused}
          label="নতুন সবক বন্ধ রাখুন"
          onPress={() =>
            void setTeacherSetting({ newSabaqPaused: !profile.newSabaqPaused })
          }
        />
        <Toggle
          active={!profile.revisionGateEnabled}
          label="গেট override (সবসময় খোলা)"
          onPress={() =>
            void setTeacherSetting({
              revisionGateEnabled: !profile.revisionGateEnabled,
            })
          }
        />
      </View>
      <View style={styles.lessonRow}>
        <Text style={styles.lessonLabel}>সবকের আকার (নতুন আয়াত/দিন)</Text>
        <View style={styles.stepper}>
          <IconAction
            label="সবক কমান"
            style={styles.stepBtn}
            icon={<Minus color={colors.primary} size={18} />}
            onPress={() =>
              void setMaxNewAyahsPerSession(profile.maxNewAyahsPerSession - 1)
            }
          />
          <Text style={styles.stepValue}>{profile.maxNewAyahsPerSession}</Text>
          <IconAction
            label="সবক বাড়ান"
            style={styles.stepBtn}
            icon={<Plus color={colors.primary} size={18} />}
            onPress={() =>
              void setMaxNewAyahsPerSession(profile.maxNewAyahsPerSession + 1)
            }
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.headingRow}>
        <Text style={styles.sectionTitle}>Approval অপেক্ষায় ({ready.length})</Text>
        {ready.length > 0 ? (
          <Pressable onPress={() => void approveSabaq(ready)} style={styles.bulkBtn}>
            <BadgeCheck color={colors.white} size={16} />
            <Text style={styles.bulkText}>সব approve</Text>
          </Pressable>
        ) : null}
      </View>
      {ready.length === 0 ? (
        <Text style={styles.empty}>এখন approve করার মতো নতুন সবক নেই।</Text>
      ) : (
        ready.map((key) => (
          <Row key={key} title={label(key)} sub="মনে থেকে বলেছে — শুনে approve করুন">
            <Pressable
              onPress={() => router.push(`/teacher-review?ayahKey=${key}`)}
              style={[styles.smallBtn, styles.smallBtnPrimary]}
            >
              <Text style={styles.smallBtnTextLight}>শুনানি নিন</Text>
              <ChevronRight color={colors.white} size={15} />
            </Pressable>
          </Row>
        ))
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>দুর্বল এলাকা ({stats.weakCount})</Text>
      {weak.length === 0 ? (
        <Text style={styles.empty}>কোনো দুর্বল আয়াত নেই — মাশাআল্লাহ।</Text>
      ) : (
        weak.map((key) => (
          <Row
            key={key}
            title={label(key)}
            sub={`শক্তি ${Math.round((strengthByKey.get(key) ?? 0) * 100)}%`}
          >
            <Pressable
              onPress={() => void setAyahStage(key, 'SABQI')}
              style={styles.smallBtn}
            >
              <Text style={styles.smallBtnText}>সবক়িতে আনুন</Text>
            </Pressable>
          </Row>
        ))
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>সাম্প্রতিক ভুল ({openMistakes.length})</Text>
      {openMistakes.length === 0 ? (
        <Text style={styles.empty}>নতুন কোনো ভুল লিপিবদ্ধ হয়নি।</Text>
      ) : (
        openMistakes.map((m) => (
          <Row
            key={m.id}
            title={`${label(m.ayahKey)} · ${mistakeLabels[m.type]}`}
            sub={
              m.teacherVerified
                ? 'উস্তাদ যাচাই করেছেন'
                : m.source === 'ai'
                  ? 'AI চিহ্নিত — যাচাই বাকি'
                  : 'ছাত্র চিহ্নিত'
            }
          >
            {!m.teacherVerified ? (
              <Pressable
                onPress={() => void verifyMistake(m.id)}
                style={styles.smallBtn}
              >
                <TriangleAlert color={colors.primary} size={14} />
                <Text style={styles.smallBtnText}>যাচাই</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void resolveMistake(m.id)}
              style={[styles.smallBtn, styles.smallBtnPrimary]}
            >
              <Check color={colors.white} size={15} />
              <Text style={styles.smallBtnTextLight}>সমাধান</Text>
            </Pressable>
          </Row>
        ))
      )}
    </AppScreen>
  );
}

function label(key: AyahKey) {
  const [s, a] = key.split(':');
  return `${surahName(Number(s))} — আয়াত ${a}`;
}

function Toggle({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.toggle, active && styles.toggleActive]}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Row({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={styles.rowActions}>{children}</View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    identityCard: {
      minHeight: 76,
      marginBottom: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.spotlight,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.md,
      ...colors.elevation.card,
    },
    identityIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    identityCopy: {
      flex: 1,
    },
    identityTitle: {
      color: colors.onSpotlight,
      fontFamily: typography.bengaliMedium,
      fontSize: 15,
    },
    identityMeta: {
      color: colors.onSpotlightMuted,
      fontFamily: typography.bengali,
      fontSize: 11,
      marginTop: 2,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 16,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    headingRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    gateCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
    },
    gateText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    toggleRow: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    toggle: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: spacing.sm,
    },
    toggleActive: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
    toggleText: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
      textAlign: 'center' as const,
    },
    toggleTextActive: {
      color: colors.primary,
    },
    lessonRow: {
      marginTop: spacing.md,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: spacing.md,
    },
    lessonLabel: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    stepper: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    stepBtn: {
      width: 36,
      height: 36,
    },
    stepValue: {
      minWidth: 24,
      textAlign: 'center' as const,
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 17,
    },
    divider: {
      height: 1,
      backgroundColor: colors.line,
      marginVertical: spacing.xl,
    },
    bulkBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    bulkText: {
      color: colors.white,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    empty: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 12,
      paddingVertical: spacing.sm,
    },
    row: {
      minHeight: 56,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
    },
    rowCopy: {
      flex: 1,
    },
    rowTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    rowSub: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
      marginTop: 2,
    },
    rowActions: {
      flexDirection: 'row' as const,
      gap: spacing.xs,
    },
    smallBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 36,
      borderRadius: radius.md,
      borderColor: colors.line,
      borderWidth: 1,
      backgroundColor: colors.surface,
    },
    smallBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    smallBtnText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    smallBtnTextLight: {
      color: colors.white,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
  };
}
