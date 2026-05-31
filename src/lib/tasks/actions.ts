"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseTaskDraftFromText } from "./ai-draft";
import { createTaskInputSchema } from "./domain";
import type { TaskFormState } from "./form-state";
import { parseCreateTaskForm, parseUpdateTaskForm, taskFormValuesFromFormData } from "./form-state";
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

  if (!id) {
    return;
  }

  await completeTask(id);
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

  await setTaskPlannedToday(id, true);
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

  await postponeTaskDueAt(id, parsed.data.dueAt);
  revalidatePath("/");
  redirect("/?notice=postponed");
}

export async function updateTaskNextActionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextAction = String(formData.get("nextAction") ?? "");

  if (!id) {
    return;
  }

  await updateTaskNextAction(id, nextAction);
  revalidatePath("/");
  redirect("/?notice=nextActionUpdated");
}

export async function completeLongRunningProgressTodayAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await completeLongRunningProgressToday(id);
  revalidatePath("/");
  redirect("/?notice=progressCompleted");
}

export async function completeDailyTodayAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await completeDailyTaskToday(id);
  revalidatePath("/");
  redirect("/?notice=dailyCompleted");
}
