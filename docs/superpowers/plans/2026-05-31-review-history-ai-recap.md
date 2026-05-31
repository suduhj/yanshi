# Review History and AI Recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `2.1 今日小结闭环`: record task handling events, show a home daily recap, and provide an explicit `生成 AI 回顾` action with local fallback.

**Architecture:** Add a small `TaskEvent` persistence layer beside existing task services. Existing Server Actions record events after successful task mutations; the home page renders grouped events and calls a server action for AI recap text without mutating tasks.

**Tech Stack:** Next.js App Router, React Server Components, Server Actions, TypeScript, Prisma, SQLite, Vitest, DeepSeek Chat Completions.

---

## File Structure

- Create `src/lib/tasks/events.ts`: event type constants, create/list helpers, today recap query helpers.
- Create `src/lib/tasks/events.test.ts`: unit and integration tests for event writing and grouping.
- Create `src/lib/tasks/recap.ts`: local recap builder, AI prompt builder, AI recap orchestration.
- Create `src/lib/tasks/recap.test.ts`: local fallback and AI recap tests.
- Modify `prisma/schema.prisma`: add `TaskEvent` model and optional task relation.
- Add a Prisma migration under `prisma/migrations/<timestamp>_add_task_events/migration.sql`.
- Modify `src/lib/tasks/actions.ts`: record task events after successful mutations.
- Modify `src/lib/tasks/service.ts`: expose recent task events for edit page and home recap.
- Modify `src/app/page.tsx`: render `今日小结` and AI recap form/result.
- Create `src/app/components/daily-recap-action-panel.tsx`: client component that submits the AI recap action and renders the returned text.
- Modify `src/app/tasks/[id]/edit/page.tsx`: render recent history for the task.
- Modify docs and `开发日志/2026-05-31.md`: record the new second-stage plan or implementation result.

---

### Task 1: Add TaskEvent Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_task_events/migration.sql`

- [ ] **Step 1: Add the Prisma model**

Add this model to `prisma/schema.prisma`:

```prisma
model TaskEvent {
  id           String   @id @default(cuid())
  taskId       String?
  task         Task?    @relation(fields: [taskId], references: [id], onDelete: SetNull)
  taskTitle    String
  type         String
  summary      String
  metadata     String?
  chinaDateKey String
  createdAt    DateTime @default(now())

  @@index([taskId, createdAt])
  @@index([chinaDateKey, createdAt])
}
```

Add this relation field to `Task`:

```prisma
events TaskEvent[]
```

- [ ] **Step 2: Create migration**

Run:

```bash
corepack pnpm prisma migrate dev --name add_task_events
```

Expected: Prisma creates a migration and updates the local SQLite database.

- [ ] **Step 3: Verify Prisma client generation**

Run:

```bash
corepack pnpm prisma generate
```

Expected: Prisma Client generates without errors.

---

### Task 2: Event Helpers

**Files:**
- Create: `src/lib/tasks/events.ts`
- Create: `src/lib/tasks/events.test.ts`

- [ ] **Step 1: Write failing tests for event creation and grouping**

Create `src/lib/tasks/events.test.ts` with tests that:

```ts
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createTaskEvent, listTodayTaskEvents, summarizeTaskEventsByType } from "./events";

describe("task events", () => {
  it("stores a task event with a China date key", async () => {
    const task = await prisma.task.create({
      data: {
        title: "复习高数",
        type: "exam",
        source: "高数",
        dueAt: new Date("2026-05-31T12:00:00.000Z"),
        status: "todo",
      },
    });

    const event = await createTaskEvent({
      taskId: task.id,
      taskTitle: task.title,
      type: "task_completed",
      summary: "完成任务：复习高数",
      now: new Date("2026-05-31T10:00:00.000Z"),
    });

    expect(event.chinaDateKey).toBe("2026-05-31");
    expect(event.taskTitle).toBe("复习高数");
  });

  it("groups today's events by type", async () => {
    await createTaskEvent({
      taskTitle: "整理材料",
      type: "progress_completed",
      summary: "今日推进：整理材料",
      now: new Date("2026-05-31T02:00:00.000Z"),
    });

    const events = await listTodayTaskEvents(new Date("2026-05-31T12:00:00.000Z"));
    const summary = summarizeTaskEventsByType(events);

    expect(summary.progressCompleted).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/events.test.ts
```

