# A1 自动备份 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local JSON backup and restore for Task and TaskEvent data, with a `/backup` management page and daily first-open backup check.

**Architecture:** Add a focused server-only backup module under `src/lib/backup/` that owns payload generation, filesystem IO, validation, listing, retention, and restore transactions. Add Server Actions and a simple `/backup` page that follow the existing `redirect(...?notice=...)` and browser-confirm patterns. Update docs and the daily log after verification.

**Tech Stack:** Next.js Server Components and Server Actions, React, TypeScript, Prisma, SQLite, Vitest, Node `fs/promises`, existing China time utilities.

---

## File Structure

- Create `src/lib/backup/backup.ts`: server-only backup domain module.
- Create `src/lib/backup/backup.test.ts`: Vitest tests for payload, file naming, listing, retention, validation, auto backup, and restore.
- Create `src/lib/backup/actions.ts`: Server Actions for manual backup and restore.
- Create `src/app/backup/page.tsx`: backup management UI.
- Modify `.gitignore`: ignore `/prisma/backups/`.
- Modify `docs/requirements.md`: add third-stage A1 backup scope.
- Modify `docs/technical.md`: document backup format, path, retention, restore transaction.
- Modify `docs/design.md`: document `/backup` UI behavior.
- Modify `docs/implementation-steps.md`: add third-stage A1 execution steps.
- Modify `GPT.md`: add local backup directory rule.
- Create or modify `开发日志/2026-06-07.md`: record completed work and verification.

No `git commit` step is included because `GPT.md` requires explicit user confirmation before committing.

---

### Task 1: Backup Module RED Tests

**Files:**
- Create: `src/lib/backup/backup.test.ts`
- Create later: `src/lib/backup/backup.ts`

- [ ] **Step 1: Write failing tests for backup payload and file naming**

Create `src/lib/backup/backup.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BACKUP_VERSION,
  buildBackupFileName,
  buildBackupPayload,
  listBackupFiles,
  parseBackupFileName,
  pruneOldBackups,
  readBackupFile,
  restoreBackupPayload,
  ensureDailyBackup,
} from "./backup";

type TaskRow = {
  id: string;
  title: string;
  type: string;
  source: string;
  dueAt: Date | null;
  priority: string;
  status: string;
  notes: string;
  isLongRunning: boolean;
  isPlannedToday: boolean;
  isDaily: boolean;
  dailyCompletedOn: string | null;
  nextAction: string;
  createdAt: Date;
  updatedAt: Date;
};

type TaskEventRow = {
  id: string;
  taskId: string | null;
  taskTitle: string;
  type: string;
  summary: string;
  metadata: string | null;
  chinaDateKey: string;
  createdAt: Date;
};

function createDb(tasks: TaskRow[] = [], taskEvents: TaskEventRow[] = []) {
  type MockDb = {
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
    $transaction: ReturnType<typeof vi.fn>;
  };

  let db: MockDb;

  db = {
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
```

Append the test fixtures and tests:

```ts
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

    const payload = await buildBackupPayload({ db, now });

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
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
corepack pnpm test src/lib/backup/backup.test.ts
```

Expected: FAIL because `src/lib/backup/backup.ts` does not exist.

---

### Task 2: Backup Module GREEN Implementation

**Files:**
- Create: `src/lib/backup/backup.ts`
- Test: `src/lib/backup/backup.test.ts`

- [ ] **Step 1: Create minimal backup module**

Create `src/lib/backup/backup.ts`:

