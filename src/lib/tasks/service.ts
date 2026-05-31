import type { Task } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  TASK_STATUSES,
  TASK_TYPES,
  compareTasks,
  getChinaDateKey,
  getSystemPriority,
  type CreateTaskInput,
  type SystemPriority,
  type TaskFilters,
  type TaskStatus,
  type TaskType,
  type UpdateTaskInput,
  matchesTaskFilters,
} from "./domain";

type TaskClient = Pick<typeof prisma, "task">;

export type TaskView = Omit<Task, "type" | "priority" | "status"> & {
  status: TaskStatus;
  systemPriority: {
    label: string;
    value: SystemPriority;
  };
  type: TaskType;
};

export async function listTasks(filters: TaskFilters = {}) {
  const now = new Date();
  const tasks = (await prisma.task.findMany({
    orderBy: [{ createdAt: "desc" }],
  })).map((task) => toTaskView(task, now));

  return tasks
    .filter((task) => matchesTaskFilters(task, filters, now))
    .sort((a, b) => compareTasks(a, b, now));
}

export async function getTask(id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
  });

  return task ? toTaskView(task) : null;
}

export async function createTask(input: CreateTaskInput) {
  return prisma.task.create({
    data: input,
  });
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  return prisma.task.update({
    where: { id },
    data: input,
  });
}

export async function completeTask(id: string, db: TaskClient = prisma) {
  return db.task.update({
    where: { id },
    data: { status: "done" },
  });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({
    where: { id },
  });
}

export async function setTaskPlannedToday(id: string, isPlannedToday: boolean, db: TaskClient = prisma) {
  return db.task.update({
    where: { id },
    data: { isPlannedToday },
  });
}

export async function postponeTaskDueAt(id: string, dueAt: Date | null, db: TaskClient = prisma) {
  return db.task.update({
    where: { id },
    data: { dueAt, isPlannedToday: false },
  });
}

export async function updateTaskNextAction(id: string, nextAction: string, db: TaskClient = prisma) {
  return db.task.update({
    where: { id },
    data: { nextAction: nextAction.trim() },
  });
}

export async function completeLongRunningProgressToday(id: string, db: TaskClient = prisma) {
  return db.task.update({
    where: { id },
    data: { isPlannedToday: false, status: "doing" },
  });
}

export async function completeDailyTaskToday(id: string, db: TaskClient = prisma) {
  return db.task.update({
    where: { id },
    data: { dailyCompletedOn: getChinaDateKey() },
  });
}

function toTaskView(task: Task, now = new Date()): TaskView {
  const status = TASK_STATUSES.includes(task.status as TaskStatus) ? (task.status as TaskStatus) : "todo";
  const view = {
    ...task,
    status,
    type: TASK_TYPES.includes(task.type as TaskType) ? (task.type as TaskType) : "life",
  };

  return {
    ...view,
    systemPriority: getSystemPriority(view, now),
  };
}
