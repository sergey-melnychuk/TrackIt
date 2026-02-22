import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ReminderConfig = {
  trackerId: number;
  trackerName: string;
  hour: number;
  minute: number;
  enabled: boolean;
  notificationId?: string;
};

const STORAGE_KEY = 'reminder_configs';

export const requestPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const loadReminders = async (): Promise<ReminderConfig[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const saveReminders = async (reminders: ReminderConfig[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
};

export const scheduleReminder = async (config: ReminderConfig): Promise<string> => {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Time to log ${config.trackerName}!`,
      body: 'Tap to open TrackIt and log your entry.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: config.hour,
      minute: config.minute,
    },
  });
  return id;
};

export const cancelReminder = async (notificationId: string) => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

export const syncReminders = async (reminders: ReminderConfig[]): Promise<ReminderConfig[]> => {
  const updated: ReminderConfig[] = [];

  for (const r of reminders) {
    if (r.notificationId) {
      await cancelReminder(r.notificationId);
    }

    if (r.enabled) {
      const id = await scheduleReminder(r);
      updated.push({ ...r, notificationId: id });
    } else {
      updated.push({ ...r, notificationId: undefined });
    }
  }

  await saveReminders(updated);
  return updated;
};
