import type { Task } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  type CreateTaskInput,
  type TaskFilters,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
  matchesTaskFilters,
} from "./domain";

export type TaskView = Omit<Task, "type" | "priority" | "status"> & {
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
};

export async function listTasks(filters: TaskFilters = {}) {
  const tasks = (await prisma.task.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  })).map(toTaskView);

  return tasks.filter((task) => matchesTaskFilters(task, filters));
}

export async function createTask(input: CreateTaskInput) {
  return prisma.task.create({
    data: input,
  });
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  return prisma.task.update({
    where: { id },
    data: { status },
  });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({
    where: { id },
  });
}

function toTaskView(task: Task): TaskView {
  return {
    ...task,
    type: TASK_TYPES.includes(task.type as TaskType) ? (task.type as TaskType) : "life",
    priority: TASK_PRIORITIES.includes(task.priority as TaskPriority)
      ? (task.priority as TaskPriority)
      : "medium",
    status: TASK_STATUSES.includes(task.status as TaskStatus) ? (task.status as TaskStatus) : "todo",
  };
}
