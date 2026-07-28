import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleDailyReminder(time: string) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'আজকের হিফজ প্রস্তুত',
      body: 'আপনার জন্য আজকের ছোট session তৈরি আছে।',
      data: { route: '/' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return true;
}
