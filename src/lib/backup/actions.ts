"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createBackup, pruneOldBackups, restoreBackupFile } from "./backup";

export async function createBackupAction() {
  try {
    await createBackup();
    await pruneOldBackups();
  } catch {
    redirect("/backup?notice=backupFailed");
  }

  revalidatePath("/backup");
  redirect("/backup?notice=backupCreated");
}

export async function restoreBackupAction(formData: FormData) {
  const fileName = String(formData.get("fileName") ?? "");

  if (!fileName) {
    redirect("/backup?notice=invalidBackup");
  }

  try {
    await restoreBackupFile(fileName);
  } catch {
    redirect("/backup?notice=restoreFailed");
  }

  revalidatePath("/");
  revalidatePath("/backup");
  redirect("/backup?notice=restored");
}
