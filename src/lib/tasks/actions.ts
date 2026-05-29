"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { TaskFormState } from "./form-state";
import { parseCreateTaskForm, parseUpdateTaskForm } from "./form-state";
import { completeDailyTaskToday, createTask, deleteTask, setTaskPlannedToday, updateTask } from "./service";

export async function createTaskAction(_prevState: TaskFormState, formData: FormData) {
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

export async function completeDailyTodayAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await completeDailyTaskToday(id);
  revalidatePath("/");
  redirect("/?notice=dailyCompleted");
}
