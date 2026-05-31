import { describe, expect, it } from "vitest";

import {
  filterUnnotifiedReminders,
  getReminderNotificationStorageKey,
  markReminderIdsNotified,
  readNotifiedReminderIds,
} from "./notification-store";
import type { Reminder } from "./reminder";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const reminders: Reminder[] = [
  {
    detail: "已逾期 1 天，建议优先处理。",
    id: "due:task-1",
    level: "danger",
    taskId: "task-1",
    title: "补交作业已逾期",
  },
  {
    detail: "每日任务今天还没有记录完成。",
    id: "daily:task-2",
    level: "focus",
    taskId: "task-2",
    title: "背单词今日未完成",
  },
];

describe("reminder notification storage", () => {
  it("uses a China date key in the localStorage key", () => {
    expect(getReminderNotificationStorageKey("2026-05-29")).toBe(
      "yanshi:notified-reminders:2026-05-29",
    );
  });

  it("filters reminders already notified for the same day", () => {
    const storage = createMemoryStorage();
    markReminderIdsNotified(storage, "2026-05-29", ["due:task-1"]);

    expect(filterUnnotifiedReminders(reminders, storage, "2026-05-29")).toEqual([
      reminders[1],
    ]);
  });

  it("allows the same reminder to notify again on a different day", () => {
    const storage = createMemoryStorage();
    markReminderIdsNotified(storage, "2026-05-29", ["due:task-1"]);

    expect(filterUnnotifiedReminders(reminders, storage, "2026-05-30")).toEqual(reminders);
    expect(readNotifiedReminderIds(storage, "2026-05-30")).toEqual([]);
  });

  it("preserves existing ids when marking new reminders notified", () => {
    const storage = createMemoryStorage();
    markReminderIdsNotified(storage, "2026-05-29", ["due:task-1"]);
    markReminderIdsNotified(storage, "2026-05-29", ["daily:task-2"]);

    expect(readNotifiedReminderIds(storage, "2026-05-29")).toEqual([
      "daily:task-2",
      "due:task-1",
    ]);
  });
});
