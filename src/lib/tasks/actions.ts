"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTaskInputSchema, updateTaskInputSchema } from "./domain";
import { createTask, deleteTask, updateTask } from "./service";

export async function createTaskAction(formData: FormData) {
  const payload = Object.fromEntries(formData.entries());
  const input = createTaskInputSchema.parse(payload);

  await createTask(input);
  revalidatePath("/");
}

export async function updateTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const payload = Object.fromEntries(formData.entries());
  const input = updateTaskInputSchema.parse(payload);

  await updateTask(id, input);
  revalidatePath("/");
  redirect("/");
}

export async function deleteTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await deleteTask(id);
  revalidatePath("/");
}
