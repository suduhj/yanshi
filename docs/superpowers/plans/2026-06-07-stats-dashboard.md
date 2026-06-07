# E1/E2 数据可视化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight `/stats` dashboard showing 7-day task history trends, task type distribution, source distribution, and recent recap records without adding chart dependencies.

**Architecture:** Keep statistics as pure functions in `src/lib/tasks/stats.ts`, tested with Vitest before any page work. The `/stats` route remains a Server Component that reads Prisma data, transforms it through the stats module, and renders compact Tailwind-based bars, lists, and summary cards.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, Prisma, Vitest, existing China time helpers.

---

## File Structure

- Create `src/lib/tasks/stats.ts`: pure statistics helpers and dashboard view model.
- Create `src/lib/tasks/stats.test.ts`: TDD coverage for date windows, event grouping, type/source distribution, and empty states.
- Create `src/app/stats/page.tsx`: `/stats` Server Component.
- Modify `src/app/page.tsx`: add a lightweight text link to `/stats` in the header action area.
- Modify `docs/requirements.md`: record E1/E2 first-version scope.
- Modify `docs/technical.md`: document stats module and China date grouping.
- Modify `docs/design.md`: document `/stats` page layout.
- Modify `docs/implementation-steps.md`: record E1/E2 execution steps.
- Modify `开发日志/2026-06-07.md`: record plan and implementation verification.

No commits are included in this plan unless the user explicitly requests committing.

---

### Task 1: Stats Module RED Tests

**Files:**
- Create: `src/lib/tasks/stats.test.ts`
- Create later: `src/lib/tasks/stats.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/tasks/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildDateWindow,
  buildSourceDistribution,
  buildStatsDashboardData,
  buildTypeDistribution,
} from "./stats";

const now = new Date("2026-06-07T02:00:00.000Z");

const tasks = [
  makeTask({ id: "task-1", source: "高数", type: "coursework" }),
  makeTask({ id: "task-2", source: "竞赛组", type: "competition" }),
  makeTask({ id: "task-3", source: "", type: "life" }),
  makeTask({ id: "task-4", source: "高数", type: "coursework" }),
];

const events = [
  makeEvent({ chinaDateKey: "2026-06-01", type: "task_completed" }),
  makeEvent({ chinaDateKey: "2026-06-02", type: "daily_completed" }),
  makeEvent({ chinaDateKey: "2026-06-02", type: "progress_completed" }),
  makeEvent({ chinaDateKey: "2026-06-03", type: "due_postponed" }),
  makeEvent({ chinaDateKey: "2026-06-07", type: "marked_unfinished_today" }),
  makeEvent({ chinaDateKey: "2026-06-07", type: "next_action_updated" }),
];

describe("stats dashboard", () => {
  it("builds a 7-day China date window ending today", () => {
    expect(buildDateWindow(now, 7)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
  });

  it("groups events into overview and daily trend buckets", () => {
    const data = buildStatsDashboardData(tasks, events, now);

    expect(data.overview.completed).toBe(2);
    expect(data.overview.progress).toBe(1);
    expect(data.overview.rescheduled).toBe(2);
    expect(data.overview.todayRecords).toBe(2);
    expect(data.trend.find((day) => day.chinaDateKey === "2026-06-02")).toMatchObject({
      completed: 1,
      progress: 1,
      rescheduled: 0,
    });
  });

  it("builds type distribution with Chinese labels", () => {
    expect(buildTypeDistribution(tasks)).toEqual([
      { count: 2, label: "课程作业", ratio: 1, type: "coursework" },
      { count: 1, label: "竞赛任务", ratio: 0.5, type: "competition" },
      { count: 1, label: "生活杂事", ratio: 0.5, type: "life" },
    ]);
  });

  it("builds source distribution and groups empty source", () => {
    expect(buildSourceDistribution(tasks)).toEqual([
      { count: 2, label: "高数", ratio: 1 },
      { count: 1, label: "竞赛组", ratio: 0.5 },
      { count: 1, label: "未填写来源", ratio: 0.5 },
    ]);
  });

  it("returns stable empty dashboard data", () => {
    const data = buildStatsDashboardData([], [], now);

    expect(data.overview).toEqual({
      completed: 0,
      nextActionUpdated: 0,
      progress: 0,
      rescheduled: 0,
      todayRecords: 0,
    });
    expect(data.typeDistribution).toEqual([]);
    expect(data.sourceDistribution).toEqual([]);
    expect(data.recentEvents).toEqual([]);
    expect(data.trend).toHaveLength(7);
  });
});

function makeTask(overrides: Partial<StatsTask> = {}): StatsTask {
  return {
    id: "task",
    source: "",
    type: "life",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<StatsEvent> = {}): StatsEvent {
  return {
    chinaDateKey: "2026-06-07",
    createdAt: new Date("2026-06-07T01:00:00.000Z"),
    id: "event",
    summary: "完成任务：测试",
    taskTitle: "测试",
    type: "task_completed",
    ...overrides,
  };
}

type StatsTask = {
  id: string;
  source: string;
  type: string;
};

type StatsEvent = {
  chinaDateKey: string;
  createdAt: Date;
  id: string;
  summary: string;
  taskTitle: string;
  type: string;
};
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
corepack pnpm test src/lib/tasks/stats.test.ts
```