Expected: fail because `./events` does not exist.

- [ ] **Step 3: Implement event helpers**

Create `src/lib/tasks/events.ts`:

```ts
import { prisma } from "@/lib/prisma";

import { getChinaDateKey } from "./domain";

export const TASK_EVENT_TYPES = [
  "task_completed",
  "daily_completed",
  "progress_completed",
  "next_action_updated",
  "due_postponed",
  "morning_confirmed_done",
  "marked_unfinished_today",
] as const;

export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

export type CreateTaskEventInput = {
  taskId?: string | null;
  taskTitle: string;
  type: TaskEventType;
  summary: string;
  metadata?: Record<string, unknown>;
  now?: Date;
};

export async function createTaskEvent(input: CreateTaskEventInput) {
  const now = input.now ?? new Date();

  return prisma.taskEvent.create({
    data: {
      taskId: input.taskId ?? null,
      taskTitle: input.taskTitle,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      chinaDateKey: getChinaDateKey(now),
      createdAt: now,
    },
  });
}

export async function listTodayTaskEvents(now = new Date()) {
  return prisma.taskEvent.findMany({
    orderBy: { createdAt: "desc" },
    where: { chinaDateKey: getChinaDateKey(now) },
  });
}

export async function listRecentTaskEvents(taskId: string, take = 8) {
  return prisma.taskEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    where: { taskId },
  });
}

export function summarizeTaskEventsByType(events: { type: string }[]) {
  return {
    completed: events.filter((event) => event.type === "task_completed" || event.type === "daily_completed" || event.type === "morning_confirmed_done"),
    progressCompleted: events.filter((event) => event.type === "progress_completed"),
    rescheduled: events.filter((event) => event.type === "due_postponed" || event.type === "marked_unfinished_today"),
    nextActionUpdated: events.filter((event) => event.type === "next_action_updated"),
  };
}
```

- [ ] **Step 4: Run event tests**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/events.test.ts
```

Expected: pass.

---

### Task 3: Record Events in Existing Actions

**Files:**
- Modify: `src/lib/tasks/actions.ts`
- Modify: `src/lib/tasks/service.test.ts`

- [ ] **Step 1: Add failing service/action tests**

Add assertions to existing task action tests to verify:

- `completeTaskAction` records `task_completed`.
- `completeDailyTodayAction` records `daily_completed`.
- `completeLongRunningProgressTodayAction` records `progress_completed`.
- `updateTaskNextActionAction` records `next_action_updated`.
- `postponeTaskDueAtAction` records `due_postponed`.
- `markUnfinishedPlannedTodayAction` records `marked_unfinished_today`.

Each assertion should query `prisma.taskEvent.findFirst({ where: { taskId: task.id, type: "..." } })`.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/service.test.ts
```

Expected: fail because events are not recorded yet.

- [ ] **Step 3: Record events after successful mutations**

In `src/lib/tasks/actions.ts`, import `createTaskEvent`.

After each successful mutation, call it with a concise Chinese summary:

```ts
await createTaskEvent({
  taskId: task.id,
  taskTitle: task.title,
  type: "task_completed",
  summary: `完成任务：${task.title}`,
});
```

For due postponement, include metadata:

```ts
metadata: { dueAt: task.dueAt.toISOString() }
```