```ts
import "server-only";

import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Task, TaskEvent } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getChinaDateKey } from "@/lib/tasks/domain";

export const BACKUP_VERSION = 1;
export const DEFAULT_BACKUP_DIR = join(process.cwd(), "prisma", "backups");
export const DEFAULT_BACKUP_RETENTION = 7;

export type BackupPayload = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  chinaDateKey: string;
  tasks: Task[];
  taskEvents: TaskEvent[];
};

type BackupDb = Pick<typeof prisma, "task" | "taskEvent" | "$transaction">;

export async function buildBackupPayload({
  db = prisma,
  now = new Date(),
}: {
  db?: Pick<typeof prisma, "task" | "taskEvent">;
  now?: Date;
} = {}): Promise<BackupPayload> {
  const [tasks, taskEvents] = await Promise.all([
    db.task.findMany({ orderBy: { createdAt: "asc" } }),
    db.taskEvent.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    chinaDateKey: getChinaDateKey(now),
    tasks,
    taskEvents,
  };
}

export function buildBackupFileName(now = new Date()) {
  const chinaDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
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
  db?: Pick<typeof prisma, "task" | "taskEvent">;
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

      return [stat(join(backupDir, fileName)).then((fileStat) => ({
        chinaDateKey: parsed.chinaDateKey,
        fileName,
        filePath: join(backupDir, fileName),
        size: fileStat.size,
        timestamp: parsed.timestamp,
      }))];
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
          dueAt: task.dueAt ? reviveDate(task.dueAt) as Date : null,
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

export async function restoreBackupFile(fileName: string, {
  backupDir = DEFAULT_BACKUP_DIR,
  db = prisma,
}: {
  backupDir?: string;
  db?: BackupDb;
} = {}) {
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
  db?: Pick<typeof prisma, "task" | "taskEvent">;
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
```

- [ ] **Step 2: Run tests and verify GREEN for current cases**

Run:

```bash
corepack pnpm test src/lib/backup/backup.test.ts
```

Expected: PASS for the two initial tests.

---

### Task 3: Listing, Retention, Validation, and Restore Tests

**Files:**
- Modify: `src/lib/backup/backup.test.ts`
- Modify: `src/lib/backup/backup.ts`

- [ ] **Step 1: Add failing tests for list, prune, read, auto backup, and restore**

Append to `src/lib/backup/backup.test.ts`:

```ts
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

    const first = await ensureDailyBackup({ backupDir, db, now });
    const second = await ensureDailyBackup({ backupDir, db, now: new Date("2026-06-07T08:00:00.000Z") });
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
    const payload = await buildBackupPayload({ db: createDb([task], [event]), now });

    await restoreBackupPayload(payload, db);

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(existingTasks).toEqual([task]);
    expect(existingEvents).toEqual([event]);
  });
});
```

- [ ] **Step 2: Run tests and verify RED or type failures**

Run:

```bash
corepack pnpm test src/lib/backup/backup.test.ts
```

Expected: FAIL if the minimal implementation needs adjustment for mock typing, JSON Date revival, or retention ordering.

- [ ] **Step 3: Complete implementation for the new tests**

Adjust `src/lib/backup/backup.ts` until the tests pass. Keep the public API names unchanged:

- `buildBackupPayload`
- `buildBackupFileName`
- `parseBackupFileName`
- `createBackup`
- `listBackupFiles`
- `pruneOldBackups`
- `readBackupFile`
- `restoreBackupPayload`
- `restoreBackupFile`
- `ensureDailyBackup`

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
corepack pnpm test src/lib/backup/backup.test.ts
```

Expected: PASS.

---

### Task 4: Server Actions for Backup

**Files:**
- Create: `src/lib/backup/actions.ts`
- Test by page/actions manually after UI task.

- [ ] **Step 1: Create backup actions**

Create `src/lib/backup/actions.ts`:

```ts
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
```

- [ ] **Step 2: Run typecheck for action shape**

Run:

```bash
corepack pnpm typecheck
```

Expected: PASS or unrelated existing failures only. If there are backup-related TypeScript errors, fix them before continuing.

---

### Task 5: Backup Page UI

**Files:**
- Create: `src/app/backup/page.tsx`
- No homepage changes in this task. `/backup` remains directly accessible.

- [ ] **Step 1: Create `/backup` page**

Create `src/app/backup/page.tsx`:

```tsx
import Link from "next/link";

