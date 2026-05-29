"use server";

import { revalidatePath } from "next/cache";

import { createTaskInputSchema, toTaskStatus } from "./domain";
import { createTask, deleteTask, updateTaskStatus } from "./service";

export async function createTaskAction(formData: FormData) {
  const payload = Object.fromEntries(formData.entries());
  const input = createTaskInputSchema.parse(payload);

  await createTask(input);
  revalidatePath("/");
}

export async function updateTaskStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = toTaskStatus(formData.get("status"));

  if (!id) {
    return;
  }

  await updateTaskStatus(id, status);
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await deleteTask(id);
  revalidatePath("/");
}