- [ ] **Step 4: Run action tests**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/service.test.ts src/lib/tasks/events.test.ts
```

Expected: pass.

---

### Task 4: Local Recap Builder

**Files:**
- Create: `src/lib/tasks/recap.ts`
- Create: `src/lib/tasks/recap.test.ts`

- [ ] **Step 1: Write failing local recap tests**

Create tests that call `buildLocalDailyRecap` with event-like objects and assert Chinese grouped output includes completed, progress, and rescheduled summaries.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/recap.test.ts
```

Expected: fail because `recap.ts` does not exist.

- [ ] **Step 3: Implement local recap**

Create `src/lib/tasks/recap.ts` with:

```ts
import { createDeepSeekCompletion } from "@/lib/ai/deepseek";

import { summarizeTaskEventsByType } from "./events";

type RecapEvent = {
  summary: string;
  taskTitle: string;
  type: string;
};

export function buildLocalDailyRecap(events: RecapEvent[]) {
  if (events.length === 0) {
    return "今天还没有留下复盘记录。可以先完成、推进或重新安排一项任务。";
  }

  const grouped = summarizeTaskEventsByType(events);
  const lines = ["今日小结："];

  if (grouped.completed.length > 0) {
    lines.push(`完成了 ${grouped.completed.length} 项：${grouped.completed.map((event) => event.taskTitle).join("、")}。`);
  }
  if (grouped.progressCompleted.length > 0) {
    lines.push(`推进了 ${grouped.progressCompleted.length} 项：${grouped.progressCompleted.map((event) => event.taskTitle).join("、")}。`);
  }
  if (grouped.rescheduled.length > 0) {
    lines.push(`重新安排了 ${grouped.rescheduled.length} 项：${grouped.rescheduled.map((event) => event.taskTitle).join("、")}。`);
  }

  lines.push("下一步可以优先处理今日必须完成和待确认事项。");
  return lines.join("\n");
}

export async function generateDailyAiRecap(events: RecapEvent[]) {
  const fallback = buildLocalDailyRecap(events);
  const eventText = events.map((event) => `- ${event.summary}`).join("\n");
  const completion = await createDeepSeekCompletion({
    messages: [
      {
        role: "system",
        content: "你是砚时的复盘助手。请用温和、具体、简短的中文帮助用户总结今天的任务处理情况，并给出下一步建议。不要编造不存在的任务。",
      },
      {
        role: "user",
        content: `今天的任务事件：\n${eventText || "暂无事件"}\n\n请生成今日回顾。`,
      },
    ],
  });

  if (!completion.ok) {
    return { source: "local" as const, text: fallback, message: completion.reason };
  }

  return { source: "ai" as const, text: completion.content.trim() || fallback };
}
```

- [ ] **Step 4: Run recap tests**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/recap.test.ts
```

Expected: pass.

---

### Task 5: Home 今日小结

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `scripts/page-content.test.mjs`

- [ ] **Step 1: Write failing content test**

Update `scripts/page-content.test.mjs` to assert:

```ts
expect(page).toContain("今日小结");
expect(page).toContain("生成 AI 回顾");
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
corepack pnpm vitest run scripts/page-content.test.mjs
```

Expected: fail until the home page renders the new section.

- [ ] **Step 3: Render the section**

In `src/app/page.tsx`:

- Import `listTodayTaskEvents` and `buildLocalDailyRecap`.
- Load today's events beside reminder data.
- Render `DailyRecapPanel` near `ReminderPanel`.
- Include a form button labeled `生成 AI 回顾`.
- Use the local recap text for the first pass.

- [ ] **Step 4: Run page content test**

Run:

```bash
corepack pnpm vitest run scripts/page-content.test.mjs
```

Expected: pass.

---

### Task 6: AI Recap Server Action

**Files:**
- Create: `src/lib/tasks/recap-actions.ts`
- Create: `src/app/components/daily-recap-action-panel.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/lib/tasks/recap.test.ts`

- [ ] **Step 1: Add failing tests for fallback behavior**

Mock `createDeepSeekCompletion` so it returns `{ ok: false, reason: "未配置 DeepSeek API Key" }`, then assert `generateDailyAiRecap` returns `{ source: "local" }` with non-empty text.

- [ ] **Step 2: Run tests and verify they fail or need implementation**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/recap.test.ts
```

