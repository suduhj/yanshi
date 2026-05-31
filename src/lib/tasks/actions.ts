"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseTaskDraftFromText } from "./ai-draft";
import { createTaskInputSchema } from "./domain";
import { createTaskEvent } from "./events";
import type { TaskFormState } from "./form-state";
import { parseCreateTaskForm, parseUpdateTaskForm, taskFormValuesFromFormData } from "./form-state";
import { prisma } from "../prisma";
import {
  completeDailyTaskToday,
  completeLongRunningProgressToday,
  completeTask,
  createTask,
  deleteTask,
  postponeTaskDueAt,
  setTaskPlannedToday,
  updateTask,
  updateTaskNextAction,
} from "./service";

export async function createTaskAction(_prevState: TaskFormState, formData: FormData) {
  if (formData.get("intent") === "parseDraft") {
    const aiInput = String(formData.get("aiInput") ?? "");
    const draft = await parseTaskDraftFromText(aiInput);

    return {
      aiInput: draft.aiInput,
      aiMessage: draft.aiMessage,
      errors: {},
      message: "",
      status: draft.ok ? ("idle" as const) : ("error" as const),
      values: draft.ok ? draft.values : taskFormValuesFromFormData(formData),
    };
  }

  const parsed = parseCreateTaskForm(formData);

  if (!parsed.ok) {
    return parsed.state;
  }

  await createTask(parsed.input);
  revalidatePath("/");
  redirect("/?notice=created");
}

export async function updateTaskAction(_prevState: TaskFormState, formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return {
      errors: { id: ["任务不存在"] },
      message: "请检查任务信息",
      status: "error" as const,
      values: {},
    };
  }

  const parsed = parseUpdateTaskForm(formData);

  if (!parsed.ok) {
    return parsed.state;
  }

  await updateTask(id, parsed.input);
  revalidatePath("/");
  redirect("/?notice=updated");
}

export async function deleteTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await deleteTask(id);
  revalidatePath("/");
  redirect("/?notice=deleted");
}

export async function completeTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const eventType = formData.get("eventType") === "morning_confirmed_done" ? "morning_confirmed_done" : "task_completed";

  if (!id) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const task = await completeTask(id, tx);
    await createTaskEvent({
      summary: eventType === "morning_confirmed_done" ? `晨间确认完成：${task.title}` : `完成任务：${task.title}`,
      taskId: task.id,
      taskTitle: task.title,
      type: eventType,
    }, tx);
  });
  revalidatePath("/");
  redirect("/?notice=completed");
}

export async function togglePlannedTodayAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const isPlannedToday = formData.get("isPlannedToday") === "true";

  if (!id) {
    return;
  }

  await setTaskPlannedToday(id, isPlannedToday);
  revalidatePath("/");
  redirect(isPlannedToday ? "/?notice=plannedToday" : "/?notice=removedToday");
}

export async function markUnfinishedPlannedTodayAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const task = await setTaskPlannedToday(id, true, tx);
    await createTaskEvent({
      summary: `未完成，加入今日：${task.title}`,
      taskId: task.id,
      taskTitle: task.title,
      type: "marked_unfinished_today",
    }, tx);
  });
  revalidatePath("/");
  redirect("/?notice=plannedToday");
}

export async function postponeTaskDueAtAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dueAt = String(formData.get("dueAt") ?? "");

  if (!id || !dueAt) {
    return;
  }

  const parsed = createTaskInputSchema.pick({ dueAt: true }).safeParse({ dueAt });

  if (!parsed.success) {
    redirect("/?notice=invalidDueAt");
  }

  await prisma.$transaction(async (tx) => {
    const task = await postponeTaskDueAt(id, parsed.data.dueAt, tx);
    await createTaskEvent({
      metadata: { dueAt: task.dueAt?.toISOString() ?? null },
      summary: `推迟截止时间：${task.title}`,
      taskId: task.id,
      taskTitle: task.title,
      type: "due_postponed",
    }, tx);
  });
  revalidatePath("/");
  redirect("/?notice=postponed");
}

export async function updateTaskNextActionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextAction = String(formData.get("nextAction") ?? "");

  if (!id) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const task = await updateTaskNextAction(id, nextAction, tx);
    await createTaskEvent({
      metadata: { nextAction: task.nextAction },
      summary: `更新下一步：${task.nextAction || "未填写"}`,
      taskId: task.id,
      taskTitle: task.title,
      type: "next_action_updated",
    }, tx);
  });
  revalidatePath("/");
  redirect("/?notice=nextActionUpdated");
}

export async function completeLongRunningProgressTodayAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const task = await completeLongRunningProgressToday(id, tx);
    await createTaskEvent({
      summary: `今日推进：${task.title}`,
      taskId: task.id,
      taskTitle: task.title,
      type: "progress_completed",
    }, tx);
  });
  revalidatePath("/");
  redirect("/?notice=progressCompleted");
}

export async function completeDailyTodayAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const task = await completeDailyTaskToday(id, tx);
    await createTaskEvent({
      summary: `完成今日：${task.title}`,
      taskId: task.id,
      taskTitle: task.title,
      type: "daily_completed",
    }, tx);
  });
  revalidatePath("/");
  redirect("/?notice=dailyCompleted");
}
