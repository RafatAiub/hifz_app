import { router } from 'expo-router';
import {
  BookOpen,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  GraduationCap,
  Mic,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { BrandMark } from '@/components/brand-mark';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
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
  const {
    ready,
    plan,
    profile,
    stats,
    setAvailableMinutes,
    activeSurahNumber,
    setActiveSurah,
    setSurahMemorized,
    setRevisionGateEnabled,
  } = useApp();
  const minutes = profile?.availableMinutes ?? 20;
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const breakpoint = useBreakpoint();
  const ringSize = breakpoint === 'compact' ? 68 : 90;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeSurah = useMemo(() => {
    return (
      quranDemoPack.surahs.find((s) => s.number === activeSurahNumber) ??
      quranDemoPack.surahs[0]
    );
  }, [activeSurahNumber]);

  const activeSurahAyahs = useMemo(() => {
    return quranDemoPack.ayahs.filter((a) => a.surahNumber === activeSurah.number);
  }, [activeSurah.number]);

  const memorizedSet = useMemo(() => {
    return new Set(profile?.memorizedAyahKeys ?? []);
  }, [profile?.memorizedAyahKeys]);

  const activeSurahMemorizedCount = useMemo(() => {
    return activeSurahAyahs.filter((a) => memorizedSet.has(a.key)).length;
  }, [activeSurahAyahs, memorizedSet]);

  const isActiveSurahComplete =
    activeSurahMemorizedCount === activeSurahAyahs.length && activeSurahAyahs.length > 0;
  const activeSurahPct =
    activeSurahAyahs.length > 0
      ? Math.round((activeSurahMemorizedCount / activeSurahAyahs.length) * 100)
      : 0;

  const filteredSurahs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return quranDemoPack.surahs;
    return quranDemoPack.surahs.filter(
      (s) =>
        s.nameBn.toLowerCase().includes(q) ||
        s.nameArabic.includes(q) ||
        String(s.number).includes(q),
    );
  }, [searchQuery]);
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

      <View style={styles.activeSurahHeroCard}>
        <View style={styles.activeSurahHeader}>
          <View style={styles.activeSurahEyebrowRow}>
            <Sparkles color={colors.gold} size={15} />
            <Text style={styles.activeSurahEyebrow}>চলতি হিফজ সূরা</Text>
          </View>
          <View style={[styles.surahStatusBadge, isActiveSurahComplete && styles.surahStatusBadgeDone]}>
            <Text style={[styles.surahStatusBadgeText, isActiveSurahComplete && styles.surahStatusBadgeTextDone]}>
              {isActiveSurahComplete ? '✅ মুখস্থ সম্পন্ন' : activeSurahMemorizedCount > 0 ? '📖 হিফজ চলছে' : '✨ নতুন শুরু'}
            </Text>
          </View>
        </View>

        <View style={styles.surahTitleRow}>
          <View style={styles.surahTitleCopy}>
            <Text style={styles.surahNameLarge}>সূরা {activeSurah.nameBn}</Text>
            <Text style={styles.surahAyahMeta}>
              {activeSurahAyahs.length} আয়াতের মধ্যে {activeSurahMemorizedCount}টি সম্পন্ন ({activeSurahPct}%)
            </Text>
          </View>
          <Text style={styles.surahArabicCalligraphy}>{activeSurah.nameArabic}</Text>
        </View>

        <View style={styles.surahProgressBarTrack}>
          <View style={[styles.surahProgressBarFill, { width: `${Math.max(4, activeSurahPct)}%` }]} />
        </View>

        <View style={styles.heroButtonArea}>
          <ActionButton
            label={isActiveSurahComplete ? 'কুরআন তিলাওয়াত ও দাওর শুরু' : `বিসমিল্লাহ — সূরা ${activeSurah.nameBn} হিফজ শুরু`}
            icon={<BookOpen color={colors.white} size={19} />}
            onPress={() => router.push(`/session?surahNumber=${activeSurah.number}`)}
          />

          <View style={styles.heroSecondaryActions}>
            <Pressable
              style={styles.heroSecondaryBtn}
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
            >
              <RotateCcw color={colors.primary} size={15} />
              <Text style={styles.heroSecondaryBtnText}>সূরা পরিবর্তন / নতুন সূরা</Text>
            </Pressable>

            <Pressable
              style={styles.heroSecondaryBtn}
              onPress={() => router.push(`/recitation-test?surahNumber=${activeSurah.number}`)}
              accessibilityRole="button"
            >
              <Mic color={colors.primary} size={15} />
              <Text style={styles.heroSecondaryBtnText}>পড়া পরীক্ষা (AI)</Text>
            </Pressable>
          </View>
        </View>
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
        <View style={styles.gateBanner}>
          <ShieldAlert color={colors.gold} size={18} />
          <View style={styles.gateCopyCol}>
            <Text style={styles.gateText}>
              {gate.blocked && gateCopy[gate.reason]
                ? gateCopy[gate.reason]
                : 'সবক়ি ও মনজিল মজবুত — নতুন সবক খোলা আছে।'}
            </Text>
            {gate.blocked ? (
              <View style={styles.gateActionRow}>
                <Pressable
                  style={styles.gateActionBtn}
                  onPress={() => router.push('/weak-repair')}
                >
                  <Text style={styles.gateActionBtnText}>দুর্বল আয়াত ঝালাই</Text>
                </Pressable>
                <Pressable
                  style={styles.gateActionBtnSecondary}
                  onPress={() => void setRevisionGateEnabled(!profile?.revisionGateEnabled)}
                >
                  <Text style={styles.gateActionBtnTextSecondary}>
                    {profile?.revisionGateEnabled === false ? 'গেট সক্রিয় করুন' : 'গেট শিথিল রাখুন'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <Text style={styles.gateStrength}>
            {Math.round(((gate.sabqiRetention + gate.manzilRetention) / 2) * 100)}%
          </Text>
        </View>
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

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>সূরা নির্বাচন করুন</Text>
              <Text style={styles.modalSubtitle}>আমপারা (সূরা ৭৮ - ১১৪) · সরাসরি হিফজ শুরু করুন</Text>
            </View>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setPickerOpen(false)}
              accessibilityLabel="বন্ধ করুন"
            >
              <X color={colors.ink} size={20} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Search color={colors.muted} size={16} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="সূরার নাম বা নম্বর লিখে খুঁজুন…"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <X color={colors.muted} size={16} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={styles.surahListContent} showsVerticalScrollIndicator={false}>
            {filteredSurahs.map((surah) => {
              const surahAyahList = quranDemoPack.ayahs.filter((a) => a.surahNumber === surah.number);
              const memCount = surahAyahList.filter((a) => memorizedSet.has(a.key)).length;
              const isDone = memCount === surahAyahList.length && surahAyahList.length > 0;
              const isCurrent = surah.number === activeSurah.number;

              return (
                <View
                  key={surah.number}
                  style={[styles.modalSurahRow, isCurrent && styles.modalSurahRowCurrent]}
                >
                  <View style={styles.surahMedallion}>
                    <Text style={styles.surahMedallionText}>{surah.number}</Text>
                  </View>

                  <Pressable
                    style={styles.surahRowMain}
                    onPress={async () => {
                      await setActiveSurah(surah.number);
                      setPickerOpen(false);
                      router.push(`/session?surahNumber=${surah.number}`);
                    }}
                  >
                    <View style={styles.surahNameColumn}>
                      <Text style={styles.modalSurahNameBn}>সূরা {surah.nameBn}</Text>
                      <Text style={styles.modalSurahAyahs}>
                        {surah.ayahCount} আয়াত · {isDone ? '✅ সম্পন্ন' : memCount > 0 ? `${memCount}টি মুখস্থ` : 'নতুন'}
                      </Text>
                    </View>
                    <Text style={styles.modalSurahNameAr}>{surah.nameArabic}</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.quickMemorizedBtn, isDone && styles.quickMemorizedBtnActive]}
                    onPress={async () => {
                      await setSurahMemorized(surah.number, !isDone, 'strong');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={isDone ? 'মুখস্থ বাতিল করুন' : 'ইতিমধ্যে মুখস্থ হিসেবে মার্ক করুন'}
                  >
                    {isDone ? (
                      <CheckCircle2 color={colors.primary} size={20} />
                    ) : (
                      <Circle color={colors.muted} size={20} />
                    )}
                    <Text style={[styles.quickMemorizedText, isDone && styles.quickMemorizedTextActive]}>
                      {isDone ? 'মুখস্থ' : 'মুখস্থ?'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
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
    gateCopyCol: {
      flex: 1,
      gap: spacing.xs,
    },
    gateText: {
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 19,
    },
    gateActionRow: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      marginTop: 4,
    },
    gateActionBtn: {
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderColor: colors.gold,
      borderWidth: 1,
    },
    gateActionBtnText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    gateActionBtnSecondary: {
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
    },
    gateActionBtnTextSecondary: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
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
    activeSurahHeroCard: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderColor: colors.gold,
      borderWidth: 1.5,
      ...colors.elevation.card,
    },
    activeSurahHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: spacing.sm,
    },
    activeSurahEyebrowRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
    },
    activeSurahEyebrow: {
      color: colors.gold,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      letterSpacing: 0.3,
    },
    surahStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      backgroundColor: colors.paleGold,
      borderColor: colors.gold,
      borderWidth: 1,
    },
    surahStatusBadgeDone: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
    surahStatusBadgeText: {
      color: '#8C660D',
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    surahStatusBadgeTextDone: {
      color: colors.primary,
    },
    surahTitleRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    surahTitleCopy: {
      flex: 1,
    },
    surahNameLarge: {
      color: colors.ink,
      fontFamily: typography.bengaliBold,
      fontSize: 22,
      lineHeight: 30,
    },
    surahAyahMeta: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 12,
      marginTop: 2,
    },
    surahArabicCalligraphy: {
      color: colors.primary,
      fontFamily: typography.arabicBold,
      fontSize: 26,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    surahProgressBarTrack: {
      height: 6,
      borderRadius: radius.full,
      backgroundColor: colors.line,
      overflow: 'hidden' as const,
      marginBottom: spacing.md,
    },
    surahProgressBarFill: {
      height: '100%' as const,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    heroButtonArea: {
      gap: spacing.sm,
    },
    heroSecondaryActions: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
    },
    heroSecondaryBtn: {
      flex: 1,
      minHeight: 40,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    heroSecondaryBtnText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingBottom: spacing.md,
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
      marginBottom: spacing.sm,
    },
    modalTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliBold,
      fontSize: 18,
    },
    modalSubtitle: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 12,
      marginTop: 2,
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    searchRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginVertical: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: typography.bengali,
      fontSize: 14,
      color: colors.ink,
    },
    surahListContent: {
      paddingBottom: spacing.xxl,
      gap: spacing.xs,
    },
    modalSurahRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    modalSurahRowCurrent: {
      borderColor: colors.primary,
      backgroundColor: colors.mint,
    },
    surahMedallion: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.paleGold,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
      borderColor: colors.gold,
    },
    surahMedallionText: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
    },
    surahRowMain: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: spacing.sm,
    },
    surahNameColumn: {
      flex: 1,
    },
    modalSurahNameBn: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 15,
    },
    modalSurahAyahs: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
      marginTop: 2,
    },
    modalSurahNameAr: {
      color: colors.primary,
      fontFamily: typography.arabicBold,
      fontSize: 18,
      textAlign: 'right' as const,
      writingDirection: 'rtl' as const,
    },
    quickMemorizedBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
      borderColor: colors.line,
      borderWidth: 1,
    },
    quickMemorizedBtnActive: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
    quickMemorizedText: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
    },
    quickMemorizedTextActive: {
      color: colors.primary,
    },
  };
}
