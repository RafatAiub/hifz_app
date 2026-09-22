import { createClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  Cloud,
  GraduationCap,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  SunMoon,
  Target,
  Type,
  User,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useApp } from '@/app-state/provider';
import { AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { normalizeSurahOrder } from '@/domain/planner';
import { scheduleDailyReminder } from '@/services/reminders';
import { syncPendingEvents } from '@/sync/sync-service';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors, useThemeMode, useTypography } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const ARABIC_SCALES = [
  [0.85, 'ছোট', '০.৮৫x'],
  [1, 'স্বাভাবিক', '১.০x'],
  [1.15, 'বড়', '১.১৫x'],
  [1.3, 'অতি বড়', '১.৩x'],
] as const;

const MUSHAF_ORDER = [...quranDemoPack.surahs]
  .map((surah) => surah.number)
  .sort((a, b) => a - b);

const SURAH_ORDER_PRESETS = [
  {
    id: 'mushaf',
    title: 'মুসহাফ ক্রম',
    subtitle: 'সূরা আন-নাবা থেকে আন-নাস (৭৮ → ১১৪)',
    value: MUSHAF_ORDER,
  },
  {
    id: 'reverse',
    title: 'শেষ থেকে শুরু',
    subtitle: 'সূরা আন-নাস থেকে আন-নাবা (১১৪ → ৭৮)',
    value: [...MUSHAF_ORDER].reverse(),
  },
  {
    id: 'short',
    title: 'ছোট সূরা আগে',
    subtitle: 'কম আয়াতের সহজ সূরাগুলো আগে আসবে',
    value: [...quranDemoPack.surahs]
      .sort((a, b) => a.ayahCount - b.ayahCount || a.number - b.number)
      .map((surah) => surah.number),
  },
];

const HIFZ_STATUS_OPTIONS = [
  ['new', 'নতুন শুরু', 'নতুন আয়াত মুখস্থ ও প্রাথমিক অনুশীলন'],
  ['partial', 'আংশিক মুখস্থ', 'নতুন সবকের সাথে পূর্বের মুখস্থ ঝালাই'],
  ['hafiz', 'হাফেজ মোড', 'শুধুমাত্র সম্পূর্ণ কুরআনের পর্যায়ক্রমিক মুরাজাআ'],
] as const;

const SAT_SABAQ_OPTIONS = [5, 7, 10, 15];
const REVISION_DAY_OPTIONS = [7, 14, 21, 30];

