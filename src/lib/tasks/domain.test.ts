import { describe, expect, it } from "vitest";

import {
  TASK_STATUSES,
  TASK_TYPES,
  buildTaskSections,
  buildTaskSummary,
  createTaskInputSchema,
  formatChinaDateTime,
  formatDueDistance,
  getChinaDateKey,
  getSystemPriority,
  isDailyCompletedToday,
  matchesTaskFilters,
  toChinaDateTimeInput,
  toTaskStatus,
} from "./domain";

const now = new Date("2026-05-29T04:00:00.000Z"); // 2026-05-29 12:00 in China.

const baseTask = {
  id: "task-1",
  title: "成图作业",
  type: TASK_TYPES[1],
  source: "建筑制图课",
  dueAt: new Date("2026-06-01T02:00:00.000Z"), // 2026-06-01 10:00 in China.
  status: TASK_STATUSES[0],
  notes: "完成平面图",
  isLongRunning: false,
  isPlannedToday: false,
  isDaily: false,
  dailyCompletedOn: null,
  nextAction: "",
  createdAt: new Date("2026-05-29T00:00:00.000Z"),
  updatedAt: new Date("2026-05-29T00:00:00.000Z"),
};

describe("task domain", () => {
  it("treats datetime-local input as China time without adding 8 hours on display", () => {
    const parsed = createTaskInputSchema.parse({
      title: "  晚上完成成图  ",
      type: "drawing",
      source: "  成图老师  ",
      dueAt: "2026-05-30T08:00",
      notes: "  先画轴网  ",
      isLongRunning: "on",
      nextAction: "  先完成底图  ",
    });

    expect(parsed).toEqual({
      title: "晚上完成成图",
      type: "drawing",
      source: "成图老师",
      dueAt: new Date("2026-05-30T00:00:00.000Z"),
      notes: "先画轴网",
      isLongRunning: true,
      isPlannedToday: false,
      isDaily: false,
      nextAction: "先完成底图",
    });
    expect(formatChinaDateTime(parsed.dueAt)).toBe("2026年5月30日 08:00");
    expect(toChinaDateTimeInput(parsed.dueAt)).toBe("2026-05-30T08:00");
  });

  it("allows tasks without a due date", () => {
    const parsed = createTaskInputSchema.parse({
      title: "整理宿舍",
      type: "life",
      source: "",
      dueAt: "",
      notes: "",
    });

    expect(parsed.dueAt).toBeNull();
    expect(getSystemPriority(parsed, now).value).toBe("low");
  });

  it("supports competition tasks and planning flags in task input", () => {
    const parsed = createTaskInputSchema.parse({
      title: "提交竞赛报名材料",
      type: "competition",
      source: "创新创业比赛",
      dueAt: "2026-05-30T18:00",
      notes: "",
      isPlannedToday: "on",
      isDaily: "on",
    });

    expect(parsed.type).toBe("competition");
    expect(parsed.isPlannedToday).toBe(true);
    expect(parsed.isDaily).toBe(true);
  });

  it("rejects an empty title", () => {
    const parsed = createTaskInputSchema.safeParse({
      title: " ",
      type: "coursework",
      source: "",
      dueAt: "2026-06-01T18:30",
      notes: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("guards task status transitions from arbitrary values", () => {
    expect(toTaskStatus("done")).toBe("done");
    expect(toTaskStatus("not-a-status")).toBe("todo");
  });

  it("calculates system priority from status and China due day", () => {
    expect(getSystemPriority({ ...baseTask, dueAt: new Date("2026-05-28T10:00:00.000Z") }, now).value).toBe("urgent");
    expect(getSystemPriority({ ...baseTask, dueAt: new Date("2026-05-29T15:00:00.000Z") }, now).value).toBe("urgent");
    expect(getSystemPriority({ ...baseTask, dueAt: new Date("2026-05-30T02:00:00.000Z") }, now).value).toBe("high");
    expect(getSystemPriority({ ...baseTask, dueAt: new Date("2026-06-01T02:00:00.000Z") }, now).value).toBe("mediumHigh");
    expect(getSystemPriority({ ...baseTask, dueAt: new Date("2026-06-04T02:00:00.000Z") }, now).value).toBe("medium");
    expect(getSystemPriority({ ...baseTask, dueAt: null }, now).value).toBe("low");
    expect(getSystemPriority({ ...baseTask, status: "done" }, now).value).toBe("lowest");
  });

  it("matches tasks by status, type, and due window", () => {
    expect(
      matchesTaskFilters(baseTask, {
        status: "todo",
        type: "drawing",
        due: "upcoming",
      }, now),
    ).toBe(true);

    expect(
      matchesTaskFilters(baseTask, {
        status: "done",
        type: "drawing",
        due: "upcoming",
      }, now),
    ).toBe(false);
  });

  it("summarizes overdue, today, long-running, and done tasks", () => {
    const summary = buildTaskSummary([
      { ...baseTask, id: "overdue", dueAt: new Date("2026-05-28T12:00:00.000Z") },
      { ...baseTask, id: "today", dueAt: new Date("2026-05-29T15:00:00.000Z") },
      { ...baseTask, id: "long-running", isLongRunning: true },
      { ...baseTask, id: "planned", isPlannedToday: true },
      { ...baseTask, id: "daily", isDaily: true },
      { ...baseTask, id: "done", status: "done" },
    ], now);

    expect(summary).toEqual({
      total: 6,
      overdue: 1,
      today: 1,
      longRunning: 1,
      plannedToday: 1,
      daily: 1,
      done: 1,
    });
  });

  it("sections tasks by daily execution logic", () => {
    const sections = buildTaskSections([
      { ...baseTask, id: "other", dueAt: new Date("2026-06-04T02:00:00.000Z") },
      { ...baseTask, id: "done", status: "done" },
      { ...baseTask, id: "long", isLongRunning: true },
      { ...baseTask, id: "planned", isPlannedToday: true },
      { ...baseTask, id: "daily", isDaily: true },
      { ...baseTask, id: "today", dueAt: new Date("2026-05-29T15:00:00.000Z") },
    ], now);

    expect(sections.todayMustDo.map((task) => task.id)).toEqual(["today"]);
    expect(sections.plannedToday.map((task) => task.id)).toEqual(["planned"]);
    expect(sections.daily.map((task) => task.id)).toEqual(["daily"]);
    expect(sections.longRunning.map((task) => task.id)).toEqual(["long"]);
    expect(sections.other.map((task) => task.id)).toEqual(["other"]);
    expect(sections.done.map((task) => task.id)).toEqual(["done"]);
  });

  it("keeps daily tasks out of ordinary done section and resets completion by China day", () => {
    const dailyTask = {
      ...baseTask,
      id: "daily",
      isDaily: true,
      dailyCompletedOn: "2026-05-29",
    };

    const sections = buildTaskSections([{ ...dailyTask, status: "done" }], now);

    expect(sections.daily.map((task) => task.id)).toEqual(["daily"]);
    expect(sections.done).toHaveLength(0);
    expect(getChinaDateKey(now)).toBe("2026-05-29");
    expect(isDailyCompletedToday(dailyTask, now)).toBe(true);
    expect(isDailyCompletedToday(dailyTask, new Date("2026-05-29T16:30:00.000Z"))).toBe(false);
  });

  it("formats due distance by China day", () => {
    expect(formatDueDistance(null, now)).toBe("无截止时间");
    expect(formatDueDistance(new Date("2026-05-28T12:00:00.000Z"), now)).toBe("已逾期 1 天");
    expect(formatDueDistance(new Date("2026-05-29T15:00:00.000Z"), now)).toBe("今天截止");
    expect(formatDueDistance(new Date("2026-05-30T02:00:00.000Z"), now)).toBe("明天截止");
    expect(formatDueDistance(new Date("2026-06-02T02:00:00.000Z"), now)).toBe("还有 4 天");
  });
});
