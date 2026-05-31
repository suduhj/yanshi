"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  filterUnnotifiedReminders,
  markReminderIdsNotified,
} from "@/lib/agent/notification-store";
import type { Reminder } from "@/lib/agent/reminder";

type NotificationPermissionState = NotificationPermission | "unsupported";

export function ReminderNotificationControls({
  chinaDateKey,
  reminders,
}: {
  chinaDateKey: string;
  reminders: Reminder[];
}) {
  const [requestedPermission, setRequestedPermission] = useState<NotificationPermission | null>(null);
  const browserPermission = useSyncExternalStore(
    subscribeToNotificationPermission,
    getNotificationPermission,
    getServerNotificationPermission,
  );
  const permission = requestedPermission ?? browserPermission;

  useEffect(() => {
    if (permission !== "granted" || reminders.length === 0) {
      return;
    }

    const unnotifiedReminders = filterUnnotifiedReminders(
      reminders,
      window.localStorage,
      chinaDateKey,
    );

    for (const reminder of unnotifiedReminders) {
      new Notification(reminder.title, {
        body: reminder.detail,
        tag: reminder.id,
      });
    }

    if (unnotifiedReminders.length > 0) {
      markReminderIdsNotified(
        window.localStorage,
        chinaDateKey,
        unnotifiedReminders.map((reminder) => reminder.id),
      );
    }
  }, [chinaDateKey, permission, reminders]);

  if (permission === "unsupported") {
    return (
      <p className="text-sm text-neutral-500">
        当前浏览器不支持通知，提醒建议会继续显示在页面内。
      </p>
    );
  }

  if (permission === "denied") {
    return (
      <p className="text-sm text-neutral-500">
        浏览器通知已关闭，可以在浏览器设置里重新允许。
      </p>
    );
  }

  if (permission === "granted") {
    return (
      <p className="text-sm text-emerald-700">
        浏览器通知已开启，页面打开时会提醒未通知过的事项。
      </p>
    );
  }

  return (
    <button
      className="h-9 border border-neutral-300 px-3 text-sm text-neutral-950 transition hover:border-neutral-950"
      onClick={async () => {
        const nextPermission = await Notification.requestPermission();
        setRequestedPermission(nextPermission);
      }}
      type="button"
    >
      开启通知
    </button>
  );
}

function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

function getServerNotificationPermission(): NotificationPermissionState {
  return "default";
}

function subscribeToNotificationPermission() {
  return () => {};
}
