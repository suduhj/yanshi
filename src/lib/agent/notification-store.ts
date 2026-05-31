import type { Reminder } from "./reminder";

type ReminderNotificationStorage = Pick<Storage, "getItem" | "setItem">;

const NOTIFIED_REMINDERS_KEY_PREFIX = "yanshi:notified-reminders";

export function getReminderNotificationStorageKey(chinaDateKey: string) {
  return `${NOTIFIED_REMINDERS_KEY_PREFIX}:${chinaDateKey}`;
}

export function readNotifiedReminderIds(
  storage: ReminderNotificationStorage,
  chinaDateKey: string,
) {
  const rawValue = storage.getItem(getReminderNotificationStorageKey(chinaDateKey));

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").sort() : [];
  } catch {
    return [];
  }
}

export function filterUnnotifiedReminders(
  reminders: Reminder[],
  storage: ReminderNotificationStorage,
  chinaDateKey: string,
) {
  const notifiedIds = new Set(readNotifiedReminderIds(storage, chinaDateKey));
  return reminders.filter((reminder) => !notifiedIds.has(reminder.id));
}

export function markReminderIdsNotified(
  storage: ReminderNotificationStorage,
  chinaDateKey: string,
  reminderIds: string[],
) {
  const nextIds = new Set(readNotifiedReminderIds(storage, chinaDateKey));

  for (const reminderId of reminderIds) {
    nextIds.add(reminderId);
  }

  storage.setItem(
    getReminderNotificationStorageKey(chinaDateKey),
    JSON.stringify([...nextIds].sort()),
  );
}