Expected: FAIL because `src/lib/tasks/stats.ts` does not exist.

---

### Task 2: Stats Module GREEN Implementation

**Files:**
- Create: `src/lib/tasks/stats.ts`
- Test: `src/lib/tasks/stats.test.ts`

- [ ] **Step 1: Implement stats helpers**

Create `src/lib/tasks/stats.ts`:

```ts
import { TASK_TYPE_LABELS, getChinaDateKey } from "./domain";

const DAY_MS = 86_400_000;
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

export type StatsTask = {
  id: string;
  source: string | null;
  type: string;
};

export type StatsEvent = {
  chinaDateKey: string;
  createdAt: Date;
  id: string;
  summary: string;
  taskTitle: string;
  type: string;
};

export function buildDateWindow(now = new Date(), days = 7) {
  const todayStart = getChinaDayStartUtcMs(now);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(todayStart - (days - 1 - index) * DAY_MS);
    return getChinaDateKey(date);
  });
}

export function buildStatsDashboardData(tasks: StatsTask[], events: StatsEvent[], now = new Date()) {
  const dateWindow = buildDateWindow(now, 7);
  const dateSet = new Set(dateWindow);
  const windowEvents = events.filter((event) => dateSet.has(event.chinaDateKey));
  const todayKey = getChinaDateKey(now);
  const overview = {
    completed: windowEvents.filter(isCompletedEvent).length,
    nextActionUpdated: windowEvents.filter((event) => event.type === "next_action_updated").length,
    progress: windowEvents.filter((event) => event.type === "progress_completed").length,
    rescheduled: windowEvents.filter(isRescheduledEvent).length,
    todayRecords: windowEvents.filter((event) => event.chinaDateKey === todayKey).length,
  };
  const trend = dateWindow.map((chinaDateKey) => {
    const dayEvents = windowEvents.filter((event) => event.chinaDateKey === chinaDateKey);
    return {
      chinaDateKey,
      completed: dayEvents.filter(isCompletedEvent).length,
      progress: dayEvents.filter((event) => event.type === "progress_completed").length,
      rescheduled: dayEvents.filter(isRescheduledEvent).length,
    };
  });

  return {
    overview,
    recentEvents: [...events]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10),
    sourceDistribution: buildSourceDistribution(tasks),
    trend,
    typeDistribution: buildTypeDistribution(tasks),
  };
}

export function buildTypeDistribution(tasks: StatsTask[]) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    counts.set(task.type, (counts.get(task.type) ?? 0) + 1);
  }

  return toDistribution([...counts.entries()]
    .map(([type, count]) => ({
      count,
      label: TASK_TYPE_LABELS[type as keyof typeof TASK_TYPE_LABELS] ?? type,
      type,
    })));
}

export function buildSourceDistribution(tasks: StatsTask[]) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const label = task.source?.trim() || "未填写来源";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const items = toDistribution([...counts.entries()].map(([label, count]) => ({ count, label })));
  if (items.length <= 8) {
    return items;
  }

  const visible = items.slice(0, 8);
  const otherCount = items.slice(8).reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(...visible.map((item) => item.count), otherCount);

  return [
    ...visible.map((item) => ({ ...item, ratio: max === 0 ? 0 : item.count / max })),
    { count: otherCount, label: "其他来源", ratio: max === 0 ? 0 : otherCount / max },
  ];
}

function toDistribution<T extends { count: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const max = sorted[0]?.count ?? 0;
  return sorted.map((item) => ({
    ...item,
    ratio: max === 0 ? 0 : item.count / max,
  }));
}

function isCompletedEvent(event: Pick<StatsEvent, "type">) {
  return event.type === "task_completed" ||
    event.type === "daily_completed" ||
    event.type === "morning_confirmed_done";
}

function isRescheduledEvent(event: Pick<StatsEvent, "type">) {
  return event.type === "due_postponed" ||
    event.type === "marked_unfinished_today";
}

function getChinaDayStartUtcMs(date: Date) {
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS);
  return Date.UTC(
    chinaDate.getUTCFullYear(),
    chinaDate.getUTCMonth(),
    chinaDate.getUTCDate(),
  ) - CHINA_OFFSET_MS;
}
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
corepack pnpm test src/lib/tasks/stats.test.ts
```