import { createBackupAction, restoreBackupAction } from "@/lib/backup/actions";
import { ensureDailyBackup, listBackupFiles, readBackupFile } from "@/lib/backup/backup";
import { formatChinaDateTime } from "@/lib/tasks/domain";

type PageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

const NOTICE_MESSAGES: Record<string, string> = {
  backupCreated: "已创建备份。",
  backupFailed: "创建备份失败，请稍后重试。",
  invalidBackup: "备份文件无效。",
  restored: "已从备份恢复数据。",
  restoreFailed: "恢复备份失败，请检查备份文件。",
};

async function toBackupView(fileName: string) {
  try {
    const payload = await readBackupFile(fileName);
    return {
      exportedAt: formatChinaDateTime(new Date(payload.exportedAt)),
      fileName,
      taskCount: payload.tasks.length,
      eventCount: payload.taskEvents.length,
      valid: true,
    };
  } catch {
    return {
      exportedAt: "无法读取",
      fileName,
      taskCount: 0,
      eventCount: 0,
      valid: false,
    };
  }
}

export default async function BackupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await ensureDailyBackup();
  const backups = await listBackupFiles();
  const backupViews = await Promise.all(backups.map((backup) => toBackupView(backup.fileName)));
  const notice = params.notice ? NOTICE_MESSAGES[params.notice] : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-5">
        <Link className="text-sm text-neutral-500 transition hover:text-neutral-950" href="/">
          返回任务列表
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-neutral-500">本地数据保护</p>
            <h1 className="mt-1 text-3xl font-semibold text-neutral-950">备份管理</h1>
          </div>
          <form action={createBackupAction}>
            <button className="border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800" type="submit">
              立即备份
            </button>
          </form>
        </div>
      </header>

      {notice ? (
        <div className="border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          {notice}
        </div>
      ) : null}

      <section className="border border-neutral-200 bg-white">
        <header className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-neutral-950">备份目录</h2>
          <p className="mt-1 text-sm text-neutral-500">prisma/backups/，默认保留最近 7 份。</p>
        </header>
        {backupViews.length === 0 ? (
          <p className="px-4 py-4 text-sm text-neutral-500">暂无备份。点击“立即备份”创建第一份备份。</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {backupViews.map((backup) => (
              <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between" key={backup.fileName}>
                <div>
                  <p className="text-sm font-medium text-neutral-950">{backup.fileName}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {backup.exportedAt} · {backup.taskCount} 个任务 · {backup.eventCount} 条记录
                  </p>
                </div>
                <form action={restoreBackupAction}>
                  <input name="fileName" type="hidden" value={backup.fileName} />
                  <button
                    className="border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!backup.valid}
                    formAction={restoreBackupAction}
                    type="submit"
                  >
                    恢复
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Add restore confirmation**

If the project requires browser confirm for restore, extract a small client component:

Create `src/app/components/restore-backup-button.tsx`:

```tsx
"use client";

export function RestoreBackupButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      className="border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm("确定要从这份备份恢复吗？当前任务数据会被覆盖。")) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      恢复
    </button>
  );
}
```

Then modify `src/app/backup/page.tsx` to import and use it:

```tsx
import { RestoreBackupButton } from "@/app/components/restore-backup-button";
```

Replace the restore `<button>` with:

```tsx
<RestoreBackupButton disabled={!backup.valid} />
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
corepack pnpm typecheck
```

Expected: PASS.

---

### Task 6: Ignore Backup Data and Update Docs

**Files:**
- Modify: `.gitignore`
- Modify: `docs/requirements.md`
- Modify: `docs/technical.md`
- Modify: `docs/design.md`
- Modify: `docs/implementation-steps.md`
- Modify: `GPT.md`
- Create or modify: `开发日志/2026-06-07.md`

- [ ] **Step 1: Update `.gitignore`**

Append under local SQLite data:

```gitignore
/prisma/backups/
```

- [ ] **Step 2: Update `docs/requirements.md`**

Add a third-stage section after the second-stage section:

```md
## 第三阶段规划：单机智能化与数据安全

### 3.1 自动备份

- 支持手动创建本地 JSON 备份。
- 支持在页面打开期间按中国日期每日首次创建一份备份。
- 支持查看已有备份列表。
- 支持从备份恢复任务和复盘事件，恢复前需要二次确认。
- 默认保留最近 7 份备份，自动清理更早备份。
- 备份文件保存到 `prisma/backups/`，不提交到 Git。
- 不接入云端备份、后台常驻 Agent、Web Push 或系统级定时能力。
```

- [ ] **Step 3: Update `docs/technical.md`**

Add under architecture or database:

```md
## 本地备份

A1 自动备份使用 `src/lib/backup/backup.ts` 作为服务端备份模块。备份目录固定为 `prisma/backups/`，文件名为 `yanshi-backup-YYYY-MM-DD-HHmmss.json`，时间按中国时间生成。

备份 JSON 使用版本号 `version: 1`，包含 `exportedAt`、`chinaDateKey`、`tasks` 和 `taskEvents`。第一版只备份业务数据，不备份 `.env`、DeepSeek 密钥、SQLite 原始数据库文件或构建产物。

恢复备份时先校验文件名、JSON 格式和版本，再在 Prisma transaction 中删除现有 `TaskEvent`、删除现有 `Task`，随后重建任务和事件。恢复失败时事务回滚。

每日自动备份只在页面请求期间触发，不使用后台常驻进程。默认保留最近 7 份备份。
```

- [ ] **Step 4: Update `docs/design.md`**

Add:

```md
## 备份管理

- `/backup` 页面用于本地备份管理，不放入首页主流程。
- 页面展示备份目录、立即备份按钮和备份列表。
- 备份列表展示文件名、导出时间、任务数量和复盘事件数量。
- 恢复备份前使用浏览器确认，避免误覆盖当前数据。
- 成功和失败反馈使用页面顶部轻量提示，不使用弹窗展示结果。
```

- [ ] **Step 5: Update `docs/implementation-steps.md`**

Add a third-stage section:

```md
## 第三阶段：单机智能化与数据安全

### 3.1 自动备份

- 新增本地备份模块，导出 `Task` 和 `TaskEvent` 为版本化 JSON。
- 新增备份列表、备份读取、备份校验、恢复和旧备份清理逻辑。
- 新增 `/backup` 页面，支持立即备份、查看备份和恢复备份。
- 恢复备份前二次确认，恢复过程使用 Prisma transaction。
- 将 `prisma/backups/` 加入 Git 忽略。
```

- [ ] **Step 6: Update `GPT.md`**

Add to working requirements:

```md
- 本地备份文件保存到 `prisma/backups/`，属于用户数据，不提交到 Git。
```

- [ ] **Step 7: Update `开发日志/2026-06-07.md`**

Create the file if missing:

```md
# 2026-06-07 开发日志

## 完成事项
- 确认第三阶段从 A1 自动备份开始推进。
- 新增 A1 自动备份设计规格和实现计划。
- 实现本地 JSON 备份模块、备份管理页面和恢复流程。

## 待办事项
- 暂无。

## 文档更新
- 更新需求、技术、设计和执行步骤文档，记录 A1 自动备份范围。
- 更新 `GPT.md`，记录 `prisma/backups/` 为本地用户数据目录。

## 验证
- `corepack pnpm test src/lib/backup/backup.test.ts`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
```

---

### Task 7: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run focused backup tests**

Run:

```bash
corepack pnpm test src/lib/backup/backup.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run:

```bash
corepack pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
corepack pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
corepack pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: changed implementation, docs, and ignored `prisma/backups/` contents not shown. Existing untracked `docs/future-roadmap.md` may still be present.

Do not commit unless the user explicitly confirms the commit content.
