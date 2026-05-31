import { prisma } from "../prisma";

import { getChinaDateKey } from "./domain";

type TaskEventClient = Pick<typeof prisma, "taskEvent">;

export const TASK_EVENT_TYPES = [
  "task_completed",
  "daily_completed",
  "progress_completed",
  "next_action_updated",
  "due_postponed",
  "morning_confirmed_done",
  "marked_unfinished_today",
] as const;

export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

export type CreateTaskEventInput = {
  metadata?: Record<string, unknown>;
  now?: Date;
  summary: string;
  taskId?: string | null;
  taskTitle: string;
  type: TaskEventType;
};

export async function createTaskEvent(input: CreateTaskEventInput, db: TaskEventClient = prisma) {
  const now = input.now ?? new Date();

  return db.taskEvent.create({
    data: {
      chinaDateKey: getChinaDateKey(now),
      createdAt: now,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      summary: input.summary,
      taskId: input.taskId ?? null,
      taskTitle: input.taskTitle,
      type: input.type,
    },
  });
}

export async function listTodayTaskEvents(now = new Date()) {
  return prisma.taskEvent.findMany({
    orderBy: { createdAt: "desc" },
    where: { chinaDateKey: getChinaDateKey(now) },
  });
}

export async function listRecentTaskEvents(taskId: string, take = 8) {
  return prisma.taskEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    where: { taskId },
  });
}

export function summarizeTaskEventsByType<TEvent extends { type: string }>(events: TEvent[]) {
  return {
    completed: events.filter((event) =>
      event.type === "task_completed" ||
      event.type === "daily_completed" ||
      event.type === "morning_confirmed_done",
    ),
    nextActionUpdated: events.filter((event) => event.type === "next_action_updated"),
    progressCompleted: events.filter((event) => event.type === "progress_completed"),
    rescheduled: events.filter((event) =>
      event.type === "due_postponed" ||
      event.type === "marked_unfinished_today",
    ),
  };
}