Expected: PASS.

---

### Task 3: Stats Page

**Files:**
- Create: `src/app/stats/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `/stats` page**

Create `src/app/stats/page.tsx` with a Server Component that reads `prisma.task.findMany()` and `prisma.taskEvent.findMany()`, builds `buildStatsDashboardData`, and renders:

- return link to `/`
- four overview cards
- 7-day trend rows with bars
- type distribution rows
- source distribution rows
- recent events list

Use these imports:

```tsx
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatChinaDateTime } from "@/lib/tasks/domain";
import { buildStatsDashboardData } from "@/lib/tasks/stats";
```

Use these helper components in the same file:

```tsx
function OverviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function RatioBar({ ratio }: { ratio: number }) {
  return (
    <div className="h-2 overflow-hidden bg-neutral-100">
      <div className="h-full bg-neutral-950" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}
```

- [ ] **Step 2: Add homepage link**

Modify the home page header action area in `src/app/page.tsx` to include:

```tsx
<Link className="text-sm text-neutral-500 transition hover:text-neutral-950" href="/stats">
  复盘统计
</Link>
```

Place it near the brand/header controls so it does not affect task sections.

- [ ] **Step 3: Run typecheck**

Run:

```bash
corepack pnpm typecheck
```

Expected: PASS.

---

### Task 4: Documentation and Log

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/technical.md`
- Modify: `docs/design.md`
- Modify: `docs/implementation-steps.md`
- Modify: `开发日志/2026-06-07.md`

- [ ] **Step 1: Update requirements**

Add E1/E2 first-version bullets under third stage:

```md
### 3.2 数据可视化

- 支持 `/stats` 复盘统计页。
- 支持近 7 天完成、推进和重新安排趋势。
- 支持按任务类型查看当前任务分布。
- 支持按任务来源查看当前任务分布。
- 支持查看最近 10 条复盘记录。
- 第一版不引入图表库，不做复杂筛选和导出。
```

- [ ] **Step 2: Update technical/design/steps/log**

Append this section to `docs/technical.md`:

```md
## 复盘统计

E1/E2 数据可视化使用 `src/lib/tasks/stats.ts` 作为纯统计模块，输入当前任务和复盘事件，输出 `/stats` 页面所需的展示模型。

近 7 天趋势按中国日期键聚合，日期窗口包含今天，并复用中国时间语义避免服务器时区差异。第一版统计完成、推进、重新安排和更新下一步等事件数量，不新增数据库表。

`/stats` 页面使用 Tailwind CSS 绘制轻量数字卡片、横向条和列表，不引入 Recharts、Chart.js 等图表库。
```

Append this section to `docs/design.md`:

```md
## 复盘统计

- `/stats` 页面用于查看复盘统计，不替代首页任务工作台。
- 页面展示近 7 天概览、趋势、任务类型分布、来源分布和最近复盘记录。
- 图表第一版使用轻量横向条和紧凑列表，不引入复杂交互。
- 空状态保持简短，不增加额外说明卡片。
```

Append this section to `docs/implementation-steps.md`:

```md
### 3.2 数据可视化

- 新增统计聚合模块，按中国日期键生成近 7 天趋势。
- 新增 `/stats` 页面，展示概览、趋势、类型分布、来源分布和最近复盘记录。
- 第一版使用 Tailwind 轻量图形，不引入图表库。
- 首页增加轻量“复盘统计”入口。
```

Append these lines to `开发日志/2026-06-07.md`:

```md
- 新增 E1/E2 数据可视化设计规格和实现计划。
- 实现 `/stats` 复盘统计页，展示近 7 天趋势、类型分布、来源分布和最近复盘记录。
```

Add verification commands to the same log:

```md
- `corepack pnpm test src/lib/tasks/stats.test.ts`
- `corepack pnpm test`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm build`
```

---

### Task 5: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run focused stats tests**

Run:

```bash
corepack pnpm test src/lib/tasks/stats.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all tests**

Run:

```bash
corepack pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck, lint, and build**

Run:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

Expected: PASS. If Windows sandbox file locks block `typecheck` or `build`, rerun the same command with approved escalation and record both outcomes.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: `feat/stats-dashboard` contains only stats dashboard files/docs plus existing untracked roadmap if it remains intentionally outside the commit.