Expected: fail until fallback test behavior is implemented.

- [ ] **Step 3: Add server action**

Create `src/lib/tasks/recap-actions.ts`:

```ts
"use server";

import { listTodayTaskEvents } from "./events";
import { generateDailyAiRecap } from "./recap";

export type DailyRecapState = {
  message: string;
  source: "ai" | "local" | "";
};

export async function generateDailyRecapAction(): Promise<DailyRecapState> {
  const events = await listTodayTaskEvents();
  const recap = await generateDailyAiRecap(events);

  return {
    message: recap.text,
    source: recap.source,
  };
}
```

- [ ] **Step 4: Add the client action panel**

Create `src/app/components/daily-recap-action-panel.tsx`:

```tsx
"use client";

import { useActionState } from "react";

import { generateDailyRecapAction, type DailyRecapState } from "@/lib/tasks/recap-actions";

const initialState: DailyRecapState = {
  message: "",
  source: "",
};

export function DailyRecapActionPanel() {
  const [state, formAction, pending] = useActionState(generateDailyRecapAction, initialState);

  return (
    <div className="grid gap-3">
      <form action={formAction}>
        <button className="h-9 border border-neutral-950 bg-neutral-950 px-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400" disabled={pending}>
          {pending ? "生成中" : "生成 AI 回顾"}
        </button>
      </form>
      {state.message ? (
        <div className="whitespace-pre-wrap border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-700">
          {state.message}
          {state.source === "local" ? <p className="mt-2 text-xs text-neutral-500">当前显示本地规则小结。</p> : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Wire the panel into the home page**

In `src/app/page.tsx`, import `DailyRecapActionPanel` and render it inside `DailyRecapPanel`.

- [ ] **Step 6: Run recap tests**

Run:

```bash
corepack pnpm vitest run src/lib/tasks/recap.test.ts
```

Expected: pass.

---

### Task 7: Recent Task History on Edit Page

**Files:**
- Modify: `src/app/tasks/[id]/edit/page.tsx`
- Modify: `src/lib/tasks/service.ts`

- [ ] **Step 1: Add service helper**

Export a `listRecentTaskEvents(taskId: string)` helper from `src/lib/tasks/service.ts` or re-export the helper from `events.ts`.

- [ ] **Step 2: Render recent history**

On the edit page, after the edit form, render:

- Heading: `最近记录`
- Empty text: `这个任务还没有复盘记录。`
- Latest event summaries with formatted China time.

- [ ] **Step 3: Run relevant tests**

Run:

```bash
corepack pnpm test
```

Expected: all tests pass.

---

### Task 8: Documentation and Verification

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/technical.md`
- Modify: `docs/design.md`
- Modify: `docs/implementation-steps.md`
- Modify: `开发日志/2026-05-31.md`

- [ ] **Step 1: Update docs**

Add `第二阶段：复盘历史与 AI 回顾` with the 2.1 scope:

- Task events.
- Home daily recap.
- Explicit AI recap button.
- Local fallback.
- No background Agent or direct AI mutation.

- [ ] **Step 2: Run full verification**

Run:

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Expected: all commands pass. On this Windows workspace, `typecheck` or `build` may require elevated execution because they write cache files.

- [ ] **Step 3: Commit**

Run:

```bash
git add prisma src docs 开发日志
git commit -m "feat: add daily recap history loop"
```

Expected: commit succeeds after tests pass.

---

## Self-Review

- Spec coverage: every design item maps to at least one implementation task.
- Scope boundary: the plan excludes export/import, backups, Web Push, background Agent, and AI mutation.
- Test strategy: event helpers, action event recording, local recap, AI fallback, and page content all have coverage.
- Rollout: the plan creates a usable local-first loop before any later reminder or data-safety milestone.
