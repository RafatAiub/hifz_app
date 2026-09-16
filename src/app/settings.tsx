import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Cloud,
  Moon,
  ShieldCheck,
  Sun,
  SunMoon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { moveInOrder, normalizeSurahOrder } from '@/domain/planner';
import { scheduleDailyReminder } from '@/services/reminders';
import { syncPendingEvents } from '@/sync/sync-service';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors, useThemeMode } from '@/theme/theme-context';
import { radius, spacing, typography, type ColorPalette } from '@/theme/tokens';

const ARABIC_SCALES = [
  [0.8, 'ছোট'],
  [1, 'স্বাভাবিক'],
  [1.2, 'বড়'],
  [1.4, 'অতিরিক্ত বড়'],
] as const;

const SURAH_BY_NUMBER = new Map(
  quranDemoPack.surahs.map((surah) => [surah.number, surah]),
);

const MUSHAF_ORDER = [...quranDemoPack.surahs]
  .map((surah) => surah.number)
  .sort((a, b) => a - b);

// One-tap orderings for the "সূরার ক্রম" section. `value` is a full,
// already-complete permutation of every Juz Amma surah -- it still passes
// through normalizeSurahOrder() before it is stored, so a future content
// change can never make a preset drop or duplicate a surah.
const SURAH_ORDER_PRESETS: Array<{
  id: string;
  label: string;
  hint: string;
  value: number[];
}> = [
  { id: 'mushaf', label: 'মুসহাফ ক্রম', hint: 'নাবা → নাস', value: MUSHAF_ORDER },
  {
    id: 'reverse',
    label: 'শেষ থেকে',
    hint: 'নাস → নাবা',
    value: [...MUSHAF_ORDER].reverse(),
  },
  {
    id: 'short',
    label: 'ছোট সূরা আগে',
    hint: 'কম আয়াত আগে',
    value: [...quranDemoPack.surahs]
      .sort((a, b) => a.ayahCount - b.ayahCount || a.number - b.number)
      .map((surah) => surah.number),
  },
];

