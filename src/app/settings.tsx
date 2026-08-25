import { createClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  Moon,
  ShieldCheck,
  Sun,
  SunMoon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { quranDemoPack } from '@/data/quran-pack';
import { normalizeSurahOrder } from '@/domain/planner';
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
    repository,
  } = useApp();
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

  const orderedSurahs = useMemo(() => {
    const order = normalizeSurahOrder(profile?.surahOrder ?? [], quranDemoPack);
    const byNumber = new Map(quranDemoPack.surahs.map((surah) => [surah.number, surah]));
    return order.map((number) => byNumber.get(number)!).filter(Boolean);
  }, [profile?.surahOrder]);

  function moveSurah(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedSurahs.length) return;
    const next = orderedSurahs.map((surah) => surah.number);
    const temp = next[index]!;
    next[index] = next[target]!;
    next[target] = temp;
    void setSurahOrder(next);
  }

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

      <Text style={styles.sectionTitle}>সূরার ক্রম</Text>
      <Text style={styles.body}>
        কোন সূরা আগে হিফজ করবেন, তা এখানে ঠিক করুন। App এই ক্রম অনুযায়ী নতুন আয়াত দেবে।
      </Text>
      <View style={styles.surahList}>
        {orderedSurahs.map((surah, index) => (
          <View key={surah.number} style={styles.orderRow}>
            <Text style={styles.orderIndex}>{index + 1}</Text>
            <Text style={styles.surahRowText} numberOfLines={1}>
              {surah.number}. {surah.nameBn} · {surah.nameArabic}
            </Text>
            <View style={styles.orderButtons}>
              <IconAction
                label={`সূরা ${surah.nameBn} উপরে নিন`}
                disabled={index === 0}
                icon={<ChevronUp color={index === 0 ? colors.line : colors.primary} size={18} />}
                onPress={() => moveSurah(index, -1)}
              />
              <IconAction
                label={`সূরা ${surah.nameBn} নিচে নিন`}
                disabled={index === orderedSurahs.length - 1}
                icon={
                  <ChevronDown
                    color={index === orderedSurahs.length - 1 ? colors.line : colors.primary}
                    size={18}
                  />
                }
                onPress={() => moveSurah(index, 1)}
              />
            </View>
          </View>
        ))}
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
        পড়াবে না। {memorizedSurahCount}/{quranDemoPack.surahs.length} সূরা মুখস্থ।
      </Text>
      <View style={styles.surahList}>
        {quranDemoPack.surahs.map((surah) => {
          const memorized = isSurahMemorized(surah.number);
          return (
            <Pressable
              key={surah.number}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: memorized }}
              onPress={() => void setSurahMemorized(surah.number, !memorized)}
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
    </AppScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return {
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
