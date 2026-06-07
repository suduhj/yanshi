import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BACKUP_VERSION,
  buildBackupFileName,
  buildBackupPayload,
  ensureDailyBackup,
  listBackupFiles,
  parseBackupFileName,
  pruneOldBackups,
  readBackupFile,
  restoreBackupPayload,
} from "./backup";

type TaskRow = {
  createdAt: Date;
  dailyCompletedOn: string | null;
  dueAt: Date | null;
  id: string;
  isDaily: boolean;
  isLongRunning: boolean;
  isPlannedToday: boolean;
  nextAction: string;
  notes: string;
  priority: string;
  source: string;
  status: string;
  title: string;
  type: string;
  updatedAt: Date;
};

type TaskEventRow = {
  chinaDateKey: string;
  createdAt: Date;
  id: string;
  metadata: string | null;
  summary: string;
  taskId: string | null;
  taskTitle: string;
  type: string;
};

function createDb(tasks: TaskRow[] = [], taskEvents: TaskEventRow[] = []) {
  type MockDb = {
    $transaction: ReturnType<typeof vi.fn>;
    task: {
      createMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    taskEvent: {
      createMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const db: MockDb = {
    task: {
      createMany: vi.fn(async ({ data }: { data: TaskRow[] }) => {
        tasks.push(...data);
        return { count: data.length };
      }),
      deleteMany: vi.fn(async () => {
        tasks.splice(0, tasks.length);
        return { count: 0 };
      }),
      findMany: vi.fn(async () => tasks),
    },
    taskEvent: {
      createMany: vi.fn(async ({ data }: { data: TaskEventRow[] }) => {
        taskEvents.push(...data);
        return { count: data.length };
      }),
      deleteMany: vi.fn(async () => {
        taskEvents.splice(0, taskEvents.length);
        return { count: 0 };
      }),
      findMany: vi.fn(async () => taskEvents),
    },
    $transaction: vi.fn(async (callback: (tx: MockDb) => Promise<unknown>) => callback(db)),
  };

  return db;
}

const now = new Date("2026-06-07T02:03:04.000Z");
const task: TaskRow = {
  id: "task-1",
  title: "完成课程作业",
  type: "coursework",
  source: "高数",
  dueAt: new Date("2026-06-07T12:00:00.000Z"),
  priority: "medium",
  status: "todo",
  notes: "先整理题目",
  isLongRunning: false,
  isPlannedToday: true,
  isDaily: false,
  dailyCompletedOn: null,
  nextAction: "",
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-02T00:00:00.000Z"),
};

const event: TaskEventRow = {
  id: "event-1",
  taskId: "task-1",
  taskTitle: "完成课程作业",
  type: "task_completed",
  summary: "完成任务：完成课程作业",
  metadata: null,
  chinaDateKey: "2026-06-07",
  createdAt: new Date("2026-06-07T01:00:00.000Z"),
};

let backupDir: string;

beforeEach(async () => {
  backupDir = await mkdtemp(join(tmpdir(), "yanshi-backup-test-"));
});

afterEach(async () => {
  await rm(backupDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("backup payload", () => {
  it("builds a versioned backup payload with China date key", async () => {
    const db = createDb([task], [event]);

    const payload = await buildBackupPayload({ db: db as never, now });

    expect(payload.version).toBe(BACKUP_VERSION);
    expect(payload.exportedAt).toBe("2026-06-07T02:03:04.000Z");
    expect(payload.chinaDateKey).toBe("2026-06-07");
    expect(payload.tasks).toHaveLength(1);
    expect(payload.taskEvents).toHaveLength(1);
  });

  it("builds backup filenames from China time", () => {
    expect(buildBackupFileName(now)).toBe("yanshi-backup-2026-06-07-100304.json");
    expect(parseBackupFileName("yanshi-backup-2026-06-07-100304.json")).toEqual({
      chinaDateKey: "2026-06-07",
      timestamp: "2026-06-07-100304",
    });
    expect(parseBackupFileName("../bad.json")).toBeNull();
  });
});

describe("backup files", () => {
  it("lists only valid backup files in newest-first order", async () => {
    await writeFile(join(backupDir, "yanshi-backup-2026-06-07-100304.json"), "{}", "utf8");
    await writeFile(join(backupDir, "yanshi-backup-2026-06-08-090000.json"), "{}", "utf8");
    await writeFile(join(backupDir, "notes.txt"), "ignored", "utf8");

    const backups = await listBackupFiles(backupDir);

    expect(backups.map((backup) => backup.fileName)).toEqual([
      "yanshi-backup-2026-06-08-090000.json",
      "yanshi-backup-2026-06-07-100304.json",
    ]);
  });

  it("prunes old backups and keeps the newest files", async () => {
    for (let day = 1; day <= 9; day += 1) {
      await writeFile(
        join(backupDir, `yanshi-backup-2026-06-${String(day).padStart(2, "0")}-100000.json`),
        "{}",
        "utf8",
      );
    }

    const removed = await pruneOldBackups({ backupDir, keep: 7 });
    const remaining = await listBackupFiles(backupDir);

    expect(removed).toEqual([
      "yanshi-backup-2026-06-02-100000.json",
      "yanshi-backup-2026-06-01-100000.json",
    ]);
    expect(remaining).toHaveLength(7);
  });

  it("rejects invalid JSON and unsupported versions", async () => {
    await writeFile(join(backupDir, "yanshi-backup-2026-06-07-100304.json"), "{", "utf8");
    await expect(readBackupFile("yanshi-backup-2026-06-07-100304.json", backupDir)).rejects.toThrow("备份文件格式无效");

    await writeFile(
      join(backupDir, "yanshi-backup-2026-06-07-100304.json"),
      JSON.stringify({ version: 999, exportedAt: now.toISOString(), chinaDateKey: "2026-06-07", tasks: [], taskEvents: [] }),
      "utf8",
    );
    await expect(readBackupFile("yanshi-backup-2026-06-07-100304.json", backupDir)).rejects.toThrow("暂不支持该备份版本");
  });

  it("creates a daily backup only once for the same China date", async () => {
    const db = createDb([task], [event]);

    const first = await ensureDailyBackup({ backupDir, db: db as never, now });
    const second = await ensureDailyBackup({ backupDir, db: db as never, now: new Date("2026-06-07T08:00:00.000Z") });
    const backups = await listBackupFiles(backupDir);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(backups).toHaveLength(1);
  });
});

describe("restore", () => {
  it("restores tasks and task events through a transaction", async () => {
    const existingTasks = [{ ...task, id: "old-task", title: "旧任务" }];
    const existingEvents = [{ ...event, id: "old-event", taskTitle: "旧任务" }];
    const db = createDb(existingTasks, existingEvents);
    const payload = await buildBackupPayload({ db: createDb([task], [event]) as never, now });

    await restoreBackupPayload(payload, db as never);

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(existingTasks).toEqual([task]);
    expect(existingEvents).toEqual([event]);
  });
});
