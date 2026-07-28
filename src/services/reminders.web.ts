export async function scheduleDailyReminder(_time: string) {
  if (!('Notification' in globalThis)) return false;
  return (await Notification.requestPermission()) === 'granted';
}