function sameOrder(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const HIFZ_STATUS_OPTIONS = [
  ['new', 'নতুন', 'শুরু করছি'],
  ['partial', 'আংশিক', 'কিছু মুখস্থ আছে'],
  ['hafiz', 'হাফেজ', 'শুধু মুরাজাআ'],
] as const;

const IMPORT_STRENGTH_OPTIONS = [
  ['strong', 'পাকা'],
  ['medium', 'মোটামুটি'],
  ['weak', 'কাঁচা'],
] as const;

const SAT_SABAQ_OPTIONS = [5, 7, 10, 15];
const RECENT_REVISION_OPTIONS = [7, 10, 14, 21, 30];
const MANZIL_PER_DAY_OPTIONS = [0, 5, 10, 15, 20];

export default function SettingsScreen() {
  const {
    profile,
    setAvailableMinutes,
    setArabicTextScale,
    setArabicFont,
    setUiFont,
    setSurahOrder,
    setMaxNewAyahsPerSession,
    setSurahMemorized,
    setHifzStatus,
    setTeacherModeEnabled,
    setTeacherSetting,
    repository,
  } = useApp();
  const [importStrength, setImportStrength] =
    useState<(typeof IMPORT_STRENGTH_OPTIONS)[number][0]>('medium');
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { preference, setPreference } = useThemeMode();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reminderTime, setReminderTime] = useState(
    profile?.preferredTime ?? '06:30',
  );

  const memorizedSet = useMemo(
    () => new Set(profile?.memorizedAyahKeys ?? []),
    [profile?.memorizedAyahKeys],
  );
  const memorizedSurahCount = useMemo(
    () =>
      quranDemoPack.surahs.filter((surah) =>
        quranDemoPack.ayahs
          .filter((a) => a.surahNumber === surah.number)
          .every((a) => memorizedSet.has(a.key)),
      ).length,
    [memorizedSet],
  );

  // The surah order is edited against a local working copy so a burst of
  // taps stays responsive and never races the async save. Every mutation
  // goes through `commitSurahOrder`, which updates the ref synchronously
  // (so chained taps compose), drives the UI, and debounces one write to
  // the provider -- flushed immediately if the user leaves the screen.
  const [surahOrder, setSurahOrderDraft] = useState<number[]>(() =>
    normalizeSurahOrder(profile?.surahOrder ?? [], quranDemoPack),
  );
  const surahOrderRef = useRef(surahOrder);
  const surahOrderSeeded = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSurahOrder = useRef<number[] | null>(null);

  // This screen can mount before the provider has finished reading the
  // stored profile, so seed the draft the first time a real profile lands
  // rather than trusting the initial (possibly empty) render.
  useEffect(() => {
    if (surahOrderSeeded.current || !profile) return;
    const seeded = normalizeSurahOrder(profile.surahOrder ?? [], quranDemoPack);
    surahOrderRef.current = seeded;
    setSurahOrderDraft(seeded);
    surahOrderSeeded.current = true;
  }, [profile]);

  const flushSurahOrder = useCallback(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    if (pendingSurahOrder.current) {
      void setSurahOrder(pendingSurahOrder.current);
      pendingSurahOrder.current = null;
    }
  }, [setSurahOrder]);

  useEffect(() => flushSurahOrder, [flushSurahOrder]);

  const commitSurahOrder = useCallback(
    (next: number[]) => {
      surahOrderRef.current = next;
      setSurahOrderDraft(next);
      pendingSurahOrder.current = next;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        persistTimer.current = null;
        const queued = pendingSurahOrder.current;
        pendingSurahOrder.current = null;
        if (queued) void setSurahOrder(queued);
      }, 400);
    },
    [setSurahOrder],
  );

  const reorderSurah = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      commitSurahOrder(moveInOrder(surahOrderRef.current, fromIndex, toIndex));
    },
    [commitSurahOrder],
  );

  const applySurahOrderPreset = useCallback(
    (value: number[]) => {
      commitSurahOrder(normalizeSurahOrder(value, quranDemoPack));
    },
    [commitSurahOrder],
  );

  async function enableReminder() {
    const enabled = await scheduleDailyReminder(reminderTime);
    setMessage(
      enabled
        ? 'প্রতিদিনের reminder চালু হয়েছে।'
        : 'এই device-এ notification permission পাওয়া যায়নি।',
    );
  }

  async function sendLink() {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setMessage('Cloud backup এখনো configure করা হয়নি। Local progress নিরাপদ আছে।');
      return;
    }
    setBusy(true);
    const supabase = createClient(url, key);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setMessage(error ? error.message : 'Email-এ sign-in link পাঠানো হয়েছে।');
    setBusy(false);
  }

  async function syncNow() {
    setBusy(true);
    try {
      const result = await syncPendingEvents(repository);
      setMessage(
        result.configured
          ? `${result.synced}টি নতুন session backup হয়েছে।`
          : 'Cloud backup configure না হওয়ায় app local-only mode-এ আছে।',
      );
    } catch {
      setMessage('এখন sync হয়নি। Internet এলে আবার চেষ্টা হবে।');
    } finally {
      setBusy(false);
    }
  }

  function isSurahMemorized(surahNumber: number) {
    const surahAyahs = quranDemoPack.ayahs.filter((a) => a.surahNumber === surahNumber);
    return surahAyahs.length > 0 && surahAyahs.every((a) => memorizedSet.has(a.key));
  }

  return (
    <AppScreen
      eyebrow="আপনার নিয়ন্ত্রণে"
      title="সেটিংস"
      hasTabBar={false}
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      <Text style={styles.sectionTitle}>থিম</Text>
      <View style={styles.choices}>
        {(
          [
            ['system', 'System', SunMoon],
            ['light', 'হালকা', Sun],
            ['dark', 'গাঢ়', Moon],
          ] as const
        ).map(([value, label, Icon]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: preference === value }}
            onPress={() => setPreference(value)}
            style={[styles.themeChoice, preference === value && styles.choiceSelected]}
          >
            <Icon
              color={preference === value ? colors.primary : colors.muted}
              size={18}
            />
            <Text
              style={[
                styles.choiceText,
                preference === value && styles.choiceTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>আরবি লেখার আকার</Text>
      <View style={styles.choices}>
        {ARABIC_SCALES.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{
              checked: (profile?.arabicTextScale ?? 1) === value,
            }}
            onPress={() => void setArabicTextScale(value)}
            style={[
              styles.choice,
              styles.arabicChoice,
              (profile?.arabicTextScale ?? 1) === value && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.arabicScalePreview,
                (profile?.arabicTextScale ?? 1) === value && styles.choiceTextSelected,
              ]}
            >
              أَ
            </Text>
            <Text
              style={[
                styles.choiceCaption,
                (profile?.arabicTextScale ?? 1) === value && styles.choiceTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>আরবি হরফের ধরন</Text>
      <View style={styles.choices}>
        {(
          [
            ['uthmanic', 'حفص عثماني', 'উসমানি হাফস'],
            ['amiri', 'أميري', 'আমিরি'],
          ] as const
        ).map(([value, arabicLabel, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: (profile?.arabicFont ?? 'uthmanic') === value }}
            onPress={() => void setArabicFont(value)}
            style={[
              styles.choice,
              styles.arabicChoice,
              (profile?.arabicFont ?? 'uthmanic') === value && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.arabicScalePreview,
                value === 'amiri' && styles.amiriPreview,
                (profile?.arabicFont ?? 'uthmanic') === value && styles.choiceTextSelected,
              ]}
            >
              {arabicLabel}
            </Text>
            <Text
              style={[
                styles.choiceCaption,
                (profile?.arabicFont ?? 'uthmanic') === value && styles.choiceTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>বাংলা লেখার ধরন</Text>
      <View style={styles.choices}>
        {(
          [
            ['sans', 'সাধারণ'],
            ['serif', 'ক্লাসিক'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: (profile?.uiFont ?? 'sans') === value }}
            onPress={() => void setUiFont(value)}
            style={[styles.choice, (profile?.uiFont ?? 'sans') === value && styles.choiceSelected]}
          >
            <Text
              style={[
                styles.choiceText,
                value === 'serif' && styles.serifPreview,
                (profile?.uiFont ?? 'sans') === value && styles.choiceTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>দৈনিক সময়</Text>
      <View style={styles.choices}>
        {[10, 15, 20, 30, 45].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{
              checked: profile?.availableMinutes === value,
            }}
            onPress={() => void setAvailableMinutes(value)}
            style={[
              styles.choice,
              profile?.availableMinutes === value && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                profile?.availableMinutes === value && styles.choiceTextSelected,
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>প্রতি session-এ নতুন আয়াত</Text>
      <View style={styles.choices}>
        {[1, 2, 3, 5, 8].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{
              checked: (profile?.maxNewAyahsPerSession ?? 3) === value,
            }}
            onPress={() => void setMaxNewAyahsPerSession(value)}
            style={[
              styles.choice,
              (profile?.maxNewAyahsPerSession ?? 3) === value && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                (profile?.maxNewAyahsPerSession ?? 3) === value && styles.choiceTextSelected,
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>হিফজ অবস্থা</Text>
      <Text style={styles.body}>
        হাফেজ বেছে নিলে app আর নতুন সবক দেবে না — শুধু পুরো কুরআনের মুরাজাআ ঘোরাবে।
      </Text>
      <View style={styles.choices}>
        {HIFZ_STATUS_OPTIONS.map(([value, label, hint]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: (profile?.hifzStatus ?? 'new') === value }}
            onPress={() => void setHifzStatus(value)}
            style={[
              styles.presetChoice,
              (profile?.hifzStatus ?? 'new') === value && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.presetLabel,
                (profile?.hifzStatus ?? 'new') === value && styles.choiceTextSelected,
              ]}
            >
              {label}
            </Text>
            <Text
              style={[
                styles.presetHint,
                (profile?.hifzStatus ?? 'new') === value && styles.choiceTextSelected,
              ]}
            >
              {hint}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>উস্তাদ মোড</Text>
      <Text style={styles.body}>
        উস্তাদ approve না করা পর্যন্ত নতুন সবক “সবক়ি” হবে না। Home ও session-এ
        দ্রুত approve/verify বোতাম আসবে।
      </Text>
      <View style={styles.choices}>
        {([
          [true, 'চালু'],
          [false, 'বন্ধ'],
        ] as const).map(([value, label]) => (
          <Pressable
            key={String(value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: (profile?.teacherModeEnabled ?? false) === value }}
            onPress={() => void setTeacherModeEnabled(value)}
            style={[
              styles.choice,
              (profile?.teacherModeEnabled ?? false) === value && styles.choiceSelected,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                (profile?.teacherModeEnabled ?? false) === value && styles.choiceTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {profile?.teacherModeEnabled ? (
        <>
          <Text style={styles.subLabel}>সাত সবক — সাম্প্রতিক কয়টি সবক দৈনিক ঝালাই</Text>
          <View style={styles.choices}>
            {SAT_SABAQ_OPTIONS.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: (profile?.satSabaqCount ?? 7) === value }}
                onPress={() => void setTeacherSetting({ satSabaqCount: value })}
                style={[
                  styles.choice,
                  (profile?.satSabaqCount ?? 7) === value && styles.choiceSelected,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    (profile?.satSabaqCount ?? 7) === value && styles.choiceTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.subLabel}>সবক়ি → মনজিল যেতে কত দিন</Text>
          <View style={styles.choices}>
            {RECENT_REVISION_OPTIONS.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: (profile?.recentRevisionDays ?? 14) === value }}
                onPress={() => void setTeacherSetting({ recentRevisionDays: value })}
                style={[
                  styles.choice,
                  (profile?.recentRevisionDays ?? 14) === value && styles.choiceSelected,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    (profile?.recentRevisionDays ?? 14) === value && styles.choiceTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.subLabel}>মনজিল / দিন (০ = নিজে ঠিক করুক)</Text>
          <View style={styles.choices}>
            {MANZIL_PER_DAY_OPTIONS.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: (profile?.manzilAyahsPerDay ?? 0) === value }}
                onPress={() => void setTeacherSetting({ manzilAyahsPerDay: value })}
                style={[
                  styles.choice,
                  (profile?.manzilAyahsPerDay ?? 0) === value && styles.choiceSelected,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    (profile?.manzilAyahsPerDay ?? 0) === value && styles.choiceTextSelected,
                  ]}
                >
                  {value === 0 ? 'auto' : value}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>সূরার ক্রম</Text>
      <Text style={styles.body}>
        কোন সূরা আগে হিফজ করবেন, তা এখানে ঠিক করুন। App এই ক্রম অনুযায়ী নতুন আয়াত
        দেবে। নিচের যেকোনো একটি সাজানো বেছে নিন, অথবা কোনো সূরার পাশের প্রথম বোতামে
        চাপলে সেটি এক ধাপেই তালিকার শুরুতে চলে আসবে।
      </Text>

      <Text style={styles.subLabel}>দ্রুত সাজান</Text>
      <View style={styles.choices}>
        {SURAH_ORDER_PRESETS.map((preset) => {
          const active = sameOrder(surahOrder, preset.value);
          return (
            <Pressable
              key={preset.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => applySurahOrderPreset(preset.value)}
              style={[styles.presetChoice, active && styles.choiceSelected]}
            >
              <Text
                style={[styles.presetLabel, active && styles.choiceTextSelected]}
                numberOfLines={1}
              >
                {preset.label}
              </Text>
              <Text
                style={[styles.presetHint, active && styles.choiceTextSelected]}
                numberOfLines={1}
              >
                {preset.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.surahList}>
        {surahOrder.map((surahNumber, index) => {
          const surah = SURAH_BY_NUMBER.get(surahNumber);
          if (!surah) return null;
          const isFirst = index === 0;
          const isLast = index === surahOrder.length - 1;
          return (
            <View key={surahNumber} style={styles.orderRow}>
              <Text style={styles.orderIndex}>{index + 1}</Text>
              <Text style={styles.surahRowText} numberOfLines={1}>
                {surah.number}. {surah.nameBn} · {surah.nameArabic}
              </Text>
              <View style={styles.orderButtons}>
                <IconAction
                  label={`সূরা ${surah.nameBn} তালিকার শুরুতে নিন`}
                  disabled={isFirst}
                  style={styles.orderButton}
                  icon={
                    <ChevronsUp color={isFirst ? colors.line : colors.primary} size={18} />
                  }
                  onPress={() => reorderSurah(index, 0)}
                />
                <IconAction
                  label={`সূরা ${surah.nameBn} এক ধাপ উপরে নিন`}
                  disabled={isFirst}
                  style={styles.orderButton}
                  icon={
                    <ChevronUp color={isFirst ? colors.line : colors.primary} size={18} />
                  }
                  onPress={() => reorderSurah(index, index - 1)}
                />
                <IconAction
                  label={`সূরা ${surah.nameBn} এক ধাপ নিচে নিন`}
                  disabled={isLast}
                  style={styles.orderButton}
                  icon={
                    <ChevronDown color={isLast ? colors.line : colors.primary} size={18} />
                  }
                  onPress={() => reorderSurah(index, index + 1)}
                />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Reminder</Text>
      <View style={styles.inline}>
        <TextInput
          accessibilityLabel="Reminder সময়"
          value={reminderTime}
          onChangeText={setReminderTime}
          placeholder="06:30"
          placeholderTextColor={colors.muted}
          inputMode="text"
          style={styles.input}
        />
        <IconAction
          label="Reminder চালু করুন"
          icon={<Bell color={colors.primary} size={21} />}
          onPress={() => void enableReminder()}
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>মুখস্থ থাকা সূরা</Text>
      <Text style={styles.body}>
        যে সূরা আগে থেকেই মুখস্থ, সেটা চিহ্নিত করুন — app আর সেটাকে নতুন হিসেবে
        পড়াবে না, বরং নিচের অবস্থা অনুযায়ী ঝালাইয়ের ঘূর্ণনে আনবে।{' '}
        {memorizedSurahCount}/{quranDemoPack.surahs.length} সূরা মুখস্থ।
      </Text>
      <Text style={styles.subLabel}>নতুন করে চিহ্নিত সূরার অবস্থা</Text>
      <View style={styles.choices}>
        {IMPORT_STRENGTH_OPTIONS.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: importStrength === value }}
            onPress={() => setImportStrength(value)}
            style={[styles.choice, importStrength === value && styles.choiceSelected]}
          >
            <Text
              style={[
                styles.choiceText,
                importStrength === value && styles.choiceTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.surahList}>
        {quranDemoPack.surahs.map((surah) => {
          const memorized = isSurahMemorized(surah.number);
          return (
            <Pressable
              key={surah.number}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: memorized }}
              onPress={() =>
                void setSurahMemorized(surah.number, !memorized, importStrength)
              }
              style={styles.surahRow}
            >
              <View style={[styles.checkbox, memorized && styles.checkboxChecked]}>
                {memorized ? <Check color={colors.white} size={14} /> : null}
              </View>
              <Text style={styles.surahRowText} numberOfLines={1}>
                {surah.number}. {surah.nameBn} · {surah.nameArabic}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.titleRow}>
        <Cloud color={colors.primary} size={22} />
        <Text style={styles.sectionTitleInline}>Optional backup</Text>
      </View>
      <Text style={styles.body}>
        Account ছাড়াই app ব্যবহার করুন। চাইলে email link দিয়ে progress অন্য
        device-এ নিতে পারবেন।
      </Text>
      <TextInput
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="আপনার email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        style={[styles.input, styles.email]}
      />
      <ActionButton
        label="Backup link পাঠান"
        tone="quiet"
        loading={busy}
        disabled={!email.includes('@')}
        icon={<ShieldCheck color={colors.primary} size={21} />}
        onPress={() => void sendLink()}
      />
      <Pressable onPress={() => void syncNow()} style={styles.syncLink}>
        <Text style={styles.syncText}>এখন sync করুন</Text>
      </Pressable>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.privacy}>
        <ShieldCheck color={colors.primary} size={19} />
        <Text style={styles.privacyText}>
          Recording কখনো নিজে থেকে upload হয় না। Teacher-কে share করলে শুধু
          আপনার বেছে নেওয়া file-টি যায়।
        </Text>
      </View>

      <Text style={styles.buildStamp}>
        {`v${Constants.expoConfig?.version ?? '?'} · build ${
          (Constants.expoConfig?.extra as { buildCommit?: string } | undefined)?.buildCommit ??
          'local-dev'
        }`}
      </Text>
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    buildStamp: {
      marginTop: spacing.xl,
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 10,
      textAlign: 'center' as const,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 16,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    choices: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
    },
    choice: {
      flex: 1,
      minWidth: 44,
      height: 46,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    themeChoice: {
      flex: 1,
      minHeight: 46,
      flexDirection: 'row' as const,
      gap: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    choiceSelected: {
      backgroundColor: colors.mint,
      borderColor: colors.primary,
    },
    subLabel: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    presetChoice: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
      gap: 2,
    },
    presetLabel: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 11,
      textAlign: 'center' as const,
    },
    presetHint: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 9,
      textAlign: 'center' as const,
    },
    arabicChoice: {
      height: 72,
      flexDirection: 'column' as const,
      gap: 2,
    },
    arabicScalePreview: {
      color: colors.ink,
      fontFamily: typography.arabicBold,
      fontSize: 22,
    },
    amiriPreview: {
      fontFamily: typography.amiriBold,
    },
    serifPreview: {
      fontFamily: typography.bengaliSerif,
    },
    choiceCaption: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 11,
    },
    choiceText: {
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    choiceTextSelected: {
      color: colors.primary,
    },
    inline: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      borderColor: colors.line,
      borderWidth: 1,
      backgroundColor: colors.surface,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 15,
      paddingHorizontal: spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: colors.line,
      marginVertical: spacing.xxl,
    },
    titleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    sectionTitleInline: {
      color: colors.ink,
      fontFamily: typography.bengaliMedium,
      fontSize: 17,
    },
    body: {
      color: colors.muted,
      fontFamily: typography.bengali,
      fontSize: 13,
      lineHeight: 22,
      marginTop: spacing.sm,
    },
    surahList: {
      marginTop: spacing.md,
      borderRadius: radius.md,
      borderColor: colors.line,
      borderWidth: 1,
      overflow: 'hidden' as const,
    },
    surahRow: {
      minHeight: 48,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
      backgroundColor: colors.surface,
    },
    orderRow: {
      minHeight: 48,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
      backgroundColor: colors.surface,
    },
    orderIndex: {
      width: 20,
      color: colors.muted,
      fontFamily: typography.bengaliMedium,
      fontSize: 12,
      textAlign: 'center' as const,
    },
    orderButtons: {
      flexDirection: 'row' as const,
      gap: spacing.xs,
    },
    orderButton: {
      width: 36,
      height: 36,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    surahRowText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 13,
    },
    email: {
      width: '100%' as const,
      flex: 0,
      marginVertical: spacing.md,
    },
    syncLink: {
      alignSelf: 'center' as const,
      minHeight: 44,
      justifyContent: 'center' as const,
      marginTop: spacing.sm,
    },
    syncText: {
      color: colors.primary,
      fontFamily: typography.bengaliMedium,
      fontSize: 13,
    },
    message: {
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 20,
      textAlign: 'center' as const,
    },
    privacy: {
      marginTop: spacing.xxl,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.mint,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: spacing.md,
    },
    privacyText: {
      flex: 1,
      color: colors.ink,
      fontFamily: typography.bengali,
      fontSize: 12,
      lineHeight: 20,
    },
  };
}
