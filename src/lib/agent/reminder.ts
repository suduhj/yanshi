import { formatDueDistance, isDailyCompletedToday, isNeedsConfirmation, type TaskLike } from "../tasks/domain";

export type ReminderLevel = "danger" | "focus" | "info";

export type Reminder = {
  detail: string;
  id: string;
  level: ReminderLevel;
  taskId: string;
  title: string;
};

export type ReminderCheckResult = {
  checkedAt: Date;
  reminders: Reminder[];
  status: "idle" | "ready";
};

export async function runReminderCheck(
  tasks: TaskLike[] = [],
  now = new Date(),
): Promise<ReminderCheckResult> {
  return buildReminderCheck(tasks, now);
}

export function buildReminderCheck(tasks: TaskLike[], now = new Date()): ReminderCheckResult {
  const reminders = tasks
    .filter((task) => task.status !== "done" || task.isDaily)
    .flatMap((task) => buildTaskReminders(task, now))
    .slice(0, 5);

  return {
    checkedAt: now,
    reminders,
    status: reminders.length > 0 ? "ready" : "idle",
  };
}

function buildTaskReminders(task: TaskLike, now: Date): Reminder[] {
  if (!task.id || !task.title) {
    return [];
  }

  if (task.isDaily) {
    return isDailyCompletedToday(task, now)
      ? []
      : [
          {
            detail: "每日任务今天还没有记录完成。",
            id: `daily:${task.id}`,
            level: "focus",
            taskId: task.id,
            title: `${task.title}今日未完成`,
          },
        ];
  }

  if (task.status === "done") {
    return [];
  }

  const dueReminder = buildDueReminder(task, now);
  if (dueReminder) {
    return [dueReminder];
  }

  if (task.isLongRunning && !task.nextAction?.trim()) {
    return [
      {
        detail: "持续推进任务缺少下一步动作，建议先写一个可执行的小动作。",
        id: `long-running:${task.id}`,
        level: "info",
        taskId: task.id,
        title: `${task.title}需要下一步`,
      },
    ];
  }

  return [];
}

function buildDueReminder(task: TaskLike, now: Date): Reminder | null {
  if (isNeedsConfirmation(task, now)) {
    return {
      detail: "截止时间已经过去，请先确认是否已经完成。",
      id: `confirm:${task.id}`,
      level: "focus",
      taskId: task.id ?? "",
      title: `${task.title}需要确认`,
    };
  }

  const distance = formatDueDistance(task.dueAt, now);

  if (distance.startsWith("已逾期")) {
    return {
      detail: `${distance}，建议优先处理。`,
      id: `due:${task.id}`,
      level: "danger",
      taskId: task.id ?? "",
      title: `${task.title}已逾期`,
    };
  }

  if (distance === "今天截止") {
    return {
      detail: "截止时间就在今天，建议安排到今日计划。",
      id: `due:${task.id}`,
      level: "focus",
      taskId: task.id ?? "",
      title: `${task.title}今天截止`,
    };
  }

  return null;
}
