"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { TaskFormState } from "./form-state";
import { parseCreateTaskForm, parseUpdateTaskForm } from "./form-state";
import { createTask, deleteTask, updateTask } from "./service";

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
