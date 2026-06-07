import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Task, TaskEvent } from "@prisma/client";

import { prisma } from "../prisma";
import { getChinaDateKey } from "../tasks/domain";

export const BACKUP_VERSION = 1;
export const DEFAULT_BACKUP_DIR = join(process.cwd(), "prisma", "backups");
export const DEFAULT_BACKUP_RETENTION = 7;

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

export type BackupPayload = {
  chinaDateKey: string;
  exportedAt: string;
  taskEvents: TaskEvent[];
  tasks: Task[];
  version: typeof BACKUP_VERSION;
};

type TaskCreateRow = Omit<Task, "events">;

type TaskEventCreateRow = TaskEvent;

type ReadDb = {
  task: {
    findMany: (args: { orderBy: { createdAt: "asc" } }) => Promise<Task[]>;
  };
  taskEvent: {
    findMany: (args: { orderBy: { createdAt: "asc" } }) => Promise<TaskEvent[]>;
  };
};

type WriteDb = {
  task: {
    createMany: (args: { data: TaskCreateRow[] }) => Promise<unknown>;
    deleteMany: () => Promise<unknown>;
  };
  taskEvent: {
    createMany: (args: { data: TaskEventCreateRow[] }) => Promise<unknown>;
    deleteMany: () => Promise<unknown>;
  };
};

type BackupDb = WriteDb & {
  $transaction: (callback: (tx: WriteDb) => Promise<void>) => Promise<unknown>;
};

export async function buildBackupPayload({
  db = prisma,
  now = new Date(),
}: {
  db?: ReadDb;
  now?: Date;
} = {}): Promise<BackupPayload> {
  const [tasks, taskEvents] = await Promise.all([
    db.task.findMany({ orderBy: { createdAt: "asc" } }),
    db.taskEvent.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    chinaDateKey: getChinaDateKey(now),
    exportedAt: now.toISOString(),
    taskEvents,
    tasks,
    version: BACKUP_VERSION,
  };
}

export function buildBackupFileName(now = new Date()) {
  const chinaDate = new Date(now.getTime() + CHINA_OFFSET_MS);
  const year = chinaDate.getUTCFullYear();
  const month = String(chinaDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(chinaDate.getUTCDate()).padStart(2, "0");
  const hour = String(chinaDate.getUTCHours()).padStart(2, "0");
  const minute = String(chinaDate.getUTCMinutes()).padStart(2, "0");
  const second = String(chinaDate.getUTCSeconds()).padStart(2, "0");

  return `yanshi-backup-${year}-${month}-${day}-${hour}${minute}${second}.json`;
}

export function parseBackupFileName(fileName: string) {
  const match = fileName.match(/^yanshi-backup-(\d{4}-\d{2}-\d{2})-(\d{6})\.json$/);

  if (!match) {
    return null;
  }

  return {
    chinaDateKey: match[1],
    timestamp: `${match[1]}-${match[2]}`,
  };
}

export async function createBackup({
  backupDir = DEFAULT_BACKUP_DIR,
  db = prisma,
  now = new Date(),
}: {
  backupDir?: string;
  db?: ReadDb;
  now?: Date;
} = {}) {
  await mkdir(backupDir, { recursive: true });
  const payload = await buildBackupPayload({ db, now });
  const fileName = buildBackupFileName(now);
  const filePath = join(backupDir, fileName);

  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return {
    fileName,
    filePath,
    payload,
  };
}

export async function listBackupFiles(backupDir = DEFAULT_BACKUP_DIR) {
  await mkdir(backupDir, { recursive: true });
  const names = await readdir(backupDir);
  const backups = await Promise.all(
    names.flatMap((fileName) => {
      const parsed = parseBackupFileName(fileName);

      if (!parsed) {
        return [];
      }

      return [
        stat(join(backupDir, fileName)).then((fileStat) => ({
          chinaDateKey: parsed.chinaDateKey,
          fileName,
          filePath: join(backupDir, fileName),
          size: fileStat.size,
          timestamp: parsed.timestamp,
        })),
      ];
    }),
  );

  return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function pruneOldBackups({
  backupDir = DEFAULT_BACKUP_DIR,
  keep = DEFAULT_BACKUP_RETENTION,
}: {
  backupDir?: string;
  keep?: number;
} = {}) {
  const backups = await listBackupFiles(backupDir);
  const stale = backups.slice(keep);

  await Promise.all(stale.map((backup) => unlink(backup.filePath)));

  return stale.map((backup) => backup.fileName);
}

function reviveDate(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date;
}

function validateBackupPayload(value: unknown): BackupPayload {
  if (!value || typeof value !== "object") {
    throw new Error("备份文件格式无效");
  }

  const candidate = value as Partial<BackupPayload>;

  if (candidate.version !== BACKUP_VERSION) {
    throw new Error("暂不支持该备份版本");
  }

  if (!Array.isArray(candidate.tasks) || !Array.isArray(candidate.taskEvents)) {
    throw new Error("备份文件格式无效");
  }

  if (typeof candidate.exportedAt !== "string" || typeof candidate.chinaDateKey !== "string") {
    throw new Error("备份文件格式无效");
  }

  return candidate as BackupPayload;
}

export async function readBackupFile(fileName: string, backupDir = DEFAULT_BACKUP_DIR) {
  if (!parseBackupFileName(fileName)) {
    throw new Error("备份文件名无效");
  }

  const raw = await readFile(join(backupDir, fileName), "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("备份文件格式无效");
  }

  return validateBackupPayload(parsed);
}

export async function restoreBackupPayload(payload: BackupPayload, db: BackupDb = prisma) {
  validateBackupPayload(payload);

  await db.$transaction(async (tx) => {
    await tx.taskEvent.deleteMany();
    await tx.task.deleteMany();

    if (payload.tasks.length > 0) {
      await tx.task.createMany({
        data: payload.tasks.map((task) => ({
          ...task,
          createdAt: reviveDate(task.createdAt) as Date,
          dueAt: task.dueAt ? (reviveDate(task.dueAt) as Date) : null,
          updatedAt: reviveDate(task.updatedAt) as Date,
        })),
      });
    }

    if (payload.taskEvents.length > 0) {
      await tx.taskEvent.createMany({
        data: payload.taskEvents.map((event) => ({
          ...event,
          createdAt: reviveDate(event.createdAt) as Date,
        })),
      });
    }
  });
}

export async function restoreBackupFile(
  fileName: string,
  {
    backupDir = DEFAULT_BACKUP_DIR,
    db = prisma,
  }: {
    backupDir?: string;
    db?: BackupDb;
  } = {},
) {
  const payload = await readBackupFile(fileName, backupDir);

  await restoreBackupPayload(payload, db);

  return payload;
}

export async function ensureDailyBackup({
  backupDir = DEFAULT_BACKUP_DIR,
  db = prisma,
  now = new Date(),
}: {
  backupDir?: string;
  db?: ReadDb;
  now?: Date;
} = {}) {
  const today = getChinaDateKey(now);
  const existing = await listBackupFiles(backupDir);

  if (existing.some((backup) => backup.chinaDateKey === today)) {
    return { created: false as const, fileName: null };
  }

  const backup = await createBackup({ backupDir, db, now });

  await pruneOldBackups({ backupDir });

  return { created: true as const, fileName: backup.fileName };
}