function sameOrder(a: number[], b: number[]) {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

export default function SettingsScreen() {
  const {
    profile,
    setAvailableMinutes,
    setArabicTextScale,
    setArabicFont,
    setUiFont,
    setSurahOrder,
    setMaxNewAyahsPerSession,
    setHifzStatus,
    setTeacherModeEnabled,
    setTeacherSetting,
    repository,
  } = useApp();

  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const fonts = useTypography();
  const { preference, setPreference } = useThemeMode();

  const [reminderTime, setReminderTime] = useState(profile?.preferredTime ?? '05:30');
  const [email, setEmail] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const memorizedSet = useMemo(
    () => new Set(profile?.memorizedAyahKeys ?? []),
    [profile?.memorizedAyahKeys],
  );

  const memorizedSurahCount = useMemo(() => {
    return quranDemoPack.surahs.filter((surah) => {
      const ayahs = quranDemoPack.ayahs.filter((a) => a.surahNumber === surah.number);
      return ayahs.length > 0 && ayahs.every((a) => memorizedSet.has(a.key));
    }).length;
  }, [memorizedSet]);

  const currentOrder = useMemo(
    () => normalizeSurahOrder(profile?.surahOrder ?? [], quranDemoPack),
    [profile?.surahOrder],
  );

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  }

  async function applyReminder(time: string) {
    setReminderTime(time);
    const ok = await scheduleDailyReminder(time);
    showToast(
      ok
        ? `প্রতিদিনের রিমাইন্ডার ${time}-এ সেট করা হয়েছে ✓`
        : 'নোটিফিকেশন পারমিশন দেওয়া নেই। ডিভাইসের সেটিংসে অনুমতি দিন।',
    );
  }

  async function handleCloudSync() {
    setBusy(true);
    try {
      const result = await syncPendingEvents(repository);
      showToast(
        result.configured
          ? `${result.synced}টি সেশন সফলভাবে ক্লাউডে ব্যাকআপ হয়েছে ✓`
          : 'ক্লাউড ব্যাকআপ কনফিগার করা নেই। লোকাল ডেটা সম্পূর্ণ সুরক্ষিত।',
      );
    } catch {
      showToast('ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।');
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSignIn() {
    if (!email.trim()) return;
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      showToast('ক্লাউড ব্যাকআপ বর্তমানে লোকাল মোডে সংরক্ষিত।');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient(url, key);
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      showToast(error ? error.message : 'আপনার ইমেইলে সাইন-ইন লিংক পাঠানো হয়েছে।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen
      hasTabBar={false}
      eyebrow="অ্যাপ কনফিগারেশন"
      title="সেটিংস"
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      {/* Toast Alert */}
      {toastMessage ? (
        <View style={styles.toastCard}>
          <Sparkles color={colors.primary} size={16} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Profile Overview Card */}
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}>
          <User color={colors.primary} size={24} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileTitle}>
            {profile?.hifzStatus === 'hafiz' ? 'হাফেজে কুরআন' : 'হিফজ শিক্ষার্থী'}
          </Text>
          <Text style={styles.profileMeta}>
            {memorizedSurahCount}টি সূরা মুখস্থ · দৈনিক {profile?.availableMinutes ?? 20} মিনিট
          </Text>
        </View>
        <View style={styles.profileBadge}>
          <Text style={styles.profileBadgeText}>
            {Math.round((memorizedSurahCount / quranDemoPack.surahs.length) * 100)}% সম্পন্ন
          </Text>
        </View>
      </View>

      {/* ──────────────────────────────────────────────────────────
          1. প্রদর্শন ও ফন্ট (Display & Fonts)
         ────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Type color={colors.primary} size={18} />
          <Text style={styles.cardTitle}>প্রদর্শন ও হরফ</Text>
        </View>

        {/* Theme Preference */}
        <Text style={styles.fieldLabel}>থিম মোড</Text>
        <View style={styles.segmentedRow}>
          {(
            [
              ['system', 'সিস্টেম', SunMoon],
              ['light', 'হালকা', Sun],
              ['dark', 'গাঢ়', Moon],
            ] as const
          ).map(([val, label, Icon]) => {
            const active = preference === val;
            return (
              <Pressable
                key={val}
                onPress={() => setPreference(val)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                accessibilityRole="button"
              >
                <Icon color={active ? colors.white : colors.muted} size={16} />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Arabic Font Size */}
        <Text style={styles.fieldLabel}>আরবি হরফের আকার</Text>
        <View style={styles.segmentedRow}>
          {ARABIC_SCALES.map(([scaleVal, label, sub]) => {
            const active = (profile?.arabicTextScale ?? 1) === scaleVal;
            return (
              <Pressable
                key={scaleVal}
                onPress={() => void setArabicTextScale(scaleVal)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {label}
                </Text>
                <Text style={[styles.segmentSub, active && styles.segmentSubActive]}>
                  {sub}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Arabic Live Preview */}
        <View style={styles.fontPreviewBox}>
          <Text
            style={[
              styles.fontPreviewArabic,
              {
                fontFamily: fonts.arabicBold,
                fontSize: 26 * (profile?.arabicTextScale ?? 1),
                lineHeight: 46 * (profile?.arabicTextScale ?? 1),
              },
            ]}
          >
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ ﴿١﴾
          </Text>
        </View>

        {/* Arabic Script Choice */}
        <Text style={styles.fieldLabel}>আরবি হরফের ধরন</Text>
        <View style={styles.segmentedRow}>
          {(
            [
              ['uthmanic', 'উসমানি হাফস (মুসহাফ)'],
              ['amiri', 'আমিরি ফন্ট'],
            ] as const
          ).map(([val, label]) => {
            const active = (profile?.arabicFont ?? 'uthmanic') === val;
            return (
              <Pressable
                key={val}
                onPress={() => void setArabicFont(val)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bengali Font Choice */}
        <Text style={styles.fieldLabel}>বাংলা লেখার ধরন</Text>
        <View style={styles.segmentedRow}>
          {(
            [
              ['sans', 'আধুনিক (Sans)'],
              ['serif', 'ক্লাসিক (Serif)'],
            ] as const
          ).map(([val, label]) => {
            const active = (profile?.uiFont ?? 'sans') === val;
            return (
              <Pressable
                key={val}
                onPress={() => void setUiFont(val)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ──────────────────────────────────────────────────────────
          2. হিফজের লক্ষ্য ও পরিকল্পনা (Hifz Goal & Pace)
         ────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Target color={colors.primary} size={18} />
          <Text style={styles.cardTitle}>হিফজ লক্ষ্য ও গতি</Text>
        </View>

        {/* Daily Time */}
        <Text style={styles.fieldLabel}>দৈনিক বরাদ্দ সময়</Text>
        <View style={styles.pillRow}>
          {[10, 15, 20, 30, 45].map((mins) => {
            const active = (profile?.availableMinutes ?? 20) === mins;
            return (
              <Pressable
                key={mins}
                onPress={() => void setAvailableMinutes(mins)}
                style={[styles.pill, active && styles.pillActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {mins} মিনিট
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* New Ayahs Per Session */}
        <Text style={styles.fieldLabel}>প্রতি সেশনে নতুন সবক</Text>
        <View style={styles.pillRow}>
          {[1, 2, 3, 5, 8].map((count) => {
            const active = (profile?.maxNewAyahsPerSession ?? 3) === count;
            return (
              <Pressable
                key={count}
                onPress={() => void setMaxNewAyahsPerSession(count)}
                style={[styles.pill, active && styles.pillActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {count}টি আয়াত
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Hifz Status Level */}
        <Text style={styles.fieldLabel}>আপনার বর্তমান হিফজ অবস্থা</Text>
        <View style={styles.optionStack}>
          {HIFZ_STATUS_OPTIONS.map(([val, label, hint]) => {
            const active = (profile?.hifzStatus ?? 'new') === val;
            return (
              <Pressable
                key={val}
                onPress={() => void setHifzStatus(val)}
                style={[styles.optionCard, active && styles.optionCardActive]}
                accessibilityRole="button"
              >
                <View style={[styles.checkCircle, active && styles.checkCircleActive]}>
                  {active ? <Check color={colors.white} size={13} /> : null}
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                    {label}
                  </Text>
                  <Text style={styles.optionHint}>{hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ──────────────────────────────────────────────────────────
          3. নামাজ-ভিত্তিক রিমাইন্ডার (Daily Reminders)
         ────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Bell color={colors.primary} size={18} />
          <Text style={styles.cardTitle}>দৈনিক রিমাইন্ডার</Text>
        </View>
        <Text style={styles.cardDesc}>
          কুরআন হিফজের সবচেয়ে বরকতময় সময়ে নোটিফিকেশনের মাধ্যমে মনে করিয়ে দেওয়া হবে।
        </Text>

        <View style={styles.reminderPresetGrid}>
          {(
            [
              ['05:30', '🌅 ফজর সবক', '০৫:৩০'],
              ['17:00', '📖 আসর দাওর', '১৭:০০'],
              ['21:30', '🌙 রাত মুরাজাআ', '২১:৩০'],
            ] as const
          ).map(([timeVal, title, displayTime]) => {
            const active = reminderTime === timeVal;
            return (
              <Pressable
                key={timeVal}
                onPress={() => void applyReminder(timeVal)}
                style={[styles.reminderPresetCard, active && styles.reminderPresetCardActive]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.reminderPresetTitle,
                    active && styles.reminderPresetTitleActive,
                  ]}
                >
                  {title}
                </Text>
                <Text
                  style={[
                    styles.reminderPresetTime,
                    active && styles.reminderPresetTimeActive,
                  ]}
                >
                  {displayTime}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom Time Setter */}
        <View style={styles.customTimeRow}>
          <TextInput
            value={reminderTime}
            onChangeText={setReminderTime}
            placeholder="06:30"
            placeholderTextColor={colors.muted}
            style={styles.timeInput}
          />
          <Pressable
            onPress={() => void applyReminder(reminderTime)}
            style={styles.timeSetBtn}
            accessibilityRole="button"
          >
            <Bell color={colors.white} size={16} />
            <Text style={styles.timeSetBtnText}>সেট করুন</Text>
          </Pressable>
        </View>
      </View>

      {/* ──────────────────────────────────────────────────────────
          4. সূরা ব্যবস্থাপনা (Surah Management)
         ────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <BookOpen color={colors.primary} size={18} />
          <Text style={styles.cardTitle}>সূরার ক্রম ও মুখস্থ তালিকা</Text>
        </View>

        {/* Memorized Surahs Link */}
        <Pressable
          onPress={() => router.push('/memorized-surahs')}
          style={styles.actionRowCard}
          accessibilityRole="button"
        >
          <View style={styles.actionRowLeft}>
            <Text style={styles.actionRowTitle}>আমার মুখস্থ থাকা সূরা</Text>
            <Text style={styles.actionRowSubtitle}>
              {memorizedSurahCount}টি সূরা মুখস্থ হিসেবে চিহ্নিত আছে
            </Text>
          </View>
          <ChevronRight color={colors.primary} size={20} />
        </Pressable>

        {/* Surah Order Presets */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
          নতুন সবকের জন্য সূরার ক্রম
        </Text>
        <View style={styles.optionStack}>
          {SURAH_ORDER_PRESETS.map((preset) => {
            const active = sameOrder(currentOrder, preset.value);
            return (
              <Pressable
                key={preset.id}
                onPress={() => setSurahOrder(preset.value)}
                style={[styles.optionCard, active && styles.optionCardActive]}
                accessibilityRole="button"
              >
                <View style={[styles.checkCircle, active && styles.checkCircleActive]}>
                  {active ? <Check color={colors.white} size={13} /> : null}
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                    {preset.title}
                  </Text>
                  <Text style={styles.optionHint}>{preset.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ──────────────────────────────────────────────────────────
          5. উস্তাদ মোড (Teacher Mode)
         ────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <GraduationCap color={colors.primary} size={18} />
          <Text style={styles.cardTitle}>উস্তাদ মোড</Text>
        </View>
        <Text style={styles.cardDesc}>
          মাদরাসা বা শিক্ষকের অধীনে হিফজের জন্য। উস্তাদের অনুমোদন ছাড়া নতুন সবক সামনে
          এগোবে না।
        </Text>

        <View style={styles.segmentedRow}>
          {(
            [
              [true, 'চালু'],
              [false, 'বন্ধ'],
            ] as const
          ).map(([val, label]) => {
            const active = (profile?.teacherModeEnabled ?? false) === val;
            return (
              <Pressable
                key={String(val)}
                onPress={() => void setTeacherModeEnabled(val)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {profile?.teacherModeEnabled ? (
          <View style={styles.subSettingWrap}>
            <Text style={styles.fieldLabel}>সাত সবক (সাম্প্রতিক কয়টি সবক দৈনিক ঝালাই)</Text>
            <View style={styles.pillRow}>
              {SAT_SABAQ_OPTIONS.map((count) => {
                const active = (profile?.satSabaqCount ?? 7) === count;
                return (
                  <Pressable
                    key={count}
                    onPress={() => void setTeacherSetting({ satSabaqCount: count })}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {count}টি
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>সবক়ি থেকে মনজিলে যাওয়ার সময়সীমা</Text>
            <View style={styles.pillRow}>
              {REVISION_DAY_OPTIONS.map((days) => {
                const active = (profile?.recentRevisionDays ?? 14) === days;
                return (
                  <Pressable
                    key={days}
                    onPress={() => void setTeacherSetting({ recentRevisionDays: days })}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {days} দিন
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      {/* ──────────────────────────────────────────────────────────
          6. ক্লাউড ব্যাকআপ ও ডেটা (Cloud Sync & Backup)
         ────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Cloud color={colors.primary} size={18} />
          <Text style={styles.cardTitle}>ক্লাউড ব্যাকআপ ও ডেটা</Text>
        </View>
        <Text style={styles.cardDesc}>
          আপনার প্রতিটি তিলাওয়াত ও মুখস্থের রেকর্ড নিরাপদ রাখুন।
        </Text>

        <Pressable
          onPress={() => void handleCloudSync()}
          disabled={busy}
          style={styles.syncBtn}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <RotateCcw color={colors.white} size={16} />
          )}
          <Text style={styles.syncBtnText}>এখনই ব্যাকআপ নিন</Text>
        </Pressable>

        <View style={styles.emailWrap}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="আপনার ইমেইল দিন (ঐচ্ছিক)"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.emailInput}
          />
          <Pressable
            onPress={() => void handleEmailSignIn()}
            style={styles.emailBtn}
            accessibilityRole="button"
          >
            <Text style={styles.emailBtnText}>সংরক্ষণ</Text>
          </Pressable>
        </View>
      </View>

      {/* ──────────────────────────────────────────────────────────
          7. অ্যাপ তথ্য ও কৃতজ্ঞতা (About App)
         ────────────────────────────────────────────────────────── */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>হিফজ অটো-পাইলট (Hifz Autopilot)</Text>
        <Text style={styles.aboutMeta}>ভার্সন ১.০.০ · বিল্ড ২০২৬.০৯</Text>
        <Text style={styles.aboutDesc}>
          পবিত্র কুরআনের বিশুদ্ধ তিলাওয়াত: তানজিল প্রজেক্ট এবং এভরি-আয়াহ (শায়খ মিশারী
          রাশিদ আল-আফাসী)। সম্পূর্ণ অফলাইনে ব্যবহারযোগ্য।
        </Text>
      </View>
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    toastCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.mint,
      borderColor: colors.primary,
      borderWidth: 1,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.md,
    },
    toastText: {
      flex: 1,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
      color: colors.primary,
    },

    // Profile Hero
    profileHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.line,
      borderWidth: 1,
      padding: spacing.lg,
      borderRadius: radius.lg,
      marginBottom: spacing.lg,
    },
    profileAvatar: {
      width: 48,
      height: 48,
      borderRadius: radius.full,
      backgroundColor: colors.mint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInfo: {
      flex: 1,
    },
    profileTitle: {
      fontFamily: typography.bengaliMedium,
      fontSize: 16,
      color: colors.ink,
    },
    profileMeta: {
      fontFamily: typography.bengali,
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    profileBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.mint,
    },
    profileBadgeText: {
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
      color: colors.primary,
    },

    // Grouping Cards
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    cardTitle: {
      fontFamily: typography.bengaliMedium,
      fontSize: 16,
      color: colors.ink,
    },
    cardDesc: {
      fontFamily: typography.bengali,
      fontSize: 12,
      color: colors.muted,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    fieldLabel: {
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
      color: colors.ink,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },

    // Segmented Control Row
    segmentedRow: {
      flexDirection: 'row',
      backgroundColor: colors.canvas,
      borderRadius: radius.md,
      padding: 3,
      gap: 3,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    segmentBtnActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      color: colors.ink,
    },
    segmentTextActive: {
      color: colors.white,
    },
    segmentSub: {
      fontFamily: typography.bengali,
      fontSize: 10,
      color: colors.muted,
    },
    segmentSubActive: {
      color: colors.white,
      opacity: 0.8,
    },

    // Live Font Preview
    fontPreviewBox: {
      marginTop: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fontPreviewArabic: {
      color: colors.ink,
      textAlign: 'center',
    },

    // Pill Selector Row
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    pill: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.canvas,
      borderColor: colors.line,
      borderWidth: 1,
    },
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      color: colors.ink,
    },
    pillTextActive: {
      color: colors.white,
    },

    // Option Stack (Checklist cards)
    optionStack: {
      gap: spacing.xs,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.canvas,
      borderColor: colors.line,
      borderWidth: 1,
    },
    optionCardActive: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
    checkCircle: {
      width: 20,
      height: 20,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkCircleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
      color: colors.ink,
    },
    optionTitleActive: {
      color: colors.primary,
    },
    optionHint: {
      fontFamily: typography.bengali,
      fontSize: 11,
      color: colors.muted,
      marginTop: 1,
    },

    // Reminder Presets
    reminderPresetGrid: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    reminderPresetCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.canvas,
      borderColor: colors.line,
      borderWidth: 1,
    },
    reminderPresetCardActive: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
    reminderPresetTitle: {
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      color: colors.ink,
      textAlign: 'center',
    },
    reminderPresetTitleActive: {
      color: colors.primary,
    },
    reminderPresetTime: {
      fontFamily: typography.bengali,
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
    },
    reminderPresetTimeActive: {
      color: colors.primary,
    },

    // Custom Time
    customTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    timeInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      paddingHorizontal: spacing.md,
      fontFamily: typography.bengaliMedium,
      fontSize: 14,
      color: colors.ink,
    },
    timeSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    timeSetBtnText: {
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
      color: colors.white,
    },

    // Action Row Card
    actionRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    actionRowLeft: {
      flex: 1,
    },
    actionRowTitle: {
      fontFamily: typography.bengaliMedium,
      fontSize: 14,
      color: colors.primary,
    },
    actionRowSubtitle: {
      fontFamily: typography.bengali,
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },

    // Teacher Sub-settings
    subSettingWrap: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },

    // Cloud Sync
    syncBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      marginBottom: spacing.md,
    },
    syncBtnText: {
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
      color: colors.white,
    },
    emailWrap: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    emailInput: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      paddingHorizontal: spacing.md,
      fontSize: 13,
      color: colors.ink,
    },
    emailBtn: {
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      borderColor: colors.primary,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emailBtnText: {
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      color: colors.primary,
    },

    // About Footer
    aboutCard: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xxl,
    },
    aboutTitle: {
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
      color: colors.ink,
    },
    aboutMeta: {
      fontFamily: typography.bengali,
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
    },
    aboutDesc: {
      fontFamily: typography.bengali,
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: spacing.xs,
    },
  });
}
