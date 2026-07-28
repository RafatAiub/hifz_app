import { createClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { ArrowLeft, Bell, Cloud, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useApp } from '@/app-state/provider';
import { ActionButton, AppScreen, IconAction } from '@/components/ui';
import { scheduleDailyReminder } from '@/services/reminders';
import { syncPendingEvents } from '@/sync/sync-service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function SettingsScreen() {
  const { profile, setAvailableMinutes, repository } = useApp();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reminderTime, setReminderTime] = useState(
    profile?.preferredTime ?? '06:30',
  );

  async function enableReminder() {
    const enabled = await scheduleDailyReminder(reminderTime);
    setMessage(
      enabled
        ? 'প্রতিদিনের reminder চালু হয়েছে।'
        : 'এই device-এ notification permission পাওয়া যায়নি।',
    );
  }

  async function sendLink() {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setMessage('Cloud backup এখনো configure করা হয়নি। Local progress নিরাপদ আছে।');
      return;
    }
    setBusy(true);
    const supabase = createClient(url, key);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setMessage(error ? error.message : 'Email-এ sign-in link পাঠানো হয়েছে।');
    setBusy(false);
  }

  async function syncNow() {
    setBusy(true);
    try {
      const result = await syncPendingEvents(repository);
      setMessage(
        result.configured
          ? `${result.synced}টি নতুন session backup হয়েছে।`
          : 'Cloud backup configure না হওয়ায় app local-only mode-এ আছে।',
      );
    } catch {
      setMessage('এখন sync হয়নি। Internet এলে আবার চেষ্টা হবে।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen
      eyebrow="আপনার নিয়ন্ত্রণে"
      title="সেটিংস"
      action={
        <IconAction
          label="ফিরে যান"
          icon={<ArrowLeft color={colors.ink} size={21} />}
          onPress={() => router.back()}
        />
      }
    >
      <Text style={styles.sectionTitle}>দৈনিক সময়</Text>
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

      <Text style={styles.sectionTitle}>Reminder</Text>
      <View style={styles.inline}>
        <TextInput
          accessibilityLabel="Reminder সময়"
          value={reminderTime}
          onChangeText={setReminderTime}
          placeholder="06:30"
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

      <View style={styles.titleRow}>
        <Cloud color={colors.primary} size={22} />
        <Text style={styles.sectionTitleInline}>Optional backup</Text>
      </View>
      <Text style={styles.body}>
        Account ছাড়াই app ব্যবহার করুন। চাইলে email link দিয়ে progress অন্য
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
          Recording কখনো নিজে থেকে upload হয় না। Teacher-কে share করলে শুধু
          আপনার বেছে নেওয়া file-টি যায়।
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.ink,
    fontFamily: typography.bengaliMedium,
    fontSize: 16,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  choices: {
    flexDirection: 'row',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSelected: {
    backgroundColor: colors.mint,
    borderColor: colors.primary,
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
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
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
  email: {
    width: '100%',
    flex: 0,
    marginVertical: spacing.md,
  },
  syncLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  privacy: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.mint,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  privacyText: {
    flex: 1,
    color: colors.ink,
    fontFamily: typography.bengali,
    fontSize: 12,
    lineHeight: 20,
  },
});
